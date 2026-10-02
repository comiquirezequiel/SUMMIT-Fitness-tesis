import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, ChevronRight, ChevronLeft, User, Mail, Phone, CreditCard,
  MapPin, FileText, Check, X, KeyRound, HeartPulse, Upload, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import Campo, { inputClass } from '../components/Campo';
import { apiFetch } from '../services/api';
import { subirCertificado, validarArchivoApto } from '../services/certificados';
import { formatFecha, formatMoneda, hoyIso, diasHasta } from '../utils/formato';
import { GENEROS, OBJETIVOS, METODOS_PAGO, textoMetodoPago } from '../utils/constantes';

const STEPS = ['Datos Personales', 'Contacto y Acceso', 'Membresía y Apto', 'Confirmación'];

const FORM_INICIAL = {
  nombre: '', apellido: '', dni: '', fechaNacimiento: '', genero: '', objetivo: '',
  email: '', telefono: '', domicilio: '', ciudad: '', password: '',
  idPlan: '', monto: '', metodoPago: 'EFECTIVO', comprobante: '',
  archivoApto: null, fechaEmisionApto: '', patologias: '', observaciones: '',
};

// Contraseña inicial para la app del socio (sin caracteres que se confunden: 0/O, 1/l)
const generarPassword = () => {
  const caracteres = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const valores = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(valores, v => caracteres[v % caracteres.length]).join('');
};

// Devuelve { campo: mensaje } con los errores del paso indicado
const validarPaso = (paso, form) => {
  const e = {};
  if (paso === 0) {
    if (!form.nombre.trim()) e.nombre = 'Ingresá el nombre';
    if (!form.apellido.trim()) e.apellido = 'Ingresá el apellido';
    if (!/^\d{7,15}$/.test(form.dni)) e.dni = 'Solo números, entre 7 y 15 dígitos';
    if (form.fechaNacimiento && diasHasta(form.fechaNacimiento) >= 0) e.fechaNacimiento = 'Debe ser anterior a hoy';
  }
  if (paso === 1) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Ingresá un email válido';
    if (form.password.length < 6) e.password = 'Mínimo 6 caracteres';
  }
  if (paso === 2) {
    if (form.idPlan && !(Number(form.monto) > 0)) e.monto = 'Ingresá el monto cobrado';
    if (form.archivoApto) {
      const errorArchivo = validarArchivoApto(form.archivoApto);
      if (errorArchivo) e.archivoApto = errorArchivo;
      if (!form.fechaEmisionApto) e.fechaEmisionApto = 'Indicá la fecha de emisión';
      else if (diasHasta(form.fechaEmisionApto) > 0) e.fechaEmisionApto = 'No puede ser una fecha futura';
      else if (diasHasta(form.fechaEmisionApto) < -365) e.fechaEmisionApto = 'El certificado tiene más de 365 días: está vencido';
    }
  }
  return e;
};

const FilaResumen = ({ label, valor }) => (
  <div className="flex justify-between gap-4">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-slate-800 text-right">{valor || '—'}</span>
  </div>
);

const NuevoSocio = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(FORM_INICIAL);
  const [errores, setErrores] = useState({});
  const [planes, setPlanes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');
  const [resultado, setResultado] = useState(null); // { socio, cobro, apto }

  useEffect(() => {
    apiFetch('/planes')
      .then(res => (res.ok ? res.json() : []))
      .then(data => setPlanes(data.filter(p => p.activo)))
      .catch(() => setPlanes([]));
  }, []);

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  };

  const elegirPlan = (idPlan) => {
    const plan = planes.find(p => p.idPlan.toString() === idPlan);
    setForm(prev => ({ ...prev, idPlan, monto: plan ? plan.precioBase : '' }));
    setErrores(prev => ({ ...prev, monto: undefined }));
  };

  const siguiente = () => {
    const e = validarPaso(step, form);
    setErrores(e);
    if (Object.keys(e).length === 0) setStep(s => Math.min(s + 1, STEPS.length - 1));
  };
  const anterior = () => setStep(s => Math.max(s - 1, 0));

  const planElegido = planes.find(p => p.idPlan.toString() === form.idPlan);

  const registrar = async () => {
    setEnviando(true);
    setErrorEnvio('');
    try {
      // 1. Alta del socio con su perfil
      const resSocio = await apiFetch('/socios', {
        method: 'POST',
        body: JSON.stringify({
          dni: form.dni,
          nombreCompleto: `${form.nombre.trim()} ${form.apellido.trim()}`,
          email: form.email.trim(),
          password: form.password,
          telefono: form.telefono,
          fechaNacimiento: form.fechaNacimiento || null,
          genero: form.genero,
          domicilio: form.domicilio,
          ciudad: form.ciudad,
          objetivo: form.objetivo,
          observaciones: form.observaciones,
        }),
      });
      const datosSocio = await resSocio.json().catch(() => ({}));
      if (!resSocio.ok) {
        const detalle = datosSocio.detalles ? Object.values(datosSocio.detalles).join(' · ') : '';
        throw new Error(detalle || datosSocio.error || 'No se pudo registrar el socio');
      }

      // 2. Cobro de la membresía (opcional)
      let cobro = null;
      if (form.idPlan) {
        const resPago = await apiFetch('/pagos', {
          method: 'POST',
          body: JSON.stringify({
            idUsuario: datosSocio.idSocio,
            idPlan: form.idPlan,
            monto: form.monto,
            metodoPago: form.metodoPago,
            comprobante: form.comprobante,
          }),
        });
        const errPago = resPago.ok ? null : (await resPago.json().catch(() => ({}))).error;
        cobro = { ok: resPago.ok, error: errPago || 'No se pudo registrar el cobro' };
      }

      // 3. Certificado médico (opcional)
      let apto = null;
      if (form.archivoApto) {
        apto = await subirCertificado(datosSocio.idSocio, form.archivoApto, form.fechaEmisionApto, form.patologias);
      }

      setResultado({ socio: datosSocio, cobro, apto });
    } catch (err) {
      setErrorEnvio(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto">
      {STEPS.map((label, idx) => (
        <React.Fragment key={idx}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              idx < step ? 'bg-blue-600 border-blue-600 text-white' :
              idx === step ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' :
              'bg-white border-slate-200 text-slate-400'
            }`}>
              {idx < step ? <Check className="w-4 h-4" /> : idx + 1}
            </div>
            <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${idx === step ? 'text-blue-600' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`h-0.5 w-8 sm:w-16 mx-1 mb-4 transition-all ${idx < step ? 'bg-blue-600' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // --- Pantalla final: qué se registró y qué falta ---
  if (resultado) {
    const Item = ({ ok, texto, detalle }) => (
      <li className={`flex items-start gap-3 p-3 rounded-lg ${ok ? 'bg-emerald-50' : 'bg-amber-50'}`}>
        {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
        <div>
          <p className={`font-semibold ${ok ? 'text-emerald-800' : 'text-amber-800'}`}>{texto}</p>
          {detalle && <p className={`text-sm ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{detalle}</p>}
        </div>
      </li>
    );
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-8 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Socio registrado</h1>
          <p className="text-slate-500">{resultado.socio.nombreCompleto} · DNI {resultado.socio.dni}</p>
        </div>
        <ul className="space-y-2">
          <Item ok texto="Datos del socio guardados" detalle={`Usuario para la app: ${resultado.socio.email}`} />
          {resultado.cobro
            ? <Item ok={resultado.cobro.ok}
                    texto={resultado.cobro.ok ? `Cobro registrado: ${planElegido?.nombrePlan}` : 'El cobro no se registró'}
                    detalle={resultado.cobro.ok ? `${formatMoneda(form.monto)} · membresía activa por ${planElegido?.duracionDias} días` : `${resultado.cobro.error}. Podés cobrarlo desde la lista de socios.`} />
            : <Item ok={false} texto="Sin membresía" detalle="No se registró un cobro: el socio no podrá ingresar hasta pagar un plan." />}
          {resultado.apto
            ? <Item ok={resultado.apto.ok}
                    texto={resultado.apto.ok ? 'Certificado médico cargado' : 'El certificado no se cargó'}
                    detalle={resultado.apto.ok ? `Vence el ${formatFecha(resultado.apto.certificado.fechaVencimiento)}` : `${resultado.apto.error}. Podés cargarlo desde la ficha del socio.`} />
            : <Item ok={false} texto="Sin certificado médico" detalle="Cargalo desde la ficha del socio: sin apto vigente no puede ingresar (Ley 5397)." />}
        </ul>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate('/socios')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">
            Ver lista de socios
          </button>
          <button
            onClick={() => { setForm(FORM_INICIAL); setResultado(null); setStep(0); }}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50"
          >
            Registrar otro socio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-2 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-blue-600" /> Nuevo Socio
          </h1>
          <p className="text-sm text-slate-500">Completá los datos para registrar un nuevo socio</p>
        </div>
        <button
          onClick={() => navigate('/socios')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <X className="w-4 h-4" /> Cancelar
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 md:p-8">
        <StepIndicator />

        {/* PASO 1: Datos Personales */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-5 h-5 text-blue-500" /> Datos Personales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Campo label="Nombre" required error={errores.nombre}>
                <input type="text" placeholder="Ej: Juan" value={form.nombre}
                  onChange={e => update('nombre', e.target.value)} className={inputClass} />
              </Campo>
              <Campo label="Apellido" required error={errores.apellido}>
                <input type="text" placeholder="Ej: Pérez" value={form.apellido}
                  onChange={e => update('apellido', e.target.value)} className={inputClass} />
              </Campo>
              <Campo label="DNI" required error={errores.dni} ayuda="Sin puntos. Es el dato que se usa para ingresar al gimnasio.">
                <input type="text" inputMode="numeric" placeholder="Ej: 38456789" value={form.dni}
                  onChange={e => update('dni', e.target.value.replace(/\D/g, ''))} className={inputClass} />
              </Campo>
              <Campo label="Fecha de Nacimiento" error={errores.fechaNacimiento}>
                <input type="date" value={form.fechaNacimiento} max={hoyIso()}
                  onChange={e => update('fechaNacimiento', e.target.value)} className={inputClass} />
              </Campo>
              <Campo label="Género">
                <select value={form.genero} onChange={e => update('genero', e.target.value)} className={inputClass}>
                  <option value="">Seleccionar...</option>
                  {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Campo>
              <Campo label="Objetivo">
                <select value={form.objetivo} onChange={e => update('objetivo', e.target.value)} className={inputClass}>
                  <option value="">Seleccionar...</option>
                  {OBJETIVOS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Campo>
            </div>
          </div>
        )}

        {/* PASO 2: Contacto y acceso */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Mail className="w-5 h-5 text-blue-500" /> Contacto y Acceso
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Campo label="Email" required error={errores.email}>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-300 absolute left-3 top-3" />
                  <input type="email" placeholder="correo@ejemplo.com" value={form.email}
                    onChange={e => update('email', e.target.value)} className={`${inputClass} pl-9`} />
                </div>
              </Campo>
              <Campo label="Teléfono">
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-300 absolute left-3 top-3" />
                  <input type="tel" placeholder="+54 9 11 1234 5678" value={form.telefono}
                    onChange={e => update('telefono', e.target.value)} className={`${inputClass} pl-9`} />
                </div>
              </Campo>
              <Campo label="Domicilio">
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-300 absolute left-3 top-3" />
                  <input type="text" placeholder="Av. Siempreviva 742" value={form.domicilio}
                    onChange={e => update('domicilio', e.target.value)} className={`${inputClass} pl-9`} />
                </div>
              </Campo>
              <Campo label="Ciudad">
                <input type="text" placeholder="Corrientes" value={form.ciudad}
                  onChange={e => update('ciudad', e.target.value)} className={inputClass} />
              </Campo>
              <Campo label="Contraseña inicial (app del socio)" required error={errores.password}
                     ayuda="Entregásela al socio: con su email y esta contraseña entra a la app."
                     className="md:col-span-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-slate-300 absolute left-3 top-3" />
                    <input type="text" value={form.password} placeholder="Mínimo 6 caracteres"
                      onChange={e => update('password', e.target.value)} className={`${inputClass} pl-9 font-mono`} />
                  </div>
                  <button type="button" onClick={() => update('password', generarPassword())}
                    className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                    Generar
                  </button>
                </div>
              </Campo>
            </div>
          </div>
        )}

        {/* PASO 3: Membresía y apto médico */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                <CreditCard className="w-5 h-5 text-blue-500" /> Membresía y Pago
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Campo label="Plan" ayuda="Podés dejarlo sin plan y cobrarlo después desde la lista de socios.">
                  <select value={form.idPlan} onChange={e => elegirPlan(e.target.value)} className={inputClass}>
                    <option value="">Sin plan por ahora</option>
                    {planes.map(p => (
                      <option key={p.idPlan} value={p.idPlan}>
                        {p.nombrePlan} — {formatMoneda(p.precioBase)}{p.vecesPorSemana ? ` (${p.vecesPorSemana}x semana)` : ' (libre)'}
                      </option>
                    ))}
                  </select>
                </Campo>
                {form.idPlan && (
                  <>
                    <Campo label="Monto cobrado ($)" required error={errores.monto}>
                      <input type="number" min="0" step="0.01" value={form.monto}
                        onChange={e => update('monto', e.target.value)} className={inputClass} />
                    </Campo>
                    <Campo label="Método de Pago" required>
                      <select value={form.metodoPago} onChange={e => update('metodoPago', e.target.value)} className={inputClass}>
                        {METODOS_PAGO.map(m => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
                      </select>
                    </Campo>
                    <Campo label="Nro. de comprobante">
                      <input type="text" value={form.comprobante} placeholder="Opcional"
                        onChange={e => update('comprobante', e.target.value)} className={inputClass} />
                    </Campo>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                <HeartPulse className="w-5 h-5 text-blue-500" /> Certificado Médico (Apto Físico)
              </h2>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                Sin un apto médico vigente (menos de 365 días) el socio no puede ingresar (Ley 5397).
                Si todavía no lo trajo, podés cargarlo después desde su ficha.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Campo label="Archivo (PDF o imagen, máx. 5 MB)" error={errores.archivoApto} className="md:col-span-2">
                  <label className="flex items-center gap-3 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600 truncate">
                      {form.archivoApto ? form.archivoApto.name : 'Seleccionar archivo...'}
                    </span>
                    <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden"
                      onChange={e => update('archivoApto', e.target.files[0] || null)} />
                  </label>
                </Campo>
                {form.archivoApto && (
                  <>
                    <Campo label="Fecha de emisión" required error={errores.fechaEmisionApto}>
                      <input type="date" value={form.fechaEmisionApto} max={hoyIso()}
                        onChange={e => update('fechaEmisionApto', e.target.value)} className={inputClass} />
                    </Campo>
                    <Campo label="Patologías / lesiones" ayuda="Separadas por coma (ej: hernia de disco, asma). Se usan en el constructor de rutinas.">
                      <input type="text" value={form.patologias} placeholder="Ninguna"
                        onChange={e => update('patologias', e.target.value)} className={inputClass} />
                    </Campo>
                  </>
                )}
              </div>
              <Campo label="Observaciones">
                <textarea rows={3} placeholder="Notas para recepción (horarios, preferencias...)"
                  value={form.observaciones} onChange={e => update('observaciones', e.target.value)}
                  className={`${inputClass} resize-none`} />
              </Campo>
            </div>
          </div>
        )}

        {/* PASO 4: Confirmación */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-5 h-5 text-blue-500" /> Resumen del Registro
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-2">Datos Personales</h3>
                <FilaResumen label="Nombre completo" valor={`${form.nombre} ${form.apellido}`} />
                <FilaResumen label="DNI" valor={form.dni} />
                <FilaResumen label="Fecha de nac." valor={form.fechaNacimiento && formatFecha(form.fechaNacimiento)} />
                <FilaResumen label="Género" valor={form.genero} />
                <FilaResumen label="Objetivo" valor={form.objetivo} />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-2">Contacto</h3>
                <FilaResumen label="Email" valor={form.email} />
                <FilaResumen label="Teléfono" valor={form.telefono} />
                <FilaResumen label="Domicilio" valor={[form.domicilio, form.ciudad].filter(Boolean).join(', ')} />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2 md:col-span-2">
                <h3 className="font-semibold text-blue-700 text-sm uppercase tracking-wide mb-2">Membresía y Apto</h3>
                <FilaResumen label="Plan" valor={planElegido ? planElegido.nombrePlan : 'Sin plan por ahora'} />
                {planElegido && <FilaResumen label="Cobro" valor={`${formatMoneda(form.monto)} · ${textoMetodoPago(form.metodoPago)}`} />}
                <FilaResumen label="Certificado médico" valor={form.archivoApto ? `${form.archivoApto.name} (emitido ${formatFecha(form.fechaEmisionApto)})` : 'Pendiente'} />
                {form.patologias && <FilaResumen label="Patologías" valor={form.patologias} />}
              </div>
            </div>

            {errorEnvio && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">
                <XCircle className="w-5 h-5 shrink-0" /> {errorEnvio}
              </div>
            )}
          </div>
        )}

        {/* Navegación */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={anterior}
            disabled={step === 0 || enviando}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={siguiente}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={registrar}
              disabled={enviando}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" /> {enviando ? 'Registrando...' : 'Registrar Socio'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NuevoSocio;

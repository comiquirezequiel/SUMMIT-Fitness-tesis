import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, ChevronRight, ChevronLeft, User, Mail, Phone, Wallet,
  MapPin, Check, X, HeartPulse, Upload, CheckCircle2, XCircle, AlertTriangle, Camera, Trash2
} from 'lucide-react';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../components/Campo';
import CapturaFoto from '../components/socios/CapturaFoto';
import DetalleCobro from '../components/socios/DetalleCobro';
import CobroModal from '../components/socios/CobroModal';
import ComprobantePago from '../components/socios/ComprobantePago';
import { SelectorPlan, SelectorMetodo, OpcionAVerificar } from '../components/socios/OpcionesCobro';
import { listarDescuentos, registrarCobro, textoValorDescuento, usePresupuesto } from '../services/membresias';
import { subirFotoSocio } from '../services/fotos';
import { useEstadoIa, BotonIa, ResultadoAnalisis, AvisoIaNoDisponible } from '../components/ia/AsistenteIa';
import { apiFetch } from '../services/api';
import { subirCertificado, validarArchivoApto } from '../services/certificados';
import { analizarArchivo } from '../services/ia';
import { formatFecha, formatMoneda, hoyIso, diasHasta } from '../utils/formato';
import { GENEROS, OBJETIVOS, METODOS_VERIFICABLES } from '../utils/constantes';

// El cobro va último: su botón registra al socio y le cobra de una vez
const STEPS = ['Datos Personales', 'Contacto y Acceso', 'Apto Médico', 'Cobro'];

const FORM_INICIAL = {
  nombre: '', apellido: '', dni: '', fechaNacimiento: '', genero: '', objetivo: '',
  email: '', telefono: '', domicilio: '', ciudad: '',
  // sinCobro: "todavía no paga" (se registra sin plan); si no, hay que elegir uno
  idPlan: '', sinCobro: false, idDescuento: '', bonificarMatricula: false, metodoPago: 'EFECTIVO', comprobante: '', aVerificar: false,
  archivoApto: null, fechaEmisionApto: '', patologias: '', resumenIa: '', observaciones: '',
  foto: null, // JPG cuadrado de CapturaFoto: se sube después de crear al socio
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
  }
  if (paso === 2) {
    if (form.archivoApto) {
      const errorArchivo = validarArchivoApto(form.archivoApto);
      if (errorArchivo) e.archivoApto = errorArchivo;
      if (!form.fechaEmisionApto) e.fechaEmisionApto = 'Indicá la fecha de emisión';
      else if (diasHasta(form.fechaEmisionApto) > 0) e.fechaEmisionApto = 'No puede ser una fecha futura';
      else if (diasHasta(form.fechaEmisionApto) < -365) e.fechaEmisionApto = 'El certificado tiene más de 365 días: está vencido';
    }
  }
  if (paso === 3) {
    if (!form.idPlan && !form.sinCobro) e.idPlan = 'Elegí el plan que paga, o marcá que todavía no paga';
  }
  return e;
};

const NuevoSocio = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(FORM_INICIAL);
  const [errores, setErrores] = useState({});
  const [planes, setPlanes] = useState([]);
  const [descuentos, setDescuentos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');
  const [resultado, setResultado] = useState(null); // { socio, cobro, apto, foto }
  const [cobrando, setCobrando] = useState(false); // "Cobrar ahora" en la pantalla final (si no se cobró en el alta)
  // Asistente de IA: lee el certificado elegido y propone fecha, patologías y un resumen
  // estadoIa: si Ollama está disponible (habilita el botón); analisisIa: la lectura recibida (null = sin lectura);
  // analizandoIa: consulta en curso (cronómetro); errorIa: mensaje si falló (ej. "Ollama no está corriendo").
  const estadoIa = useEstadoIa();
  const [analisisIa, setAnalisisIa] = useState(null);
  const [analizandoIa, setAnalizandoIa] = useState(false);
  const [errorIa, setErrorIa] = useState('');
  const [sacandoFoto, setSacandoFoto] = useState(false);
  const [urlFoto, setUrlFoto] = useState(null);

  // Vista previa de la foto sacada (la dirección blob: se libera al cambiarla)
  useEffect(() => {
    if (!form.foto) {
      setUrlFoto(null);
      return undefined;
    }
    const url = URL.createObjectURL(form.foto);
    setUrlFoto(url);
    return () => URL.revokeObjectURL(url);
  }, [form.foto]);

  useEffect(() => {
    apiFetch('/planes')
      .then(res => (res.ok ? res.json() : []))
      .then(data => setPlanes(data.filter(p => p.activo)))
      .catch(() => setPlanes([]));
    listarDescuentos(true).then(setDescuentos).catch(() => setDescuentos([]));
  }, []);

  // Total del primer cobro (plan - descuento habitual + matrícula), calculado por el backend como para un socio nuevo
  const { presupuesto, calculando, error: errorPresupuesto } = usePresupuesto(form.idPlan ? {
    idPlan: Number(form.idPlan),
    idDescuento: form.idDescuento ? Number(form.idDescuento) : null,
    bonificarMatricula: form.bonificarMatricula,
  } : null);

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  };

  // Otro archivo: lo que la IA leyó del anterior ya no vale
  const elegirArchivoApto = (archivo) => {
    update('archivoApto', archivo);
    update('resumenIa', '');
    setAnalisisIa(null);
    setErrorIa('');
  };

  // Envía el archivo elegido + el DNI cargado en el paso 1 (para detectar un certificado de otra persona).
  // No guarda nada: solo muestra la lectura para revisarla.
  const leerCertificadoConIa = async () => {
    setErrorIa('');
    setAnalisisIa(null);
    setAnalizandoIa(true);
    const r = await analizarArchivo(form.archivoApto, form.dni);
    setAnalizandoIa(false);
    if (r.ok) setAnalisisIa(r.datos);
    else setErrorIa(r.error);
  };

  // "Usar estos datos": copia la lectura al formulario (fecha, patologías listas para la regla del Constructor
  // y resumen). El usuario todavía puede corregir los campos; todo se guarda recién al registrar el socio.
  const usarAnalisisIa = () => {
    if (analisisIa.fechaEmision) update('fechaEmisionApto', analisisIa.fechaEmision);
    update('patologias', analisisIa.observacionesSugeridas || '');
    update('resumenIa', analisisIa.resumen || '');
    setAnalisisIa(null);
  };

  const siguiente = () => {
    const e = validarPaso(step, form);
    setErrores(e);
    if (Object.keys(e).length === 0) setStep(s => Math.min(s + 1, STEPS.length - 1));
  };
  const anterior = () => setStep(s => Math.max(s - 1, 0));

  // Un plan o "todavía no paga": una cosa o la otra
  const elegirPlan = (idPlan) => { update('idPlan', idPlan); update('sinCobro', false); };
  const elegirSinCobro = (sinCobro) => { update('sinCobro', sinCobro); if (sinCobro) update('idPlan', ''); };
  // En efectivo no hay comprobante que anotar, y solo una transferencia o un QR pueden quedar a verificar
  const elegirMetodo = (metodoPago) => setForm(prev => ({
    ...prev, metodoPago, aVerificar: false, comprobante: metodoPago === 'EFECTIVO' ? '' : prev.comprobante,
  }));
  const cobroListo = Boolean(form.idPlan && presupuesto && !calculando && !errorPresupuesto);

  const registrar = async () => {
    const e = validarPaso(3, form);
    // Con plan, se registra cuando el total del cobro ya está calculado (y sin errores)
    if (form.idPlan && !cobroListo) e.idPlan = errorPresupuesto || 'Esperá a que se calcule el total';
    setErrores(e);
    if (Object.keys(e).length > 0) return;
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
          telefono: form.telefono,
          fechaNacimiento: form.fechaNacimiento || null,
          genero: form.genero,
          domicilio: form.domicilio,
          ciudad: form.ciudad,
          objetivo: form.objetivo,
          observaciones: form.observaciones,
          idDescuento: form.idDescuento ? Number(form.idDescuento) : null,
        }),
      });
      const datosSocio = await resSocio.json().catch(() => ({}));
      if (!resSocio.ok) {
        const detalle = datosSocio.detalles ? Object.values(datosSocio.detalles).join(' · ') : '';
        throw new Error(detalle || datosSocio.error || 'No se pudo registrar el socio');
      }

      // 2. Cobro de la membresía (opcional), con el total que se mostró
      let cobro = null;
      if (form.idPlan) {
        try {
          const pago = await registrarCobro({
            idUsuario: datosSocio.idSocio,
            idPlan: Number(form.idPlan),
            idDescuento: form.idDescuento ? Number(form.idDescuento) : null,
            bonificarMatricula: form.bonificarMatricula,
            metodoPago: form.metodoPago,
            comprobante: form.comprobante,
            aVerificar: form.aVerificar,
            totalMostrado: presupuesto?.total,
          });
          cobro = { ok: true, pago };
        } catch (err) {
          cobro = { ok: false, error: err.message };
        }
      }

      // 3. Certificado médico (opcional)
      let apto = null;
      if (form.archivoApto) {
        apto = await subirCertificado(datosSocio.idSocio, form.archivoApto, form.fechaEmisionApto, form.patologias, form.resumenIa);
      }

      // 4. Foto (opcional)
      let foto = null;
      if (form.foto) {
        foto = await subirFotoSocio(datosSocio.idSocio, form.foto);
      }

      setResultado({ socio: datosSocio, cobro, apto, foto });
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
    const Item = ({ ok, texto, detalle, accion }) => (
      <li className={`flex items-start gap-3 p-3 rounded-lg ${ok ? 'bg-emerald-50' : 'bg-amber-50'}`}>
        {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
        <div>
          <p className={`font-semibold ${ok ? 'text-emerald-800' : 'text-amber-800'}`}>{texto}</p>
          {detalle && <p className={`text-sm ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{detalle}</p>}
          {accion && <div className="mt-2">{accion}</div>}
        </div>
      </li>
    );
    const { cobro } = resultado;
    const aVerificar = cobro?.ok && cobro.pago.estado === 'PENDIENTE';
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
          <Item ok texto="Datos del socio guardados" detalle={resultado.socio.email} />
          {cobro?.ok
            ? <Item ok={!aVerificar}
                    texto={`${aVerificar ? 'Cobro a verificar' : 'Cobro registrado'}: ${cobro.pago.plan}`}
                    detalle={aVerificar
                      ? `${formatMoneda(cobro.pago.monto)} · la membresía empieza cuando un administrador confirme el pago en Caja.`
                      : `${formatMoneda(cobro.pago.monto)} · membresía paga hasta el ${formatFecha(cobro.pago.venceMembresia)}`} />
            : <Item ok={false} texto={cobro ? 'El cobro no se registró' : 'Sin cobrar'}
                    detalle={cobro ? cobro.error : 'Sin un plan pago no puede ingresar.'}
                    accion={<button type="button" onClick={() => setCobrando(true)} className={`${botonPrimario} inline-flex`}>
                      <Wallet className="w-4 h-4" /> Cobrar ahora
                    </button>} />}
          {resultado.apto
            ? <Item ok={resultado.apto.ok}
                    texto={resultado.apto.ok ? 'Certificado médico cargado' : 'El certificado no se cargó'}
                    detalle={resultado.apto.ok ? `Vence el ${formatFecha(resultado.apto.certificado.fechaVencimiento)}` : `${resultado.apto.error}. Podés cargarlo desde la ficha del socio.`} />
            : <Item ok={false} texto="Sin certificado médico" detalle="Cargalo desde la ficha del socio: sin apto vigente no puede ingresar (Ley 5397)." />}
          {resultado.foto
            ? <Item ok={resultado.foto.ok}
                    texto={resultado.foto.ok ? 'Foto guardada' : 'La foto no se guardó'}
                    detalle={resultado.foto.ok ? 'Recepción la va a ver en cada ingreso.' : `${resultado.foto.error}. Podés sacarla desde la ficha del socio.`} />
            : <Item ok={false} texto="Sin foto" detalle="Sacala desde la ficha del socio: recepción la ve en cada ingreso." />}
        </ul>
        {cobro?.ok && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-slate-700">Comprobante para el socio</h2>
            <ComprobantePago pago={cobro.pago} />
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate('/socios')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">
            Ver lista de socios
          </button>
          <button
            onClick={() => { setForm(FORM_INICIAL); setErrores({}); setResultado(null); setStep(0); }}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50"
          >
            Registrar otro socio
          </button>
        </div>
        {cobrando && (
          // Se propone el plan que se había elegido en el alta
          <CobroModal socio={{ ...resultado.socio, idPlanActual: form.idPlan ? Number(form.idPlan) : null }} planes={planes}
            onClose={() => setCobrando(false)}
            onGuardado={(pago) => { setCobrando(false); setResultado(r => ({ ...r, cobro: { ok: true, pago } })); }} />
        )}
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
            {/* Foto (opcional): recepción la ve en cada ingreso */}
            <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
                {urlFoto
                  ? <img src={urlFoto} alt="Foto del socio" className="w-full h-full object-cover" />
                  : <Camera className="w-7 h-7 text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">Foto <span className="font-normal text-slate-400">(opcional)</span></p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Para que recepción lo reconozca en cada ingreso. Se puede sacar después desde la ficha.
                </p>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setSacandoFoto(true)}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> {form.foto ? 'Sacar otra' : 'Sacar foto'}
                  </button>
                  {form.foto && (
                    <button type="button" onClick={() => update('foto', null)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-white flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" /> Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
            {sacandoFoto && (
              <CapturaFoto nombre={`${form.nombre} ${form.apellido}`.trim()}
                onListo={(foto) => { update('foto', foto); setSacandoFoto(false); }}
                onCerrar={() => setSacandoFoto(false)} />
            )}
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
              <Campo label="Observaciones" className="md:col-span-2">
                <textarea rows={3} placeholder="Notas para recepción (horarios, preferencias...)"
                  value={form.observaciones} onChange={e => update('observaciones', e.target.value)}
                  className={`${inputClass} resize-none`} />
              </Campo>
            </div>
          </div>
        )}

        {/* PASO 3: Apto médico */}
        {step === 2 && (
          <div className="space-y-6">
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
                      onChange={e => elegirArchivoApto(e.target.files[0] || null)} />
                  </label>
                </Campo>
                {form.archivoApto && (
                  <div className="md:col-span-2 space-y-2">
                    <BotonIa estado={estadoIa} cargando={analizandoIa} onClick={leerCertificadoConIa}>
                      Leer el certificado con IA
                    </BotonIa>
                    <AvisoIaNoDisponible estado={estadoIa} />
                    {errorIa && <p className="text-sm text-rose-600">{errorIa}</p>}
                    {analisisIa && (
                      <ResultadoAnalisis analisis={analisisIa} acciones={<>
                        <button type="button" onClick={() => setAnalisisIa(null)} className={botonSecundario}>Descartar</button>
                        <button type="button" onClick={usarAnalisisIa} className={botonPrimario}>Usar estos datos</button>
                      </>} />
                    )}
                    {form.resumenIa && !analisisIa && (
                      <p className="text-xs text-violet-700">Se va a guardar el resumen de la IA junto con el certificado: {form.resumenIa}</p>
                    )}
                  </div>
                )}
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
            </div>
          </div>
        )}

        {/* PASO 4: Cobro. Su botón (abajo) registra al socio y le cobra de una vez */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Wallet className="w-5 h-5 text-blue-500" /> Cobro de la membresía
            </h2>

            {/* Quién es, para revisarlo antes de registrar */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-blue-100 flex items-center justify-center shrink-0">
                {urlFoto ? <img src={urlFoto} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-blue-400" />}
              </div>
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-slate-800 truncate">{form.nombre} {form.apellido}</p>
                <p className="text-xs text-slate-500">DNI {form.dni} · {form.archivoApto ? 'con apto médico' : 'apto médico pendiente'}</p>
                <p className="text-xs text-slate-500 truncate">{form.email}</p>
              </div>
            </div>

            <Campo label="¿Qué plan paga?" required error={errores.idPlan}>
              <SelectorPlan planes={planes} valor={form.idPlan} onCambiar={elegirPlan} />
              <label className={`mt-2 flex items-start gap-3 p-3 rounded-xl border border-dashed cursor-pointer transition-colors ${form.sinCobro ? 'border-amber-300 bg-amber-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                <input type="checkbox" checked={form.sinCobro} onChange={e => elegirSinCobro(e.target.checked)} className="mt-0.5 w-4 h-4 accent-amber-600" />
                <span className="text-sm">
                  <span className="font-semibold text-slate-800">Todavía no paga: registrarlo sin cobrar</span>
                  <span className="block text-xs text-slate-500 mt-0.5">No va a poder ingresar hasta pagar un plan. Se le cobra después desde la lista de socios.</span>
                </span>
              </label>
            </Campo>

            <Campo label="Descuento habitual" ayuda="Se le propone en cada cobro. Los descuentos los arma el dueño en Membresías > Descuentos y reglas.">
              <select value={form.idDescuento} onChange={e => update('idDescuento', e.target.value)} className={inputClass}>
                <option value="">Sin descuento</option>
                {descuentos.map(d => (
                  <option key={d.idDescuento} value={d.idDescuento}>{d.nombre} ({textoValorDescuento(d)})</option>
                ))}
              </select>
            </Campo>

            {form.idPlan && (
              <>
                <DetalleCobro presupuesto={presupuesto} calculando={calculando} error={errorPresupuesto}
                  bonificarMatricula={form.bonificarMatricula} onBonificarMatricula={v => update('bonificarMatricula', v)} />
                <Campo label="¿Cómo paga?" required>
                  <SelectorMetodo valor={form.metodoPago} onCambiar={elegirMetodo} />
                </Campo>
                {form.metodoPago !== 'EFECTIVO' && (
                  <Campo label="Nro. de comprobante">
                    <input type="text" maxLength={50} value={form.comprobante} placeholder={form.aVerificar ? 'Recomendado para verificarlo después' : 'Opcional'}
                      onChange={e => update('comprobante', e.target.value)} className={inputClass} />
                  </Campo>
                )}
                {METODOS_VERIFICABLES.includes(form.metodoPago) && (
                  <OpcionAVerificar marcada={form.aVerificar} onCambiar={v => update('aVerificar', v)} />
                )}
              </>
            )}

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
              disabled={enviando || (Boolean(form.idPlan) && !cobroListo)}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" />
              {enviando ? 'Registrando...'
                : form.sinCobro ? 'Registrar sin cobrar'
                  : cobroListo ? `Registrar y cobrar ${formatMoneda(presupuesto.total)}` : 'Registrar y cobrar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NuevoSocio;

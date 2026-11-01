import { useEffect, useState } from 'react';
import { Save, Receipt, ShieldCheck, PlugZap, CheckCircle, XCircle, AlertTriangle, FlaskConical } from 'lucide-react';
import Campo, { inputClass, botonPrimario } from '../components/Campo';
import Encabezado from '../components/Encabezado';
import {
  obtenerEstadoFacturacion, obtenerDatosFiscales, guardarDatosFiscales, probarConexion, actualizarAvisoFacturacion,
  cuitConGuiones, AMBIENTES, CONDICIONES_IVA,
} from '../services/facturacion';
import { formatFecha } from '../utils/formato';

const VACIOS = {
  cuit: '', razonSocial: '', condicionIva: '', ingresosBrutos: '', inicioActividades: '', domicilioComercial: '',
  puntoVenta: '', identificarSocio: false,
};

const Tarjeta = ({ icon: Icon, color, titulo, children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs ${className}`}>
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
      <div className={`p-1.5 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
      <h2 className="text-sm font-bold text-slate-800">{titulo}</h2>
    </div>
    {children}
  </div>
);

const Fila = ({ etiqueta, children }) => (
  <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-1 border-b border-slate-100 last:border-0 text-xs">
    <span className="text-slate-500">{etiqueta}</span>
    <span className="font-medium text-slate-800 text-right">{children}</span>
  </div>
);

/**
 * Facturación (pestaña de Configuración y reglas, solo admin y con la factura electrónica prendida): los datos
 * fiscales del dueño (salen en cada factura), en qué ambiente se factura, el certificado de ARCA y la prueba de conexión.
 */
const AjustesFacturacion = () => {
  const [estado, setEstado] = useState(null);
  const [datos, setDatos] = useState(VACIOS);
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const [probando, setProbando] = useState(false);

  const cargarEstado = async () => {
    try {
      setEstado(await obtenerEstadoFacturacion());
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    }
  };

  useEffect(() => {
    cargarEstado();
    obtenerDatosFiscales()
      .then((d) => setDatos({ ...VACIOS, ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v ?? VACIOS[k]])) }))
      .catch((e) => setMensaje({ tipo: 'error', texto: e.message }));
  }, []);

  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      const guardados = await guardarDatosFiscales({ ...datos, puntoVenta: datos.puntoVenta === '' ? null : Number(datos.puntoVenta) });
      setDatos({ ...VACIOS, ...guardados });
      setMensaje({ tipo: 'ok', texto: 'Datos fiscales guardados. Las facturas que esperaban se mandan ahora.' });
      cargarEstado();
      actualizarAvisoFacturacion();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const probar = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      setPrueba(await probarConexion());
      cargarEstado();
    } catch (e) {
      setPrueba({ ok: false, pasos: [{ nombre: 'Conexión', ok: false, detalle: e.message }] });
    } finally {
      setProbando(false);
    }
  };

  const ambiente = estado?.ambiente ? AMBIENTES[estado.ambiente] : null;

  return (
    <div className="space-y-3">
      <Encabezado titulo="Factura electrónica" icono={Receipt}
        subtitulo="Cada cobro aprobado sale con su factura de ARCA: acá se cargan los datos del dueño del gimnasio" />

      {mensaje && (
        <div className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {mensaje.tipo === 'ok' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {mensaje.texto}
        </div>
      )}

      {/* Los datos fiscales a la izquierda; el estado de la conexión y la prueba, al costado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        <Tarjeta icon={Receipt} color="bg-blue-50 text-blue-600" titulo="Datos fiscales" className="lg:col-span-2">
          <form onSubmit={guardar} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo label="CUIT" required ayuda="11 números, con o sin guiones">
                <input className={inputClass} value={datos.cuit} onChange={(e) => cambiar('cuit', e.target.value)}
                  inputMode="numeric" placeholder="20-12345678-6" maxLength={13} />
              </Campo>
              <Campo label="Razón social o nombre del dueño" required ayuda="Como figura en ARCA">
                <input className={inputClass} value={datos.razonSocial} maxLength={100} onChange={(e) => cambiar('razonSocial', e.target.value)} />
              </Campo>
            </div>

            <Campo label="Condición frente al IVA" required>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CONDICIONES_IVA.map((c) => (
                  <label key={c.valor}
                    className={`px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${datos.condicionIva === c.valor ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-100' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="condicionIva" value={c.valor} checked={datos.condicionIva === c.valor}
                      onChange={() => cambiar('condicionIva', c.valor)} className="sr-only" />
                    <span className="block text-sm font-semibold text-slate-800">{c.texto}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{c.detalle}</span>
                  </label>
                ))}
              </div>
            </Campo>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Campo label="Ingresos Brutos" required ayuda='El número, o "Exento"'>
                <input className={inputClass} value={datos.ingresosBrutos} maxLength={30} onChange={(e) => cambiar('ingresosBrutos', e.target.value)} />
              </Campo>
              <Campo label="Inicio de actividades" required>
                <input type="date" className={inputClass} value={datos.inicioActividades} onChange={(e) => cambiar('inicioActividades', e.target.value)} />
              </Campo>
              <Campo label="Punto de venta" required ayuda="El de web services dado de alta en ARCA">
                <input type="number" min="1" max="99998" className={inputClass} value={datos.puntoVenta}
                  onChange={(e) => cambiar('puntoVenta', e.target.value)} />
              </Campo>
            </div>

            <Campo label="Domicilio comercial" required ayuda="El del local, como está declarado en ARCA">
              <input className={inputClass} value={datos.domicilioComercial} maxLength={150} onChange={(e) => cambiar('domicilioComercial', e.target.value)} />
            </Campo>

            <label className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg bg-slate-50 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={datos.identificarSocio} onChange={(e) => cambiar('identificarSocio', e.target.checked)} className="w-4 h-4 mt-0.5" />
              <span>
                <span className="font-semibold">Facturar a nombre del socio, con su DNI.</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Si no, la factura sale "a consumidor final" (las cuotas están muy por debajo del monto desde el que ARCA exige
                  identificarlo). Una factura ya emitida se puede rehacer con el DNI desde Caja &gt; Facturas.
                </span>
              </span>
            </label>

            <div className="flex justify-end">
              <button type="submit" disabled={guardando} className={botonPrimario}>
                <Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar datos fiscales'}
              </button>
            </div>
          </form>
        </Tarjeta>

        <div className="space-y-3">
          {estado && (
            <Tarjeta icon={ShieldCheck} color="bg-emerald-50 text-emerald-700" titulo="Conexión con ARCA">
              {ambiente && !estado.deVerdad && (
                <p className="mb-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <FlaskConical className="w-3.5 h-3.5 shrink-0 mt-px" /> {ambiente.detalle}
                </p>
              )}
              <Fila etiqueta="Ambiente">{ambiente?.texto || '—'}</Fila>
              <Fila etiqueta="Certificado">
                {estado.certificadoDeMentira ? 'El del simulador (no sirve contra ARCA)'
                  : estado.certificadoCargado ? `CUIT ${cuitConGuiones(estado.certificadoCuit) || '?'} · vence el ${formatFecha(estado.certificadoVence)}`
                    : <span className="text-rose-700">{estado.certificadoError || 'No está cargado'}</span>}
              </Fila>
              <Fila etiqueta="Facturas esperando">{estado.pendientes + estado.inciertos}</Fila>
              <Fila etiqueta="Rechazadas">{estado.rechazados}</Fila>
              {estado.advertencias.map((a) => (
                <p key={a} className="mt-2 px-2.5 py-2 rounded-lg bg-amber-50 text-amber-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {a}
                </p>
              ))}
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                El ambiente y el certificado se configuran en el servidor (ARCA_AMBIENTE y ARCA_CERTIFICADO, en la configuración
                privada del backend). FACTURACION.md explica cómo sacar el certificado de ARCA.
              </p>
            </Tarjeta>
          )}

          <Tarjeta icon={PlugZap} color="bg-violet-50 text-violet-600" titulo="Probar conexión">
            <p className="text-xs text-slate-600 mb-2.5">
              Revisa los servidores de ARCA, el certificado, los datos fiscales, el punto de venta y la numeración. Si todo anda,
              manda enseguida las facturas que estaban esperando.
            </p>
            <button onClick={probar} disabled={probando} className={botonPrimario}>
              <PlugZap className="w-4 h-4" /> {probando ? 'Probando…' : 'Probar conexión'}
            </button>
            {prueba && (
              <ul className="mt-2.5 space-y-1.5">
                {prueba.pasos.map((p) => (
                  <li key={p.nombre} className="flex items-start gap-1.5 text-xs">
                    {p.ok ? <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-700 shrink-0" />}
                    <span><span className="font-semibold text-slate-800">{p.nombre}:</span> <span className="text-slate-600">{p.detalle}</span></span>
                  </li>
                ))}
                {prueba.ok && <li className="text-xs font-semibold text-emerald-700 pt-1">Todo listo para facturar.</li>}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>
    </div>
  );
};

export default AjustesFacturacion;

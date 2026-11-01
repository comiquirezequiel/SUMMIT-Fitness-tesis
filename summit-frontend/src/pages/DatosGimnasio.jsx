import { useEffect, useRef, useState } from 'react';
import { Save, Building2, CheckCircle, AlertTriangle, Image as ImageIcon, Upload, Trash2, Clock } from 'lucide-react';
import { apiFetch } from '../services/api';
import { DIAS_SEMANA } from '../utils/constantes';

const claseCampo = 'w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800 placeholder:text-slate-300 placeholder:font-normal';

const Tarjeta = ({ icono: Icono, titulo, children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] ${className}`}>
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
      <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Icono className="w-5 h-5" /></div>
      <h2 className="text-base font-bold text-slate-800">{titulo}</h2>
    </div>
    {children}
  </div>
);

const Campo = ({ etiqueta, ayuda, children }) => (
  <label className="block">
    <span className="block text-sm font-semibold text-slate-700 mb-1.5">{etiqueta}</span>
    {children}
    {ayuda && <span className="block text-xs text-slate-500 mt-1">{ayuda}</span>}
  </label>
);

/**
 * Logo del gimnasio: sale en el encabezado de los PDF (comprobantes de pago y rutinas). Se sube aparte de los demás
 * datos: el backend lo achica y lo guarda como PNG (con su transparencia).
 */
const LogoGimnasio = ({ logoUrl, onCambio }) => {
  const [imagen, setImagen] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const entrada = useRef(null);

  // El logo se pide con la sesión (no alcanza con poner la dirección en un <img>)
  useEffect(() => {
    if (!logoUrl) {
      setImagen(null);
      return undefined;
    }
    let url = null;
    apiFetch(logoUrl.replace(/^\/api/, ''))
      .then(async (res) => {
        if (!res.ok) return;
        url = URL.createObjectURL(await res.blob());
        setImagen(url);
      })
      .catch(() => setImagen(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [logoUrl]);

  const enviar = async (pedido) => {
    setProcesando(true);
    setError('');
    try {
      const res = await pedido();
      const cuerpo = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error('Solo un administrador puede cambiar el logo.');
      if (!res.ok) throw new Error(cuerpo.error || 'No se pudo guardar el logo.');
      onCambio(cuerpo);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const subir = (archivo) => {
    if (!archivo) return;
    if (archivo.size > 5 * 1024 * 1024) {
      setError('El logo pesa más de 5 MB: probá con uno más liviano.');
      return;
    }
    const formulario = new FormData();
    formulario.append('logo', archivo);
    enviar(() => apiFetch('/configuracion/gimnasio/logo', { method: 'POST', body: formulario }));
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="w-28 h-28 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
        {imagen ? <img src={imagen} alt="Logo del gimnasio" className="max-w-full max-h-full object-contain" />
          : <ImageIcon className="w-8 h-8 text-slate-300" />}
      </div>
      <div className="space-y-2">
        <p className="text-sm text-slate-600">Sale en el encabezado de los comprobantes de pago y de las rutinas en PDF. PNG o JPG; mejor con fondo transparente.</p>
        <div className="flex flex-wrap gap-2">
          <input ref={entrada} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
          <button type="button" onClick={() => entrada.current?.click()} disabled={procesando}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white flex items-center gap-2">
            <Upload className="w-4 h-4" /> {procesando ? 'Guardando...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
          </button>
          {logoUrl && (
            <button type="button" disabled={procesando}
              onClick={() => window.confirm('¿Quitar el logo? Los PDF salen sin logo.') && enviar(() => apiFetch('/configuracion/gimnasio/logo', { method: 'DELETE' }))}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Quitar
            </button>
          )}
        </div>
        {error && <p className="text-sm text-rose-700 font-medium">{error}</p>}
      </div>
    </div>
  );
};

/**
 * Horario de cada día de la semana. Un día cerrado no cuenta en las métricas (no es que no vino nadie: no se podía venir).
 */
const Horarios = ({ horarios = [], onCambio }) => {
  const delDia = (dia) => horarios.find(h => h.dia === dia) || { dia, abre: null, cierra: null };
  const cambiar = (dia, cambios) => onCambio(DIAS_SEMANA.map(({ enum: d }) => (d === dia ? { ...delDia(d), ...cambios } : delDia(d))));

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">Los días que no abre no aparecen en las métricas de asistencia, y el promedio de visitas se calcula solo sobre los días abiertos.</p>
      <div className="divide-y divide-slate-100">
        {DIAS_SEMANA.map(({ enum: dia, nombre }) => {
          const h = delDia(dia);
          const abierto = Boolean(h.abre && h.cierra);
          return (
            <div key={dia} className="flex flex-wrap items-center gap-3 py-2">
              <span className="w-24 text-sm font-semibold text-slate-700">{nombre}</span>
              <label className="flex items-center gap-2 text-sm text-slate-600 w-24">
                <input type="checkbox" checked={abierto} className="w-4 h-4 accent-blue-600"
                  onChange={(e) => cambiar(dia, e.target.checked ? { abre: '08:00', cierra: '22:00' } : { abre: null, cierra: null })} />
                {abierto ? 'Abierto' : 'Cerrado'}
              </label>
              {abierto && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="time" value={h.abre} aria-label={`${nombre}: abre`} onChange={(e) => cambiar(dia, { abre: e.target.value })}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800" />
                  <span>a</span>
                  <input type="time" value={h.cierra} aria-label={`${nombre}: cierra`} onChange={(e) => cambiar(dia, { cierra: e.target.value })}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Datos del gimnasio: logo, contacto (van en el encabezado de los PDF de comprobantes y rutinas) y horario.
 */
const DatosGimnasio = () => {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });

  useEffect(() => {
    apiFetch('/configuracion/gimnasio')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setDatos(await res.json());
      })
      .catch(() => setError('No se pudieron cargar los datos del gimnasio.'));
  }, []);

  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  const guardar = async () => {
    setGuardando(true);
    setMensaje({ texto: '', tipo: '' });
    try {
      const res = await apiFetch('/configuracion/gimnasio', { method: 'PUT', body: JSON.stringify(datos) });
      if (res.status === 403) throw new Error('Solo un administrador puede cambiar los datos del gimnasio.');
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error || 'No se pudieron guardar los datos.');
      setDatos(cuerpo);
      setMensaje({ texto: 'Datos guardados: ya salen en los PDF y el horario se usa en las métricas.', tipo: 'ok' });
      setTimeout(() => setMensaje((m) => (m.tipo === 'ok' ? { texto: '', tipo: '' } : m)), 4000);
    } catch (err) {
      setMensaje({ texto: err.message, tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  if (error) return <div className="p-5 text-center text-rose-700 font-medium">{error}</div>;
  if (!datos) return <div className="p-5 text-center text-slate-500">Cargando datos del gimnasio...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-5">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 mb-1">Datos del gimnasio</h1>
          <p className="text-sm text-slate-500">Logo y contacto, que van en los comprobantes y rutinas en PDF, y el horario del gimnasio.</p>
        </div>
        <button onClick={guardar} disabled={guardando}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-1.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors shadow-xs shrink-0">
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {mensaje.texto && (
        <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`} role="status">
          {mensaje.tipo === 'ok' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />} {mensaje.texto}
        </div>
      )}

      <Tarjeta icono={ImageIcon} titulo="Logo">
        <LogoGimnasio logoUrl={datos.logoUrl}
          onCambio={(nuevos) => setDatos((d) => ({ ...d, logoUrl: nuevos.logoUrl }))} />
      </Tarjeta>

      <Tarjeta icono={Building2} titulo="Datos y contacto">
        <div className="space-y-3">
          <Campo etiqueta="Nombre">
            <input value={datos.nombre || ''} maxLength={80} onChange={(e) => cambiar('nombre', e.target.value)} className={claseCampo} />
          </Campo>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo etiqueta="Dirección">
              <input value={datos.direccion || ''} maxLength={150} placeholder="Av. Corrientes 1234" onChange={(e) => cambiar('direccion', e.target.value)} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Ciudad">
              <input value={datos.ciudad || ''} maxLength={80} placeholder="CABA" onChange={(e) => cambiar('ciudad', e.target.value)} className={claseCampo} />
            </Campo>
            <Campo etiqueta="WhatsApp" ayuda="Con código de país y área, sin 0 ni 15: 54 9 11 2345 6789">
              <input value={datos.whatsapp || ''} inputMode="tel" placeholder="5491123456789" onChange={(e) => cambiar('whatsapp', e.target.value)} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Teléfono">
              <input value={datos.telefono || ''} inputMode="tel" maxLength={25} placeholder="011 4321-0000" onChange={(e) => cambiar('telefono', e.target.value)} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Email">
              <input type="email" value={datos.email || ''} maxLength={100} placeholder="hola@gimnasio.com" onChange={(e) => cambiar('email', e.target.value)} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Instagram" ayuda="@usuario o el link del perfil">
              <input value={datos.instagram || ''} placeholder="@summitfitness" onChange={(e) => cambiar('instagram', e.target.value)} className={claseCampo} />
            </Campo>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta icono={Clock} titulo="Horario">
        <Horarios horarios={datos.horarios} onCambio={(horarios) => cambiar('horarios', horarios)} />
      </Tarjeta>
    </div>
  );
};

export default DatosGimnasio;

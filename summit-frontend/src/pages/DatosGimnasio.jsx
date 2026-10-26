import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Building2, Clock, Users, FileText, MapPin, CheckCircle, AlertTriangle, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { DIAS_SEMANA } from '../utils/constantes';

const MAX_REGLAMENTO = 5000;

const claseCampo = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800 placeholder:text-slate-300 placeholder:font-normal';

const Tarjeta = ({ icono: Icono, titulo, children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] ${className}`}>
    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
      <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Icono className="w-5 h-5" /></div>
      <h2 className="text-lg font-bold text-slate-800">{titulo}</h2>
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

// Interruptor (mismo estilo que Reglas de acceso)
const Interruptor = ({ activo, onChange, etiqueta }) => (
  <label className="relative inline-flex items-center cursor-pointer shrink-0">
    <input type="checkbox" className="sr-only peer" checked={activo} onChange={(e) => onChange(e.target.checked)} aria-label={etiqueta} />
    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
    <div className="flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="w-28 h-28 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
        {imagen ? <img src={imagen} alt="Logo del gimnasio" className="max-w-full max-h-full object-contain" />
          : <ImageIcon className="w-8 h-8 text-slate-300" />}
      </div>
      <div className="space-y-2">
        <p className="text-sm text-slate-600">Sale en el encabezado de los comprobantes de pago y de las rutinas en PDF. PNG o JPG; mejor con fondo transparente.</p>
        <div className="flex flex-wrap gap-2">
          <input ref={entrada} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
          <button type="button" onClick={() => entrada.current?.click()} disabled={procesando}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white flex items-center gap-2">
            <Upload className="w-4 h-4" /> {procesando ? 'Guardando...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
          </button>
          {logoUrl && (
            <button type="button" disabled={procesando}
              onClick={() => window.confirm('¿Quitar el logo? Los PDF salen sin logo.') && enviar(() => apiFetch('/configuracion/gimnasio/logo', { method: 'DELETE' }))}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Quitar
            </button>
          )}
        </div>
        {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
      </div>
    </div>
  );
};

/**
 * Datos del gimnasio (PLAN-APP-SOCIOS.md, A5): logo, contacto, horarios, capacidad y reglamento. Van en los PDF
 * (comprobantes y rutinas) y en la app del socio. Reemplaza la pantalla de ejemplo de Ajustes > General.
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

  const cambiarHorario = (dia, cambios) => setDatos((d) => ({
    ...d,
    horarios: DIAS_SEMANA.map(({ enum: e }) => {
      const actual = d.horarios.find((h) => h.dia === e) || { dia: e, abre: null, cierra: null };
      return e === dia ? { ...actual, ...cambios } : actual;
    }),
  }));

  const guardar = async () => {
    setGuardando(true);
    setMensaje({ texto: '', tipo: '' });
    try {
      const res = await apiFetch('/configuracion/gimnasio', { method: 'PUT', body: JSON.stringify(datos) });
      if (res.status === 403) throw new Error('Solo un administrador puede cambiar los datos del gimnasio.');
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error || 'No se pudieron guardar los datos.');
      setDatos(cuerpo);
      setMensaje({ texto: 'Datos guardados: ya salen en los PDF.', tipo: 'ok' });
      setTimeout(() => setMensaje((m) => (m.tipo === 'ok' ? { texto: '', tipo: '' } : m)), 4000);
    } catch (err) {
      setMensaje({ texto: err.message, tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  if (error) return <div className="p-8 text-center text-rose-600 font-medium">{error}</div>;
  if (!datos) return <div className="p-8 text-center text-slate-500">Cargando datos del gimnasio...</div>;

  const horarioDe = (dia) => datos.horarios.find((h) => h.dia === dia) || { dia, abre: null, cierra: null };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Datos del gimnasio</h1>
          <p className="text-sm text-slate-500">Logo, contacto, horarios, capacidad y reglamento. Van en los comprobantes y rutinas en PDF.</p>
        </div>
        <button onClick={guardar} disabled={guardando}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors shadow-sm shrink-0">
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {mensaje.texto && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`} role="status">
          {mensaje.tipo === 'ok' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />} {mensaje.texto}
        </div>
      )}

      <Tarjeta icono={ImageIcon} titulo="Logo">
        <LogoGimnasio logoUrl={datos.logoUrl}
          onCambio={(nuevos) => setDatos((d) => ({ ...d, logoUrl: nuevos.logoUrl }))} />
      </Tarjeta>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta icono={Building2} titulo="Datos y contacto">
          <div className="space-y-4">
            <Campo etiqueta="Nombre">
              <input value={datos.nombre || ''} maxLength={80} onChange={(e) => cambiar('nombre', e.target.value)} className={claseCampo} />
            </Campo>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <Tarjeta icono={Clock} titulo="Horarios">
          <div className="space-y-3">
            {DIAS_SEMANA.map(({ enum: dia, nombre }) => {
              const h = horarioDe(dia);
              const abierto = !!h.abre;
              return (
                <div key={dia} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-semibold text-slate-700">{nombre}</span>
                  <Interruptor activo={abierto} etiqueta={`${nombre} abierto`}
                    onChange={(v) => cambiarHorario(dia, v ? { abre: '07:00', cierra: '23:00' } : { abre: null, cierra: null })} />
                  {abierto ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={h.abre || ''} aria-label={`${nombre} abre`}
                        onChange={(e) => cambiarHorario(dia, { abre: e.target.value || null })}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <span className="text-sm text-slate-400">a</span>
                      <input type="time" value={h.cierra || ''} aria-label={`${nombre} cierra`}
                        onChange={(e) => cambiarHorario(dia, { cierra: e.target.value || null })}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">Cerrado</span>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-slate-500 pt-2">Si cierra a medianoche, poné 00:00 como hora de cierre.</p>
          </div>
        </Tarjeta>

        <Tarjeta icono={Users} titulo="Ocupación">
          <Campo etiqueta="Capacidad (personas a la vez)"
            ayuda="Con este número la app le dice al socio si el gimnasio está tranquilo, con movimiento o lleno. Si lo dejás vacío, se compara con los horarios de más gente.">
            <input type="number" min="1" max="2000" value={datos.capacidad ?? ''} placeholder="Ej.: 80"
              onChange={(e) => cambiar('capacidad', e.target.value === '' ? null : Number(e.target.value))} className={claseCampo} />
          </Campo>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600">
              El botón "Ver en el mapa" de la app usa la ubicación cargada en{' '}
              <Link to="/ajustes/acceso" className="text-blue-600 font-semibold hover:underline">Reglas de acceso</Link>
              {datos.latitud != null ? ' (ya está cargada).' : '. Como todavía no está, usa la dirección.'}
            </p>
          </div>
        </Tarjeta>

        <Tarjeta icono={FileText} titulo="Reglamento">
          <Campo etiqueta="Normas del gimnasio" ayuda={`${(datos.reglamento || '').length} / ${MAX_REGLAMENTO} caracteres. El socio lo ve en su perfil.`}>
            <textarea value={datos.reglamento || ''} maxLength={MAX_REGLAMENTO} rows={9}
              placeholder={'Ej.:\n- Usar toalla en las máquinas.\n- Devolver los discos y mancuernas a su lugar.'}
              onChange={(e) => cambiar('reglamento', e.target.value)} className={`${claseCampo} resize-y`} />
          </Campo>
        </Tarjeta>
      </div>
    </div>
  );
};

export default DatosGimnasio;

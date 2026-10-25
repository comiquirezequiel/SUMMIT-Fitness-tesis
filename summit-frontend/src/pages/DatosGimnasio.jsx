import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Building2, Clock, Users, FileText, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
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
 * Datos del gimnasio que ve el socio en la app (PLAN-APP-SOCIOS.md, A5): contacto, horarios, capacidad y
 * reglamento. Reemplaza la pantalla de ejemplo de Ajustes > General.
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
      setMensaje({ texto: 'Datos guardados: los socios ya los ven en la app.', tipo: 'ok' });
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
          <p className="text-sm text-slate-500">Lo que ven los socios en la app: contacto, horarios, ocupación y reglamento.</p>
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

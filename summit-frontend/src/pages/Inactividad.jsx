import { Fragment, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Download, Search, MessageCircle, Clock, Users, CheckCircle2, Phone } from 'lucide-react';
import { CANALES, mensajeInactivo, obtenerInactividad, registrarContacto, textoCanal } from '../services/seguimiento';
import { datosDelGimnasio } from '../components/pdf';
import { enlaceWhatsApp } from '../utils/whatsapp';
import { descargarCsv, formatFecha, formatFechaHora } from '../utils/formato';

const NIVELES = {
  LEVE: { texto: 'Leve', rango: '7 a 14 días', punto: 'bg-yellow-400', clase: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  MEDIO: { texto: 'Media', rango: '15 a 29 días', punto: 'bg-orange-500', clase: 'bg-orange-50 text-orange-700 border-orange-200' },
  ALTO: { texto: 'Alta', rango: '30 días o más', punto: 'bg-rose-500', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const Tarjeta = ({ titulo, valor, detalle, icono: Icono, color, onClick, activa }) => (
  <button type="button" onClick={onClick} disabled={!onClick}
    className={`text-left bg-white p-5 rounded-xl border shadow-xs flex items-center justify-between transition-all ${onClick ? 'hover:shadow-md' : 'cursor-default'} ${activa ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
    <div>
      <p className="text-sm font-medium text-slate-500">{titulo}</p>
      <p className="text-3xl font-bold text-slate-800 mt-1">{valor}</p>
      {detalle && <p className="text-xs text-slate-500 mt-1">{detalle}</p>}
    </div>
    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${color}`}><Icono className="w-5 h-5" /></div>
  </button>
);

/**
 * Socios que dejaron de venir: los que tienen la cuota al día (o vencida hace poco) y hace días que no entran, para
 * escribirles antes de que no renueven. Cada contacto queda registrado.
 */
const Inactividad = () => {
  const [datos, setDatos] = useState(null);
  const [minDias, setMinDias] = useState(7);
  const [nivel, setNivel] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [gimnasio, setGimnasio] = useState(null);
  const [contacto, setContacto] = useState(null); // { idSocio, canal, nota, enviando, error }
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await obtenerInactividad(minDias));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [minDias]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { datosDelGimnasio().then(g => setGimnasio(g?.nombre || null)); }, []);

  const guardarContacto = async () => {
    setContacto(c => ({ ...c, enviando: true, error: '' }));
    try {
      await registrarContacto({ idSocio: contacto.idSocio, canal: contacto.canal, nota: contacto.nota.trim() || null });
      const socio = datos.socios.find(s => s.idSocio === contacto.idSocio);
      setAviso(`Contacto con ${socio?.nombreCompleto} registrado.`);
      setContacto(null);
      cargar();
    } catch (err) {
      setContacto(c => ({ ...c, enviando: false, error: err.message }));
    }
  };

  const filtro = busqueda.trim().toLowerCase();
  const socios = (datos?.socios || []).filter(s => (!nivel || s.nivel === nivel)
    && (!filtro || s.nombreCompleto.toLowerCase().includes(filtro) || s.dni.includes(filtro)));

  const exportar = () => descargarCsv(`inactividad-${new Date().toISOString().substring(0, 10)}.csv`,
    ['Socio', 'DNI', 'Teléfono', 'Email', 'Nivel', 'Días sin venir', 'Último ingreso', 'Ingresos en 90 días', 'Promedio semanal', 'Plan', 'Vence', 'Último contacto'],
    socios.map(s => [s.nombreCompleto, s.dni, s.telefono, s.email, NIVELES[s.nivel].texto, s.diasSinVenir,
      s.ultimoIngreso ? formatFechaHora(s.ultimoIngreso) : 'Nunca vino', s.ingresos90, String(s.promedioSemanal).replace('.', ','),
      s.plan, formatFecha(s.vencimientoMembresia), s.ultimoContacto ? formatFechaHora(s.ultimoContacto) : '']));

  const porcentaje = datos && datos.sociosAlDia > 0 ? Math.round((datos.vinieronSemana * 100) / datos.sociosAlDia) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" /> Inactividad
          </h1>
          <p className="text-sm text-slate-500 mt-1">Socios con la cuota al día (o vencida hace poco) que hace días que no vienen</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 bg-white">
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <button onClick={exportar} disabled={socios.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 bg-white disabled:opacity-50">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {['LEVE', 'MEDIO', 'ALTO'].map(n => (
          <Tarjeta key={n} titulo={`Alerta ${NIVELES[n].texto.toLowerCase()}`} valor={datos ? datos[n.toLowerCase()] : '—'}
            detalle={`${NIVELES[n].rango} sin venir · tocá para filtrar`} icono={n === 'LEVE' ? Clock : AlertTriangle}
            color={NIVELES[n].clase} onClick={() => setNivel(nivel === n ? null : n)} activa={nivel === n} />
        ))}
        <Tarjeta titulo="Vinieron esta semana" valor={datos ? `${porcentaje} %` : '—'}
          detalle={datos ? `${datos.vinieronSemana} de ${datos.sociosAlDia} socios con la cuota al día` : ''}
          icono={Users} color="bg-blue-50 text-blue-600" />
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}
      {aviso && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {aviso}</div>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setNivel(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${!nivel ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>Todos</button>
            {Object.entries(NIVELES).map(([clave, n]) => (
              <button key={clave} onClick={() => setNivel(clave)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${nivel === clave ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                <span className={`w-2 h-2 rounded-full ${n.punto}`} /> {n.texto}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o DNI..."
                className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100" />
            </div>
            <select value={minDias} onChange={e => setMinDias(Number(e.target.value))} aria-label="Días sin venir"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              <option value={7}>7 días o más</option>
              <option value={15}>15 días o más</option>
              <option value={30}>30 días o más</option>
            </select>
          </div>
        </div>

        {datos && socios.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            {datos.socios.length === 0 ? '¡Bien! Todos los socios con la cuota al día vinieron en los últimos días.' : 'Ningún socio coincide con el filtro.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-medium">Socio</th>
                  <th className="px-5 py-3 font-medium">Último ingreso</th>
                  <th className="px-5 py-3 font-medium">Promedio</th>
                  <th className="px-5 py-3 font-medium">Membresía</th>
                  <th className="px-5 py-3 font-medium">Último contacto</th>
                  <th className="px-5 py-3 font-medium text-right">Contactar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {socios.map(s => (
                  <Fragment key={s.idSocio}>
                    <tr className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${NIVELES[s.nivel].clase}`}>{NIVELES[s.nivel].texto}</span>
                          <span className="font-medium text-slate-800">{s.nombreCompleto}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">DNI {s.dni}{s.telefono ? ` · ${s.telefono}` : ''}</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{s.ultimoIngreso ? `Hace ${s.diasSinVenir} días` : 'Nunca vino'}</div>
                        <div className="text-xs text-slate-500">{s.ultimoIngreso ? formatFecha(s.ultimoIngreso) : `Alta hace ${s.diasSinVenir} días`}</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-slate-800">{String(s.promedioSemanal).replace('.', ',')} por semana</div>
                        <div className="text-xs text-slate-500">{s.ingresos90} en 90 días</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-slate-800">{s.plan}</div>
                        <div className="text-xs text-slate-500">vence {formatFecha(s.vencimientoMembresia)}</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-600">{s.ultimoContacto ? formatFecha(s.ultimoContacto) : '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <a href={enlaceWhatsApp(s.telefono, mensajeInactivo(s.nombreCompleto, s.ultimoIngreso ? s.diasSinVenir : null, gimnasio))}
                            target="_blank" rel="noopener noreferrer" title="Escribirle por WhatsApp (mensaje ya armado)"
                            onClick={() => setContacto({ idSocio: s.idSocio, canal: 'WHATSAPP', nota: '', enviando: false, error: '' })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold">
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                          <button onClick={() => setContacto({ idSocio: s.idSocio, canal: 'LLAMADA', nota: '', enviando: false, error: '' })}
                            title="Registrar que lo contactaste de otra forma"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold">
                            <Phone className="w-3.5 h-3.5" /> Otro
                          </button>
                        </div>
                      </td>
                    </tr>
                    {contacto?.idSocio === s.idSocio && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={6} className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700">Registrar el contacto:</span>
                            <select value={contacto.canal} onChange={e => setContacto(c => ({ ...c, canal: e.target.value }))}
                              className="px-2 py-2 border border-slate-200 rounded-lg text-sm bg-white" aria-label="Cómo lo contactaste">
                              {CANALES.map(c => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
                            </select>
                            <input value={contacto.nota} maxLength={300} placeholder="¿Qué te dijo? (opcional)"
                              onChange={e => setContacto(c => ({ ...c, nota: e.target.value }))}
                              className="flex-1 min-w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                            <button onClick={guardarContacto} disabled={contacto.enviando}
                              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50">
                              {contacto.enviando ? 'Guardando...' : `Registrar (${textoCanal(contacto.canal)})`}
                            </button>
                            <button onClick={() => setContacto(null)} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold bg-white">
                              No lo contacté
                            </button>
                          </div>
                          {contacto.error && <p className="text-xs text-rose-600 font-medium mt-1">{contacto.error}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inactividad;

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  LayoutDashboard, Users, UserPlus, UserCheck, UserX, CalendarClock, DollarSign, AlertTriangle, Calendar, Activity, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import Encabezado from '../components/Encabezado';
import { Buscador } from '../components/Campo';
import ControlAcceso from '../components/ControlAcceso';
import PanelMetricas from '../components/metricas/PanelMetricas';
import FotoSocio from '../components/socios/FotoSocio';
import CobroRapido from '../components/socios/CobroRapido';
import FichaSocioModal from '../components/socios/FichaSocioModal';
import EditarSocioModal from '../components/socios/EditarSocioModal';
import { apiFetch } from '../services/api';
import { formatHora, usuarioActual } from '../utils/formato';
import { resultadoIngreso } from '../utils/constantes';

const ROLES = { ADMIN: 'Administración', RECEPCION: 'Recepción' };
const ACTUALIZAR_CADA_MS = 30000;

// Un número del día en una línea: "23 ingresos hoy"
const Cifra = ({ icon: Icon, valor, texto, color = 'text-slate-500' }) => (
  <span className="inline-flex items-center gap-1">
    <Icon className={`w-3 h-3 ${color}`} /> <b className="text-slate-700 tabular-nums">{valor}</b> {texto}
  </span>
);

// Un dato del resumen de socios, en el encabezado
// Cada uno con su color; alerta (hay membresías por vencer) lo resalta con un anillo
const TONOS_RESUMEN = {
  verde: { caja: 'bg-emerald-50 border-emerald-200', icono: 'bg-exito', numero: 'text-emerald-700' },
  azul: { caja: 'bg-blue-50 border-blue-200', icono: 'bg-blue-500', numero: 'text-blue-700' },
  ambar: { caja: 'bg-amber-50 border-amber-200', icono: 'bg-alerta', numero: 'text-amber-700' },
  gris: { caja: 'bg-slate-100 border-slate-200', icono: 'bg-slate-500', numero: 'text-slate-700' },
};
const Resumen = ({ icon: Icon, valor, texto, tono, alerta }) => {
  const t = TONOS_RESUMEN[tono];
  return (
    <div className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl border shadow-xs ${t.caja} ${alerta ? 'ring-2 ring-amber-300' : ''}`}>
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.icono}`}>
        <Icon className="w-4 h-4 text-white" />
      </span>
      <span className="leading-tight">
        <b className={`block text-lg font-extrabold tabular-nums ${t.numero}`}>{valor}</b>
        <span className="block text-xs font-medium text-slate-600">{texto}</span>
      </span>
    </div>
  );
};

/**
 * Tablero de recepción y gerencia: arriba, el control de acceso por DNI con Nuevo socio y Cobrar cuota al lado y la
 * información rápida del socio abajo, junto a la actividad de hoy (el último que entró, primero; tocando el nombre de
 * un socio se abre su ficha completa, y desde ahí se editan sus datos); debajo, las métricas en un contenedor con
 * pestañas (Socios, Planes / Membresías y Ganancias).
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const usuario = usuarioActual();
  const [resumen, setResumen] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cobro, setCobro] = useState(null); // { idSocio } mientras se cobra (sin idSocio, primero se busca al socio)
  const [ficha, setFicha] = useState(null); // socio con la ficha completa abierta
  const [editando, setEditando] = useState(null); // socio cuyos datos se están editando (desde su ficha)
  const [abriendo, setAbriendo] = useState(null); // idLog de la fila cuya ficha se está pidiendo
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    try {
      const [resResumen, resIngresos] = await Promise.all([
        apiFetch('/dashboard/resumen'),
        apiFetch('/dashboard/ingresos-hoy'),
      ]);
      if (!resResumen.ok || !resIngresos.ok) throw new Error();
      setResumen(await resResumen.json());
      setIngresos(await resIngresos.json());
      setError('');
    } catch {
      setError('No se pudieron cargar los datos del tablero.');
    }
  }, []);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, ACTUALIZAR_CADA_MS);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  const leerSocio = async (idSocio) => {
    const res = await apiFetch(`/socios/${idSocio}`).catch(() => null);
    return res?.ok ? res.json() : null;
  };

  // Nombre de un socio en la actividad: abre su ficha completa con los datos de hoy
  const abrirFicha = async (ingreso) => {
    setAbriendo(ingreso.idLog);
    const socio = await leerSocio(ingreso.idUsuario);
    setAbriendo(null);
    if (socio) setFicha(socio);
    else setError(`No se pudo abrir la ficha de ${ingreso.nombre}.`);
  };

  // La ficha completa muestra el socio que recibe: después de un cambio (foto, apto, congelamiento) se lo vuelve a leer
  const refrescarFicha = async () => {
    cargarDatos();
    const socio = await leerSocio(ficha.idSocio);
    if (socio) setFicha(socio);
  };

  // Guardó los datos: vuelve a la ficha, ya con lo nuevo
  const alGuardarEdicion = async () => {
    const id = editando.idSocio;
    setEditando(null);
    cargarDatos();
    const socio = await leerSocio(id);
    if (socio) setFicha(socio);
  };

  const filtro = busqueda.trim().toLowerCase();
  const ingresosFiltrados = ingresos.filter(i =>
    !filtro || i.nombre.toLowerCase().includes(filtro) || i.dni.includes(filtro));
  // La lista viene del más nuevo al más viejo: el primero es el último que entró
  const ultimo = ingresos[0]?.idLog;

  const valor = (campo) => (resumen ? resumen[campo].toString() : '—');

  return (
    <div className="space-y-3">
      <Encabezado titulo="Dashboard" icono={LayoutDashboard}
        subtitulo={`Bienvenido, ${usuario?.nombreCompleto || 'equipo'}${ROLES[usuario?.rol] ? ` · ${ROLES[usuario.rol]}` : ''}`}
        acciones={resumen && (
          <>
            <Resumen icon={UserCheck} tono="verde" valor={resumen.sociosActivos} texto={`socios activos de ${resumen.sociosTotal}`} />
            <Resumen icon={UserPlus} tono="azul" valor={resumen.nuevosEsteMes} texto="nuevos este mes" />
            <Resumen icon={CalendarClock} tono="ambar" valor={resumen.membresiasPorVencer} texto="vencen en 7 días"
              alerta={resumen.membresiasPorVencer > 0} />
            <Resumen icon={UserX} tono="gris" valor={resumen.sociosInactivos} texto="inactivos" />
          </>
        )} />

      {error && (
        <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>
      )}

      {/* El ingreso por DNI, más ancho; la actividad al lado y los dos del mismo alto (al menos 18rem): la tabla de la
          actividad se desplaza adentro */}
      <div className="grid grid-cols-1 xl:grid-cols-5 xl:grid-rows-[minmax(18rem,auto)] gap-3 items-start">
        <div className="xl:col-span-3 xl:self-stretch">
          <ControlAcceso onIngreso={cargarDatos} acciones={(
            <>
              <button type="button" onClick={() => navigate('/socios/nuevo')}
                className="px-3 py-1.5 tactil:min-h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors">
                <UserPlus className="w-4 h-4" /> Nuevo socio
              </button>
              <button type="button" onClick={() => setCobro({})}
                className="px-3 py-1.5 tactil:min-h-11 rounded-lg bg-exito hover:bg-exito-oscuro text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors">
                <DollarSign className="w-4 h-4" /> Cobrar cuota
              </button>
            </>
          )} />
        </div>

        <section className="xl:col-span-2 xl:self-stretch xl:h-0 xl:min-h-full flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs" aria-label="Actividad en vivo">
          {/* El título y el buscador en la misma fila: el buscador ocupa lo que queda */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <Activity className="w-4 h-4 text-slate-400" />
              Actividad en vivo
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-normal text-slate-500">hoy</span>
            </h2>
            <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar socio o DNI..." className="flex-1 min-w-0" />
          </div>
          <div className="px-3 py-1.5 border-b border-slate-100 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 bg-slate-50/50">
            <Cifra icon={Users} valor={valor('ingresosHoy')} texto="ingresos hoy" />
            <Cifra icon={CheckCircle} valor={valor('permitidosHoy')} texto="permitidos" color="text-emerald-500" />
            <Cifra icon={XCircle} valor={valor('denegadosHoy')} texto="denegados" color="text-rose-500" />
            <Cifra icon={Clock} valor={valor('ingresosUltimaHora')} texto="en la última hora" />
          </div>

          {ingresosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-3 py-8">
              <Calendar className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm font-medium">
                {ingresos.length === 0 ? 'Todavía no hubo ingresos hoy' : 'Ningún ingreso coincide con la búsqueda'}
              </p>
            </div>
          ) : (
            // Con mucho movimiento la tabla se desplaza adentro: el resto del tablero no se corre
            <div className="overflow-auto max-h-[26rem] xl:max-h-none xl:flex-1 xl:min-h-0">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Hora</th>
                    <th className="px-3 py-1.5 font-medium">Socio</th>
                    <th className="px-3 py-1.5 font-medium">DNI</th>
                    <th className="px-3 py-1.5 font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ingresosFiltrados.map(ingreso => {
                    const res = resultadoIngreso(ingreso.resultado);
                    const esUltimo = ingreso.idLog === ultimo;
                    return (
                      <tr key={ingreso.idLog} className={`transition-colors ${esUltimo ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                        <td className="px-3 py-1.5 text-slate-600 font-medium tabular-nums">{formatHora(ingreso.fechaHora)}</td>
                        <td className="px-3 py-1.5 text-slate-800 font-medium whitespace-normal">
                          <div className="flex items-center gap-2">
                            <FotoSocio idSocio={ingreso.idUsuario} fotoVersion={ingreso.fotoVersion} nombre={ingreso.nombre}
                              className="w-6 h-6 rounded-full" texto="text-xs" />
                            {ingreso.rol === 'SOCIO' ? (
                              <button type="button" onClick={() => abrirFicha(ingreso)} disabled={abriendo === ingreso.idLog}
                                title="Ver la ficha completa del socio"
                                className="font-medium text-slate-800 hover:text-blue-600 hover:underline underline-offset-2 disabled:opacity-60 disabled:cursor-wait">
                                {ingreso.nombre}
                              </button>
                            ) : <span>{ingreso.nombre}</span>}
                            {ingreso.rol !== 'SOCIO' && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1 py-px rounded-sm">PERSONAL</span>}
                            {esUltimo && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-px rounded-sm">ÚLTIMO</span>}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-slate-500 tabular-nums">{ingreso.dni}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${res.clase}`}>
                            {ingreso.resultado === 'PERMITIDO' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {res.texto}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <PanelMetricas />

      {cobro && (
        <CobroRapido idSocio={cobro.idSocio} onClose={() => setCobro(null)} onCobrado={() => { setCobro(null); cargarDatos(); }} />
      )}
      {ficha && (
        <FichaSocioModal socio={ficha} puedeEditar onActualizado={refrescarFicha} onClose={() => { setFicha(null); cargarDatos(); }}
          onEditar={() => { setEditando(ficha); setFicha(null); }} />
      )}
      {editando && (
        <EditarSocioModal socio={editando} onClose={() => { setFicha(editando); setEditando(null); }} onGuardado={alGuardarEdicion} />
      )}
    </div>
  );
};

export default Dashboard;

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Repeat, RefreshCw, AlertTriangle, Hourglass, Wallet, Search, Info } from 'lucide-react';
import { apiFetch } from '../services/api';
import { formatFecha, formatMoneda } from '../utils/formato';
import { ESTADOS_DEBITO, textoMedioPago } from '../utils/constantes';

const Kpi = ({ titulo, valor, detalle, icon: Icon, color }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{titulo}</p>
      <h3 className="text-2xl font-bold text-slate-800 tabular-nums">{valor}</h3>
      {detalle && <p className="text-xs text-slate-500 mt-1">{detalle}</p>}
    </div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}><Icon className="w-6 h-6" /></div>
  </div>
);

const FILTROS = [
  { clave: 'TODOS', texto: 'Todos' },
  { clave: 'ACTIVO', texto: 'Activos' },
  { clave: 'PENDIENTE_AUTORIZACION', texto: 'Esperando autorización' },
  { clave: 'RECHAZO', texto: 'Con rechazo' },
  { clave: 'CANCELADO', texto: 'De baja' },
];

const coincide = (d, filtro) => {
  if (filtro === 'TODOS') return true;
  if (filtro === 'RECHAZO') return d.estado !== 'CANCELADO' && !!d.ultimoRechazo;
  return d.estado === filtro;
};

/**
 * Débitos automáticos: socios que pagan su plan solo cada mes por Mercado Pago.
 * Recepción ve quién está activo, quién falta autorizar y los cobros rechazados para avisar al socio.
 */
const DebitosAutomaticos = () => {
  const navigate = useNavigate();
  const [habilitado, setHabilitado] = useState(true);
  const [debitos, setDebitos] = useState([]);
  const [filtro, setFiltro] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [resEstado, resLista] = await Promise.all([apiFetch('/debitos/estado'), apiFetch('/debitos')]);
      if (!resEstado.ok || !resLista.ok) throw new Error();
      setHabilitado((await resEstado.json()).habilitado);
      setDebitos(await resLista.json());
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los débitos automáticos.' });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const res = await apiFetch('/debitos/sincronizar', { method: 'POST' });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error || 'No se pudo consultar a Mercado Pago');
      setMensaje({
        tipo: 'ok',
        texto: datos.enCurso
          ? 'Ya hay una sincronización en curso: probá de nuevo en unos segundos.'
          : `Se revisaron ${datos.revisados} adhesiones: ${datos.cobrosNuevos} cobro(s) nuevo(s)${datos.errores ? `, ${datos.errores} con error` : ''}.`,
      });
      cargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setSincronizando(false);
    }
  };

  const activos = debitos.filter(d => d.estado === 'ACTIVO');
  const recurrente = activos.reduce((total, d) => total + Number(d.monto || 0), 0);
  const esperando = debitos.filter(d => d.estado === 'PENDIENTE_AUTORIZACION').length;
  const conRechazo = debitos.filter(d => coincide(d, 'RECHAZO')).length;

  const texto = busqueda.trim().toLowerCase();
  const visibles = debitos.filter(d => coincide(d, filtro) &&
    (!texto || d.nombreSocio.toLowerCase().includes(texto) || d.dniSocio.includes(texto) || d.plan.toLowerCase().includes(texto)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Débitos automáticos</h1>
          <p className="text-sm text-slate-500">Socios que pagan su plan solos cada mes con Mercado Pago</p>
        </div>
        <button onClick={sincronizar} disabled={!habilitado || sincronizando}
          className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} /> Sincronizar ahora
        </button>
      </div>

      {!habilitado && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800 flex gap-3">
          <Info className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">El débito automático todavía no está activado.</p>
            <p className="mt-1">Para activarlo, cargá la credencial de Mercado Pago del gimnasio (Access Token) en la variable de
              entorno <code className="bg-white/70 px-1 rounded-sm">MP_ACCESS_TOKEN</code> del servidor y reiniciá el backend.
              Mientras tanto, los cobros siguen siendo presenciales en recepción.</p>
          </div>
        </div>
      )}

      {mensaje && (
        <div className={`p-3 rounded-lg text-sm font-medium ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {mensaje.texto}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Kpi titulo="Activos" valor={activos.length} detalle="Cobran solos cada mes" icon={Repeat} color="bg-emerald-50 text-emerald-600" />
        <Kpi titulo="Cobro recurrente" valor={formatMoneda(recurrente)} detalle="Suma de los débitos activos" icon={Wallet} color="bg-sky-50 text-sky-600" />
        <Kpi titulo="Esperando autorización" valor={esperando} detalle="Falta que el socio confirme" icon={Hourglass} color="bg-amber-50 text-amber-600" />
        <Kpi titulo="Con rechazo" valor={conRechazo} detalle={conRechazo ? 'Conviene avisarles' : 'Todo en orden'} icon={AlertTriangle} color="bg-rose-50 text-rose-600" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map(f => (
              <button key={f.clave} onClick={() => setFiltro(f.clave)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filtro === f.clave ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f.texto}
              </button>
            ))}
          </div>
          <div className="relative lg:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar socio, DNI o plan..."
              className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>

        {visibles.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {cargando ? 'Cargando...' : debitos.length === 0
              ? 'Todavía nadie se adhirió. Se hace desde la ficha del socio (Lista de Socios).'
              : 'No hay débitos con ese filtro.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Socio</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Medio</th>
                  <th className="px-6 py-4">Próximo cobro</th>
                  <th className="px-6 py-4">Último cobro</th>
                  <th className="px-6 py-4 text-right">Monto / mes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map(d => {
                  const estado = ESTADOS_DEBITO[d.estado];
                  return (
                    <tr key={d.idDebito} className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/socios?buscar=${d.dniSocio}`)} title="Ver en la lista de socios">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{d.nombreSocio}</div>
                        <div className="text-xs text-slate-500">DNI {d.dniSocio}</div>
                      </td>
                      <td className="px-6 py-4">{d.plan}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${estado?.clase}`}>{estado?.texto}</span>
                        {d.ultimoRechazo && d.estado !== 'CANCELADO' && (
                          <div className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3" /> Rechazado {formatFecha(d.ultimoRechazo)}: {d.detalleRechazo}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs">{textoMedioPago(d.medioPago)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{d.proximoCobro ? formatFecha(d.proximoCobro) : '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{d.ultimoCobro ? formatFecha(d.ultimoCobro) : '—'}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-800 whitespace-nowrap">{formatMoneda(d.monto)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebitosAutomaticos;

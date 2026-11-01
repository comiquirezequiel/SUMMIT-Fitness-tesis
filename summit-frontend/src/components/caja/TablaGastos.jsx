import { Fragment, useCallback, useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import Paginador from './Paginador';
import { anularGasto, listarGastos, textoCategoriaGasto } from '../../services/caja';
import { formatFecha, formatHora, formatMoneda } from '../../utils/formato';
import { textoMetodoPago } from '../../utils/constantes';

/**
 * Gastos de la caja, del más nuevo al más viejo. Los del turno abierto se pueden anular con motivo (quedan tachados).
 * version: cambiarla recarga la lista (por ejemplo, después de registrar un gasto).
 */
const TablaGastos = ({ version, onCambio }) => {
  const [pagina, setPagina] = useState(null);
  const [numero, setNumero] = useState(0);
  const [error, setError] = useState('');
  const [anulando, setAnulando] = useState(null); // { idGasto, motivo, enviando, error }

  const cargar = useCallback(() => {
    listarGastos(numero).then((p) => { setPagina(p); setError(''); }).catch(err => setError(err.message));
  }, [numero]);
  useEffect(() => { cargar(); }, [cargar, version]);

  const confirmarAnulacion = async () => {
    setAnulando(a => ({ ...a, enviando: true, error: '' }));
    try {
      await anularGasto(anulando.idGasto, anulando.motivo.trim());
      setAnulando(null);
      cargar();
      onCambio?.();
    } catch (err) {
      setAnulando(a => ({ ...a, enviando: false, error: err.message }));
    }
  };

  const gastos = pagina?.content || [];
  if (error) return <div className="p-4 text-sm text-rose-700 font-medium">{error}</div>;
  if (pagina && gastos.length === 0) {
    return <div className="p-6 text-center text-slate-500 text-sm">Todavía no hay gastos registrados.</div>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-3 py-2">Fecha y hora</th>
              <th className="px-3 py-2">Gasto</th>
              <th className="px-3 py-2">Método</th>
              <th className="px-3 py-2">Comprobante</th>
              <th className="px-3 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gastos.map(g => (
              <Fragment key={g.idGasto}>
                <tr className={`hover:bg-slate-50/50 ${g.anulado ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-medium text-slate-700">{formatFecha(g.fecha)}</div>
                    <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5"><Calendar className="w-3 h-3" /> {formatHora(g.fecha)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{textoCategoriaGasto(g.categoria)}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{g.descripcion}</div>
                    {g.anulado ? (
                      <div className="text-xs text-rose-700 mt-1">Anulado por {g.anuladoPor || 'recepción'}: {g.motivoAnulacion}</div>
                    ) : (
                      <div className="text-xs text-slate-500 mt-1">Registró: {g.registradoPor || '—'}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-sm bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200 whitespace-nowrap">
                      {textoMetodoPago(g.metodoPago)}
                    </span>
                    {g.fueraDeCaja && <div className="text-xs text-slate-500 mt-1 whitespace-nowrap">No salió de la caja</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{g.comprobante || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className={`font-bold ${g.anulado ? 'text-slate-500 line-through' : 'text-rose-700'}`}>−{formatMoneda(g.monto)}</span>
                    {g.anulable && anulando?.idGasto !== g.idGasto && (
                      <button onClick={() => setAnulando({ idGasto: g.idGasto, motivo: '', enviando: false, error: '' })}
                        className="block ml-auto mt-1 text-xs font-semibold text-slate-500 hover:text-rose-700">Anular</button>
                    )}
                  </td>
                </tr>
                {anulando?.idGasto === g.idGasto && (
                  <tr className="bg-rose-50/40">
                    <td colSpan={5} className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input autoFocus value={anulando.motivo} maxLength={200} placeholder="¿Por qué se anula? (queda registrado)"
                          onChange={e => setAnulando(a => ({ ...a, motivo: e.target.value }))}
                          className="flex-1 min-w-56 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-100" />
                        <button onClick={confirmarAnulacion} disabled={anulando.enviando || anulando.motivo.trim().length < 5}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-50">
                          {anulando.enviando ? 'Anulando...' : 'Anular gasto'}
                        </button>
                        <button onClick={() => setAnulando(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-white">
                          Cancelar
                        </button>
                      </div>
                      {anulando.error && <p className="text-xs text-rose-700 font-medium mt-1">{anulando.error}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Paginador pagina={pagina} nombre="gastos" onCambiar={setNumero} />
    </>
  );
};

export default TablaGastos;

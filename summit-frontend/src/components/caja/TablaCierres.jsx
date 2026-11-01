import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Paginador from './Paginador';
import { TablaMetodos, textoDiferencia } from './CierreCajaModal';
import { listarCierres } from '../../services/caja';
import { formatFechaHora, formatMoneda } from '../../utils/formato';

/**
 * Cierres de caja, del más nuevo al más viejo. Cada uno se abre para ver los medios de pago y la observación.
 * version: cambiarla recarga la lista.
 */
const TablaCierres = ({ version }) => {
  const [pagina, setPagina] = useState(null);
  const [numero, setNumero] = useState(0);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(null);

  const cargar = useCallback(() => {
    listarCierres(numero).then((p) => { setPagina(p); setError(''); }).catch(err => setError(err.message));
  }, [numero]);
  useEffect(() => { cargar(); }, [cargar, version]);

  const cierres = pagina?.content || [];
  if (error) return <div className="p-4 text-sm text-rose-700 font-medium">{error}</div>;
  if (pagina && cierres.length === 0) {
    return <div className="p-6 text-center text-slate-500 text-sm">Todavía no se cerró la caja. Al final de cada turno, tocá "Cerrar caja".</div>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-3 py-2">Turno</th>
              <th className="px-3 py-2 text-right">Esperado</th>
              <th className="px-3 py-2 text-right">Contado</th>
              <th className="px-3 py-2">Diferencia</th>
              <th className="px-3 py-2 text-right">Retiro</th>
              <th className="px-3 py-2 text-right">Quedó de fondo</th>
              <th className="px-2 py-2.5" aria-label="Detalle" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cierres.map(c => {
              const dif = textoDiferencia(c.diferencia);
              const estaAbierto = abierto === c.idCierre;
              return (
                <Fragment key={c.idCierre}>
                  <tr className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setAbierto(estaAbierto ? null : c.idCierre)}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800 whitespace-nowrap">{formatFechaHora(c.hasta)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">desde {formatFechaHora(c.desde)} · cerró {c.cerradoPor || '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-slate-700">{formatMoneda(c.efectivoEsperado)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-slate-800">{formatMoneda(c.efectivoContado)}</td>
                    <td className={`px-4 py-2.5 whitespace-nowrap font-semibold ${dif.clase}`}>{dif.texto}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-slate-700">{formatMoneda(c.retiro)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-slate-700">{formatMoneda(c.fondoSiguiente)}</td>
                    <td className="px-2 py-2.5 text-slate-500">{estaAbierto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</td>
                  </tr>
                  {estaAbierto && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={7} className="px-3 py-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                              {c.cantidadCobros} {c.cantidadCobros === 1 ? 'cobro' : 'cobros'} · {c.cantidadGastos} {c.cantidadGastos === 1 ? 'gasto' : 'gastos'}
                            </p>
                            <TablaMetodos metodos={c.metodos} />
                          </div>
                          <div className="text-sm space-y-1 text-slate-600">
                            <p>Fondo inicial: <span className="font-semibold text-slate-800">{formatMoneda(c.fondoInicial)}</span></p>
                            <p>Cobros en efectivo: <span className="font-semibold text-slate-800">{formatMoneda(c.ingresosEfectivo)}</span></p>
                            <p>Gastos en efectivo: <span className="font-semibold text-slate-800">{formatMoneda(c.egresosEfectivo)}</span></p>
                            <p>Total cobrado (todos los medios): <span className="font-semibold text-slate-800">{formatMoneda(c.totalIngresos)}</span></p>
                            {c.observacion && <p className="pt-2 text-slate-700"><span className="font-semibold">Observación:</span> {c.observacion}</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Paginador pagina={pagina} nombre="cierres" onCambiar={setNumero} />
    </>
  );
};

export default TablaCierres;

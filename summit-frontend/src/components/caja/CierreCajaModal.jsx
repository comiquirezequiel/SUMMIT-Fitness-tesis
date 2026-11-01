import { useEffect, useState } from 'react';
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import { cerrarCaja, obtenerTurno } from '../../services/caja';
import { formatFechaHora, formatMoneda } from '../../utils/formato';
import { textoMetodoPago } from '../../utils/constantes';

const Fila = ({ texto, children, fuerte }) => (
  <div className={`flex justify-between items-baseline gap-3 ${fuerte ? 'pt-2 border-t border-slate-200 font-bold text-slate-900' : 'text-slate-600'}`}>
    <span>{texto}</span>
    <span className={fuerte ? '' : 'font-semibold text-slate-800'}>{children}</span>
  </div>
);

// "Coincide", "Faltan $ 500" o "Sobran $ 200", con su color
export const textoDiferencia = (diferencia) => {
  const d = Number(diferencia);
  if (d === 0) return { texto: 'Coincide', clase: 'text-emerald-700' };
  return d < 0
    ? { texto: `Faltan ${formatMoneda(-d)}`, clase: 'text-rose-700' }
    : { texto: `Sobran ${formatMoneda(d)}`, clase: 'text-amber-700' };
};

/** Lo que entró y salió por cada medio de pago en un turno. */
export const TablaMetodos = ({ metodos }) => (metodos.length === 0 ? (
  <p className="text-sm text-slate-500">Sin cobros ni gastos en este turno.</p>
) : (
  <table className="w-full text-sm">
    <thead className="text-xs text-slate-500 uppercase tracking-wide">
      <tr><th className="text-left font-semibold pb-1">Medio de pago</th><th className="text-right font-semibold pb-1">Cobros</th><th className="text-right font-semibold pb-1">Gastos</th></tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {metodos.map(m => (
        <tr key={m.metodoPago}>
          <td className="py-1.5 text-slate-700">{textoMetodoPago(m.metodoPago)}</td>
          <td className="py-1.5 text-right text-emerald-700 font-medium">{Number(m.ingresos) ? `+${formatMoneda(m.ingresos)}` : '—'}</td>
          <td className="py-1.5 text-right text-rose-700 font-medium">{Number(m.egresos) ? `−${formatMoneda(m.egresos)}` : '—'}</td>
        </tr>
      ))}
    </tbody>
  </table>
));

/**
 * Cierre de caja (arqueo): muestra lo que se movió en el turno, recepción escribe el efectivo que contó y se ve al
 * instante si coincide, falta o sobra. Lo que no se retira queda de fondo para el turno siguiente.
 */
const CierreCajaModal = ({ onClose, onCerrado }) => {
  const [turno, setTurno] = useState(null);
  const [datos, setDatos] = useState({ efectivoContado: '', retiro: '', observacion: '' });
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [cierre, setCierre] = useState(null); // el cierre ya registrado

  useEffect(() => {
    obtenerTurno().then(setTurno).catch(err => setError(err.message));
  }, []);
  const cambiar = (campo, valor) => setDatos(prev => ({ ...prev, [campo]: valor }));

  const contado = datos.efectivoContado === '' ? null : Number(datos.efectivoContado);
  const retiro = Number(datos.retiro) || 0;
  // Lo contado es plata de verdad: nunca es negativo, y no se puede retirar más de lo que hay
  const contadoNegativo = contado !== null && contado < 0;
  const errorRetiro = retiro < 0 ? 'No puede ser negativo'
    : contado !== null && !contadoNegativo && retiro > contado ? `No se puede retirar más de lo que contaste (${formatMoneda(contado)})` : '';
  const diferencia = turno && contado !== null && !contadoNegativo ? Math.round((contado - Number(turno.efectivoEsperado)) * 100) / 100 : null;
  const hayDiferencia = diferencia !== null && diferencia !== 0;

  const cerrar = async (e) => {
    e.preventDefault();
    setProcesando(true);
    setError('');
    try {
      const registrado = await cerrarCaja({ efectivoContado: contado, retiro, observacion: datos.observacion.trim() || null });
      setCierre(registrado);
      onCerrado?.(registrado);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) obtenerTurno().then(setTurno).catch(() => {});
    } finally {
      setProcesando(false);
    }
  };

  if (cierre) {
    const dif = textoDiferencia(cierre.diferencia);
    return (
      <Modal titulo="Caja cerrada" subtitulo={`Turno del ${formatFechaHora(cierre.desde)} al ${formatFechaHora(cierre.hasta)}`} onClose={onClose}
        pie={<button type="button" onClick={onClose} className={botonPrimario}>Listo</button>}>
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 className="w-5 h-5" /> Cierre registrado</p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-sm">
            <Fila texto="Efectivo esperado">{formatMoneda(cierre.efectivoEsperado)}</Fila>
            <Fila texto="Efectivo contado">{formatMoneda(cierre.efectivoContado)}</Fila>
            <Fila texto="Diferencia"><span className={dif.clase}>{dif.texto}</span></Fila>
            <Fila texto="Retiro">{formatMoneda(cierre.retiro)}</Fila>
            <Fila texto="Queda de fondo para el próximo turno" fuerte>{formatMoneda(cierre.fondoSiguiente)}</Fila>
          </div>
        </div>
      </Modal>
    );
  }

  const dif = contadoNegativo ? { texto: 'No puede ser negativo: escribí la plata que contaste', clase: 'text-rose-700' }
    : diferencia !== null ? textoDiferencia(diferencia) : null;
  return (
    <Modal titulo="Cerrar caja" ancho="max-w-xl"
      subtitulo={turno ? `Turno abierto desde el ${formatFechaHora(turno.desde)}` : 'Cargando el turno...'}
      onClose={onClose}
      pie={<>
        <button type="button" onClick={onClose} className={botonSecundario}>Cancelar</button>
        <button type="submit" form="form-cierre" disabled={procesando || !turno || contado === null || contadoNegativo || Boolean(errorRetiro)} className={botonPrimario}>
          <Lock className="w-4 h-4" /> {procesando ? 'Cerrando...' : 'Cerrar caja'}
        </button>
      </>}>
      {!turno ? (
        error ? <p className="text-sm text-rose-700 font-medium">{error}</p> : <p className="text-sm text-slate-500">Cargando...</p>
      ) : (
        <form id="form-cierre" onSubmit={cerrar} className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
              Movimientos del turno ({turno.cantidadCobros} {turno.cantidadCobros === 1 ? 'cobro' : 'cobros'}, {turno.cantidadGastos} {turno.cantidadGastos === 1 ? 'gasto' : 'gastos'})
            </p>
            <TablaMetodos metodos={turno.metodos} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-sm">
            <Fila texto="Fondo con el que empezó la caja">{formatMoneda(turno.fondoInicial)}</Fila>
            <Fila texto="+ Cobros en efectivo">{formatMoneda(turno.ingresosEfectivo)}</Fila>
            <Fila texto="− Gastos en efectivo">{formatMoneda(turno.egresosEfectivo)}</Fila>
            <Fila texto="Efectivo que tendría que haber" fuerte>{formatMoneda(turno.efectivoEsperado)}</Fila>
          </div>
          {Number(turno.efectivoEsperado) < 0 && (
            <p className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Da negativo porque se cargaron gastos en efectivo por más de lo que había en la caja. Si alguno lo pagó el dueño
              con su plata, anulalo en la pestaña Gastos y cargalo de nuevo marcando “No salió de la caja”.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Efectivo contado ($)" required ayuda={dif ? undefined : 'Contá los billetes y monedas de la caja'}>
              <input type="number" required min="0" step="0.01" inputMode="decimal" autoFocus value={datos.efectivoContado}
                onChange={e => cambiar('efectivoContado', e.target.value)} className={inputClass} />
              {dif && <p className={`text-sm font-bold mt-1 ${dif.clase}`}>{dif.texto}</p>}
            </Campo>
            <Campo label="Retiro ($)" error={errorRetiro}
              ayuda={contado !== null && !contadoNegativo ? `Queda de fondo para el próximo turno: ${formatMoneda(contado - retiro)}` : 'Lo que se lleva el dueño'}>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={datos.retiro} placeholder="0"
                onChange={e => cambiar('retiro', e.target.value)} className={inputClass} />
            </Campo>
          </div>

          <Campo label={hayDiferencia ? 'Observación (obligatoria: explicá la diferencia)' : 'Observación'} required={hayDiferencia}>
            <textarea rows={2} maxLength={300} value={datos.observacion} required={hayDiferencia}
              placeholder={hayDiferencia ? 'Ej. faltan $ 500: se le dio vuelto de más a un socio' : 'Opcional'}
              onChange={e => cambiar('observacion', e.target.value)} className={`${inputClass} resize-none`} />
          </Campo>
          {error && <p className="text-sm text-rose-700 font-medium">{error}</p>}
        </form>
      )}
    </Modal>
  );
};

export default CierreCajaModal;

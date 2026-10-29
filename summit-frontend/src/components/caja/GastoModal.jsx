import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import { CATEGORIAS_GASTO, obtenerTurno, registrarGasto } from '../../services/caja';
import { METODOS_PAGO } from '../../utils/constantes';
import { formatMoneda } from '../../utils/formato';

/**
 * Registrar un gasto (egreso) de la caja. Uno pagado en efectivo sale de la caja de recepción: se descuenta del
 * efectivo esperado al cerrarla, así que no puede superar lo que hay en ella. Si lo pagó el dueño con su plata, se
 * marca que no salió de la caja.
 */
const GastoModal = ({ onClose, onGuardado }) => {
  const [datos, setDatos] = useState({ monto: '', categoria: 'LIMPIEZA', descripcion: '', metodoPago: 'EFECTIVO', fueraDeCaja: false, comprobante: '' });
  const [turno, setTurno] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const cambiar = (campo, valor) => setDatos(prev => ({ ...prev, [campo]: valor }));

  // Sin el turno no se muestra cuánto hay (el backend controla igual)
  useEffect(() => {
    obtenerTurno().then(setTurno).catch(() => {});
  }, []);
  const efectivo = datos.metodoPago === 'EFECTIVO';
  const enCaja = turno ? Math.max(0, Number(turno.efectivoEsperado)) : null;
  const noAlcanza = efectivo && !datos.fueraDeCaja && enCaja !== null && Number(datos.monto) > enCaja;

  const guardar = async (e) => {
    e.preventDefault();
    setProcesando(true);
    setError('');
    try {
      const gasto = await registrarGasto({
        ...datos, monto: Number(datos.monto), descripcion: datos.descripcion.trim(), fueraDeCaja: efectivo && datos.fueraDeCaja,
      });
      onGuardado(gasto);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal titulo="Registrar gasto" subtitulo="Un pago del gimnasio: sale de la caja si es en efectivo" onClose={onClose}
      pie={<>
        <button type="button" onClick={onClose} className={botonSecundario}>Cancelar</button>
        <button type="submit" form="form-gasto" disabled={procesando || noAlcanza} className={botonPrimario}>
          <Save className="w-4 h-4" /> {procesando ? 'Guardando...' : 'Registrar gasto'}
        </button>
      </>}>
      <form id="form-gasto" onSubmit={guardar} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="Monto ($)" required>
          <input type="number" required min="0.01" step="0.01" inputMode="decimal" autoFocus value={datos.monto}
            onChange={e => cambiar('monto', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Rubro" required>
          <select value={datos.categoria} onChange={e => cambiar('categoria', e.target.value)} className={inputClass}>
            {CATEGORIAS_GASTO.map(c => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
          </select>
        </Campo>
        <Campo label="En qué se gastó" required className="sm:col-span-2">
          <input type="text" required minLength={3} maxLength={200} value={datos.descripcion}
            placeholder="Ej. artículos de limpieza, arreglo de la cinta 2"
            onChange={e => cambiar('descripcion', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Cómo se pagó" required>
          <select value={datos.metodoPago} onChange={e => cambiar('metodoPago', e.target.value)} className={inputClass}>
            {METODOS_PAGO.map(m => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
          </select>
        </Campo>
        <Campo label="Nro. de comprobante">
          <input type="text" maxLength={50} value={datos.comprobante} placeholder="Opcional (factura, ticket)"
            onChange={e => cambiar('comprobante', e.target.value)} className={inputClass} />
        </Campo>
        {efectivo && (
          <div className="sm:col-span-2 space-y-2">
            {!datos.fueraDeCaja && (
              <p className={`text-xs ${noAlcanza ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
                {noAlcanza
                  ? `En la caja hay ${formatMoneda(enCaja)} en efectivo: no alcanza. Si lo pagó el dueño con su plata, marcá la opción de abajo; si se pagó de otra forma, elegí cómo.`
                  : `Sale de la caja de recepción${enCaja !== null ? `: hay ${formatMoneda(enCaja)} en efectivo` : ''}.`}
              </p>
            )}
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${datos.fueraDeCaja ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
              <input type="checkbox" checked={datos.fueraDeCaja} className="mt-0.5 w-4 h-4 accent-amber-600"
                onChange={e => cambiar('fueraDeCaja', e.target.checked)} />
              <span className="text-sm">
                <span className="font-semibold text-slate-800">No salió de la caja: lo pagó el dueño con su plata</span>
                <span className="block text-xs text-slate-500 mt-0.5">Cuenta como gasto del mes, pero no se descuenta del efectivo de la caja.</span>
              </span>
            </label>
          </div>
        )}
        {error && <p className="sm:col-span-2 text-sm text-rose-600 font-medium">{error}</p>}
      </form>
    </Modal>
  );
};

export default GastoModal;

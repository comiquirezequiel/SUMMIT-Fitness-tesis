import React, { useState } from 'react';
import { Save } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import { CATEGORIAS_GASTO, registrarGasto } from '../../services/caja';
import { METODOS_PAGO } from '../../utils/constantes';

/**
 * Registrar un gasto (egreso) de la caja. Uno pagado en efectivo sale de la caja de recepción: se descuenta del
 * efectivo esperado al cerrarla.
 */
const GastoModal = ({ onClose, onGuardado }) => {
  const [datos, setDatos] = useState({ monto: '', categoria: 'LIMPIEZA', descripcion: '', metodoPago: 'EFECTIVO', comprobante: '' });
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const cambiar = (campo, valor) => setDatos(prev => ({ ...prev, [campo]: valor }));

  const guardar = async (e) => {
    e.preventDefault();
    setProcesando(true);
    setError('');
    try {
      const gasto = await registrarGasto({ ...datos, monto: Number(datos.monto), descripcion: datos.descripcion.trim() });
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
        <button type="submit" form="form-gasto" disabled={procesando} className={botonPrimario}>
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
        {datos.metodoPago === 'EFECTIVO' && (
          <p className="sm:col-span-2 text-xs text-slate-500">Sale de la caja de recepción: se descuenta del efectivo esperado al cerrarla.</p>
        )}
        {error && <p className="sm:col-span-2 text-sm text-rose-600 font-medium">{error}</p>}
      </form>
    </Modal>
  );
};

export default GastoModal;

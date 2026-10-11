import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import { apiFetch } from '../../services/api';
import { formatMoneda } from '../../utils/formato';
import { METODOS_PAGO, METODOS_VERIFICABLES } from '../../utils/constantes';

/**
 * Cobro presencial en recepción: registra el pago y extiende la membresía del socio.
 * Una transferencia o un QR que todavía no se ve acreditado puede quedar "a verificar": no extiende
 * la membresía hasta que el admin lo confirme.
 */
const CobroModal = ({ socio, planes, onClose, onGuardado }) => {
  const [datos, setDatos] = useState({ idPlan: '', monto: '', metodoPago: 'EFECTIVO', comprobante: '', aVerificar: false });
  const verificable = METODOS_VERIFICABLES.includes(datos.metodoPago);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const planesActivos = planes.filter(p => p.activo);

  const elegirPlan = (idPlan) => {
    const plan = planesActivos.find(p => p.idPlan.toString() === idPlan);
    setDatos({ ...datos, idPlan, monto: plan ? plan.precioBase : '' });
  };

  const registrar = async (e) => {
    e.preventDefault();
    if (!(Number(datos.monto) > 0)) {
      setError('Ingresá el monto cobrado');
      return;
    }
    setProcesando(true);
    setError('');
    try {
      const res = await apiFetch('/pagos', {
        method: 'POST',
        body: JSON.stringify({ idUsuario: socio.idSocio, ...datos }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo registrar el pago');
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal
      titulo="Registrar cobro"
      subtitulo="El pago extiende la membresía del socio según la duración del plan"
      onClose={onClose}
      pie={<>
        <button type="button" onClick={onClose} className={botonSecundario}>Cancelar</button>
        <button type="submit" form="form-cobro" disabled={procesando || !datos.idPlan} className={botonPrimario}>
          <Wallet className="w-4 h-4" /> {procesando ? 'Procesando...' : 'Confirmar cobro'}
        </button>
      </>}
    >
      <form id="form-cobro" onSubmit={registrar} className="space-y-4">
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Socio</p>
          <p className="font-semibold text-slate-800">{socio.nombreCompleto}</p>
          <p className="text-xs text-slate-500">DNI {socio.dni} · Plan actual: {socio.planActual}</p>
        </div>

        <Campo label="Plan / Membresía" required>
          <select required value={datos.idPlan} onChange={e => elegirPlan(e.target.value)} className={inputClass}>
            <option value="">Seleccioná un plan...</option>
            {planesActivos.map(p => (
              <option key={p.idPlan} value={p.idPlan}>{p.nombrePlan} ({formatMoneda(p.precioBase)})</option>
            ))}
          </select>
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Monto ($)" required>
            <input type="number" min="0" step="0.01" required value={datos.monto}
              onChange={e => setDatos({ ...datos, monto: e.target.value })} className={inputClass} />
          </Campo>
          <Campo label="Método" required>
            <select value={datos.metodoPago} className={inputClass}
              onChange={e => setDatos({ ...datos, metodoPago: e.target.value, aVerificar: false })}>
              {METODOS_PAGO.map(m => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
            </select>
          </Campo>
        </div>

        <Campo label="Nro. de comprobante">
          <input type="text" value={datos.comprobante} placeholder={datos.aVerificar ? 'Recomendado para verificarlo después' : 'Opcional'}
            onChange={e => setDatos({ ...datos, comprobante: e.target.value })} className={inputClass} />
        </Campo>

        {verificable && (
          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${datos.aVerificar ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
            <input type="checkbox" checked={datos.aVerificar} className="mt-0.5 w-4 h-4 accent-amber-600"
              onChange={e => setDatos({ ...datos, aVerificar: e.target.checked })} />
            <span className="text-sm">
              <span className="font-semibold text-slate-800">Todavía no se ve acreditado: dejar a verificar</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                No extiende la membresía ni suma en la caja hasta que un administrador lo confirme.
              </span>
            </span>
          </label>
        )}

        {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
      </form>
    </Modal>
  );
};

export default CobroModal;

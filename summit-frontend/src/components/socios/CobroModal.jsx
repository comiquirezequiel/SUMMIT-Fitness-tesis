import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import DetalleCobro from './DetalleCobro';
import ComprobantePago from './ComprobantePago';
import { formatMoneda } from '../../utils/formato';
import { METODOS_PAGO, METODOS_VERIFICABLES } from '../../utils/constantes';
import { listarDescuentos, registrarCobro, textoValorDescuento, usePresupuesto } from '../../services/membresias';

const ESPECIAL = 'ESPECIAL';

/**
 * Cobro presencial en recepción: registra el pago y extiende la membresía del socio.
 * El total lo calcula el backend (precio del plan - descuento + matrícula si corresponde) y se muestra antes de
 * confirmar. El descuento puede ser uno del catálogo (se propone el habitual del socio) o uno especial con motivo.
 * Una transferencia o un QR que todavía no se ve acreditado puede quedar "a verificar": no extiende
 * la membresía hasta que el admin lo confirme.
 * Después de cobrar muestra el comprobante (PDF y WhatsApp); onGuardado(pago) se llama al cerrarlo.
 */
const CobroModal = ({ socio, planes, onClose, onGuardado }) => {
  const [datos, setDatos] = useState({
    idPlan: '', descuento: '', especialMonto: '', especialMotivo: '', bonificarMatricula: false,
    metodoPago: 'EFECTIVO', comprobante: '', aVerificar: false,
  });
  const [descuentos, setDescuentos] = useState([]);
  const verificable = METODOS_VERIFICABLES.includes(datos.metodoPago);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [registrado, setRegistrado] = useState(null); // el cobro ya registrado: se muestra su comprobante

  const planesActivos = planes.filter(p => p.activo);
  const cambiar = (campo, valor) => setDatos(prev => ({ ...prev, [campo]: valor }));

  // Catálogo de descuentos activos; si el socio tiene uno habitual (y sigue activo), se propone
  useEffect(() => {
    listarDescuentos(true)
      .then((lista) => {
        setDescuentos(lista);
        if (socio.idDescuentoHabitual && lista.some(d => d.idDescuento === socio.idDescuentoHabitual)) {
          setDatos(prev => ({ ...prev, descuento: String(socio.idDescuentoHabitual) }));
        }
      })
      .catch(() => setDescuentos([]));
  }, [socio.idDescuentoHabitual]);

  // El descuento especial entra al cálculo recién cuando tiene monto y motivo
  const especial = datos.descuento === ESPECIAL;
  const especialCompleto = especial && Number(datos.especialMonto) > 0 && datos.especialMotivo.trim().length >= 3;
  const pedido = datos.idPlan ? {
    idUsuario: socio.idSocio,
    idPlan: Number(datos.idPlan),
    idDescuento: datos.descuento && !especial ? Number(datos.descuento) : null,
    descuentoEspecial: especialCompleto ? { monto: Number(datos.especialMonto), motivo: datos.especialMotivo.trim() } : null,
    bonificarMatricula: datos.bonificarMatricula,
  } : null;
  const { presupuesto, calculando, error: errorPresupuesto, recalcular } = usePresupuesto(pedido);
  const listo = presupuesto && !calculando && !errorPresupuesto && (!especial || especialCompleto);

  const registrar = async (e) => {
    e.preventDefault();
    if (!listo) return;
    setProcesando(true);
    setError('');
    try {
      const pago = await registrarCobro({
        ...pedido,
        metodoPago: datos.metodoPago,
        comprobante: datos.comprobante,
        aVerificar: datos.aVerificar,
        totalMostrado: presupuesto.total,
      });
      setRegistrado(pago);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) recalcular(); // cambió un precio: se muestra el total nuevo
    } finally {
      setProcesando(false);
    }
  };

  if (registrado) {
    return (
      <Modal titulo="Cobro registrado" subtitulo="Imprimí el comprobante o mandáselo al socio" onClose={() => onGuardado(registrado)}
        pie={<button type="button" onClick={() => onGuardado(registrado)} className={botonPrimario}>Listo</button>}>
        <ComprobantePago pago={registrado} />
      </Modal>
    );
  }

  return (
    <Modal
      titulo="Registrar cobro"
      subtitulo="El pago extiende la membresía del socio según la duración del plan"
      onClose={onClose}
      pie={<>
        <button type="button" onClick={onClose} className={botonSecundario}>Cancelar</button>
        <button type="submit" form="form-cobro" disabled={procesando || !listo} className={botonPrimario}>
          <Wallet className="w-4 h-4" />
          {procesando ? 'Procesando...' : listo ? `Cobrar ${formatMoneda(presupuesto.total)}` : 'Confirmar cobro'}
        </button>
      </>}
    >
      <form id="form-cobro" onSubmit={registrar} className="space-y-4">
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Socio</p>
          <p className="font-semibold text-slate-800">{socio.nombreCompleto}</p>
          <p className="text-xs text-slate-500">DNI {socio.dni} · Plan actual: {socio.planActual}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Plan / Membresía" required>
            <select required value={datos.idPlan} onChange={e => cambiar('idPlan', e.target.value)} className={inputClass}>
              <option value="">Seleccioná un plan...</option>
              {planesActivos.map(p => (
                <option key={p.idPlan} value={p.idPlan}>{p.nombrePlan} ({formatMoneda(p.precioBase)})</option>
              ))}
            </select>
          </Campo>
          <Campo label="Descuento" ayuda={socio.descuentoHabitual ? `Habitual: ${socio.descuentoHabitual}` : null}>
            <select value={datos.descuento} onChange={e => cambiar('descuento', e.target.value)} className={inputClass}>
              <option value="">Sin descuento</option>
              {descuentos.map(d => (
                <option key={d.idDescuento} value={d.idDescuento}>{d.nombre} ({textoValorDescuento(d)})</option>
              ))}
              <option value={ESPECIAL}>Especial (monto y motivo)...</option>
            </select>
          </Campo>
        </div>

        {especial && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50">
            <Campo label="Monto a descontar ($)" required>
              <input type="number" min="0" step="0.01" value={datos.especialMonto} inputMode="decimal"
                onChange={e => cambiar('especialMonto', e.target.value)} className={inputClass} />
            </Campo>
            <Campo label="Motivo (queda registrado)" required className="sm:col-span-2">
              <input type="text" maxLength={100} value={datos.especialMotivo} placeholder="Ej. promo amigo, ajuste de precio"
                onChange={e => cambiar('especialMotivo', e.target.value)} className={inputClass} />
            </Campo>
          </div>
        )}

        <DetalleCobro presupuesto={presupuesto} calculando={calculando} error={errorPresupuesto}
          bonificarMatricula={datos.bonificarMatricula} onBonificarMatricula={v => cambiar('bonificarMatricula', v)} />
        {especial && !especialCompleto && datos.idPlan && (
          <p className="text-xs text-slate-500">Completá el monto y el motivo para aplicar el descuento especial.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Método" required>
            <select value={datos.metodoPago} className={inputClass}
              onChange={e => setDatos(prev => ({ ...prev, metodoPago: e.target.value, aVerificar: false }))}>
              {METODOS_PAGO.map(m => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
            </select>
          </Campo>
          <Campo label="Nro. de comprobante">
            <input type="text" maxLength={50} value={datos.comprobante} placeholder={datos.aVerificar ? 'Recomendado para verificarlo después' : 'Opcional'}
              onChange={e => cambiar('comprobante', e.target.value)} className={inputClass} />
          </Campo>
        </div>

        {verificable && (
          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${datos.aVerificar ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
            <input type="checkbox" checked={datos.aVerificar} className="mt-0.5 w-4 h-4 accent-amber-600"
              onChange={e => cambiar('aVerificar', e.target.checked)} />
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

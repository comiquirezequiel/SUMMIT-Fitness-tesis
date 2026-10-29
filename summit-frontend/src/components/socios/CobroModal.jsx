import { useEffect, useState } from 'react';
import { Wallet, AlertTriangle } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import DetalleCobro from './DetalleCobro';
import ComprobantePago from './ComprobantePago';
import { SelectorPlan, SelectorMetodo, OpcionAVerificar } from './OpcionesCobro';
import { formatMoneda } from '../../utils/formato';
import { METODOS_VERIFICABLES } from '../../utils/constantes';
import { listarDescuentos, registrarCobro, textoValorDescuento, usePresupuesto } from '../../services/membresias';

const ESPECIAL = 'ESPECIAL';

/**
 * Cobro presencial en recepción: registra el pago y extiende la membresía del socio.
 * Se propone el plan que ya tiene (o el único que hay): para renovar alcanza con elegir cómo paga y cobrar.
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
  // Mientras recepción no elija otro: el plan que ya tiene, si sigue activo, o el único que hay
  const propuesto = planesActivos.some(p => p.idPlan === socio.idPlanActual) ? String(socio.idPlanActual)
    : planesActivos.length === 1 ? String(planesActivos[0].idPlan) : '';
  const idPlan = datos.idPlan || propuesto;
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
  const pedido = idPlan ? {
    idUsuario: socio.idSocio,
    idPlan: Number(idPlan),
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

        {socio.cobroAVerificar && (
          <p className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            Ya tiene un cobro a verificar (transferencia o QR). Antes de cobrarle otra vez, fijate en Caja si esa plata entró.
          </p>
        )}

        <Campo label="Plan / Membresía" required>
          {planesActivos.length > 0
            ? <SelectorPlan planes={planesActivos} valor={idPlan} onCambiar={v => cambiar('idPlan', v)} />
            : <p className="text-sm text-slate-500">No hay planes activos (se crean en Membresías &gt; Planes).</p>}
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
        {especial && !especialCompleto && idPlan && (
          <p className="text-xs text-slate-500">Completá el monto y el motivo para aplicar el descuento especial.</p>
        )}

        <Campo label="¿Cómo paga?" required>
          {/* En efectivo no hay comprobante que anotar */}
          <SelectorMetodo valor={datos.metodoPago}
            onCambiar={v => setDatos(prev => ({ ...prev, metodoPago: v, aVerificar: false, comprobante: v === 'EFECTIVO' ? '' : prev.comprobante }))} />
        </Campo>
        {datos.metodoPago !== 'EFECTIVO' && (
          <Campo label="Nro. de comprobante">
            <input type="text" maxLength={50} value={datos.comprobante} placeholder={datos.aVerificar ? 'Recomendado para verificarlo después' : 'Opcional'}
              onChange={e => cambiar('comprobante', e.target.value)} className={inputClass} />
          </Campo>
        )}

        {verificable && <OpcionAVerificar marcada={datos.aVerificar} onCambiar={v => cambiar('aVerificar', v)} />}

        {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
      </form>
    </Modal>
  );
};

export default CobroModal;

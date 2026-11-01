import { lazy, Suspense, useEffect, useState } from 'react';
import { CreditCard, FlaskConical } from 'lucide-react';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import { cobrarConTarjeta, configTarjeta } from '../../services/membresias';
import { formatMoneda } from '../../utils/formato';

// El formulario de Mercado Pago y su librería se descargan recién cuando se cobra con tarjeta
const FormularioMercadoPago = lazy(() => import('./FormularioMercadoPago'));

// Una clave por intento de cobro: si el pedido se repite (por un corte), Mercado Pago no cobra dos veces.
// crypto.randomUUID solo existe con https; getRandomValues, siempre
const claveNueva = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

const TITULARES_DE_PRUEBA = [
  ['APRO', 'aprobado'], ['CONT', 'en proceso'], ['FUND', 'sin fondos'], ['SECU', 'código incorrecto'], ['OTHE', 'rechazado'],
];

// Formulario del simulador (MP_TARJETA=SIMULADOR): como las tarjetas de prueba de Mercado Pago, el titular decide el
// resultado. No se manda ningún dato de la tarjeta: solo el titular y si es de débito
const FormularioDePrueba = ({ total, onCobrar }) => {
  const [titular, setTitular] = useState('APRO');
  const [debito, setDebito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const cobrar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await onCobrar({ token: `SIM-${titular}-${claveNueva()}`, medio: debito ? 'debvisa' : 'visa', cuotas: 1, email: 'prueba@summit.local', tipoDocumento: 'DNI', documento: '12345678' });
    } catch {
      // el error lo muestra PagoConTarjeta
    } finally {
      setEnviando(false);
    }
  };
  return (
    <form onSubmit={cobrar} className="space-y-3">
      <p className="flex items-start gap-2 p-3 rounded-xl bg-violet-50 border border-violet-200 text-sm text-violet-800">
        <FlaskConical className="w-4 h-4 shrink-0 mt-0.5" />
        Simulador de Mercado Pago: no se cobra de verdad. El titular decide el resultado, como las tarjetas de prueba de Mercado Pago.
      </p>
      <Campo label="Titular de la tarjeta (de prueba)">
        <select value={titular} onChange={(e) => setTitular(e.target.value)} className={inputClass}>
          {TITULARES_DE_PRUEBA.map(([valor, texto]) => <option key={valor} value={valor}>{valor} · {texto}</option>)}
        </select>
      </Campo>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={debito} onChange={(e) => setDebito(e.target.checked)} className="w-4 h-4" /> Es una tarjeta de débito
      </label>
      <button type="submit" disabled={enviando} className={`${botonPrimario} w-full justify-center`}>
        <CreditCard className="w-4 h-4" /> {enviando ? 'Cobrando...' : `Cobrar ${formatMoneda(total)}`}
      </button>
    </form>
  );
};

/**
 * Cobro con tarjeta por Mercado Pago: la tarjeta se carga en el formulario de Mercado Pago (o, en el simulador, en
 * uno de prueba) y el backend cobra el total que calculó. pedido: el cobro con el total que vio recepción.
 * onListo(pago): cobrado (aprobado, o a verificar si Mercado Pago lo dejó en proceso). onVolver: elegir otro medio.
 * onTotalCambiado: cambió un precio y no se llegó a cobrar.
 */
const PagoConTarjeta = ({ pedido, total, onListo, onVolver, onTotalCambiado }) => {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [clave, setClave] = useState(claveNueva);

  useEffect(() => {
    configTarjeta().then(setConfig).catch((err) => setError(err.message));
  }, []);

  const cobrar = async (tarjeta) => {
    setError('');
    try {
      onListo(await cobrarConTarjeta({ cobro: pedido, tarjeta, idempotencia: clave }));
    } catch (err) {
      setError(err.message);
      if (err.status === 409) onTotalCambiado();
      // Un rechazo termina ese intento: el próximo es otro cobro
      if (err.status === 402) setClave(claveNueva());
      throw err;
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Total a cobrar: <span className="font-bold text-slate-800">{formatMoneda(total)}</span></p>
      {config?.modo === 'SIMULADOR' && <FormularioDePrueba total={total} onCobrar={cobrar} />}
      {config?.modo === 'MERCADO_PAGO' && (
        <Suspense fallback={<p className="text-sm text-slate-500">Cargando el formulario de Mercado Pago…</p>}>
          <FormularioMercadoPago publicKey={config.publicKey} total={total} onCobrar={cobrar} />
        </Suspense>
      )}
      {!config && !error && <p className="text-sm text-slate-500">Preparando el cobro con tarjeta…</p>}
      {error && <p className="text-sm text-rose-700 font-medium" role="alert">{error}</p>}
      <button type="button" onClick={onVolver} className={`${botonSecundario} w-full justify-center`}>Elegir otro medio de pago</button>
    </div>
  );
};

export default PagoConTarjeta;

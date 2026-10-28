import React from 'react';
import { Banknote, ArrowLeftRight, QrCode, CreditCard } from 'lucide-react';
import { formatMoneda } from '../../utils/formato';
import { METODOS_PAGO } from '../../utils/constantes';

// Elecciones del cobro con un toque (alta de socio y cobro en recepción): el plan y cómo paga

const ICONOS_METODO = {
  EFECTIVO: Banknote, TRANSFERENCIA: ArrowLeftRight, MERCADO_PAGO: QrCode, TARJETA_DEBITO: CreditCard, TARJETA_CREDITO: CreditCard,
};
// Con el ícono de la tarjeta alcanza, y así el botón no se parte en dos renglones
const TEXTO_CORTO = { TARJETA_DEBITO: 'Débito', TARJETA_CREDITO: 'Crédito' };

// "3 veces por semana · 30 días" o "Libre · 30 días"
const detallePlan = (p) => {
  const veces = p.vecesPorSemana ? `${p.vecesPorSemana} ${p.vecesPorSemana === 1 ? 'vez' : 'veces'} por semana` : 'Libre';
  return `${veces} · ${p.duracionDias} días`;
};

const claseOpcion = (elegida) => `cursor-pointer rounded-xl border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-300 ${
  elegida ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`;

/**
 * Planes activos como tarjetas (nombre, precio y qué incluye). valor: el idPlan elegido, como texto ('' = ninguno).
 */
export const SelectorPlan = ({ planes, valor, onCambiar }) => (
  <div role="radiogroup" aria-label="Plan" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    {planes.map(p => {
      const elegido = String(p.idPlan) === valor;
      return (
        <label key={p.idPlan} className={`${claseOpcion(elegido)} p-3`}>
          <input type="radio" name="plan-cobro" value={p.idPlan} checked={elegido} onChange={() => onCambiar(String(p.idPlan))} className="sr-only" />
          <span className="flex justify-between items-baseline gap-3">
            <span className="font-semibold text-slate-800">{p.nombrePlan}</span>
            <span className="font-bold text-slate-900 whitespace-nowrap">{formatMoneda(p.precioBase)}</span>
          </span>
          <span className="block text-xs text-slate-500 mt-0.5">{detallePlan(p)}</span>
        </label>
      );
    })}
  </div>
);

/**
 * Medios de pago que puede elegir recepción, como botones.
 */
export const SelectorMetodo = ({ valor, onCambiar }) => (
  <div role="radiogroup" aria-label="Cómo paga" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
    {METODOS_PAGO.map(m => {
      const Icono = ICONOS_METODO[m.valor] || Banknote;
      const elegido = m.valor === valor;
      return (
        <label key={m.valor} title={m.texto}
          className={`${claseOpcion(elegido)} px-3 py-2.5 tactil:min-h-11 flex items-center gap-2 text-sm font-semibold whitespace-nowrap ${elegido ? 'text-blue-700' : 'text-slate-700'}`}>
          <input type="radio" name="metodo-cobro" value={m.valor} checked={elegido} onChange={() => onCambiar(m.valor)} className="sr-only" />
          <Icono className={`w-4 h-4 shrink-0 ${elegido ? 'text-blue-600' : 'text-slate-400'}`} />
          {TEXTO_CORTO[m.valor] || m.texto}
        </label>
      );
    })}
  </div>
);

/**
 * Transferencia o QR que todavía no se ve acreditado: el cobro queda "a verificar" hasta que un admin lo confirme.
 */
export const OpcionAVerificar = ({ marcada, onCambiar }) => (
  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${marcada ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
    <input type="checkbox" checked={marcada} className="mt-0.5 w-4 h-4 accent-amber-600" onChange={e => onCambiar(e.target.checked)} />
    <span className="text-sm">
      <span className="font-semibold text-slate-800">Todavía no se ve acreditado: dejar a verificar</span>
      <span className="block text-xs text-slate-500 mt-0.5">
        No extiende la membresía ni suma en la caja hasta que un administrador lo confirme.
      </span>
    </span>
  </label>
);

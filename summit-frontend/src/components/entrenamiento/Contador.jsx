import React from 'react';
import { Minus, Plus } from 'lucide-react';

const boton = 'w-10 tactil:w-11 shrink-0 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent';

/**
 * Número con botones − y + para cargarlo con el dedo (series, repeticiones, carga, descanso). Igual se puede escribir:
 * en el celular abre el teclado numérico.
 * - valor: texto, como los demás campos del formulario. Vacío = sin valor (por ejemplo, peso corporal)
 * - paso, min, max: los rangos del backend. vacioPermitido: bajar del mínimo deja el campo vacío
 */
const Contador = ({ valor, onChange, etiqueta, paso = 1, min = 0, max, vacioPermitido = false, decimales = false, placeholder, deshabilitado }) => {
  const numero = valor === '' || valor === null || valor === undefined || Number.isNaN(Number(valor)) ? null : Number(valor);

  const sumar = (delta) => {
    let nuevo;
    if (numero === null) nuevo = delta > 0 ? Math.max(min, paso) : null;
    else nuevo = Math.round((numero + delta) * 100) / 100;
    if (nuevo !== null && nuevo < min) nuevo = vacioPermitido ? null : min;
    if (nuevo !== null && max !== undefined && nuevo > max) nuevo = max;
    onChange(nuevo === null ? '' : String(nuevo));
  };

  const puedeRestar = numero !== null && (numero > min || (vacioPermitido && numero >= min));
  const puedeSumar = max === undefined || numero === null || numero < max;

  return (
    // 46 px en el celular y la tablet: 44 de botón más el borde (el mismo alto que los demás campos)
    <div className={`flex h-10 tactil:h-[46px] rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 ${deshabilitado ? 'bg-slate-50 opacity-70' : ''}`}>
      <button type="button" onClick={() => sumar(-paso)} disabled={deshabilitado || !puedeRestar} className={`${boton} border-r border-slate-200`}
        aria-label={`Restar ${etiqueta}`}>
        <Minus className="w-4 h-4" />
      </button>
      <input type="number" inputMode={decimales ? 'decimal' : 'numeric'} value={valor} min={min} max={max} step={decimales ? 0.5 : 1}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={deshabilitado} aria-label={etiqueta}
        className="flex-1 min-w-0 w-full text-center text-sm tactil:text-base font-semibold text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-400 placeholder:font-normal placeholder:text-[13px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
      <button type="button" onClick={() => sumar(paso)} disabled={deshabilitado || !puedeSumar} className={`${boton} border-l border-slate-200`}
        aria-label={`Sumar ${etiqueta}`}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Contador;

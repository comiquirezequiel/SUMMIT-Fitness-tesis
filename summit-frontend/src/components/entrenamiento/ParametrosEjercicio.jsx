import React from 'react';
import Campo, { inputClass } from '../Campo';

export const PARAMETROS_INICIALES = { series: '4', repeticiones: '10', pesoSugeridoKg: '', descansoSegundos: '90', observaciones: '' };

const aTexto = (v) => (v === null || v === undefined ? '' : String(v));

// Parámetros de un ejercicio de la rutina -> valores del formulario (texto)
export const parametrosDe = (e) => ({
  series: aTexto(e.series),
  repeticiones: aTexto(e.repeticiones),
  pesoSugeridoKg: aTexto(e.pesoSugeridoKg),
  descansoSegundos: aTexto(e.descansoSegundos),
  observaciones: e.observaciones || '',
});

/**
 * Valida el formulario con los mismos rangos que el backend y lo convierte al JSON de la API.
 * Devuelve { datos } o { error }. Peso vacío = peso corporal; descanso vacío = sin indicar.
 */
export const validarParametros = (p) => {
  const series = Number(p.series);
  const repeticiones = Number(p.repeticiones);
  if (p.series === '' || !Number.isInteger(series) || series < 1 || series > 20) return { error: 'Las series deben ser de 1 a 20.' };
  if (p.repeticiones === '' || !Number.isInteger(repeticiones) || repeticiones < 1 || repeticiones > 100) {
    return { error: 'Las repeticiones deben ser de 1 a 100.' };
  }
  let pesoSugeridoKg = null;
  if (String(p.pesoSugeridoKg).trim() !== '') {
    pesoSugeridoKg = Number(p.pesoSugeridoKg);
    if (!(pesoSugeridoKg >= 0 && pesoSugeridoKg <= 500)) return { error: 'El peso sugerido debe ser de 0 a 500 kg (vacío = peso corporal).' };
  }
  let descansoSegundos = null;
  if (String(p.descansoSegundos).trim() !== '') {
    descansoSegundos = Number(p.descansoSegundos);
    if (!Number.isInteger(descansoSegundos) || descansoSegundos < 0 || descansoSegundos > 600) {
      return { error: 'El descanso debe ser de 0 a 600 segundos.' };
    }
  }
  const observaciones = (p.observaciones || '').trim();
  if (observaciones.length > 300) return { error: 'Las observaciones no pueden superar los 300 caracteres.' };
  return { datos: { series, repeticiones, pesoSugeridoKg, descansoSegundos, observaciones: observaciones || null } };
};

/**
 * Campos de series, repeticiones, peso sugerido, descanso y observaciones.
 */
const ParametrosEjercicio = ({ valores, onChange, deshabilitado }) => {
  const cambiar = (campo) => (e) => onChange(campo, e.target.value);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Campo label="Series" required>
          <input type="number" inputMode="numeric" min="1" max="20" value={valores.series} onChange={cambiar('series')}
            disabled={deshabilitado} className={inputClass} />
        </Campo>
        <Campo label="Repeticiones" required>
          <input type="number" inputMode="numeric" min="1" max="100" value={valores.repeticiones} onChange={cambiar('repeticiones')}
            disabled={deshabilitado} className={inputClass} />
        </Campo>
        <Campo label="Peso sug. (kg)">
          <input type="number" inputMode="decimal" min="0" max="500" step="0.5" value={valores.pesoSugeridoKg}
            onChange={cambiar('pesoSugeridoKg')} placeholder="Corporal" disabled={deshabilitado} className={inputClass} />
        </Campo>
        <Campo label="Descanso (seg)">
          <input type="number" inputMode="numeric" min="0" max="600" step="15" value={valores.descansoSegundos}
            onChange={cambiar('descansoSegundos')} disabled={deshabilitado} className={inputClass} />
        </Campo>
      </div>
      <Campo label="Observaciones">
        <input type="text" maxLength={300} value={valores.observaciones} onChange={cambiar('observaciones')}
          placeholder="Ej.: bajar lento, rango corto, usar banco" disabled={deshabilitado} className={inputClass} />
      </Campo>
    </div>
  );
};

export default ParametrosEjercicio;

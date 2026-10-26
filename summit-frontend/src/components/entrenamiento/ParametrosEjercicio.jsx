import React from 'react';
import Campo, { inputClass } from '../Campo';
import Contador from './Contador';
import { formatDescanso } from './comun';

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
 * Series, repeticiones, carga, descanso y notas. Los números van con botones − y + para cargarlos con el dedo.
 * Las columnas se acomodan al ancho disponible (2 en el celular, 4 en la tablet acostada y en la PC).
 */
const ParametrosEjercicio = ({ valores, onChange, deshabilitado }) => {
  const descanso = String(valores.descansoSegundos).trim() === '' ? null : formatDescanso(Number(valores.descansoSegundos));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]">
        <Campo label="Series" required>
          <Contador etiqueta="series" valor={valores.series} onChange={(v) => onChange('series', v)} min={1} max={20} deshabilitado={deshabilitado} />
        </Campo>
        <Campo label="Repeticiones" required>
          <Contador etiqueta="repeticiones" valor={valores.repeticiones} onChange={(v) => onChange('repeticiones', v)} min={1} max={100}
            deshabilitado={deshabilitado} />
        </Campo>
        <Campo label="Carga (kg)" ayuda={String(valores.pesoSugeridoKg).trim() === '' ? 'Vacía: peso corporal' : null}>
          <Contador etiqueta="carga en kilos" valor={valores.pesoSugeridoKg} onChange={(v) => onChange('pesoSugeridoKg', v)} paso={2.5} min={0} max={500}
            vacioPermitido decimales placeholder="Corporal" deshabilitado={deshabilitado} />
        </Campo>
        <Campo label="Descanso (seg)" ayuda={descanso && Number(valores.descansoSegundos) >= 60 ? descanso : null}>
          <Contador etiqueta="segundos de descanso" valor={valores.descansoSegundos} onChange={(v) => onChange('descansoSegundos', v)} paso={15} min={0}
            max={600} vacioPermitido placeholder="—" deshabilitado={deshabilitado} />
        </Campo>
      </div>
      <Campo label="Notas para el socio">
        <input type="text" maxLength={300} value={valores.observaciones} onChange={(e) => onChange('observaciones', e.target.value)}
          placeholder="Ej.: bajar lento, rango corto, usar banco" disabled={deshabilitado} className={inputClass} />
      </Campo>
    </div>
  );
};

export default ParametrosEjercicio;

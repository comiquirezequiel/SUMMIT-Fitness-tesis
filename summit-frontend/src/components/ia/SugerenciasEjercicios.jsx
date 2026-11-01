import { useEffect, useState } from 'react';
import { ejerciciosAEvitar } from '../../services/ia';
import { useEstadoIa, BotonIa, AvisoIaNoDisponible } from './AsistenteIa';

// Etiqueta y colores según de dónde sale cada sugerencia (lo calcula el backend en "origen"):
// REGLA (ámbar) = contraindicación cargada en el catálogo; IA (violeta) = solo lo sugiere el modelo;
// AMBOS (rojo) = coinciden las dos fuentes, el caso de mayor certeza.
const ORIGEN = {
  REGLA: { texto: 'Regla', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  IA: { texto: 'IA', clase: 'bg-violet-50 text-violet-700 border-violet-200' },
  AMBOS: { texto: 'Regla + IA', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
};

/**
 * Ejercicios del catálogo que el socio debería evitar según su ficha médica: lo que marca la regla firme
 * (contraindicaciones del catálogo) y lo que agrega el asistente de IA, cada uno con su motivo.
 * onSugerencias recibe un Map idEjercicio -> { motivo, origen } para marcar el selector de ejercicios.
 *
 * Se usa dentro de la tarjeta "Ficha médica" del Constructor de rutinas. La consulta NO es automática
 * (se dispara con el botón) porque tarda ~30 s y ocupa la placa de video: solo se pide cuando el profe la necesita.
 */
const SugerenciasEjercicios = ({ idSocio, onSugerencias }) => {
  const estado = useEstadoIa();                     // ¿está Ollama disponible?
  const [cargando, setCargando] = useState(false);  // consulta en curso (muestra el cronómetro)
  const [resultado, setResultado] = useState(null); // el SugerenciaEjerciciosDTO del backend
  const [error, setError] = useState('');

  // Otro socio: las sugerencias del anterior ya no valen
  // También le avisa al Constructor (onSugerencias con un Map vacío) para que borre las marcas ✦ del selector.
  useEffect(() => {
    setResultado(null);
    setError('');
    onSugerencias(new Map());
  }, [idSocio, onSugerencias]);

  const pedir = async () => {
    setError('');
    setCargando(true);
    const r = await ejerciciosAEvitar(idSocio);
    setCargando(false);
    if (!r.ok) {
      setError(r.error);   // ej. "El socio no tiene patologías cargadas..." o "Ollama no está corriendo..."
      return;
    }
    setResultado(r.datos);
    // Se le pasa al Constructor un Map (búsqueda rápida por id) para marcar los ejercicios en el desplegable.
    onSugerencias(new Map(r.datos.ejercicios.map(e => [e.idEjercicio, { motivo: e.motivo, origen: e.origen }])));
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
      <BotonIa estado={estado} cargando={cargando} onClick={pedir} className="w-full">
        {resultado ? 'Volver a consultar a la IA' : 'Ejercicios a evitar según la IA'}
      </BotonIa>
      <AvisoIaNoDisponible estado={estado} />
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {resultado && (
        <div className="space-y-2 text-sm">
          {resultado.ejercicios.length === 0 ? (
            <p className="text-slate-600">No encontró ejercicios del catálogo para evitar.</p>
          ) : (
            <ul className="space-y-1.5">
              {/* Cada ejercicio: nombre, origen (Regla / IA / Regla + IA) y el motivo para el profesor. */}
              {resultado.ejercicios.map(e => (
                <li key={e.idEjercicio} className="p-2 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-800">{e.nombre}</span>
                    <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-sm border ${ORIGEN[e.origen]?.clase}`}>
                      {ORIGEN[e.origen]?.texto}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{e.motivo}</p>
                </li>
              ))}
            </ul>
          )}
          {resultado.recomendacion && <p className="text-xs text-slate-600"><b>Consejo:</b> {resultado.recomendacion}</p>}
          {/* Trazabilidad (modelo y tiempo) y recordatorio de que decide el profesor. */}
          <p className="text-xs text-slate-500">
            {resultado.modelo} · {resultado.segundos} s · Son sugerencias: el criterio final es del profesor.
          </p>
        </div>
      )}
    </div>
  );
};

export default SugerenciasEjercicios;

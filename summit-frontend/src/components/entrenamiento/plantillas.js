// Rutinas predeterminadas: plantillas para asignar rápido una rutina armada y después ajustarla al socio.
// Se cargan en el constructor como un borrador más: el cruce con la ficha médica marca igual los ejercicios
// contraindicados y nada se guarda hasta "Crear rutina".
// Los ejercicios se buscan por nombre en el catálogo del gimnasio (sin mayúsculas ni tildes). Los que no estén se
// saltean y se avisa cuáles. Repeticiones, descanso (segundos) y notas con los mismos rangos que el formulario.
import { normalizar } from './comun';

const ej = (nombre, series, repeticiones, descansoSegundos, observaciones = null) =>
  ({ nombre, series, repeticiones, descansoSegundos, observaciones });

const PLANCHA = ej('Plancha frontal', 3, 30, 45, 'Sostener 30 segundos por serie');

export const PLANTILLAS = [
  {
    id: 'full-body-3',
    nombre: 'Full body 3 días',
    objetivo: 'Salud general',
    nivel: 'Principiante',
    descripcion: 'Todo el cuerpo en cada sesión: para empezar o volver a entrenar.',
    dias: [
      [ej('Sentadilla con barra', 3, 10, 90), ej('Press de banca plano', 3, 10, 90), ej('Jalón al pecho en polea', 3, 12, 60),
        ej('Elevaciones laterales con mancuernas', 3, 12, 60), PLANCHA],
      [ej('Prensa de piernas', 3, 12, 90), ej('Press inclinado con mancuernas', 3, 10, 90), ej('Remo con barra', 3, 10, 90),
        ej('Curl de bíceps con barra', 3, 12, 60), ej('Crunch abdominal', 3, 15, 45)],
      [ej('Peso muerto rumano', 3, 10, 90), ej('Fondos en paralelas', 3, 10, 90), ej('Jalón al pecho en polea', 3, 12, 60),
        ej('Hip thrust con barra', 3, 12, 60), ej('Elevación de talones de pie', 3, 15, 45)],
    ],
  },
  {
    id: 'torso-piernas-4',
    nombre: 'Torso / Piernas 4 días',
    objetivo: 'Hipertrofia',
    nivel: 'Intermedio',
    descripcion: 'Dos días de torso y dos de piernas, alternados: más volumen por grupo.',
    dias: [
      [ej('Press de banca plano', 4, 8, 120), ej('Remo con barra', 4, 8, 120), ej('Press militar con barra', 3, 10, 90),
        ej('Jalón al pecho en polea', 3, 10, 90), ej('Extensión de tríceps en polea', 3, 12, 60), ej('Curl de bíceps con barra', 3, 12, 60)],
      [ej('Sentadilla con barra', 4, 8, 120), ej('Peso muerto rumano', 3, 10, 120), ej('Prensa de piernas', 3, 12, 90),
        ej('Curl femoral acostado', 3, 12, 60), ej('Elevación de talones de pie', 4, 15, 45)],
      [ej('Press inclinado con mancuernas', 4, 10, 90), ej('Dominadas', 4, 8, 120), ej('Elevaciones laterales con mancuernas', 3, 15, 60),
        ej('Fondos en paralelas', 3, 10, 90), ej('Curl martillo con mancuernas', 3, 12, 60)],
      [ej('Hip thrust con barra', 4, 10, 90), ej('Extensión de cuádriceps en máquina', 3, 12, 60), ej('Curl femoral acostado', 3, 12, 60),
        ej('Prensa de piernas', 3, 15, 90), ej('Crunch abdominal', 3, 15, 45), PLANCHA],
    ],
  },
  {
    id: 'push-pull-legs-3',
    nombre: 'Push / Pull / Legs',
    objetivo: 'Hipertrofia',
    nivel: 'Intermedio',
    descripcion: 'Empuje, tracción y piernas: cada grupo, una vez por semana con buen volumen.',
    dias: [
      [ej('Press de banca plano', 4, 8, 120), ej('Press inclinado con mancuernas', 3, 10, 90), ej('Press militar con barra', 3, 10, 90),
        ej('Elevaciones laterales con mancuernas', 3, 15, 60), ej('Extensión de tríceps en polea', 3, 12, 60), ej('Fondos en paralelas', 3, 10, 90)],
      [ej('Dominadas', 4, 8, 120), ej('Remo con barra', 4, 8, 120), ej('Jalón al pecho en polea', 3, 12, 90),
        ej('Curl de bíceps con barra', 3, 10, 60), ej('Curl martillo con mancuernas', 3, 12, 60)],
      [ej('Sentadilla con barra', 4, 8, 120), ej('Peso muerto rumano', 3, 10, 120), ej('Prensa de piernas', 3, 12, 90),
        ej('Curl femoral acostado', 3, 12, 60), ej('Elevación de talones de pie', 4, 15, 45), ej('Crunch abdominal', 3, 15, 45)],
    ],
  },
  {
    id: 'fuerza-5x5',
    nombre: 'Fuerza 5×5',
    objetivo: 'Fuerza',
    nivel: 'Intermedio',
    descripcion: 'Pocos ejercicios básicos, cinco series de cinco con descanso largo.',
    dias: [
      [ej('Sentadilla con barra', 5, 5, 180), ej('Press de banca plano', 5, 5, 180), ej('Remo con barra', 5, 5, 150), PLANCHA],
      [ej('Peso muerto rumano', 5, 5, 180), ej('Press militar con barra', 5, 5, 150), ej('Dominadas', 4, 6, 150),
        ej('Crunch abdominal', 3, 15, 45)],
      [ej('Sentadilla con barra', 5, 5, 180), ej('Press de banca plano', 5, 5, 180), ej('Hip thrust con barra', 4, 8, 120),
        ej('Elevación de talones de pie', 3, 15, 45)],
    ],
  },
  {
    id: 'quema-3',
    nombre: 'Tonificación 3 días',
    objetivo: 'Pérdida de peso',
    nivel: 'Principiante',
    descripcion: 'Más repeticiones y descansos cortos: circuito para gastar más energía.',
    dias: [
      [ej('Prensa de piernas', 3, 15, 45), ej('Press inclinado con mancuernas', 3, 15, 45), ej('Jalón al pecho en polea', 3, 15, 45),
        ej('Elevaciones laterales con mancuernas', 3, 15, 45), ej('Crunch abdominal', 3, 20, 30)],
      [ej('Hip thrust con barra', 3, 15, 45), ej('Extensión de cuádriceps en máquina', 3, 15, 45), ej('Curl femoral acostado', 3, 15, 45),
        ej('Elevación de talones de pie', 3, 20, 30), PLANCHA],
      [ej('Sentadilla con barra', 3, 12, 60), ej('Remo con barra', 3, 12, 60), ej('Press de banca plano', 3, 12, 60),
        ej('Curl martillo con mancuernas', 3, 15, 45), ej('Extensión de tríceps en polea', 3, 15, 45)],
    ],
  },
];

export const plantillaPorId = (id) => PLANTILLAS.find((p) => p.id === id) || null;

// "3 días · 15 ejercicios"
export const resumenPlantilla = (p) => `${p.dias.length} ${p.dias.length === 1 ? 'día' : 'días'} · ${p.dias.flat().length} ejercicios`;

/**
 * Ejercicios de la plantilla como ítems del borrador del constructor (con el ejercicio del catálogo), y los nombres
 * que el catálogo no tiene: { items, faltantes }.
 */
export const armarDesdePlantilla = (plantilla, catalogo) => {
  const porNombre = new Map(catalogo.map((e) => [normalizar(e.nombre), e]));
  const items = [];
  const faltantes = [];
  plantilla.dias.forEach((ejercicios, i) => ejercicios.forEach((e) => {
    const delCatalogo = porNombre.get(normalizar(e.nombre));
    if (!delCatalogo) {
      faltantes.push(e.nombre);
      return;
    }
    items.push({
      idEjercicio: delCatalogo.idEjercicio, nombreEjercicio: delCatalogo.nombre, grupoMuscular: delCatalogo.grupoMuscular,
      diaNumero: i + 1, series: e.series, repeticiones: e.repeticiones, pesoSugeridoKg: null,
      descansoSegundos: e.descansoSegundos, observaciones: e.observaciones,
    });
  }));
  return { items, faltantes: [...new Set(faltantes)] };
};

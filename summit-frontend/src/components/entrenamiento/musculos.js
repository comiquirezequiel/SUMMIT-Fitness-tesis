// Músculos del modelo del cuerpo (data/musculos.js) y su grupo muscular en el catálogo de ejercicios. Cada ejercicio
// del catálogo trae svgTargetId: el músculo del modelo que trabaja (ver DataSeeder). Lo usan el catálogo interactivo
// (Ejercicios) y el constructor de rutinas para buscar ejercicios tocando el cuerpo.

// Los antebrazos no tienen grupo propio en el catálogo: muestran solo los ejercicios que los marcan
export const GRUPO_DE_MUSCULO = {
  'pecho-superior': 'PECHO', 'pecho-medio': 'PECHO', 'pecho-inferior': 'PECHO',
  'deltoide-frontal': 'HOMBROS', 'deltoide-lateral': 'HOMBROS', 'deltoides-posterior': 'HOMBROS',
  'cabeza-larga': 'BICEPS', 'cabeza-corta': 'BICEPS', 'antebrazo-braquiorradial': 'BICEPS',
  'triceps-larga': 'TRICEPS', 'triceps-lateral': 'TRICEPS', 'triceps-medial': 'TRICEPS',
  'recto-abdominal': 'ABDOMINALES', oblicuos: 'CORE', 'serrato-anterior': 'CORE',
  'trapecio-superior': 'ESPALDA', 'espalda-alta': 'ESPALDA', 'dorsales-anchos': 'ESPALDA', lumbar: 'ESPALDA',
  cuadriceps: 'CUADRICEPS', aductores: 'CUADRICEPS', 'tibia-anterior': 'PANTORRILLAS',
  gluteo: 'GLUTEOS', abductores: 'GLUTEOS', isquiotibiales: 'ISQUIOS', gemelos: 'PANTORRILLAS',
};

/**
 * Ejercicios del catálogo para un músculo del modelo: los que lo trabajan directo y, aparte, los demás de su grupo.
 * Devuelve { directos, delGrupo, grupo }.
 */
export const ejerciciosDelMusculo = (catalogo, idMusculo) => {
  const grupo = GRUPO_DE_MUSCULO[idMusculo] || null;
  const directos = catalogo.filter((e) => e.svgTargetId === idMusculo);
  const delGrupo = grupo ? catalogo.filter((e) => e.svgTargetId !== idMusculo && e.grupoMuscular === grupo) : [];
  return { directos, delGrupo, grupo };
};

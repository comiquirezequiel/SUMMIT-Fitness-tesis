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

// Ejercicios correspondientes a los GIFs en public/gym-exercises/ con su músculo/sector y grupo muscular.
// Si alguno no existe todavía en la base de datos, se crea automáticamente y se vincula su urlMedia.
export const EJERCICIOS_CON_GIF = [
  {
    nombre: 'Abdominales en V con mancuerna',
    grupoMuscular: 'ABDOMINALES',
    svgTargetId: 'recto-abdominal',
    patologiasContraindicadas: 'HERNIA,LUMBAR',
    descripcion: 'Acostado boca arriba con una mancuerna en las manos, elevar al mismo tiempo el torso y las piernas extendidas formando una V.',
    urlMedia: '/gym-exercises/abdominales_en_v_con_mancuerna.gif',
  },
  {
    nombre: 'Abducción de cadera en polea',
    grupoMuscular: 'GLUTEOS',
    svgTargetId: 'abductores',
    patologiasContraindicadas: null,
    descripcion: 'De pie junto a la polea baja con tobillera, separar la pierna hacia el costado manteniendo el torso firme.',
    urlMedia: '/gym-exercises/abduccion_cable.gif',
  },
  {
    nombre: 'Aducción en máquina',
    grupoMuscular: 'CUADRICEPS',
    svgTargetId: 'aductores',
    patologiasContraindicadas: null,
    descripcion: 'En la máquina de aductores, llevar la pierna hacia adentro cruzando la línea media con movimiento controlado.',
    urlMedia: '/gym-exercises/aduccion_maquina.gif',
  },
  {
    nombre: 'Air Bike (Bicicleta de aire)',
    grupoMuscular: 'CUADRICEPS',
    svgTargetId: 'cuadriceps',
    patologiasContraindicadas: 'RODILLA',
    descripcion: 'Pedalear y empujar los brazos de la bicicleta de aire en simultáneo manteniendo el torso erguido.',
    urlMedia: '/gym-exercises/air_bike.gif',
  },
  {
    nombre: 'Extensión de cuádriceps en máquina',
    grupoMuscular: 'CUADRICEPS',
    svgTargetId: 'cuadriceps',
    patologiasContraindicadas: 'RODILLA',
    descripcion: 'Sentado, extender las rodillas y bajar controlando el peso.',
    urlMedia: '/gym-exercises/extension_de_cuadriceps_en_maquina.gif',
  },
  {
    nombre: 'Extensión de gemelos en prensa',
    grupoMuscular: 'PANTORRILLAS',
    svgTargetId: 'gemelos',
    patologiasContraindicadas: null,
    descripcion: 'En la prensa de piernas, apoyar la punta de los pies en el borde de la plataforma y empujar extendiendo los tobillos.',
    urlMedia: '/gym-exercises/extension_de_gemelos_en_prensa.gif',
  },
  {
    nombre: 'Fondos en banco para tríceps',
    grupoMuscular: 'TRICEPS',
    svgTargetId: 'triceps-medial',
    patologiasContraindicadas: 'HOMBRO',
    descripcion: 'Con las manos apoyadas en el borde de un banco detrás de la espalda, bajar flexionando los codos y empujar hasta extenderlos.',
    urlMedia: '/gym-exercises/fondos_en_banco_triceps.gif',
  },
  {
    nombre: 'Peso muerto con barra',
    grupoMuscular: 'ISQUIOS',
    svgTargetId: 'isquiotibiales',
    patologiasContraindicadas: 'HERNIA,LUMBAR',
    descripcion: 'De pie frente a la barra, tomarla con agarre firme y levantarla extendiendo cadera y rodillas con la espalda neutra.',
    urlMedia: '/gym-exercises/peso_muerto_con_barra.gif',
  },
  {
    nombre: 'Press francés con barra',
    grupoMuscular: 'TRICEPS',
    svgTargetId: 'triceps-larga',
    patologiasContraindicadas: 'HOMBRO',
    descripcion: 'Acostado en banco plano, bajar la barra hacia la frente flexionando los codos sin abrirlos y volver a extender.',
    urlMedia: '/gym-exercises/press_frances_con_barra_triceps.gif',
  },
  {
    nombre: 'Sentadilla con mancuernas',
    grupoMuscular: 'CUADRICEPS',
    svgTargetId: 'cuadriceps',
    patologiasContraindicadas: 'RODILLA,HERNIA,LUMBAR',
    descripcion: 'De pie con una mancuerna en cada mano a los costados, bajar flexionando rodillas y cadera con la espalda recta.',
    urlMedia: '/gym-exercises/sentadilla_con_mancuernas.gif',
  },
];

export const normalizarSlug = (texto) =>
  (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Detecta automáticamente todos los GIFs colocados en public/gym-exercises/ (incluyendo los que se añadan a futuro)
const ARCHIVOS_GIF = import.meta.glob('/public/gym-exercises/*.{gif,webp,png,jpg,jpeg}');
const GIFS_POR_SLUG = new Map(
  Object.keys(ARCHIVOS_GIF).map((ruta) => {
    const url = ruta.replace(/^\/public/, '');
    const archivo = url.split('/').pop() || '';
    const base = archivo.replace(/\.[^.]+$/, '');
    return [normalizarSlug(base), url];
  }),
);

const GIF_POR_NOMBRE = new Map(
  EJERCICIOS_CON_GIF.map((e) => [normalizarSlug(e.nombre), e.urlMedia]),
);

/**
 * Resuelve la URL del GIF demostrativo de un ejercicio (desde su urlMedia, el catálogo base o la carpeta gym-exercises/).
 * Acepta el objeto ejercicio ({ urlMedia, nombre, nombreEjercicio }) o directamente (urlMedia, nombre).
 */
export const resolverUrlMedia = (ejercicioOUrl, nombreOpcional = '') => {
  const esObjeto = ejercicioOUrl && typeof ejercicioOUrl === 'object';
  const urlRaw = esObjeto ? ejercicioOUrl.urlMedia : ejercicioOUrl;
  const nombre = esObjeto ? (ejercicioOUrl.nombre || ejercicioOUrl.nombreEjercicio || '') : nombreOpcional;

  if (typeof urlRaw === 'string' && urlRaw.trim()) {
    const limpia = urlRaw.trim();
    if (/^(https?:\/\/|data:|\/)/i.test(limpia)) return limpia;
    if (limpia.startsWith('gym-exercises/')) return `/${limpia}`;
    return `/gym-exercises/${limpia}`;
  }
  if (nombre) {
    const slug = normalizarSlug(nombre);
    return GIF_POR_NOMBRE.get(slug) || GIFS_POR_SLUG.get(slug) || null;
  }
  return null;
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

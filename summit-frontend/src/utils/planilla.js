// Lectura de planillas para importar socios: Excel (.xlsx) o CSV (el "Guardar como CSV" de Excel usa ";" y la
// codificación de Windows). Reconoce las columnas por su título, con o sin acentos y con nombres parecidos.

// Columna → títulos que se aceptan (ya sin acentos, en minúscula y sin signos)
const COLUMNAS = {
  nombreCompleto: ['nombre y apellido', 'apellido y nombre', 'nombre completo', 'socio'],
  nombre: ['nombre', 'nombres'],
  apellido: ['apellido', 'apellidos'],
  dni: ['dni', 'documento', 'nro de documento', 'numero de documento', 'doc'],
  email: ['email', 'e mail', 'mail', 'correo', 'correo electronico'],
  telefono: ['telefono', 'celular', 'tel', 'whatsapp', 'movil'],
  fechaNacimiento: ['fecha de nacimiento', 'nacimiento', 'fecha nacimiento'],
  genero: ['genero', 'sexo'],
  domicilio: ['domicilio', 'direccion'],
  ciudad: ['ciudad', 'localidad'],
  objetivo: ['objetivo'],
  observaciones: ['observaciones', 'notas', 'comentarios'],
  plan: ['plan', 'membresia'],
  vence: ['vence', 'vencimiento', 'vence la cuota', 'fecha de vencimiento', 'vence membresia'],
};

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Planilla de ejemplo (CSV que abre Excel): los títulos que entiende la importación y una fila de muestra. */
export const COLUMNAS_EJEMPLO = ['Nombre y apellido', 'DNI', 'Email', 'Teléfono', 'Fecha de nacimiento', 'Género',
  'Domicilio', 'Ciudad', 'Objetivo', 'Observaciones', 'Plan', 'Vence'];
export const FILA_EJEMPLO = ['Juana Pérez', '30111222', 'juana.perez@gmail.com', '11 2233-4455', '15/03/1990', 'Femenino',
  'Av. Siempre Viva 742', 'CABA', 'Salud general', '', 'Pase Libre', '30/11/2026'];

// CSV → filas. Detecta el separador (";" o ",") y respeta las comillas
const leerCsv = (texto) => {
  const primera = texto.split(/\r?\n/, 1)[0] || '';
  const separador = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ';' : ',';
  const filas = [];
  let fila = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === separador) { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += c;
  }
  if (celda !== '' || fila.length > 0) { fila.push(celda); filas.push(fila); }
  return filas;
};

// Los CSV de Excel en Windows vienen en la codificación de Windows: si al leerlo como UTF-8 aparecen caracteres
// raros, se vuelve a leer así
const textoDeArchivo = async (archivo) => {
  const bytes = await archivo.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const texto = utf8.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(bytes) : utf8;
  return texto.replace(/^\uFEFF/, '');
};

/** Lee el archivo (.xlsx o .csv) y devuelve sus filas como listas de celdas. */
export const leerPlanilla = async (archivo) => {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) return leerCsv(await textoDeArchivo(archivo));
  if (nombre.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    return readSheet(archivo);
  }
  throw new Error('Elegí un archivo de Excel (.xlsx) o CSV. Si es un .xls viejo, abrilo en Excel y guardalo como .xlsx');
};

// 'YYYY-MM-DD' a partir de una celda: fecha de Excel, "31/12/2026", "31-12-26" o "2026-12-31". null si no es una fecha
export const fechaIso = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const dos = (n) => String(n).padStart(2, '0');
  if (valor instanceof Date && !isNaN(valor)) {
    return `${valor.getUTCFullYear()}-${dos(valor.getUTCMonth() + 1)}-${dos(valor.getUTCDate())}`;
  }
  const texto = String(valor).trim();
  let m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${dos(m[2])}-${dos(m[3])}`;
  m = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const anio = m[3].length === 2 ? (Number(m[3]) > 40 ? `19${m[3]}` : `20${m[3]}`) : m[3];
    const [dia, mes] = [Number(m[1]), Number(m[2])];
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${anio}-${dos(mes)}-${dos(dia)}`;
  }
  return null;
};

/**
 * Convierte las filas de la planilla en socios a importar. Devuelve { socios, faltan } (faltan: columnas obligatorias
 * que no se encontraron). Cada socio trae numero (fila del archivo) y problemas (lo que ya se ve que está mal).
 */
export const sociosDePlanilla = (filas) => {
  const indiceTitulos = filas.findIndex((f) => f.some((c) => normalizar(c) !== ''));
  if (indiceTitulos < 0) return { socios: [], faltan: ['la fila de títulos'] };
  const titulos = filas[indiceTitulos].map(normalizar);
  const columna = {};
  Object.entries(COLUMNAS).forEach(([campo, nombres]) => {
    const i = titulos.findIndex((t) => nombres.includes(t));
    if (i >= 0) columna[campo] = i;
  });
  const faltan = [];
  if (columna.dni === undefined) faltan.push('DNI');
  if (columna.email === undefined) faltan.push('Email');
  if (columna.nombreCompleto === undefined && columna.nombre === undefined) faltan.push('Nombre y apellido');
  if (faltan.length) return { socios: [], faltan };

  const celda = (fila, campo) => (columna[campo] === undefined ? '' : fila[columna[campo]]);
  const texto = (fila, campo) => String(celda(fila, campo) ?? '').trim();
  const vistos = new Map();
  const socios = [];
  filas.slice(indiceTitulos + 1).forEach((fila, i) => {
    if (!fila.some((c) => String(c ?? '').trim() !== '')) return;
    const numero = indiceTitulos + i + 2;
    const nombreCompleto = texto(fila, 'nombreCompleto') || [texto(fila, 'nombre'), texto(fila, 'apellido')].filter(Boolean).join(' ');
    const dni = String(celda(fila, 'dni') ?? '').replace(/[\s.-]/g, '');
    const email = texto(fila, 'email').toLowerCase();
    const nacimientoCrudo = celda(fila, 'fechaNacimiento');
    const venceCrudo = celda(fila, 'vence');
    const socio = {
      numero, nombreCompleto, dni, email,
      telefono: texto(fila, 'telefono'),
      fechaNacimiento: fechaIso(nacimientoCrudo),
      genero: texto(fila, 'genero'),
      domicilio: texto(fila, 'domicilio'),
      ciudad: texto(fila, 'ciudad'),
      objetivo: texto(fila, 'objetivo'),
      observaciones: texto(fila, 'observaciones'),
      plan: texto(fila, 'plan'),
      vence: fechaIso(venceCrudo),
      problemas: [],
    };
    if (nombreCompleto.length < 3) socio.problemas.push('Falta el nombre');
    if (!/^\d{7,15}$/.test(dni)) socio.problemas.push(dni ? 'DNI inválido' : 'Falta el DNI');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) socio.problemas.push(email ? 'Email inválido' : 'Falta el email');
    if (nacimientoCrudo && String(nacimientoCrudo).trim() && !socio.fechaNacimiento) socio.problemas.push('Fecha de nacimiento inválida');
    if (venceCrudo && String(venceCrudo).trim() && !socio.vence) socio.problemas.push('Fecha de vencimiento inválida');
    if (dni && vistos.has(dni)) socio.problemas.push(`DNI repetido (fila ${vistos.get(dni)})`);
    else if (dni) vistos.set(dni, numero);
    socios.push(socio);
  });
  return { socios, faltan: [] };
};

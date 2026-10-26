// Comunes de la asistencia del personal: textos de roles y de horas, y los períodos (día, semana, mes).

export const ROLES_PERSONAL = {
  ADMIN: { texto: 'Administrador', clase: 'bg-violet-50 text-violet-700 border-violet-200' },
  RECEPCION: { texto: 'Recepción', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  PROFESOR: { texto: 'Profesor', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export const textoRol = (rol) => ROLES_PERSONAL[rol]?.texto || rol;

// 485 -> "8 h 05 min" · 45 -> "45 min" · 480 -> "8 h"
export const duracion = (minutos) => {
  const total = Math.max(0, Math.round(minutos || 0));
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${String(resto).padStart(2, '0')} min`;
};

// 485 -> "8,08": horas con decimales, para sumar en Excel
export const horasDecimales = (minutos) =>
  (Math.round(((minutos || 0) / 60) * 100) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dos = (n) => String(n).padStart(2, '0');
// Las fechas se arman a mano (año, mes, día): new Date('2026-10-25') es UTC y en Argentina daría el día anterior
export const aFecha = (iso) => {
  const [anio, mes, dia] = iso.substring(0, 10).split('-').map(Number);
  return new Date(anio, mes - 1, dia);
};
export const aIso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const sumarDias = (iso, dias) => {
  const d = aFecha(iso);
  d.setDate(d.getDate() + dias);
  return aIso(d);
};

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// '2026-10-25' -> "sáb 25/10"
export const diaCorto = (iso) => {
  const d = aFecha(iso);
  return `${DIAS[d.getDay()]} ${dos(d.getDate())}/${dos(d.getMonth() + 1)}`;
};

// LocalDateTime ('2026-10-25T07:58:31') -> "07:58", sin pasar por Date (no depende de la zona del navegador)
export const hora = (fechaHora) => (fechaHora ? fechaHora.substring(11, 16) : '');

// Hora de salida como se lee en la planilla: "16:03", o "02:15 (+1)" si salió al día siguiente de la entrada
export const horaSalida = (entrada, salida) => {
  if (!salida) return '';
  const dias = Math.round((aFecha(salida) - aFecha(entrada)) / 86400000);
  return dias > 0 ? `${hora(salida)} (+${dias})` : hora(salida);
};

// Períodos de la pantalla: el que contiene la fecha de referencia
export const MODOS = [
  { clave: 'dia', texto: 'Día' },
  { clave: 'semana', texto: 'Semana' },
  { clave: 'mes', texto: 'Mes' },
];

export const periodo = (modo, referencia) => {
  const d = aFecha(referencia);
  if (modo === 'dia') {
    return {
      desde: referencia,
      hasta: referencia,
      titulo: d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      archivo: referencia,
    };
  }
  if (modo === 'semana') {
    const desde = sumarDias(referencia, -((d.getDay() + 6) % 7)); // lunes
    const hasta = sumarDias(desde, 6);
    const [i, f] = [aFecha(desde), aFecha(hasta)];
    const titulo = i.getMonth() === f.getMonth()
      ? `Semana del ${i.getDate()} al ${f.getDate()} de ${MESES[f.getMonth()]}`
      : `Semana del ${i.getDate()}/${i.getMonth() + 1} al ${f.getDate()}/${f.getMonth() + 1}`;
    return { desde, hasta, titulo, archivo: `${desde}-al-${hasta}` };
  }
  const desde = aIso(new Date(d.getFullYear(), d.getMonth(), 1));
  const hasta = aIso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { desde, hasta, titulo: `${MESES[d.getMonth()]} de ${d.getFullYear()}`, archivo: desde.substring(0, 7) };
};

// La fecha de referencia del período anterior (-1) o siguiente (+1)
export const moverPeriodo = (modo, referencia, paso) => {
  if (modo === 'dia') return sumarDias(referencia, paso);
  if (modo === 'semana') return sumarDias(referencia, 7 * paso);
  const d = aFecha(referencia);
  return aIso(new Date(d.getFullYear(), d.getMonth() + paso, 1));
};

export const ESTADOS_TURNO = {
  COMPLETO: { texto: 'Completo' },
  EN_CURSO: { texto: 'En curso' },
  SIN_SALIDA: { texto: 'Sin salida' },
};

// Qué se le hizo a un turno en cada corrección
export const ACCIONES_CORRECCION = { ALTA: 'Cargado a mano', CAMBIO: 'Corregido', ANULACION: 'Anulado' };

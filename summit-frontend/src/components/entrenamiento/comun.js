// Utilidades compartidas por las pantallas de entrenamiento del personal
// (Ejercicios, Rutinas y Constructor).
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';

export const DIAS_MAXIMOS = 7;

// Arman y modifican rutinas (RECEPCION solo consulta)
export const puedeEditarEntrenamiento = (usuario) => ['ADMIN', 'PROFESOR'].includes(usuario?.rol);

const GRUPOS = {
  PECHO: 'Pecho', ESPALDA: 'Espalda', BICEPS: 'Bíceps', TRICEPS: 'Tríceps', HOMBROS: 'Hombros',
  CUADRICEPS: 'Cuádriceps', ISQUIOS: 'Isquiotibiales', GLUTEOS: 'Glúteos', PANTORRILLAS: 'Pantorrillas',
  ABDOMINALES: 'Abdominales', CORE: 'Core',
};
export const nombreGrupo = (grupo) => GRUPOS[grupo] || grupo || 'Sin grupo';

const SIN_CONEXION = 'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.';

// Mensaje del {"error"} que manda el backend, o uno por defecto
export const leerError = async (res, porDefecto) => {
  const data = await res.json().catch(() => null);
  if (data?.error) return data.error;
  return res.status === 403 ? 'No tenés permiso para hacer esto.' : porDefecto;
};

// GET que devuelve el JSON; si falla lanza un Error con el mensaje del backend y el status
export const obtenerJson = async (ruta, porDefecto = 'No se pudieron cargar los datos.') => {
  let res;
  try {
    res = await apiFetch(ruta);
  } catch {
    throw new Error(SIN_CONEXION);
  }
  if (!res.ok) {
    const error = new Error(await leerError(res, porDefecto));
    error.status = res.status;
    throw error;
  }
  return res.json();
};

// POST / PUT / DELETE con JSON. Devuelve { ok, status, data } (data trae el {"error"} si falló)
export const enviarJson = async (ruta, method, body) => {
  try {
    const res = await apiFetch(ruta, { method, ...(body !== undefined && { body: JSON.stringify(body) }) });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: SIN_CONEXION } };
  }
};

// Catálogo completo de ejercicios por nombre (el backend pagina de a 50 como máximo)
export const cargarCatalogo = async () => {
  const todos = [];
  for (let pagina = 0; pagina < 20; pagina++) {
    const data = await obtenerJson(`/ejercicios?size=50&sort=nombre&page=${pagina}`,
      'No se pudo cargar el catálogo de ejercicios.');
    const contenido = Array.isArray(data) ? data : (data.content || []);
    todos.push(...contenido);
    if (Array.isArray(data) || data.last !== false || contenido.length === 0) break;
  }
  return todos;
};

// Lista de socios (GET /socios) con estados de carga y error
export const useSocios = () => {
  const [estado, setEstado] = useState({ socios: [], cargando: true, error: '' });
  const recargar = useCallback(async () => {
    setEstado((e) => ({ ...e, cargando: true, error: '' }));
    try {
      const socios = await obtenerJson('/socios', 'No se pudo cargar la lista de socios.');
      setEstado({ socios, cargando: false, error: '' });
    } catch (e) {
      setEstado({ socios: [], cargando: false, error: e.message });
    }
  }, []);
  useEffect(() => { recargar(); }, [recargar]);
  return { ...estado, recargar };
};

// Patologías declaradas en el certificado médico vigente del socio (dato de salud: ADMIN y PROFESOR)
export const cargarPatologias = async (idSocio) => {
  try {
    const cert = await obtenerJson(`/socios/${idSocio}/certificados/actual`);
    const patologias = (cert?.observacionesPatologias || '').split(',').map((p) => p.trim()).filter(Boolean);
    // resumenIa: el resumen de la condición del socio que leyó la IA y confirmó recepción.
    // El Constructor lo muestra en la tarjeta "Ficha médica" para que el profe lo tenga a la vista.
    return { estado: 'ok', patologias, resumenIa: cert?.resumenIa || '' };
  } catch (e) {
    return e.status === 404 ? { estado: 'sin-certificado', patologias: [] } : { estado: 'error', patologias: [], error: e.message };
  }
};

// Misma regla que el cruce preventivo del backend (sin mayúsculas ni tildes): solo para marcar
// los ejercicios riesgosos en las listas. La validación que vale es la del backend.
export const normalizar = (texto) => (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
export const riesgosLocales = (patologias, contraindicadas) => {
  const contra = (contraindicadas || '').split(',').map(normalizar).filter(Boolean);
  if (contra.length === 0) return [];
  return patologias
    .filter((p) => { const n = normalizar(p); return n && contra.some((c) => n.includes(c)); })
    .map((p) => p.trim().toUpperCase());
};

// ---- Formatos ----

export const formatNumero = (n, decimales = 1) =>
  Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: decimales });

export const formatKg = (kg) => (kg === null || kg === undefined ? 'Peso corporal' : `${formatNumero(kg)} kg`);

export const formatDescanso = (segundos) => {
  if (segundos === null || segundos === undefined) return null;
  if (segundos < 60) return `${segundos} s`;
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return seg ? `${min} min ${seg} s` : `${min} min`;
};

// "4 × 10"
export const seriesPorReps = (series, repeticiones) =>
  `${series ?? '—'} × ${repeticiones ?? '—'}`;

// 'YYYY-MM-DD' -> "lun 29/09"
export const fechaCorta = (fechaIso) => {
  if (!fechaIso) return '—';
  const [anio, mes, dia] = fechaIso.substring(0, 10).split('-').map(Number);
  const semana = new Date(anio, mes - 1, dia).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  return `${semana} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
};

// Ejercicios de una rutina agrupados por día: [[1, [...]], [2, [...]]]
export const agruparPorDia = (ejercicios) => {
  const dias = new Map();
  for (const e of ejercicios || []) {
    const dia = e.diaNumero || 1;
    if (!dias.has(dia)) dias.set(dia, []);
    dias.get(dia).push(e);
  }
  return [...dias.entries()].sort((a, b) => a[0] - b[0]);
};

// Busca por nombre, DNI o email sin distinguir mayúsculas ni tildes
export const coincide = (texto, ...campos) => {
  const buscado = normalizar(texto);
  return !buscado || campos.some((c) => normalizar(String(c ?? '')).includes(buscado));
};

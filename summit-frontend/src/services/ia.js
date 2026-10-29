// apiFetch: el cliente HTTP central del frontend (services/api.js). Agrega la URL del backend y el token JWT
// de la sesión a cada pedido, y si el backend responde 401 (sesión vencida) vuelve al login.
import { apiFetch } from './api';

// Asistente de IA local (Ollama). Todas las funciones devuelven { ok, datos } o { ok: false, error }.
// Este archivo es la ÚNICA puerta del frontend hacia la API de IA (/api/ia/...): los componentes no
// llaman a fetch directamente. Así, si cambia una ruta del backend, se corrige en un solo lugar.

/**
 * Ejecuta un pedido y lo normaliza a { ok, datos } o { ok: false, error }.
 * Por qué: los componentes no tienen que manejar excepciones ni leer códigos HTTP; solo preguntan "r.ok".
 * - Respuesta 2xx: devuelve el JSON como "datos".
 * - Respuesta de error (400/404/503...): devuelve el mensaje en español que manda el backend en {"error": "..."}.
 * - Falla de red (backend apagado): el fetch lanza una excepción, que se convierte en un mensaje claro.
 */
const llamar = async (pedido, porDefecto) => {
  try {
    const res = await pedido();
    if (res.ok) return { ok: true, datos: await res.json() };
    // .catch(() => ({})): si la respuesta de error no trae JSON, se usa el mensaje por defecto.
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || porDefecto };
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor' };
  }
};

// Se consulta una sola vez por sesión del navegador (si Ollama se levanta después, alcanza con recargar)
// "estadoCacheado" guarda la PROMESA (no el resultado): si varios componentes piden el estado al mismo tiempo,
// todos esperan la misma consulta en lugar de mandar una cada uno.
let estadoCacheado = null;
export const estadoIa = () => {
  if (!estadoCacheado) {
    estadoCacheado = llamar(() => apiFetch('/ia/estado'), 'No se pudo consultar el asistente')
      // Si la consulta falla, se responde como "no disponible" con el motivo, para que los botones lo expliquen.
      .then(r => (r.ok ? r.datos : { disponible: false, motivo: r.error }));
  }
  return estadoCacheado;
};

// Lee un certificado ANTES de subirlo: no guarda nada. Con el DNI del socio avisa si el certificado es de otra persona
// FormData = el formato de los formularios con archivos (multipart/form-data). apiFetch detecta que el cuerpo
// es FormData y NO le pone "Content-Type: application/json" (el navegador arma el encabezado correcto).
export const analizarArchivo = (archivo, dni) => {
  const datos = new FormData();
  datos.append('archivo', archivo);
  if (dni) datos.append('dni', dni);
  return llamar(() => apiFetch('/ia/certificados/analizar', { method: 'POST', body: datos }), 'No se pudo analizar el certificado');
};

// Lee un certificado que ya está guardado en la ficha del socio (el backend lo busca en el disco).
export const analizarCertificado = (idSocio, idCertificado) =>
  llamar(() => apiFetch(`/ia/socios/${idSocio}/certificados/${idCertificado}/analizar`, { method: 'POST' }),
    'No se pudo analizar el certificado');

// Ejercicios del catálogo que el socio debería evitar (regla firme + sugerencias de la IA).
export const ejerciciosAEvitar = (idSocio) =>
  llamar(() => apiFetch(`/ia/socios/${idSocio}/ejercicios-a-evitar`, { method: 'POST' }),
    'No se pudieron obtener las sugerencias');

// Guarda en el certificado lo que confirmó el personal
// Es el paso de "supervisión humana": la IA nunca guarda sola; esto se llama desde el botón "Guardar en la ficha".
// PATCH /api/socios/{id}/certificados/{id} → solo ADMIN y RECEPCION (lo controla el backend).
export const guardarObservaciones = (idSocio, idCertificado, observacionesPatologias, resumenIa) =>
  llamar(() => apiFetch(`/socios/${idSocio}/certificados/${idCertificado}`, {
    method: 'PATCH', body: JSON.stringify({ observacionesPatologias, resumenIa }),
  }), 'No se pudo guardar la ficha médica');

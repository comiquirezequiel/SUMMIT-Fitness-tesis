import { API_URL } from './config';
import { cerrarSesion, marcarCambioDePasswordPendiente } from './auth';

const PANTALLA_CAMBIAR_PASSWORD = '/cambiar-password';

/**
 * fetch hacia el backend de Spring Boot.
 * - Agrega el token JWT (salvo en /auth/*) y el Content-Type JSON cuando hay body.
 *   Con FormData (subida de archivos) el navegador arma el Content-Type multipart.
 * - Si el backend responde 401 (sesión vencida o inválida), vuelve al login.
 * - Si responde 403 CAMBIAR_PASSWORD (entró con una contraseña temporal), lleva a la pantalla para cambiarla.
 * Devuelve la Response igual que fetch: cada pantalla sigue usando response.ok y response.json().
 */
export const apiFetch = async (path, options = {}) => {
  // Cambiar la propia contraseña es el único /auth que va con el token: para él, un 401 es una sesión vencida
  const esAuth = path.startsWith('/auth/') && path !== '/auth/password';

  const headers = { ...(options.headers || {}) };
  const token = localStorage.getItem('token');
  if (token && !esAuth) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  // En /auth/login un 401 significa "credenciales inválidas", no "sesión vencida"
  if (response.status === 401 && !esAuth) {
    cerrarSesion('expirada');
  }

  if (response.status === 403 && window.location.pathname !== PANTALLA_CAMBIAR_PASSWORD) {
    const datos = await response.clone().json().catch(() => null);
    if (datos?.codigo === 'CAMBIAR_PASSWORD') {
      marcarCambioDePasswordPendiente();
      window.location.href = PANTALLA_CAMBIAR_PASSWORD;
    }
  }
  return response;
};

/**
 * Pedido JSON con apiFetch: devuelve los datos (null en un 204) o lanza un Error con el mensaje del backend (y su
 * status), para las pantallas que solo necesitan "anduvo o qué falló".
 */
export const pedirJson = async (ruta, opciones = {}, mensajeError = 'No se pudo completar la operación') => {
  const res = await apiFetch(ruta, opciones);
  if (res.status === 204) return null;
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle = datos.detalles ? Object.values(datos.detalles).join(' · ') : '';
    const error = new Error(detalle || datos.error || (res.status === 403 ? 'No tenés permiso para hacer esto' : mensajeError));
    error.status = res.status;
    throw error;
  }
  return datos;
};

/** Opciones de un pedido con cuerpo JSON. */
export const conJson = (metodo, cuerpo) => ({ method: metodo, body: JSON.stringify(cuerpo) });

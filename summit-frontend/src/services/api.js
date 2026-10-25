import { API_URL } from './config';
import { cerrarSesion, marcarCambioDePasswordPendiente, renovarSesion, sesionRenovable, tokenVigente } from './auth';

const PANTALLA_CAMBIAR_PASSWORD = '/cambiar-password';

// Un pedido al backend con el token actual
const enviar = (path, options, esAuth) => {
  const headers = { ...(options.headers || {}) };
  const token = localStorage.getItem('token');
  if (token && !esAuth) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${API_URL}${path}`, { ...options, headers });
};

/**
 * fetch hacia el backend de Spring Boot.
 * - Agrega el token JWT (salvo en /auth/*) y el Content-Type JSON cuando hay body.
 *   Con FormData (subida de archivos) el navegador arma el Content-Type multipart.
 * - Socio (sesión renovable): si su token está por vencer, primero pide uno nuevo; si igual recibe un 401,
 *   renueva y repite el pedido una vez. Sin conexión sigue con el token que tiene y no lo saca de la app.
 * - Si el backend responde 401 y no se puede renovar (sesión vencida o inválida), vuelve al login.
 * - Si responde 403 CAMBIAR_PASSWORD (entró con una contraseña temporal), lleva a la pantalla para cambiarla.
 * Devuelve la Response igual que fetch: cada pantalla sigue usando response.ok y response.json().
 */
export const apiFetch = async (path, options = {}) => {
  // Cambiar la propia contraseña es el único /auth que va con el token: para él, un 401 es una sesión vencida
  const esAuth = path.startsWith('/auth/') && path !== '/auth/password';

  if (!esAuth && sesionRenovable() && !tokenVigente(60)) {
    const sigue = await renovarSesion().catch(() => true); // sin conexión: se intenta igual con el token que hay
    if (!sigue) {
      cerrarSesion('expirada');
      throw new Error('Tu sesión se cerró: volvé a entrar');
    }
  }

  let response = await enviar(path, options, esAuth);

  // En /auth/login un 401 significa "credenciales inválidas", no "sesión vencida"
  if (response.status === 401 && !esAuth) {
    if (sesionRenovable() && await renovarSesion().catch(() => false)) {
      response = await enviar(path, options, esAuth);
      if (response.status !== 401) return response;
    }
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

import { cerrarSesion } from './auth';

// URL del backend. Por defecto, /api en la misma dirección del frontend (en desarrollo, el proxy de
// vite.config.js lo deriva al backend). Se cambia con VITE_API_URL (ver .env.example) sin tocar el código
const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * fetch hacia el backend de Spring Boot.
 * - Agrega el token JWT (salvo en /auth/*) y el Content-Type JSON cuando hay body.
 *   Con FormData (subida de archivos) el navegador arma el Content-Type multipart.
 * - Si el backend responde 401 (sesión vencida o inválida), vuelve al login.
 * Devuelve la Response igual que fetch: cada pantalla sigue usando response.ok y response.json().
 */
export const apiFetch = async (path, options = {}) => {
  const esAuth = path.startsWith('/auth/');
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
  return response;
};

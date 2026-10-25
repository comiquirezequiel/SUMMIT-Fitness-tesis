// Contraseñas (backend: AuthController y los restablecer-password de socios y usuarios): cambiar la propia,
// "¿Olvidaste tu contraseña?", el link del mail y la temporal que da recepción o el admin.
import { apiFetch } from './api';
import { guardarSesion, limpiarSesion } from './auth';
import { usuarioActual } from '../utils/formato';

// Error con el mensaje del backend ({ error }) y su código, si trae (CAMBIAR_PASSWORD, LINK_INVALIDO)
const fallo = async (respuesta, porDefecto) => {
  const datos = await respuesta.json().catch(() => ({}));
  const error = new Error(datos.error || porDefecto);
  error.codigo = datos.codigo;
  return error;
};

const enviarJson = (metodo, cuerpo) => ({ method: metodo, body: JSON.stringify(cuerpo) });

/**
 * Cambia la propia contraseña. El backend responde como un login: se guarda la sesión nueva, porque la anterior
 * (y las de los otros dispositivos) se cerró.
 */
export const cambiarPassword = async (actual, nueva) => {
  const respuesta = await apiFetch('/auth/password', enviarJson('PUT', { actual, nueva }));
  if (!respuesta.ok) throw await fallo(respuesta, 'No se pudo cambiar la contraseña');
  guardarSesion(await respuesta.json());
};

// true si el gimnasio configuró el correo para "¿Olvidaste tu contraseña?"
export const hayRecuperacionPorEmail = async () => {
  const respuesta = await apiFetch('/auth/recuperacion');
  return respuesta.ok && (await respuesta.json()).porEmail === true;
};

// Pide el link por mail. Devuelve el mensaje del backend (es el mismo exista o no la cuenta)
export const pedirLinkPorEmail = async (email) => {
  const respuesta = await apiFetch('/auth/olvide-password', enviarJson('POST', { email }));
  if (!respuesta.ok) throw await fallo(respuesta, 'No se pudo mandar el mail');
  return (await respuesta.json()).mensaje;
};

/**
 * Elige la contraseña nueva con el link del mail. Devuelve el email de la cuenta, para entrar. Si en este
 * navegador había una sesión de esa cuenta, se borra: el backend la cerró.
 */
export const restablecerConLink = async (token, password) => {
  const respuesta = await apiFetch('/auth/restablecer-password', enviarJson('POST', { token, password }));
  if (!respuesta.ok) throw await fallo(respuesta, 'No se pudo guardar la contraseña');
  const { email } = await respuesta.json();
  if (usuarioActual()?.email?.toLowerCase() === email.toLowerCase()) limpiarSesion();
  return email;
};

/**
 * Le pone una contraseña temporal a un socio (ruta /socios/{id}: recepción o el admin) o a alguien del equipo
 * (/usuarios/{id}: solo el admin). Devuelve la temporal, que se muestra una sola vez.
 */
export const restablecerConTemporal = async (ruta) => {
  const respuesta = await apiFetch(`${ruta}/restablecer-password`, { method: 'POST' });
  if (!respuesta.ok) throw await fallo(respuesta, 'No se pudo restablecer la contraseña');
  return (await respuesta.json()).passwordTemporal;
};

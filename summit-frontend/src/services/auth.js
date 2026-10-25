// Manejo de la sesión guardada en localStorage (token JWT + datos del usuario).
// El socio además tiene una sesión renovable: una cookie que el JavaScript no puede leer (HttpOnly). La app sabe
// hasta cuándo la puede usar por "sesionRenovableHasta" y, cuando el token vence, pide uno nuevo sin contraseña
// (renovarSesion). Así el socio no vuelve a entrar mientras use la app, y sin conexión no queda afuera.
import { API_URL } from './config';
import { borrarGuardado } from './guardado';

const CLAVE_RENOVABLE = 'sesionRenovableHasta';
// Se cerró sesión sin conexión: falta avisarle al servidor para que la sesión renovable no sirva más
const CLAVE_SALIDA_PENDIENTE = 'salidaPendiente';

// Guarda lo que devuelven el login y la renovación
export const guardarSesion = (datos) => {
  localStorage.setItem('token', datos.token);
  localStorage.setItem('user', JSON.stringify({
    idUsuario: datos.idUsuario,
    email: datos.email,
    nombreCompleto: datos.nombreCompleto,
    rol: datos.rol,
    // Entró con una contraseña temporal: hasta que elija una, solo ve la pantalla para cambiarla
    debeCambiarPassword: !!datos.debeCambiarPassword,
  }));
  if (datos.renovableHasta) {
    localStorage.setItem(CLAVE_RENOVABLE, datos.renovableHasta);
  } else {
    localStorage.removeItem(CLAVE_RENOVABLE);
  }
  // Entrar de nuevo reemplaza la sesión anterior (el servidor la cierra al recibir el login)
  localStorage.removeItem(CLAVE_SALIDA_PENDIENTE);
};

// El backend avisó (403 CAMBIAR_PASSWORD) que la contraseña es temporal y la sesión guardada no lo sabía
export const marcarCambioDePasswordPendiente = () => {
  try {
    const usuario = JSON.parse(localStorage.getItem('user'));
    if (usuario) localStorage.setItem('user', JSON.stringify({ ...usuario, debeCambiarPassword: true }));
  } catch {
    // sin sesión guardada no hay nada que marcar
  }
};

// La contraseña temporal recién escrita en el login, para no pedirla otra vez al elegir la nueva. Queda solo en
// memoria (nunca en localStorage ni en el historial) y se usa una vez.
let claveDelLogin = null;
export const recordarClaveDelLogin = (clave) => { claveDelLogin = clave; };
export const tomarClaveDelLogin = () => {
  const clave = claveDelLogin;
  claveDelLogin = null;
  return clave;
};

// También borra los datos personales guardados para usar la app sin conexión (services/guardado.js)
export const limpiarSesion = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem(CLAVE_RENOVABLE);
  borrarGuardado();
};

// Segundos que le quedan al token (negativos si venció); null si no hay token o no se puede leer su campo "exp"
const segundosDelToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp - Date.now() / 1000 : Infinity;
  } catch {
    return null;
  }
};

// true si el token sigue vigente por más de "margen" segundos
export const tokenVigente = (margen = 0) => {
  const segundos = segundosDelToken();
  return segundos !== null && segundos > margen;
};

// true si la sesión del socio todavía se puede renovar sin contraseña
export const sesionRenovable = () => {
  const hasta = localStorage.getItem(CLAVE_RENOVABLE);
  return !!hasta && new Date(hasta).getTime() > Date.now();
};

// Hay sesión iniciada: el token vigente, o vencido pero renovable (aunque ahora no haya conexión para renovarlo)
export const sesionVigente = () => !!localStorage.getItem('token') && (tokenVigente() || sesionRenovable());

let renovacionEnCurso = null;

/**
 * Pide un token nuevo con la sesión renovable (la cookie viaja sola). Devuelve true si se renovó y false si la
 * sesión ya no sirve (hay que volver a entrar). Sin conexión rechaza con el error de fetch: la sesión sigue y se
 * reintenta en el próximo pedido. Si varios pedidos la necesitan a la vez, comparten la misma renovación.
 */
export const renovarSesion = () => {
  if (!renovacionEnCurso) {
    renovacionEnCurso = (async () => {
      const respuesta = await fetch(`${API_URL}/auth/renovar`, { method: 'POST' });
      if (respuesta.ok) {
        guardarSesion(await respuesta.json());
        return true;
      }
      if (respuesta.status === 401) return false;
      throw new Error(`No se pudo renovar la sesión (${respuesta.status})`);
    })().finally(() => {
      renovacionEnCurso = null;
    });
  }
  return renovacionEnCurso;
};

/**
 * Manda al servidor la salida que quedó pendiente, para que la sesión renovable de este celular no sirva más.
 * keepalive: el pedido sigue aunque la página cambie al login. Si falla (sin conexión), queda pendiente y se
 * reintenta al volver la conexión (main.jsx).
 */
export const avisarSalidaPendiente = () => {
  if (localStorage.getItem(CLAVE_SALIDA_PENDIENTE) !== '1' || !navigator.onLine) return;
  fetch(`${API_URL}/auth/salir`, { method: 'POST', keepalive: true })
    .then((respuesta) => {
      if (respuesta.ok) localStorage.removeItem(CLAVE_SALIDA_PENDIENTE);
    })
    .catch(() => { /* sigue pendiente */ });
};

// Borra la sesión y vuelve al login; con motivo 'expirada' el login muestra un aviso.
// Si había sesión renovable (socio), también se le avisa al servidor que la cierre.
export const cerrarSesion = (motivo) => {
  const teniaSesionRenovable = !!localStorage.getItem(CLAVE_RENOVABLE);
  limpiarSesion();
  if (teniaSesionRenovable) {
    localStorage.setItem(CLAVE_SALIDA_PENDIENTE, '1');
    avisarSalidaPendiente();
  }
  window.location.href = motivo ? `/login?sesion=${motivo}` : '/login';
};

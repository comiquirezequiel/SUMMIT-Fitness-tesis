// Manejo de la sesión guardada en localStorage (token JWT + datos del usuario).

// Guarda lo que devuelve el login (y el cambio de contraseña, que da un token nuevo)
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

export const limpiarSesion = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// true si hay un token y no venció (si no se puede leer su campo "exp", se lo da por vencido)
export const sesionVigente = () => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
};

// Borra la sesión y vuelve al login; con motivo 'expirada' el login muestra un aviso.
export const cerrarSesion = (motivo) => {
  limpiarSesion();
  window.location.href = motivo ? `/login?sesion=${motivo}` : '/login';
};

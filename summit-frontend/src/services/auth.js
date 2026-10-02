// Manejo de la sesión guardada en localStorage (token JWT + datos del usuario).

export const limpiarSesion = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// true si hay token y todavía no venció (lee el campo "exp" del JWT)
export const sesionVigente = () => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

// Borra la sesión y vuelve al login; con motivo 'expirada' el login muestra un aviso
export const cerrarSesion = (motivo) => {
  limpiarSesion();
  window.location.href = motivo ? `/login?sesion=${motivo}` : '/login';
};

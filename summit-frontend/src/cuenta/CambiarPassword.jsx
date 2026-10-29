import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import Marco from './Marco';
import FormCambiarPassword from './FormCambiarPassword';
import { cambiarPassword } from '../services/cuenta';
import { cerrarSesion, sesionVigente, tomarClaveDelLogin } from '../services/auth';
import { usuarioActual } from '../utils/formato';

/**
 * Primera entrada con una contraseña temporal (la de una cuenta nueva o la que dio recepción o el admin): antes de
 * seguir, la persona elige una propia. Si viene directo del login, no se le pide de nuevo la temporal.
 */
export default function CambiarPassword() {
  const navigate = useNavigate();
  const usuario = usuarioActual();
  const [temporal, setTemporal] = useState(tomarClaveDelLogin);

  if (!usuario || !sesionVigente()) return <Navigate to="/login" replace />;
  if (!usuario.debeCambiarPassword) return <Navigate to="/" replace />;

  const guardar = async ({ actual, nueva }) => {
    try {
      await cambiarPassword(temporal || actual, nueva);
    } catch (err) {
      // Si la temporal recordada ya no sirve (la restablecieron de nuevo), se la pide
      if (temporal) setTemporal(null);
      throw err;
    }
    navigate('/', { replace: true });
  };

  return (
    <Marco titulo="Elegí tu contraseña">
      <p className="text-sm text-slate-600 mb-5">
        Hola, {usuario.nombreCompleto.split(' ')[0]}. Entraste con una contraseña temporal: para seguir, elegí una que
        sea solo tuya.
      </p>
      <FormCambiarPassword pedirActual={!temporal} etiquetaActual="Contraseña temporal" email={usuario.email}
        textoBoton="Guardar y entrar" alEnviar={guardar} />
      <button type="button" onClick={() => cerrarSesion()}
        className="mt-3 w-full min-h-[44px] text-sm font-semibold text-slate-500 hover:text-slate-700">
        Salir
      </button>
    </Marco>
  );
}

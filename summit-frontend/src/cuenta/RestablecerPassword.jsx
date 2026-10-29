import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Marco from './Marco';
import FormCambiarPassword from './FormCambiarPassword';
import { restablecerConLink } from '../services/cuenta';

/**
 * Llega desde el link del mail de "¿Olvidaste tu contraseña?" (/restablecer?token=...). El token sale enseguida de
 * la barra de direcciones y del historial: queda solo en memoria hasta que se usa.
 */
export default function RestablecerPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.search).get('token'));
  const [linkInvalido, setLinkInvalido] = useState(!token);

  useEffect(() => {
    if (location.search) navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate]);

  const guardar = async ({ nueva }) => {
    try {
      const email = await restablecerConLink(token, nueva);
      navigate('/login', { replace: true, state: { email, listo: true } });
    } catch (err) {
      if (err.codigo !== 'LINK_INVALIDO') throw err;
      setLinkInvalido(true);
    }
  };

  if (linkInvalido) {
    return (
      <Marco titulo="El link ya no sirve">
        <p className="text-sm text-slate-600">
          Puede ser que ya se haya usado, que haya vencido o que se haya copiado incompleto. Pedí uno nuevo y usá el
          último que te llegue.
        </p>
        <Link to="/olvide-password"
          className="mt-5 w-full min-h-[48px] rounded-xl bg-bordo-700 text-white text-base font-bold hover:bg-bordo-800 flex items-center justify-center">
          Pedir otro link
        </Link>
        <Link to="/login" className="mt-3 min-h-[44px] flex items-center justify-center text-sm font-semibold text-bordo-700 hover:text-bordo-800">
          Volver para entrar
        </Link>
      </Marco>
    );
  }

  return (
    <Marco titulo="Elegí una contraseña nueva">
      <p className="text-sm text-slate-600 mb-5">Vas a usarla para entrar a partir de ahora, en todos tus dispositivos.</p>
      <FormCambiarPassword pedirActual={false} textoBoton="Guardar contraseña" alEnviar={guardar} />
    </Marco>
  );
}

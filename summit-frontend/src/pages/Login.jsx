import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, WifiOff } from 'lucide-react';
import Marco from '../cuenta/Marco';
import { apiFetch } from '../services/api';
import { guardarSesion, recordarClaveDelLogin } from '../services/auth';
import { useFunciones } from '../services/funciones';
import { esErrorDeConexion, useEnLinea } from '../utils/conexion';

export default function Login() {
  const location = useLocation();
  // Viene de elegir la contraseña con el link del mail: el email ya queda escrito
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // "¿Olvidaste tu contraseña?" lleva al link por mail solo si el gimnasio configuró el correo
  const { recuperacionPorEmail } = useFunciones();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sesionExpirada = searchParams.get('sesion') === 'expirada';
  const passwordElegida = location.state?.listo === true;
  const enLinea = useEnLinea();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Credenciales inválidas');
      }

      // Token, datos del usuario y, si es socio, hasta cuándo se puede renovar la sesión sin contraseña
      const datos = await response.json();
      guardarSesion(datos);

      // Con una contraseña temporal, primero elige una propia (sin volver a escribir la temporal)
      if (datos.debeCambiarPassword) {
        recordarClaveDelLogin(password);
        navigate('/cambiar-password', { replace: true });
      } else {
        navigate('/');
      }
    } catch (err) {
      // Sin conexión no es un problema de la contraseña: se dice qué pasa en lugar del error técnico del navegador
      if (esErrorDeConexion(err)) {
        setError(navigator.onLine
          ? 'No pudimos conectarnos con el gimnasio. Probá de nuevo en un momento.'
          : 'Sin conexión: para entrar necesitás internet.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Marco titulo="Ingresá a tu cuenta">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center">
          {error}
        </div>
      )}

      {passwordElegida && !error && (
        <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg mb-6 text-sm text-center" role="status">
          Listo: ya podés entrar con tu contraseña nueva.
        </div>
      )}

      {sesionExpirada && !error && (
        <div className="bg-amber-50 text-amber-700 p-3 rounded-lg mb-6 text-sm text-center">
          Tu sesión expiró. Volvé a iniciar sesión.
        </div>
      )}

      {/* El login necesita al servidor: sin conexión se avisa antes de que la persona lo intente */}
      {!enLinea && !error && (
        <div className="bg-amber-50 text-amber-700 p-3 rounded-lg mb-6 text-sm flex items-start gap-2" role="status">
          <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Estás sin conexión. Para entrar necesitás internet; probá cuando tengas señal.</span>
        </div>
      )}

      {/* Campos de 16 px o más: con menos, el iPhone agranda la pantalla al tocarlos.
          autoComplete: el celular ofrece guardar y completar el email y la contraseña. */}
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full min-h-[44px] pl-10 pr-3 py-2 text-base border border-gray-300 rounded-xl shadow-sm focus:ring-bordo-600 focus:border-bordo-600"
              placeholder="tu@email.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Contraseña
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full min-h-[44px] pl-10 pr-3 py-2 text-base border border-gray-300 rounded-xl shadow-sm focus:ring-bordo-600 focus:border-bordo-600"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] flex items-center justify-center px-4 rounded-xl shadow-sm text-base font-bold text-white bg-bordo-700 hover:bg-bordo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bordo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      {recuperacionPorEmail ? (
        <Link to="/olvide-password" state={{ email }}
          className="mt-4 min-h-[44px] flex items-center justify-center text-sm font-semibold text-bordo-700 hover:text-bordo-800">
          ¿Olvidaste tu contraseña?
        </Link>
      ) : (
        <p className="mt-5 text-center text-sm text-gray-500">
          ¿Olvidaste tu contraseña? Pedile al gimnasio que te la restablezca.
        </p>
      )}
    </Marco>
  );
}

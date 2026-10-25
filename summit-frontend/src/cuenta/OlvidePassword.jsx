import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, MailCheck } from 'lucide-react';
import Marco from './Marco';
import { pedirLinkPorEmail } from '../services/cuenta';
import { esErrorDeConexion } from '../utils/conexion';

const enlace = 'min-h-[44px] flex items-center justify-center text-sm font-semibold text-bordo-700 hover:text-bordo-800';

/**
 * "¿Olvidaste tu contraseña?": manda al email un link para elegir una nueva (cuenta/RestablecerPassword). La
 * respuesta es la misma exista o no la cuenta, así que el mensaje no confirma nada.
 */
export default function OlvidePassword() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      setMensaje(await pedirLinkPorEmail(email.trim()));
    } catch (err) {
      setError(esErrorDeConexion(err) ? 'Sin conexión: para pedir el link necesitás internet.' : err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (mensaje) {
    return (
      <Marco titulo="Revisá tu correo">
        <div className="text-center space-y-3">
          <MailCheck className="w-12 h-12 text-emerald-600 mx-auto" />
          <p className="text-sm text-slate-700">{mensaje}</p>
          <p className="text-sm text-slate-500">El link sirve una sola vez. Si no llega en unos minutos, podés volver a pedirlo.</p>
        </div>
        <Link to="/login" className={`${enlace} mt-4`}>Volver para entrar</Link>
      </Marco>
    );
  }

  return (
    <Marco titulo="¿Olvidaste tu contraseña?">
      <form onSubmit={enviar} className="space-y-5">
        <p className="text-sm text-slate-600">Escribí el email de tu cuenta y te mandamos un link para elegir una contraseña nueva.</p>
        <div>
          <label htmlFor="email-recuperacion" className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            <input id="email-recuperacion" type="email" required autoComplete="username" autoCapitalize="none" spellCheck={false}
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
              className="block w-full min-h-[48px] pl-10 pr-3 text-base text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-bordo-200 focus:border-bordo-400" />
          </div>
        </div>
        {error && <p className="rounded-xl bg-rose-50 text-rose-700 text-sm font-medium p-3" role="alert">{error}</p>}
        <button type="submit" disabled={enviando}
          className="w-full min-h-[48px] rounded-xl bg-bordo-700 text-white text-base font-bold hover:bg-bordo-800 disabled:opacity-50">
          {enviando ? 'Enviando…' : 'Mandarme el link'}
        </button>
      </form>
      <Link to="/login" className={`${enlace} mt-3`}>Volver</Link>
    </Marco>
  );
}

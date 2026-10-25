import React, { useId, useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { esErrorDeConexion } from '../utils/conexion';

// Las mismas reglas que el backend (PasswordService.validarNueva)
const LARGO_MINIMO = 8;
const LARGO_MAXIMO = 100;
const REGLAS = [
  { texto: `${LARGO_MINIMO} caracteres o más`, cumple: (c) => c.length >= LARGO_MINIMO },
  { texto: 'Letras y números', cumple: (c) => /\p{L}/u.test(c) && /\d/.test(c) },
];

// "app": pantallas de la cuenta y portal del socio (campos de 16 px: con menos, el iPhone agranda la pantalla).
// "panel": ventanas del panel del personal.
const ESTILOS = {
  app: {
    etiqueta: 'block text-sm font-semibold text-slate-700 mb-1.5',
    campo: 'block w-full min-h-[48px] px-3 text-base text-slate-900 bg-superficie border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-bordo-200 focus:border-bordo-400',
    boton: 'w-full min-h-[48px] rounded-xl bg-bordo-700 text-white text-base font-bold active:bg-bordo-800 hover:bg-bordo-800 disabled:opacity-50',
  },
  panel: {
    etiqueta: 'block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide',
    campo: 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400',
    boton: 'w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg',
  },
};

/**
 * Formulario para elegir una contraseña nueva: la actual (si se pide), la nueva y repetirla, con las reglas a la
 * vista. Revisa lo mismo que el backend antes de mandar. alEnviar({ actual, nueva }) hace el pedido: si rechaza,
 * se muestra su mensaje.
 *
 * email: el de la cuenta, para que el celular guarde la contraseña nueva donde corresponde.
 */
const FormCambiarPassword = ({ alEnviar, pedirActual = true, etiquetaActual = 'Contraseña actual', email, textoBoton = 'Cambiar contraseña', variante = 'app' }) => {
  const estilos = ESTILOS[variante];
  const id = useId();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [visibles, setVisibles] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    let problema = '';
    if (pedirActual && !actual) problema = `Escribí tu ${etiquetaActual.toLowerCase()}`;
    else if (!REGLAS.every((r) => r.cumple(nueva))) problema = `La contraseña nueva tiene que tener al menos ${LARGO_MINIMO} caracteres, con letras y números`;
    else if (nueva.length > LARGO_MAXIMO) problema = `La contraseña puede tener hasta ${LARGO_MAXIMO} caracteres`;
    else if (nueva !== repetida) problema = 'Las dos contraseñas nuevas no coinciden';
    else if (pedirActual && nueva === actual) problema = 'La contraseña nueva tiene que ser distinta de la actual';
    setError(problema);
    if (problema) return;

    setEnviando(true);
    try {
      await alEnviar({ actual, nueva });
    } catch (err) {
      setError(esErrorDeConexion(err) ? 'Sin conexión: para cambiar la contraseña necesitás internet.' : err.message);
    } finally {
      setEnviando(false);
    }
  };

  const tipo = visibles ? 'text' : 'password';
  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      {/* Para que el gestor de contraseñas sepa de qué cuenta es la nueva */}
      {email && <input type="email" name="username" autoComplete="username" value={email} readOnly className="hidden" />}

      {pedirActual && (
        <div>
          <label htmlFor={`${id}-actual`} className={estilos.etiqueta}>{etiquetaActual}</label>
          <input id={`${id}-actual`} type={tipo} autoComplete="current-password" value={actual}
            onChange={(e) => setActual(e.target.value)} className={estilos.campo} />
        </div>
      )}

      <div>
        <label htmlFor={`${id}-nueva`} className={estilos.etiqueta}>Contraseña nueva</label>
        <input id={`${id}-nueva`} type={tipo} autoComplete="new-password" value={nueva} maxLength={LARGO_MAXIMO}
          onChange={(e) => setNueva(e.target.value)} className={estilos.campo} aria-describedby={`${id}-reglas`} />
        <ul id={`${id}-reglas`} className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {REGLAS.map((r) => {
            const cumple = r.cumple(nueva);
            return (
              <li key={r.texto} className={`flex items-center gap-1.5 text-xs font-semibold ${cumple ? 'text-emerald-700' : 'text-slate-500'}`}>
                <Check className={`w-3.5 h-3.5 ${cumple ? '' : 'opacity-30'}`} aria-hidden="true" />
                {r.texto}
                <span className="sr-only">{cumple ? '(listo)' : '(falta)'}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <label htmlFor={`${id}-repetida`} className={estilos.etiqueta}>Repetí la contraseña nueva</label>
        <input id={`${id}-repetida`} type={tipo} autoComplete="new-password" value={repetida} maxLength={LARGO_MAXIMO}
          onChange={(e) => setRepetida(e.target.value)} className={estilos.campo} />
      </div>

      <button type="button" onClick={() => setVisibles((v) => !v)}
        className="min-h-[36px] inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700">
        {visibles ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        {visibles ? 'Ocultar las contraseñas' : 'Mostrar las contraseñas'}
      </button>

      {error && <p className="rounded-xl bg-rose-50 text-rose-700 text-sm font-medium p-3" role="alert">{error}</p>}

      <button type="submit" disabled={enviando} className={estilos.boton}>
        {enviando ? 'Guardando…' : textoBoton}
      </button>
    </form>
  );
};

export default FormCambiarPassword;

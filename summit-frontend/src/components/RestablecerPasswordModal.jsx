import React, { useState } from 'react';
import { KeyRound, Copy, Check } from 'lucide-react';
import Modal from './Modal';
import { botonPrimario, botonSecundario } from './Campo';
import { restablecerConTemporal } from '../services/cuenta';

/**
 * Restablece la contraseña de un socio o de alguien del equipo con una temporal, para dársela en persona. Al
 * entrar con ella, el sistema le pide que elija una propia.
 *
 * ruta: '/socios/{id}' (recepción o el admin) o '/usuarios/{id}' (solo el admin).
 */
const RestablecerPasswordModal = ({ nombre, ruta, onClose, onListo }) => {
  const [temporal, setTemporal] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [copiada, setCopiada] = useState(false);

  const restablecer = async () => {
    setEnviando(true);
    setError('');
    try {
      setTemporal(await restablecerConTemporal(ruta));
      onListo?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(temporal);
      setCopiada(true);
    } catch {
      // Sin permiso para el portapapeles: queda a la vista para copiarla a mano
    }
  };

  return (
    <Modal titulo="Restablecer contraseña" subtitulo={nombre} onClose={onClose} ancho="max-w-md"
      pie={temporal
        ? <button onClick={onClose} className={botonPrimario}>Listo</button>
        : <>
          <button onClick={onClose} className={botonSecundario}>Cancelar</button>
          <button onClick={restablecer} disabled={enviando} className={botonPrimario}>
            <KeyRound className="w-4 h-4" /> {enviando ? 'Restableciendo…' : 'Restablecer'}
          </button>
        </>}>
      {temporal ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Esta es la contraseña temporal. Dásela en persona: al entrar, el sistema le va a pedir que elija una propia.
          </p>
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <code className="text-2xl font-bold tracking-[0.15em] text-slate-900 select-all" data-temporal>{temporal}</code>
            <button onClick={copiar} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
              {copiada ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copiada ? 'Copiada' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-slate-500">No se vuelve a mostrar: si se pierde, restablecela otra vez.</p>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-slate-600">
          <p>Se le va a generar una contraseña temporal nueva para que se la des en persona.</p>
          <p>La contraseña que tiene ahora deja de funcionar y se cierran sus sesiones abiertas, también la de la app del celular.</p>
          {error && <p className="rounded-lg bg-rose-50 text-rose-700 font-medium p-3" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
};

export default RestablecerPasswordModal;

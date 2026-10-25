import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Globe, Moon, Bell, LogOut, Menu, KeyRound, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import FormCambiarPassword from '../cuenta/FormCambiarPassword';
import { cambiarPassword } from '../services/cuenta';
import { cerrarSesion } from '../services/auth';
import { usuarioActual } from '../utils/formato';

// Cambiar la propia contraseña desde el panel
const CambiarPasswordModal = ({ email, onClose }) => {
  const [listo, setListo] = useState(false);
  return (
    <Modal titulo="Cambiar contraseña" subtitulo={listo ? null : 'Si tenés la sesión abierta en otra computadora, ahí vas a tener que volver a entrar'}
      onClose={onClose} ancho="max-w-md">
      {listo ? (
        <div className="text-center space-y-4 py-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Listo: tu contraseña cambió.</p>
          <button onClick={onClose} className="w-full px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg">
            Cerrar
          </button>
        </div>
      ) : (
        <FormCambiarPassword variante="panel" email={email} textoBoton="Guardar contraseña nueva"
          alEnviar={async ({ actual, nueva }) => { await cambiarPassword(actual, nueva); setListo(true); }} />
      )}
    </Modal>
  );
};

const Navbar = ({ onMenuClick }) => {
  const usuario = usuarioActual();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const menu = useRef(null);

  // El menú de la cuenta se cierra al tocar afuera o con Escape
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alTocar = (e) => { if (!menu.current?.contains(e.target)) setMenuAbierto(false); };
    const alTeclear = (e) => { if (e.key === 'Escape') setMenuAbierto(false); };
    document.addEventListener('mousedown', alTocar);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alTocar);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [menuAbierto]);

  return (
    <header className="h-14 bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4">
      <div className="flex items-center">
        {/* Mobile menu button */}
        <button 
          onClick={onMenuClick}
          className="md:hidden text-slate-500 hover:text-slate-700 p-2 -ml-2 mr-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="w-auto md:w-60 flex items-center justify-between md:pr-4">
          <span className="text-lg md:text-xl font-extrabold text-blue-600 tracking-tight">Summit</span>
          <button className="hidden md:flex text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 text-slate-600">
        <button className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded hover:bg-slate-100 transition-colors text-slate-700">
          <Globe className="w-4 h-4 text-slate-500" />
          <span>ES</span>
        </button>
        
        <button className="hidden sm:flex p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
          <Moon className="w-4 h-4" />
        </button>

        <div className="relative">
          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full border-2 border-white">
            0
          </span>
        </div>

        <button 
          onClick={() => cerrarSesion()}
          title="Cerrar sesión"
          className="hidden sm:flex p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>

        {/* Cuenta: cambiar la contraseña y cerrar sesión (también en el celular, donde no está el botón de salir) */}
        <div className="relative pl-2 border-l border-slate-200" ref={menu}>
          <button onClick={() => setMenuAbierto((a) => !a)} aria-haspopup="menu" aria-expanded={menuAbierto}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100 transition-colors">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200">
              {usuario ? usuario.nombreCompleto.substring(0, 2).toUpperCase() : 'ST'}
            </span>
            <span className="hidden md:inline text-sm font-semibold text-slate-700">
              {usuario ? usuario.nombreCompleto : 'Staff Test'}
            </span>
          </button>
          {menuAbierto && (
            <div role="menu" className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-40">
              <div className="px-4 pb-2 mb-1 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800 truncate">{usuario?.nombreCompleto}</p>
                <p className="text-xs text-slate-500 truncate">{usuario?.email}</p>
              </div>
              <button role="menuitem" onClick={() => { setMenuAbierto(false); setCambiandoPassword(true); }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-400" /> Cambiar contraseña
              </button>
              <button role="menuitem" onClick={() => cerrarSesion()}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <LogOut className="w-4 h-4 text-slate-400" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {cambiandoPassword && <CambiarPasswordModal email={usuario?.email} onClose={() => setCambiandoPassword(false)} />}
    </header>
  );
};

export default Navbar;

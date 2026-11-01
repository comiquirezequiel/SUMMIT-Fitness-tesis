import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Bell, LogOut, Menu, KeyRound, CheckCircle2, Moon, Sun } from 'lucide-react';
import Modal from './Modal';
import { useTareasPendientes } from '../services/seguimiento';
import FormCambiarPassword from '../cuenta/FormCambiarPassword';
import { cambiarPassword } from '../services/cuenta';
import { cerrarSesion } from '../services/auth';
import { useModoOscuro } from '../services/tema';
import { usuarioActual } from '../utils/formato';

// Cambiar la propia contraseña desde el panel
const CambiarPasswordModal = ({ email, onClose }) => {
  const [listo, setListo] = useState(false);
  return (
    <Modal titulo="Cambiar contraseña" subtitulo={listo ? null : 'Si tenés la sesión abierta en otra computadora, ahí vas a tener que volver a entrar'}
      onClose={onClose} ancho="max-w-md">
      {listo ? (
        <div className="text-center space-y-3 py-1.5">
          <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Listo: tu contraseña cambió.</p>
          <button onClick={onClose} className="w-full px-3 py-1.5 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg">
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
  // La campanita avisa las tareas de seguimiento pendientes
  const avisaTareas = ['ADMIN', 'RECEPCION'].includes(usuario?.rol);
  const [oscuro, alternarTema] = useModoOscuro();
  const tareas = useTareasPendientes(avisaTareas);
  const tituloTareas = tareas.pendientes > 0
    ? `Seguimiento: ${tareas.pendientes} ${tareas.pendientes === 1 ? 'tarea pendiente' : 'tareas pendientes'}${tareas.atrasadas > 0 ? ` (${tareas.atrasadas} atrasadas)` : ''}`
    : 'Tareas de seguimiento';
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
    <header className="h-12 barra-marca fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-3">
      <div className="flex items-center">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          aria-label="Abrir el menú"
          className="md:hidden text-[#ebd2ae] hover:text-[#fbf6ef] p-2 tactil:min-h-11 tactil:min-w-11 flex items-center justify-center -ml-2 mr-2 rounded-lg hover:bg-black/25 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* La marca: el logo y el nombre en cobre, como en el logo */}
        <Link to="/" className="w-auto md:w-60 flex items-center gap-2 md:pr-3" aria-label="SUMMIT, ir al inicio">
          <img src="/assets/logo-summit.png" alt="" className="h-10 w-auto drop-shadow-[0_0_6px_rgba(217,160,102,0.55)]" />
          <span className="leading-none">
            <span className="block text-base md:text-lg font-black tracking-[0.18em] text-[#fbf6ef]">SUMMIT</span>
            <span className="hidden md:block text-xs font-semibold tracking-[0.32em] text-[#d9a066] mt-0.5">FITNESS</span>
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {avisaTareas && (
          <Link to="/socios/tareas" className="relative p-1.5 tactil:min-h-11 tactil:min-w-11 flex items-center justify-center rounded-lg hover:bg-black/25 text-[#ebd2ae] hover:text-[#fbf6ef] transition-colors"
            title={tituloTareas} aria-label={tituloTareas}>
            <Bell className="w-4 h-4" />
            {tareas.pendientes > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 text-white text-xs font-bold px-1.5 rounded-full border-2 border-bordo-800 ${tareas.atrasadas > 0 ? 'bg-rose-600' : 'bg-bronce-600'}`}>
                {tareas.pendientes > 9 ? '9+' : tareas.pendientes}
              </span>
            )}
          </Link>
        )}

        <button onClick={alternarTema} title={oscuro ? 'Pasar a modo claro' : 'Pasar a modo oscuro'} aria-label="Modo oscuro" aria-pressed={oscuro}
          className="p-1.5 tactil:min-h-11 tactil:min-w-11 flex items-center justify-center rounded-lg hover:bg-black/25 text-[#ebd2ae] hover:text-[#fbf6ef] transition-colors">
          {oscuro ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={() => cerrarSesion()}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="hidden sm:flex items-center justify-center p-1.5 tactil:min-h-11 tactil:min-w-11 rounded-lg hover:bg-black/25 text-[#ebd2ae] hover:text-[#fbf6ef] transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>

        {/* Cuenta: cambiar la contraseña y cerrar sesión (también en el celular, donde no está el botón de salir) */}
        <div className="relative pl-2 border-l border-white/15" ref={menu}>
          <button onClick={() => setMenuAbierto((a) => !a)} aria-haspopup="menu" aria-expanded={menuAbierto}
            className="flex items-center gap-2 rounded-lg p-1 tactil:min-h-11 tactil:min-w-11 hover:bg-black/25 transition-colors">
            <span className="w-7 h-7 rounded-full bg-linear-to-br from-bronce-300 to-bronce-600 text-bordo-950 font-bold text-xs flex items-center justify-center ring-1 ring-black/20">
              {usuario ? usuario.nombreCompleto.substring(0, 2).toUpperCase() : 'ST'}
            </span>
            <span className="hidden md:inline text-sm font-semibold text-[#fbf6ef]">
              {usuario ? usuario.nombreCompleto : 'Staff Test'}
            </span>
          </button>
          {menuAbierto && (
            <div role="menu" className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40">
              <div className="px-3 pb-2 mb-1 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800 truncate">{usuario?.nombreCompleto}</p>
                <p className="text-xs text-slate-500 truncate">{usuario?.email}</p>
              </div>
              <button role="menuitem" onClick={() => { setMenuAbierto(false); setCambiandoPassword(true); }}
                className="w-full px-3 py-1.5 tactil:min-h-11 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-400" /> Cambiar contraseña
              </button>
              <button role="menuitem" onClick={() => cerrarSesion()}
                className="w-full px-3 py-1.5 tactil:min-h-11 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
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

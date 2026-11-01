import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Save, Power, KeyRound } from 'lucide-react';
import Modal from '../components/Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../components/Campo';
import Encabezado from '../components/Encabezado';
import RestablecerPasswordModal from '../components/RestablecerPasswordModal';
import { apiFetch } from '../services/api';
import { usuarioActual } from '../utils/formato';
import { ESTADOS_USUARIO } from '../utils/constantes';

const ROLES = {
  ADMIN: { texto: 'Administrador', clase: 'bg-violet-50 text-violet-700 border-violet-200' },
  RECEPCION: { texto: 'Recepción', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  PROFESOR: { texto: 'Profesor', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
};

/**
 * Alta de un miembro del personal. El backend solo permite que lo haga un ADMIN.
 */
const NuevoMiembroModal = ({ onClose, onGuardado }) => {
  const [datos, setDatos] = useState({ nombreCompleto: '', dni: '', email: '', telefono: '', password: '', rol: 'RECEPCION' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const set = (campo, valor) => setDatos(prev => ({ ...prev, [campo]: valor }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const res = await apiFetch('/usuarios', { method: 'POST', body: JSON.stringify(datos) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detalle = err.detalles ? Object.values(err.detalles).join(' · ') : '';
        throw new Error(detalle || err.error || 'No se pudo crear el usuario');
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal titulo="Nuevo miembro del equipo" subtitulo="Podrá ingresar al sistema con su email y contraseña" onClose={onClose}
      pie={<>
        <button type="button" onClick={onClose} className={botonSecundario}>Cancelar</button>
        <button type="submit" form="form-miembro" disabled={guardando} className={botonPrimario}>
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Crear usuario'}
        </button>
      </>}>
      <form id="form-miembro" onSubmit={guardar} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Campo label="Nombre completo" required className="md:col-span-2">
          <input required minLength={3} value={datos.nombreCompleto} onChange={e => set('nombreCompleto', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="DNI" required>
          <input required inputMode="numeric" value={datos.dni} onChange={e => set('dni', e.target.value.replace(/\D/g, ''))} className={inputClass} />
        </Campo>
        <Campo label="Rol" required>
          <select value={datos.rol} onChange={e => set('rol', e.target.value)} className={inputClass}>
            {Object.entries(ROLES).map(([valor, { texto }]) => <option key={valor} value={valor}>{texto}</option>)}
          </select>
        </Campo>
        <Campo label="Email" required>
          <input type="email" required value={datos.email} onChange={e => set('email', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Teléfono">
          <input value={datos.telefono} onChange={e => set('telefono', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Contraseña inicial" required ayuda="Mínimo 6 caracteres. Al entrar por primera vez, elige una propia." className="md:col-span-2">
          <input type="text" required minLength={6} value={datos.password} onChange={e => set('password', e.target.value)} className={`${inputClass} font-mono`} />
        </Campo>
        {error && <p className="md:col-span-2 text-sm text-rose-700 font-medium">{error}</p>}
      </form>
    </Modal>
  );
};

/**
 * Equipo (pestaña de Gestión de personal): quién entra al sistema, con qué rol, y las altas, bajas y contraseñas.
 */
const AjustesEquipo = () => {
  const usuario = usuarioActual();
  const [miembros, setMiembros] = useState(null); // null: todavía cargando
  const [error, setError] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [restableciendo, setRestableciendo] = useState(null); // miembro al que se le da una contraseña temporal

  const cargar = useCallback(async () => {
    try {
      const respuestas = await Promise.all(Object.keys(ROLES).map(rol => apiFetch(`/usuarios/rol/${rol}`)));
      if (respuestas.some(r => !r.ok)) throw new Error();
      const listas = await Promise.all(respuestas.map(r => r.json()));
      setMiembros(listas.flat().sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)));
      setError('');
    } catch {
      setError('No se pudo cargar el equipo.');
      setMiembros((m) => m || []);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (m) => {
    const activo = m.estado === 'ACTIVO';
    if (activo && !window.confirm(`¿Desactivar a ${m.nombreCompleto}? No podrá iniciar sesión.`)) return;
    const res = activo
      ? await apiFetch(`/usuarios/${m.idUsuario}`, { method: 'DELETE' })
      : await apiFetch(`/usuarios/${m.idUsuario}/activar`, { method: 'PATCH' });
    if (!res.ok) setError('No se pudo cambiar el estado del usuario.');
    cargar();
  };

  const esAdmin = usuario?.rol === 'ADMIN';

  return (
    <div className="space-y-3 w-full relative">
      <Encabezado titulo="Equipo" icono={Users} subtitulo="Los empleados y colaboradores que entran al sistema, con su rol"
        acciones={esAdmin && (
          <button onClick={() => setModalAbierto(true)} className={`${botonPrimario} whitespace-nowrap`}>
            <UserPlus className="w-4 h-4" /> Nuevo miembro
          </button>
        )} />

      {error && <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">Miembros del equipo{miembros && ` (${miembros.length})`}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 font-medium">Miembro</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                {esAdmin && <th className="px-4 py-2.5 font-medium text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!miembros && (
                <tr><td colSpan={esAdmin ? 5 : 4} className="px-4 py-6 text-center text-sm text-slate-500">
                  <span className="aparece-tarde" role="status" data-cargando>Cargando…</span>
                </td></tr>
              )}
              {(miembros || []).map(m => {
                const rol = ROLES[m.rol];
                const estado = ESTADOS_USUARIO[m.estado] || ESTADOS_USUARIO.INACTIVO;
                const esYo = m.idUsuario === usuario?.idUsuario;
                return (
                  <tr key={m.idUsuario} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs shrink-0">
                          {m.nombreCompleto.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{m.nombreCompleto} {esYo && <span className="text-xs text-slate-500">(vos)</span>}</p>
                          <p className="text-xs text-slate-500">{m.telefono || `DNI ${m.dni}`}</p>
                          {m.debeCambiarPassword && (
                            <p className="text-xs text-amber-700 mt-0.5" title="Todavía no entró a elegir su propia contraseña">Con contraseña temporal</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{m.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${rol.clase}`}>{rol.texto}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${estado.clase}`}>{estado.texto}</span>
                    </td>
                    {esAdmin && (
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {!esYo && (
                          <button onClick={() => setRestableciendo(m)} title="Restablecer contraseña"
                            className="mr-2 p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors">
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}
                        {!esYo && (
                          <button onClick={() => cambiarEstado(m)} title={m.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                            className={`p-2 rounded-lg border transition-colors ${m.estado === 'ACTIVO' ? 'border-slate-200 text-slate-500 hover:text-rose-700 hover:border-rose-200' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                            <Power className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalAbierto && <NuevoMiembroModal onClose={() => setModalAbierto(false)} onGuardado={() => { setModalAbierto(false); cargar(); }} />}
      {restableciendo && (
        <RestablecerPasswordModal nombre={restableciendo.nombreCompleto} ruta={`/usuarios/${restableciendo.idUsuario}`}
          onClose={() => setRestableciendo(null)} onListo={cargar} />
      )}
    </div>
  );
};

export default AjustesEquipo;

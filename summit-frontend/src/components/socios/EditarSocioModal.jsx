import { useEffect, useState } from 'react';
import { Save, UserX, UserCheck } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import { apiFetch } from '../../services/api';
import { listarDescuentos, textoValorDescuento } from '../../services/membresias';
import { hoyIso } from '../../utils/formato';
import { GENEROS, OBJETIVOS } from '../../utils/constantes';

/**
 * Edición de datos del socio, baja lógica y reactivación.
 */
const EditarSocioModal = ({ socio, onClose, onGuardado }) => {
  const [datos, setDatos] = useState({
    nombreCompleto: socio.nombreCompleto || '',
    email: socio.email || '',
    telefono: socio.telefono || '',
    fechaNacimiento: socio.fechaNacimiento || '',
    genero: socio.genero || '',
    domicilio: socio.domicilio || '',
    ciudad: socio.ciudad || '',
    objetivo: socio.objetivo || '',
    observaciones: socio.observaciones || '',
    idDescuento: socio.idDescuentoHabitual ? String(socio.idDescuentoHabitual) : '',
  });
  const [descuentos, setDescuentos] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listarDescuentos(true).then(setDescuentos).catch(() => setDescuentos([]));
  }, []);
  // El que ya tiene puede haberse desactivado: igual se muestra para poder dejarlo
  const habitualDesactivado = socio.idDescuentoHabitual && !descuentos.some(d => d.idDescuento === socio.idDescuentoHabitual);

  const set = (campo, valor) => setDatos(prev => ({ ...prev, [campo]: valor }));

  const ejecutar = async (accion) => {
    setProcesando(true);
    setError('');
    try {
      const res = await accion();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detalle = err.detalles ? Object.values(err.detalles).join(' · ') : '';
        throw new Error(detalle || err.error || 'No se pudo guardar');
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const guardar = (e) => {
    e.preventDefault();
    ejecutar(() => apiFetch(`/socios/${socio.idSocio}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...datos,
        fechaNacimiento: datos.fechaNacimiento || null,
        idDescuento: datos.idDescuento ? Number(datos.idDescuento) : null,
      }),
    }));
  };

  const darDeBaja = () => {
    if (!window.confirm(`¿Dar de baja a ${socio.nombreCompleto}? No podrá ingresar al gimnasio.`)) return;
    ejecutar(() => apiFetch(`/socios/${socio.idSocio}`, { method: 'DELETE' }));
  };

  const reactivar = () => ejecutar(() => apiFetch(`/socios/${socio.idSocio}/reactivar`, { method: 'PATCH' }));

  const dadoDeBaja = socio.estado === 'CANCELADO';

  return (
    <Modal
      titulo="Editar socio"
      subtitulo={`DNI ${socio.dni}`}
      onClose={onClose}
      ancho="max-w-2xl"
      pie={<>
        {dadoDeBaja ? (
          <button type="button" onClick={reactivar} disabled={procesando}
            className="mr-auto px-4 py-2.5 text-sm font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-lg flex items-center gap-2">
            <UserCheck className="w-4 h-4" /> Reactivar socio
          </button>
        ) : (
          <button type="button" onClick={darDeBaja} disabled={procesando}
            className="mr-auto px-4 py-2.5 text-sm font-semibold text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg flex items-center gap-2">
            <UserX className="w-4 h-4" /> Dar de baja
          </button>
        )}
        <button type="button" onClick={onClose} className={botonSecundario}>Cancelar</button>
        <button type="submit" form="form-editar-socio" disabled={procesando} className={botonPrimario}>
          <Save className="w-4 h-4" /> {procesando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </>}
    >
      <form id="form-editar-socio" onSubmit={guardar} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Campo label="Nombre completo" required className="md:col-span-2">
          <input required minLength={3} value={datos.nombreCompleto} onChange={e => set('nombreCompleto', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Email" required>
          <input type="email" required value={datos.email} onChange={e => set('email', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Teléfono">
          <input value={datos.telefono} onChange={e => set('telefono', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Fecha de nacimiento">
          <input type="date" max={hoyIso()} value={datos.fechaNacimiento} onChange={e => set('fechaNacimiento', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Género">
          <select value={datos.genero} onChange={e => set('genero', e.target.value)} className={inputClass}>
            <option value="">Sin especificar</option>
            {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Campo>
        <Campo label="Domicilio">
          <input value={datos.domicilio} onChange={e => set('domicilio', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Ciudad">
          <input value={datos.ciudad} onChange={e => set('ciudad', e.target.value)} className={inputClass} />
        </Campo>
        <Campo label="Objetivo">
          <select value={datos.objetivo} onChange={e => set('objetivo', e.target.value)} className={inputClass}>
            <option value="">Sin especificar</option>
            {OBJETIVOS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>
        <Campo label="Descuento habitual" ayuda="Se le propone en cada cobro">
          <select value={datos.idDescuento} onChange={e => set('idDescuento', e.target.value)} className={inputClass}>
            <option value="">Sin descuento</option>
            {habitualDesactivado && (
              <option value={socio.idDescuentoHabitual}>{socio.descuentoHabitual} (desactivado)</option>
            )}
            {descuentos.map(d => (
              <option key={d.idDescuento} value={d.idDescuento}>{d.nombre} ({textoValorDescuento(d)})</option>
            ))}
          </select>
        </Campo>
        <Campo label="Observaciones" className="md:col-span-2">
          <textarea rows={2} value={datos.observaciones} onChange={e => set('observaciones', e.target.value)} className={`${inputClass} resize-none`} />
        </Campo>
        {error && <p className="md:col-span-2 text-sm text-rose-600 font-medium">{error}</p>}
      </form>
    </Modal>
  );
};

export default EditarSocioModal;

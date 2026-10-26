import React, { useEffect, useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import Modal from '../Modal';
import CobroModal from './CobroModal';
import { inputClass } from '../Campo';
import { apiFetch } from '../../services/api';
import { formatFecha, diasHasta, textoVencimiento } from '../../utils/formato';

/**
 * Cobro rápido desde el tablero o el control de acceso: el mismo modal de cobro de la lista de socios, sin tener que
 * ir a buscarlo ahí. Con idSocio se abre directo; sin él, primero se busca al socio por nombre o DNI.
 * onCobrado(pago, socio) se llama con el cobro registrado.
 */
const CobroRapido = ({ idSocio, onClose, onCobrado }) => {
  const [planes, setPlanes] = useState([]);
  const [socios, setSocios] = useState(null); // para buscar (solo sin idSocio)
  const [socio, setSocio] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/planes').then(r => (r.ok ? r.json() : [])).then(setPlanes).catch(() => setPlanes([]));
    if (idSocio) {
      apiFetch(`/socios/${idSocio}`)
        .then(async (r) => {
          if (!r.ok) throw new Error();
          setSocio(await r.json());
        })
        .catch(() => setError('No se pudieron leer los datos del socio.'));
    } else {
      apiFetch('/socios')
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then(lista => setSocios(lista.filter(s => s.estado !== 'CANCELADO')))
        .catch(() => setError('No se pudo cargar la lista de socios.'));
    }
  }, [idSocio]);

  if (socio) {
    return <CobroModal socio={socio} planes={planes} onClose={onClose} onGuardado={(pago) => onCobrado?.(pago, socio)} />;
  }
  if (idSocio && !error) return null; // leyendo los datos del socio: es un instante

  const filtro = busqueda.trim().toLowerCase();
  const resultados = filtro && socios
    ? socios.filter(s => s.nombreCompleto.toLowerCase().includes(filtro) || s.dni.includes(filtro)).slice(0, 8)
    : [];

  return (
    <Modal titulo="Cobrar cuota" subtitulo="Buscá al socio por nombre o DNI" onClose={onClose}>
      {error ? (
        <p className="text-sm text-rose-600 font-medium">{error}</p>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input autoFocus value={busqueda} onChange={e => setBusqueda(e.target.value)} disabled={!socios}
              placeholder={socios ? 'Nombre o DNI' : 'Cargando socios...'} className={`${inputClass} pl-9`} />
          </div>
          {filtro && resultados.length === 0 && socios && (
            <p className="text-sm text-slate-500 text-center py-3">No hay socios que coincidan.</p>
          )}
          <ul className="divide-y divide-slate-100">
            {resultados.map(s => {
              const dias = diasHasta(s.vencimientoMembresia);
              return (
                <li key={s.idSocio}>
                  <button type="button" onClick={() => setSocio(s)}
                    className="w-full flex items-center justify-between gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 text-left">
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800 truncate">{s.nombreCompleto}</span>
                      <span className="block text-xs text-slate-500">
                        DNI {s.dni} · {s.vencimientoMembresia
                          ? `${s.planActual}, ${formatFecha(s.vencimientoMembresia)} (${textoVencimiento(dias)})`
                          : 'Sin membresía'}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
};

export default CobroRapido;

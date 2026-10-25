import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Users, Plus, ChevronLeft, ChevronRight, User, Trash2, Save, CheckCircle2, XCircle, Ban, Hourglass } from 'lucide-react';
import Modal from '../components/Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../components/Campo';
import { apiFetch } from '../services/api';
import { formatFecha, hoyIso, usuarioActual } from '../utils/formato';
import { DIAS_SEMANA as DIAS } from '../utils/constantes';
const COLORES = ['border-l-rose-500', 'border-l-indigo-500', 'border-l-pink-500', 'border-l-orange-500', 'border-l-blue-500', 'border-l-emerald-500'];

const ESTADOS_RESERVA = {
  CONFIRMADA: { texto: 'Confirmada', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  ASISTIO: { texto: 'Asistió', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  AUSENTE: { texto: 'Ausente', clase: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELADA: { texto: 'Cancelada', clase: 'bg-slate-100 text-slate-500 border-slate-200' },
};

// Fecha local -> 'YYYY-MM-DD'
const aIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lunesDe = (d) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; };
const hora = (h) => (h ? h.substring(0, 5) : '');

const ClassCard = ({ clase, color, onClick }) => {
  const isFull = clase.reservados >= clase.capacidad;
  return (
    <div onClick={onClick} className={`p-4 rounded-xl border border-l-4 ${color} relative shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white`}>
      <div className="flex justify-between items-start mb-2 gap-2">
        <h3 className="font-bold text-slate-800">{clase.nombreClase}</h3>
        <span className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap ${isFull ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {clase.reservados}/{clase.capacidad}
        </span>
      </div>
      <div className="space-y-1.5 mt-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>{hora(clase.horaInicio)} - {hora(clase.horaFin)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Users className="w-4 h-4 text-slate-400" />
          <span>{clase.profesor || 'Sin profesor asignado'}</span>
        </div>
        {clase.descripcion && <p className="text-xs text-slate-500 pt-1">{clase.descripcion}</p>}
      </div>
    </div>
  );
};

/**
 * Alta de clase con sus horarios semanales. El backend rechaza horarios superpuestos del mismo profesor.
 */
const NuevaClaseModal = ({ onClose, onGuardado }) => {
  const [datos, setDatos] = useState({ nombre: '', descripcion: '', capacidadMaxima: 20, idProfesor: '' });
  const [horarios, setHorarios] = useState([{ diaSemana: 'LUNES', horaInicio: '08:00', horaFin: '09:00' }]);
  const [profesores, setProfesores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [claseCreada, setClaseCreada] = useState(false); // creada con algún horario rechazado: no volver a crearla

  useEffect(() => {
    apiFetch('/usuarios/rol/PROFESOR').then(r => (r.ok ? r.json() : [])).then(lista => setProfesores(lista.filter(p => p.estado === 'ACTIVO')));
  }, []);

  const setHorario = (i, campo, valor) => setHorarios(hs => hs.map((h, j) => (j === i ? { ...h, [campo]: valor } : h)));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const resClase = await apiFetch('/clases', {
        method: 'POST',
        body: JSON.stringify({
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          capacidadMaxima: Number(datos.capacidadMaxima),
          profesor: datos.idProfesor ? { idUsuario: Number(datos.idProfesor) } : null,
        }),
      });
      const clase = await resClase.json().catch(() => ({}));
      if (!resClase.ok) throw new Error(clase.error || 'No se pudo crear la clase');

      const rechazados = [];
      for (const h of horarios) {
        const res = await apiFetch(`/clases/${clase.idClase}/horarios`, { method: 'POST', body: JSON.stringify(h) });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          rechazados.push(`${DIAS.find(d => d.enum === h.diaSemana).nombre} ${h.horaInicio}: ${err.error || 'error'}`);
        }
      }
      if (rechazados.length > 0) {
        setClaseCreada(true);
        setError(`La clase se creó, pero estos horarios no se guardaron: ${rechazados.join(' | ')}`);
        return;
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal titulo="Nueva clase" subtitulo="Clase grupal con sus horarios semanales" onClose={onClose} ancho="max-w-2xl"
      pie={<>
        <button type="button" onClick={claseCreada ? onGuardado : onClose} className={botonSecundario}>{claseCreada ? 'Cerrar' : 'Cancelar'}</button>
        <button type="submit" form="form-clase" disabled={guardando || claseCreada} className={botonPrimario}>
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Crear clase'}
        </button>
      </>}>
      <form id="form-clase" onSubmit={guardar} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="Nombre" required>
            <input required value={datos.nombre} onChange={e => setDatos({ ...datos, nombre: e.target.value })} className={inputClass} placeholder="Ej: Funcional" />
          </Campo>
          <Campo label="Capacidad (personas)" required>
            <input type="number" min="1" required value={datos.capacidadMaxima} onChange={e => setDatos({ ...datos, capacidadMaxima: e.target.value })} className={inputClass} />
          </Campo>
          <Campo label="Profesor">
            <select value={datos.idProfesor} onChange={e => setDatos({ ...datos, idProfesor: e.target.value })} className={inputClass}>
              <option value="">Sin asignar</option>
              {profesores.map(p => <option key={p.idUsuario} value={p.idUsuario}>{p.nombreCompleto}</option>)}
            </select>
          </Campo>
          <Campo label="Descripción">
            <input value={datos.descripcion} onChange={e => setDatos({ ...datos, descripcion: e.target.value })} className={inputClass} placeholder="Opcional" />
          </Campo>
        </div>

        <div>
          <p className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Horarios semanales</p>
          <div className="space-y-2">
            {horarios.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select value={h.diaSemana} onChange={e => setHorario(i, 'diaSemana', e.target.value)} className={`${inputClass} w-36`}>
                  {DIAS.map(d => <option key={d.enum} value={d.enum}>{d.nombre}</option>)}
                </select>
                <input type="time" value={h.horaInicio} onChange={e => setHorario(i, 'horaInicio', e.target.value)} className={`${inputClass} w-32`} />
                <span className="text-slate-400 text-sm">a</span>
                <input type="time" value={h.horaFin} onChange={e => setHorario(i, 'horaFin', e.target.value)} className={`${inputClass} w-32`} />
                {horarios.length > 1 && (
                  <button type="button" onClick={() => setHorarios(hs => hs.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-rose-600" title="Quitar horario">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setHorarios(hs => [...hs, { ...hs[hs.length - 1] }])}
            className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Agregar horario
          </button>
        </div>
        {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
      </form>
    </Modal>
  );
};

/**
 * Reservas de un horario en una fecha: anotar socios, cancelar y tomar asistencia.
 */
const ReservasModal = ({ clase, fecha, esAdmin, onClose, onCambio }) => {
  const [reservas, setReservas] = useState([]);
  const [espera, setEspera] = useState([]); // lista de espera, en orden (se anotan desde la app)
  const [socios, setSocios] = useState([]);
  const [idSocio, setIdSocio] = useState('');
  const [mensaje, setMensaje] = useState(null);

  const cargar = useCallback(async () => {
    const [res, resEspera] = await Promise.all([
      apiFetch(`/reservas/horario/${clase.idHorario}?fecha=${fecha}`),
      apiFetch(`/reservas/horario/${clase.idHorario}/espera?fecha=${fecha}`),
    ]);
    if (res.ok) setReservas(await res.json());
    if (resEspera.ok) setEspera(await resEspera.json());
  }, [clase.idHorario, fecha]);

  useEffect(() => {
    cargar();
    apiFetch('/socios').then(r => (r.ok ? r.json() : [])).then(lista =>
      setSocios(lista.filter(s => s.estado === 'ACTIVO').sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))));
  }, [cargar]);

  const ejecutar = async (peticion, textoOk) => {
    setMensaje(null);
    const res = await peticion();
    if (res.ok) {
      setMensaje({ tipo: 'ok', texto: textoOk });
      cargar();
      onCambio();
    } else {
      const err = await res.json().catch(() => ({}));
      setMensaje({ tipo: 'error', texto: err.error || 'No se pudo completar la acción' });
    }
  };

  const reservar = () => ejecutar(
    () => apiFetch('/reservas', { method: 'POST', body: JSON.stringify({ idUsuario: Number(idSocio), idHorario: clase.idHorario, fechaClase: fecha }) }),
    'Reserva confirmada');

  const marcar = (r, estado) => ejecutar(
    () => apiFetch(`/reservas/${r.idReserva}/asistencia`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
    `${r.nombreSocio}: ${estado === 'ASISTIO' ? 'presente' : 'ausente'}`);

  const cancelar = (r) => {
    if (!window.confirm(`¿Cancelar la reserva de ${r.nombreSocio}?`)) return;
    ejecutar(() => apiFetch(`/reservas/${r.idReserva}`, { method: 'DELETE' }), 'Reserva cancelada');
  };

  const desactivarClase = () => {
    if (!window.confirm(`¿Desactivar la clase "${clase.nombreClase}"? Deja de aparecer en la agenda.`)) return;
    apiFetch(`/clases/${clase.idClase}`, { method: 'DELETE' }).then(() => { onCambio(); onClose(); });
  };

  const hoy = hoyIso();
  const esFutura = fecha >= hoy;
  const yaDictada = fecha <= hoy;
  const activas = reservas.filter(r => r.estado !== 'CANCELADA');
  const reservados = new Set(activas.map(r => r.idSocio));

  return (
    <Modal titulo={clase.nombreClase}
      subtitulo={`${formatFecha(fecha)} · ${hora(clase.horaInicio)} a ${hora(clase.horaFin)} · ${clase.profesor || 'sin profesor'} · ${activas.length}/${clase.capacidad} lugares`}
      onClose={onClose} ancho="max-w-2xl"
      pie={<>
        {esAdmin && (
          <button onClick={desactivarClase} className="mr-auto px-4 py-2.5 text-sm font-semibold text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg flex items-center gap-2">
            <Ban className="w-4 h-4" /> Desactivar clase
          </button>
        )}
        <button onClick={onClose} className={botonSecundario}>Cerrar</button>
      </>}>
      <div className="space-y-4">
        {esFutura && (
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={idSocio} onChange={e => setIdSocio(e.target.value)} className={`${inputClass} flex-1`}>
              <option value="">Elegí un socio para anotarlo...</option>
              {socios.filter(s => !reservados.has(s.idSocio)).map(s => (
                <option key={s.idSocio} value={s.idSocio}>{s.nombreCompleto} · DNI {s.dni}</option>
              ))}
            </select>
            <button onClick={reservar} disabled={!idSocio || activas.length >= clase.capacidad} className={botonPrimario}>
              <Plus className="w-4 h-4" /> Reservar
            </button>
          </div>
        )}
        {mensaje && <p className={`text-sm font-medium ${mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-600'}`}>{mensaje.texto}</p>}

        {reservas.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No hay reservas para esta clase.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {reservas.map(r => {
              const estado = ESTADOS_RESERVA[r.estado];
              return (
                <li key={r.idReserva} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><User className="w-4 h-4 text-slate-500" /></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{r.nombreSocio}</p>
                      <p className="text-xs text-slate-500">DNI {r.dni}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${estado.clase}`}>{estado.texto}</span>
                    {r.estado !== 'CANCELADA' && yaDictada && (
                      <>
                        <button onClick={() => marcar(r, 'ASISTIO')} title="Presente" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => marcar(r, 'AUSENTE')} title="Ausente" className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"><XCircle className="w-4 h-4" /></button>
                      </>
                    )}
                    {r.estado === 'CONFIRMADA' && esFutura && (
                      <button onClick={() => cancelar(r)} className="text-xs font-semibold text-slate-500 hover:text-rose-600 px-2">Cancelar</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {espera.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-amber-600" /> Lista de espera ({espera.length})
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 mb-2">
              Si se libera un lugar con más de una hora de anticipación, se le reserva solo al primero que puede y le llega una notificación.
            </p>
            <ol className="divide-y divide-slate-100 border border-amber-200 rounded-lg">
              {espera.map(e => (
                <li key={e.idSocio} className="p-3 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-amber-50 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">{e.puesto}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{e.nombreSocio}</p>
                    <p className="text-xs text-slate-500">DNI {e.dni}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Modal>
  );
};

const Clases = () => {
  const esAdmin = usuarioActual()?.rol === 'ADMIN';
  const [lunes, setLunes] = useState(() => lunesDe(new Date()));
  const [fecha, setFecha] = useState(hoyIso());
  const [agenda, setAgenda] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { tipo: 'nueva' } | { tipo: 'reservas', clase }

  const cargarAgenda = useCallback(async () => {
    setCargando(true);
    try {
      const res = await apiFetch(`/clases/agenda?fecha=${fecha}`);
      if (!res.ok) throw new Error();
      setAgenda(await res.json());
      setError('');
    } catch {
      setError('No se pudo cargar la agenda.');
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => { cargarAgenda(); }, [cargarAgenda]);

  const dias = DIAS.map((d, i) => {
    const f = new Date(lunes);
    f.setDate(lunes.getDate() + i);
    return { ...d, iso: aIso(f), numero: f.getDate() };
  });

  const moverSemana = (semanas) => {
    const nuevo = new Date(lunes);
    nuevo.setDate(lunes.getDate() + semanas * 7);
    setLunes(nuevo);
    setFecha(aIso(nuevo));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agenda de Clases</h1>
          <p className="text-sm text-slate-500">Horarios, reservas y asistencia de las clases grupales</p>
        </div>
        {esAdmin && (
          <button onClick={() => setModal({ tipo: 'nueva' })} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap">
            <Plus className="w-4 h-4" /> Nueva Clase
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-6 gap-2">
          <button onClick={() => moverSemana(-1)} title="Semana anterior" className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-2 overflow-x-auto">
            {dias.map(d => (
              <button
                key={d.iso}
                onClick={() => setFecha(d.iso)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  fecha === d.iso
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                {d.nombre} {d.numero}
                {d.iso === hoyIso() && <span className="ml-1 text-[10px] font-bold text-emerald-600">HOY</span>}
              </button>
            ))}
          </div>

          <button onClick={() => moverSemana(1)} title="Semana siguiente" className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {error && <p className="text-sm text-rose-600 font-medium mb-4">{error}</p>}

        {!cargando && agenda.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Calendar className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">No hay clases este día</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {agenda.map((c, i) => (
              <ClassCard key={c.idHorario} clase={c} color={COLORES[c.idClase % COLORES.length] || COLORES[i % COLORES.length]}
                onClick={() => setModal({ tipo: 'reservas', clase: c })} />
            ))}
          </div>
        )}
      </div>

      {modal?.tipo === 'nueva' && (
        <NuevaClaseModal onClose={() => setModal(null)} onGuardado={() => { setModal(null); cargarAgenda(); }} />
      )}
      {modal?.tipo === 'reservas' && (
        <ReservasModal clase={modal.clase} fecha={fecha} esAdmin={esAdmin} onClose={() => setModal(null)} onCambio={cargarAgenda} />
      )}
    </div>
  );
};

export default Clases;

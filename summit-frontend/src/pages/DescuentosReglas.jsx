import { useCallback, useEffect, useState } from 'react';
import { Save, BadgePercent, Snowflake, Ticket, Plus, Pencil, Trash2, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../components/Campo';
import Encabezado from '../components/Encabezado';
import {
  obtenerReglas, guardarReglas, listarDescuentos, crearDescuento, actualizarDescuento, eliminarDescuento,
  textoValorDescuento,
} from '../services/membresias';

// Las dos pestañas de Configuración y reglas que antes eran Membresías > Descuentos y reglas (solo admin):
// ReglasMembresia (matrícula de inscripción y límites de los congelamientos) y Descuentos (el catálogo que recepción
// aplica al cobrar).

const Tarjeta = ({ icon: Icon, color, titulo, accion, children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs ${className}`}>
    <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
        <h2 className="text-sm font-bold text-slate-800">{titulo}</h2>
      </div>
      {accion}
    </div>
    {children}
  </div>
);

// Campo numérico con la unidad a la derecha ("días", "%") o a la izquierda ("$")
const Numero = ({ valor, onChange, unidad, prefijo, ...props }) => (
  <div className="relative">
    {prefijo && <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-500 text-sm font-medium pointer-events-none">{prefijo}</span>}
    <input type="number" value={valor ?? ''} onChange={e => onChange(e.target.value)}
      className={`${inputClass} ${prefijo ? 'pl-6' : ''} ${unidad ? 'pr-12' : ''}`} {...props} />
    {unidad && <span className="absolute inset-y-0 right-2.5 flex items-center text-slate-500 text-sm font-medium pointer-events-none">{unidad}</span>}
  </div>
);

// Aviso de guardado (los de "listo" se van solos a los 3 segundos)
const useMensaje = () => {
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }
  const mostrar = useCallback((tipo, texto) => {
    setMensaje(texto ? { tipo, texto } : null);
    if (tipo === 'ok' && texto) setTimeout(() => setMensaje(null), 3000);
  }, []);
  return [mensaje, mostrar];
};

const Mensaje = ({ mensaje }) => (mensaje ? (
  <div className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
    {mensaje.tipo === 'ok' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
    {mensaje.texto}
  </div>
) : null);

const Nota = ({ children }) => (
  <p className="text-xs text-slate-500 leading-relaxed px-2.5 py-2 bg-slate-50 rounded-lg">{children}</p>
);

/**
 * Matrícula de inscripción y límites de los congelamientos (solo admin).
 */
export const ReglasMembresia = () => {
  const [reglas, setReglas] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, mostrar] = useMensaje();

  useEffect(() => {
    obtenerReglas().then(setReglas).catch(err => mostrar('error', err.message));
  }, [mostrar]);

  const cambiarRegla = (campo, valor) => setReglas(prev => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    setGuardando(true);
    mostrar('ok', null);
    try {
      setReglas(await guardarReglas({
        matriculaMonto: Number(reglas.matriculaMonto) || 0,
        matriculaReinscripcionDias: parseInt(reglas.matriculaReinscripcionDias, 10) || 0,
        congelamientoMinDias: parseInt(reglas.congelamientoMinDias, 10) || 0,
        congelamientoMaxDiasAnio: parseInt(reglas.congelamientoMaxDiasAnio, 10) || 0,
      }));
      mostrar('ok', 'Reglas guardadas: se aplican desde el próximo cobro o congelamiento.');
    } catch (err) {
      mostrar('error', err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!reglas) {
    // Sin mensaje está cargando: el aviso aparece solo si tarda; con mensaje es el error y se ve enseguida
    return mensaje?.texto
      ? <div className="p-5 text-center text-sm text-slate-500">{mensaje.texto}</div>
      : <div className="p-5 text-center text-sm text-slate-500 aparece-tarde" role="status" data-cargando>Cargando reglas...</div>;
  }

  const conMatricula = Number(reglas.matriculaMonto) > 0;

  return (
    <div className="space-y-3">
      <Encabezado titulo="Reglas de membresía" icono={Ticket}
        subtitulo="La matrícula de inscripción y los límites de los congelamientos"
        acciones={(
          <button onClick={guardar} disabled={guardando} className={botonPrimario}>
            <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar reglas'}
          </button>
        )} />

      <Mensaje mensaje={mensaje} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Tarjeta icon={Ticket} color="bg-violet-50 text-violet-600" titulo="Matrícula de inscripción">
          <div className="space-y-3">
            <Campo label="Monto" ayuda="0 = el gimnasio no cobra matrícula">
              <Numero min="0" step="0.01" prefijo="$" valor={reglas.matriculaMonto} onChange={v => cambiarRegla('matriculaMonto', v)} />
            </Campo>
            <Campo label="Volver a cobrarla si estuvo sin cuota más de" ayuda="0 = solo en la primera inscripción">
              <Numero min="0" step="1" unidad="días" disabled={!conMatricula}
                valor={reglas.matriculaReinscripcionDias} onChange={v => cambiarRegla('matriculaReinscripcionDias', v)} />
            </Campo>
            <Nota>
              Se suma sola al primer cobro de cada socio (y al de los que vuelven después de ese tiempo). Al cobrar, recepción
              la puede bonificar.
            </Nota>
          </div>
        </Tarjeta>

        <Tarjeta icon={Snowflake} color="bg-cyan-50 text-cyan-600" titulo="Congelamiento de membresías">
          <div className="space-y-3">
            <Campo label="Mínimo de días de cada congelamiento">
              <Numero min="1" step="1" unidad="días" valor={reglas.congelamientoMinDias} onChange={v => cambiarRegla('congelamientoMinDias', v)} />
            </Campo>
            <Campo label="Máximo de días congelados por año" ayuda="0 = el gimnasio no congela membresías">
              <Numero min="0" step="1" unidad="días" valor={reglas.congelamientoMaxDiasAnio} onChange={v => cambiarRegla('congelamientoMaxDiasAnio', v)} />
            </Campo>
            <Nota>
              Se congela desde la ficha del socio. Mientras dura no puede ingresar y el vencimiento se corre esos días; si vuelve
              antes, recepción lo termina y se descuentan los días que no usó.
            </Nota>
          </div>
        </Tarjeta>
      </div>
    </div>
  );
};

const FormDescuento = ({ descuento, onChange, onSubmit, onCancel, procesando, error }) => (
  <form onSubmit={onSubmit} className="p-3 rounded-lg border border-blue-100 bg-blue-50/40 space-y-2.5">
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_9rem] gap-2.5">
      <Campo label="Nombre" required>
        <input required autoFocus maxLength={60} value={descuento.nombre} placeholder="Ej. Familiar, Estudiante, Convenio empresa"
          onChange={e => onChange('nombre', e.target.value)} className={inputClass} />
      </Campo>
      <Campo label="Tipo" required>
        <select value={descuento.tipo} onChange={e => onChange('tipo', e.target.value)} className={inputClass}>
          <option value="PORCENTAJE">Porcentaje</option>
          <option value="MONTO_FIJO">Monto fijo</option>
        </select>
      </Campo>
      <Campo label="Valor" required>
        <Numero required min="0.01" step="0.01" max={descuento.tipo === 'PORCENTAJE' ? 100 : undefined}
          valor={descuento.valor} onChange={v => onChange('valor', v)}
          unidad={descuento.tipo === 'PORCENTAJE' ? '%' : null} prefijo={descuento.tipo === 'MONTO_FIJO' ? '$' : null} />
      </Campo>
    </div>
    {error && <p className="text-sm text-rose-700 font-medium">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={onCancel} className={botonSecundario}>Cancelar</button>
      <button type="submit" disabled={procesando} className={botonPrimario}>
        <Save className="w-4 h-4" /> {procesando ? 'Guardando...' : 'Guardar descuento'}
      </button>
    </div>
  </form>
);

/**
 * Catálogo de descuentos que recepción aplica al cobrar (solo admin).
 */
export const Descuentos = () => {
  const [descuentos, setDescuentos] = useState([]);
  const [mensaje, mostrar] = useMensaje();
  const [edicion, setEdicion] = useState(null); // descuento que se está creando (sin id) o editando
  const [errorDescuento, setErrorDescuento] = useState('');
  const [procesando, setProcesando] = useState(false);

  const cargarDescuentos = useCallback(
    () => listarDescuentos().then(setDescuentos).catch(err => mostrar('error', err.message)),
    [mostrar],
  );

  useEffect(() => { cargarDescuentos(); }, [cargarDescuentos]);

  const editar = (descuento) => {
    setErrorDescuento('');
    setEdicion(descuento ? { ...descuento, valor: String(Number(descuento.valor)) } : { nombre: '', tipo: 'PORCENTAJE', valor: '' });
  };
  const cambiarEdicion = (campo, valor) => setEdicion(prev => ({ ...prev, [campo]: valor }));

  const guardarDescuento = async (e) => {
    e.preventDefault();
    setProcesando(true);
    setErrorDescuento('');
    const cuerpo = { nombre: edicion.nombre.trim(), tipo: edicion.tipo, valor: Number(edicion.valor), activo: edicion.activo ?? true };
    try {
      if (edicion.idDescuento) await actualizarDescuento(edicion.idDescuento, cuerpo);
      else await crearDescuento(cuerpo);
      setEdicion(null);
      await cargarDescuentos();
    } catch (err) {
      setErrorDescuento(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const cambiarActivo = async (d) => {
    try {
      await actualizarDescuento(d.idDescuento, { nombre: d.nombre, tipo: d.tipo, valor: d.valor, activo: !d.activo });
      await cargarDescuentos();
    } catch (err) {
      mostrar('error', err.message);
    }
  };

  const borrar = async (d) => {
    const habituales = d.socios > 0
      ? ` ${d.socios === 1 ? '1 socio lo tiene' : `${d.socios} socios lo tienen`} como descuento habitual y se ${d.socios === 1 ? 'queda' : 'quedan'} sin descuento.`
      : '';
    if (!window.confirm(`¿Borrar el descuento "${d.nombre}"?${habituales} Los cobros ya hechos no cambian. Si solo querés dejar de ofrecerlo, desactivalo.`)) return;
    try {
      await eliminarDescuento(d.idDescuento);
      await cargarDescuentos();
    } catch (err) {
      mostrar('error', err.message);
    }
  };

  return (
    <div className="space-y-3">
      <Encabezado titulo="Descuentos" icono={BadgePercent}
        subtitulo="Los que recepción aplica al cobrar: sobre el precio del plan, nunca sobre la matrícula"
        acciones={!edicion && (
          <button onClick={() => editar(null)} className={botonPrimario}>
            <Plus className="w-4 h-4" /> Nuevo descuento
          </button>
        )} />

      <Mensaje mensaje={mensaje} />

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2.5">
        {edicion && !edicion.idDescuento && (
          <FormDescuento descuento={edicion} onChange={cambiarEdicion} onSubmit={guardarDescuento}
            onCancel={() => setEdicion(null)} procesando={procesando} error={errorDescuento} />
        )}

        {descuentos.length === 0 && !edicion && (
          <p className="text-sm text-slate-500 py-3 text-center">
            Todavía no hay descuentos. Creá uno, por ejemplo "Familiar" del 10 % o "Estudiante" de $ 2.000.
          </p>
        )}

        <ul className="divide-y divide-slate-100">
          {descuentos.map(d => (
            <li key={d.idDescuento} className="py-2">
              {edicion?.idDescuento === d.idDescuento ? (
                <FormDescuento descuento={edicion} onChange={cambiarEdicion} onSubmit={guardarDescuento}
                  onCancel={() => setEdicion(null)} procesando={procesando} error={errorDescuento} />
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex-1 min-w-40">
                    <p className={`text-sm font-semibold ${d.activo ? 'text-slate-800' : 'text-slate-500'}`}>{d.nombre}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3" />
                      {d.socios === 0 ? 'Ningún socio lo tiene como habitual' : d.socios === 1 ? '1 socio lo tiene como habitual' : `${d.socios} socios lo tienen como habitual`}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-sm font-bold ${d.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    − {textoValorDescuento(d)}
                  </span>
                  <button onClick={() => cambiarActivo(d)} title={d.activo ? 'Dejar de ofrecerlo al cobrar' : 'Volver a ofrecerlo al cobrar'}
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${d.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                    {d.activo ? 'Activo' : 'Desactivado'}
                  </button>
                  <button onClick={() => editar(d)} disabled={!!edicion} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40" aria-label={`Editar ${d.nombre}`}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => borrar(d)} disabled={!!edicion} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40" aria-label={`Borrar ${d.nombre}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <Nota>
          Cada socio puede tener uno habitual (se elige en su alta o al editarlo) y al cobrar recepción también puede hacer un
          descuento especial, con motivo. Cambiar o borrar un descuento no modifica los cobros ya hechos.
        </Nota>
      </div>
    </div>
  );
};

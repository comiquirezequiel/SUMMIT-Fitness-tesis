import React, { useEffect, useState } from 'react';
import { Save, BadgePercent, Snowflake, Ticket, Plus, Pencil, Trash2, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../components/Campo';
import {
  obtenerReglas, guardarReglas, listarDescuentos, crearDescuento, actualizarDescuento, eliminarDescuento,
  textoValorDescuento,
} from '../services/membresias';

const Tarjeta = ({ icon: Icon, color, titulo, accion, children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] ${className}`}>
    <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
        <h2 className="text-lg font-bold text-slate-800">{titulo}</h2>
      </div>
      {accion}
    </div>
    {children}
  </div>
);

// Campo numérico con la unidad a la derecha ("días", "%") o a la izquierda ("$")
const Numero = ({ valor, onChange, unidad, prefijo, ...props }) => (
  <div className="relative">
    {prefijo && <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm font-medium pointer-events-none">{prefijo}</span>}
    <input type="number" value={valor ?? ''} onChange={e => onChange(e.target.value)}
      className={`${inputClass} ${prefijo ? 'pl-7' : ''} ${unidad ? 'pr-14' : ''}`} {...props} />
    {unidad && <span className="absolute inset-y-0 right-3 flex items-center text-slate-400 text-sm font-medium pointer-events-none">{unidad}</span>}
  </div>
);

const FormDescuento = ({ descuento, onChange, onSubmit, onCancel, procesando, error }) => (
  <form onSubmit={onSubmit} className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem_10rem] gap-3">
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
    {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={onCancel} className={botonSecundario}>Cancelar</button>
      <button type="submit" disabled={procesando} className={botonPrimario}>
        <Save className="w-4 h-4" /> {procesando ? 'Guardando...' : 'Guardar descuento'}
      </button>
    </div>
  </form>
);

/**
 * Membresías > Descuentos y reglas (solo admin): matrícula de inscripción, límites de los congelamientos y el catálogo
 * de descuentos que recepción aplica al cobrar.
 */
const DescuentosReglas = () => {
  const [reglas, setReglas] = useState(null);
  const [descuentos, setDescuentos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }
  const [edicion, setEdicion] = useState(null); // descuento que se está creando (sin id) o editando
  const [errorDescuento, setErrorDescuento] = useState('');
  const [procesando, setProcesando] = useState(false);

  const mostrar = (tipo, texto) => {
    setMensaje({ tipo, texto });
    if (tipo === 'ok') setTimeout(() => setMensaje(null), 3000);
  };
  const cargarDescuentos = () => listarDescuentos().then(setDescuentos).catch(err => mostrar('error', err.message));

  useEffect(() => {
    obtenerReglas().then(setReglas).catch(err => mostrar('error', err.message));
    cargarDescuentos();
  }, []);

  const cambiarRegla = (campo, valor) => setReglas(prev => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
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

  if (!reglas) {
    return <div className="p-8 text-center text-slate-500">{mensaje?.texto || 'Cargando reglas...'}</div>;
  }

  const conMatricula = Number(reglas.matriculaMonto) > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Descuentos y reglas</h1>
          <p className="text-sm text-slate-500">La matrícula, los congelamientos y los descuentos que recepción aplica al cobrar.</p>
        </div>
        <button onClick={guardar} disabled={guardando}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar reglas'}
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {mensaje.tipo === 'ok' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          {mensaje.texto}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Tarjeta icon={Ticket} color="bg-violet-50 text-violet-600" titulo="Matrícula de inscripción">
          <div className="space-y-5">
            <Campo label="Monto" ayuda="0 = el gimnasio no cobra matrícula">
              <Numero min="0" step="0.01" prefijo="$" valor={reglas.matriculaMonto} onChange={v => cambiarRegla('matriculaMonto', v)} />
            </Campo>
            <Campo label="Volver a cobrarla si estuvo sin cuota más de" ayuda="0 = solo en la primera inscripción">
              <Numero min="0" step="1" unidad="días" disabled={!conMatricula}
                valor={reglas.matriculaReinscripcionDias} onChange={v => cambiarRegla('matriculaReinscripcionDias', v)} />
            </Campo>
            <p className="text-xs text-slate-500 leading-relaxed p-3 bg-slate-50 rounded-xl">
              Se suma sola al primer cobro de cada socio (y al de los que vuelven después de ese tiempo). Al cobrar, recepción
              la puede bonificar.
            </p>
          </div>
        </Tarjeta>

        <Tarjeta icon={Snowflake} color="bg-cyan-50 text-cyan-600" titulo="Congelamiento de membresías">
          <div className="space-y-5">
            <Campo label="Mínimo de días de cada congelamiento">
              <Numero min="1" step="1" unidad="días" valor={reglas.congelamientoMinDias} onChange={v => cambiarRegla('congelamientoMinDias', v)} />
            </Campo>
            <Campo label="Máximo de días congelados por año" ayuda="0 = el gimnasio no congela membresías">
              <Numero min="0" step="1" unidad="días" valor={reglas.congelamientoMaxDiasAnio} onChange={v => cambiarRegla('congelamientoMaxDiasAnio', v)} />
            </Campo>
            <p className="text-xs text-slate-500 leading-relaxed p-3 bg-slate-50 rounded-xl">
              Se congela desde la ficha del socio. Mientras dura no puede ingresar y el vencimiento se corre esos días; si vuelve
              antes, recepción lo termina y se descuentan los días que no usó.
            </p>
          </div>
        </Tarjeta>
      </div>

      <Tarjeta icon={BadgePercent} color="bg-emerald-50 text-emerald-600" titulo="Descuentos"
        accion={!edicion && (
          <button onClick={() => editar(null)} className={botonSecundario}>
            <Plus className="w-4 h-4" /> Nuevo descuento
          </button>
        )}>
        <div className="space-y-3">
          {edicion && !edicion.idDescuento && (
            <FormDescuento descuento={edicion} onChange={cambiarEdicion} onSubmit={guardarDescuento}
              onCancel={() => setEdicion(null)} procesando={procesando} error={errorDescuento} />
          )}

          {descuentos.length === 0 && !edicion && (
            <p className="text-sm text-slate-500 py-4 text-center">
              Todavía no hay descuentos. Creá uno, por ejemplo "Familiar" del 10 % o "Estudiante" de $ 2.000.
            </p>
          )}

          <ul className="divide-y divide-slate-100">
            {descuentos.map(d => (
              <li key={d.idDescuento} className="py-3">
                {edicion?.idDescuento === d.idDescuento ? (
                  <FormDescuento descuento={edicion} onChange={cambiarEdicion} onSubmit={guardarDescuento}
                    onCancel={() => setEdicion(null)} procesando={procesando} error={errorDescuento} />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[10rem]">
                      <p className={`font-semibold ${d.activo ? 'text-slate-800' : 'text-slate-400'}`}>{d.nombre}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Users className="w-3.5 h-3.5" />
                        {d.socios === 0 ? 'Ningún socio lo tiene como habitual' : d.socios === 1 ? '1 socio lo tiene como habitual' : `${d.socios} socios lo tienen como habitual`}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-sm font-bold ${d.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      − {textoValorDescuento(d)}
                    </span>
                    <button onClick={() => cambiarActivo(d)} title={d.activo ? 'Dejar de ofrecerlo al cobrar' : 'Volver a ofrecerlo al cobrar'}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${d.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                      {d.activo ? 'Activo' : 'Desactivado'}
                    </button>
                    <button onClick={() => editar(d)} disabled={!!edicion} className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40" aria-label={`Editar ${d.nombre}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => borrar(d)} disabled={!!edicion} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40" aria-label={`Borrar ${d.nombre}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-500 leading-relaxed p-3 bg-slate-50 rounded-xl">
            Se aplican sobre el precio del plan, nunca sobre la matrícula. Cada socio puede tener uno habitual (se elige en su
            alta o al editarlo) y al cobrar recepción también puede hacer un descuento especial, con motivo. Cambiar o borrar un
            descuento no modifica los cobros ya hechos.
          </p>
        </div>
      </Tarjeta>
    </div>
  );
};

export default DescuentosReglas;

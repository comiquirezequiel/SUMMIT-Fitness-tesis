import { LogIn, LogOut, ArrowLeftRight } from 'lucide-react';
import { AvisosIngreso } from '../FichaIngreso';
import { duracion, hora, diaCorto, sumarDias, textoRol } from './comun';

// "25/10/2026 16:03:12" (fechaHora de la ficha) -> "2026-10-25"
const diaDeLaFicha = (fechaHora) => `${fechaHora.substring(6, 10)}-${fechaHora.substring(3, 5)}-${fechaHora.substring(0, 2)}`;

// "a las 07:58", "ayer a las 22:00" o "el jue 23/10 a las 22:00"
const cuandoEntro = (entrada, diaSalida) => {
  const dia = entrada.substring(0, 10);
  if (dia === diaSalida) return `a las ${hora(entrada)}`;
  if (dia === sumarDias(diaSalida, -1)) return `ayer a las ${hora(entrada)}`;
  return `el ${diaCorto(dia)} a las ${hora(entrada)}`;
};

/**
 * Ficha del control de acceso cuando pasa alguien del equipo: su paso es la entrada o la salida, con la hora bien
 * grande. Si el sistema lo tomó al revés (por ejemplo, se había olvidado de marcar la salida), recepción lo corrige ahí
 * mismo con el botón de abajo.
 */
const FichaPersonal = ({ ficha, onInvertir, invirtiendo }) => {
  const salida = ficha.fichada === 'SALIDA';
  const titulo = salida
    ? (ficha.fichadaRepetida ? 'Salida ya registrada' : 'Salida registrada')
    : (ficha.fichadaRepetida ? 'Entrada ya registrada' : 'Entrada registrada');
  return (
    <div className={`p-4 md:p-5 ${salida ? 'bg-sky-50/70' : 'bg-emerald-50/60'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${salida ? 'bg-sky-600' : 'bg-emerald-500'}`}>
          {salida ? <LogOut className="w-8 h-8 text-white" /> : <LogIn className="w-8 h-8 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black uppercase tracking-widest ${salida ? 'text-sky-700' : 'text-emerald-600'}`}>{titulo}</p>
          <h3 className="text-2xl md:text-3xl font-extrabold text-slate-800 leading-tight truncate">{ficha.nombreSocio}</h3>
          <p className="text-sm text-slate-500 mt-0.5">DNI {ficha.dni} · Personal ({textoRol(ficha.rol)})</p>
          {salida && ficha.entradaTurno && (
            <p className="text-sm text-slate-700 mt-1">
              Trabajó <b>{duracion(ficha.minutosTrabajados)}</b> · entró {cuandoEntro(ficha.entradaTurno, diaDeLaFicha(ficha.fechaHora))}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[11px] font-black uppercase tracking-widest ${salida ? 'text-sky-700' : 'text-emerald-700'}`}>
            {salida ? 'Salida' : 'Entrada'}
          </p>
          <p className="text-3xl md:text-4xl font-extrabold text-slate-800 tabular-nums leading-none mt-1">{ficha.fechaHora?.substring(11, 16)}</p>
        </div>
      </div>

      <AvisosIngreso avisos={ficha.avisos} />

      {ficha.inversionPosible && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onInvertir} disabled={invirtiendo.enviando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {invirtiendo.enviando ? 'Corrigiendo...' : salida ? '¿Está llegando? Es una entrada' : '¿Se está yendo? Es una salida'}
          </button>
          {invirtiendo.error && <span className="text-xs text-rose-600 font-medium">{invirtiendo.error}</span>}
        </div>
      )}
    </div>
  );
};

export default FichaPersonal;

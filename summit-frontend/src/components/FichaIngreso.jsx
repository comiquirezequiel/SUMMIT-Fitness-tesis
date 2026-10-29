import React from 'react';
import { XCircle, AlertTriangle, CalendarDays, Wallet, HeartPulse } from 'lucide-react';
import { formatFecha, textoVencimiento } from '../utils/formato';

// Partes de la ficha de un intento de ingreso (respuesta del control de acceso por DNI).

// Tarjeta chica con un dato de la ficha (días de la semana, cuota, apto)
const DatoFicha = ({ icon: Icon, titulo, valor, detalle, alerta }) => (
  <div className={`rounded-xl border p-3 ${alerta ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" /> {titulo}
    </p>
    <p className={`text-lg font-bold mt-1 ${alerta ? 'text-rose-700' : 'text-slate-800'}`}>{valor}</p>
    {detalle && <p className={`text-xs mt-0.5 ${alerta ? 'text-rose-600' : 'text-slate-500'}`}>{detalle}</p>}
  </div>
);

const datoSemana = (r) => {
  if (!r.plan) return { valor: '—', detalle: 'Sin plan' };
  if (r.diasSemanaPermitidos == null) {
    return { valor: 'Pase libre', detalle: `${r.diasSemanaUsados ?? 0} ${r.diasSemanaUsados === 1 ? 'día' : 'días'} esta semana` };
  }
  return {
    valor: `${r.diasSemanaUsados} de ${r.diasSemanaPermitidos}`,
    detalle: `Le ${r.diasSemanaRestantes === 1 ? 'queda' : 'quedan'} ${r.diasSemanaRestantes} esta semana`,
    alerta: r.resultado === 'DENEGADO_LIMITE_SEMANAL',
  };
};

/** Lo que le impide entrar, en rojo. */
export const FaltasIngreso = ({ faltas }) => (faltas?.length > 0 ? (
  <ul className="mt-4 space-y-1.5">
    {faltas.map((falta, i) => (
      <li key={i} className="flex items-start gap-2 bg-rose-100 text-rose-800 rounded-lg px-3 py-2 text-sm font-semibold">
        <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> {falta}
      </li>
    ))}
  </ul>
) : null);

/** Advertencias que no le impiden entrar, en amarillo. */
export const AvisosIngreso = ({ avisos }) => (avisos?.length > 0 ? (
  <ul className="mt-2 space-y-1.5">
    {avisos.map((aviso, i) => (
      <li key={i} className="flex items-start gap-2 bg-amber-100 text-amber-800 rounded-lg px-3 py-2 text-sm font-medium">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {aviso}
      </li>
    ))}
  </ul>
) : null);

/** Días usados de la semana, cuota y apto médico de un socio. */
export const DatosFicha = ({ ficha }) => {
  const semana = datoSemana(ficha);
  const cuotaVencida = ficha.diasParaVencerCuota != null && ficha.diasParaVencerCuota < 0;
  const aptoVencido = ficha.diasParaVencerApto != null && ficha.diasParaVencerApto < 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
      <DatoFicha icon={CalendarDays} titulo="Días esta semana" {...semana} />
      <DatoFicha
        icon={Wallet}
        titulo="Cuota"
        valor={ficha.vencimientoCuota ? formatFecha(ficha.vencimientoCuota) : 'Sin membresía'}
        detalle={textoVencimiento(ficha.diasParaVencerCuota)}
        alerta={!ficha.vencimientoCuota || ficha.resultado === 'DENEGADO_CUOTA_VENCIDA' || cuotaVencida}
      />
      <DatoFicha
        icon={HeartPulse}
        titulo="Apto médico"
        valor={ficha.vencimientoApto ? formatFecha(ficha.vencimientoApto) : 'Sin certificado'}
        detalle={textoVencimiento(ficha.diasParaVencerApto)}
        alerta={!ficha.vencimientoApto || ficha.resultado === 'DENEGADO_CERTIFICADO_MEDICO' || aptoVencido}
      />
    </div>
  );
};

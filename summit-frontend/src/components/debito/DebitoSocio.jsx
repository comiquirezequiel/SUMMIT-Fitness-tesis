import React, { useState, useEffect, useCallback } from 'react';
import { Repeat, RefreshCw, AlertTriangle, XCircle, Plus } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { formatFecha, formatMoneda } from '../../utils/formato';
import { ESTADOS_DEBITO, textoMedioPago, planAptoDebito } from '../../utils/constantes';
import { inputClass } from '../Campo';
import QrAutorizacion from './QrAutorizacion';

const Dato = ({ label, valor }) => (
  <div>
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
    <p className="text-sm font-medium text-slate-800 mt-0.5">{valor || '—'}</p>
  </div>
);

const boton = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50';

/**
 * Débito automático del socio, dentro de su ficha (recepción y admin).
 * Alta con QR, estado, último cobro, alerta de rechazo, actualizar y baja.
 */
const DebitoSocio = ({ socio }) => {
  const [estado, setEstado] = useState(null); // { habilitado, debito }
  const [planes, setPlanes] = useState([]);
  const [form, setForm] = useState(null);     // { idPlan, emailPagador } mientras se adhiere
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const res = await apiFetch(`/debitos/socio/${socio.idSocio}`);
      if (res.ok) setEstado(await res.json());
    } catch {
      setError('No se pudo consultar el débito automático');
    }
  }, [socio.idSocio]);

  useEffect(() => { cargar(); }, [cargar]);

  const pedir = async (path, opciones, mensajeError) => {
    setProcesando(true);
    setError('');
    try {
      const res = await apiFetch(path, opciones);
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error || mensajeError);
      return datos;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setProcesando(false);
    }
  };

  const abrirAlta = async () => {
    setForm({ idPlan: '', emailPagador: '' });
    const res = await apiFetch('/planes');
    if (res.ok) setPlanes((await res.json()).filter(planAptoDebito));
  };

  const adherir = async () => {
    const datos = await pedir('/debitos', {
      method: 'POST',
      body: JSON.stringify({ idSocio: socio.idSocio, idPlan: form.idPlan, emailPagador: form.emailPagador || null }),
    }, 'No se pudo crear el débito automático');
    if (datos) {
      setForm(null);
      setEstado(e => ({ ...e, debito: datos }));
    }
  };

  const actualizar = async (idDebito) => {
    const datos = await pedir(`/debitos/${idDebito}/sincronizar`, { method: 'POST' }, 'No se pudo consultar a Mercado Pago');
    if (datos) setEstado(e => ({ ...e, debito: datos }));
  };

  const darDeBaja = async (debito) => {
    const pregunta = debito.estado === 'PENDIENTE_AUTORIZACION'
      ? '¿Cancelar esta adhesión? El link de autorización deja de servir.'
      : `¿Dar de baja el débito automático de ${socio.nombreCompleto}? Mercado Pago deja de cobrarle.`;
    if (!window.confirm(pregunta)) return;
    const datos = await pedir(`/debitos/${debito.idDebito}/baja`, { method: 'POST' }, 'No se pudo dar de baja');
    if (datos) setEstado(e => ({ ...e, debito: datos }));
  };

  if (!estado) return null;

  if (!estado.habilitado) {
    return (
      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2">
        <Repeat className="w-4 h-4 text-slate-400 shrink-0" />
        El débito automático no está activado: falta cargar la credencial de Mercado Pago del gimnasio en el servidor.
      </p>
    );
  }

  const debito = estado.debito;
  const vigente = debito && debito.estado !== 'CANCELADO';
  const insignia = vigente ? ESTADOS_DEBITO[debito.estado] : null;

  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Repeat className="w-4 h-4 text-sky-600" /> Débito automático mensual
        </p>
        {insignia && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${insignia.clase}`}>{insignia.texto}</span>}
      </div>

      {vigente ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Dato label="Plan" valor={`${debito.plan} · ${formatMoneda(debito.monto)}`} />
            <Dato label="Medio de pago" valor={textoMedioPago(debito.medioPago)} />
            <Dato label="Cuenta Mercado Pago" valor={debito.emailPagador} />
            <Dato label="Próximo cobro" valor={debito.proximoCobro && formatFecha(debito.proximoCobro)} />
            <Dato label="Último cobro" valor={debito.ultimoCobro && formatFecha(debito.ultimoCobro)} />
            <Dato label="Alta" valor={`${formatFecha(debito.fechaAlta)}${debito.creadoPor ? ` · ${debito.creadoPor}` : ''}`} />
          </div>

          {debito.ultimoRechazo && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span><b>Débito rechazado</b> el {formatFecha(debito.ultimoRechazo)}: {debito.detalleRechazo}. Mercado Pago reintenta;
                si no entra, la membresía vence como siempre. Conviene avisarle al socio.</span>
            </div>
          )}

          {debito.estado === 'PENDIENTE_AUTORIZACION' && debito.linkAutorizacion && (
            <QrAutorizacion link={debito.linkAutorizacion} />
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => actualizar(debito.idDebito)} disabled={procesando}
              className={`${boton} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
              <RefreshCw className={`w-3.5 h-3.5 ${procesando ? 'animate-spin' : ''}`} /> Actualizar estado
            </button>
            <button onClick={() => darDeBaja(debito)} disabled={procesando}
              className={`${boton} border border-rose-200 text-rose-600 hover:bg-rose-50`}>
              <XCircle className="w-3.5 h-3.5" /> {debito.estado === 'PENDIENTE_AUTORIZACION' ? 'Cancelar adhesión' : 'Dar de baja'}
            </button>
          </div>
        </>
      ) : form ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-600 space-y-1">
              <span>Plan a debitar cada mes</span>
              <select value={form.idPlan} onChange={e => setForm({ ...form, idPlan: e.target.value })} className={inputClass}>
                <option value="">Elegí un plan...</option>
                {planes.map(p => <option key={p.idPlan} value={p.idPlan}>{p.nombrePlan} ({formatMoneda(p.precioBase)})</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">
              <span>Email de su cuenta de Mercado Pago</span>
              <input type="email" value={form.emailPagador} placeholder={socio.email}
                onChange={e => setForm({ ...form, emailPagador: e.target.value })} className={inputClass} />
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            Se cobra del dinero en cuenta de Mercado Pago o de la tarjeta que elija el socio (débito, crédito o prepaga:
            Ualá, Naranja X, su banco). Solo planes de 30 días o múltiplos.
          </p>
          <div className="flex gap-2">
            <button onClick={adherir} disabled={procesando || !form.idPlan}
              className={`${boton} bg-sky-600 hover:bg-sky-700 text-white`}>
              {procesando ? 'Creando...' : 'Crear y mostrar QR'}
            </button>
            <button onClick={() => setForm(null)} className={`${boton} border border-slate-200 text-slate-600 hover:bg-slate-50`}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {debito ? `Dado de baja el ${formatFecha(debito.fechaBaja)}.` : 'No tiene débito automático.'} Si prefiere no pasar por
            recepción cada mes, se puede adherir.
          </p>
          <button onClick={abrirAlta} className={`${boton} bg-sky-600 hover:bg-sky-700 text-white`}>
            <Plus className="w-3.5 h-3.5" /> Adherir al débito automático
          </button>
        </div>
      )}

      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
    </div>
  );
};

export default DebitoSocio;

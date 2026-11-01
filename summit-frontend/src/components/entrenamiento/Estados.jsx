import { Loader2, Inbox, AlertTriangle, CheckCircle2, Info, X, RefreshCw } from 'lucide-react';

// Estados de carga, vacío, error y avisos de las pantallas de entrenamiento

export const Cargando = ({ texto = 'Cargando...' }) => (
  <div className="p-5 text-center text-slate-500 text-sm flex items-center justify-center gap-2 aparece-tarde" role="status" data-cargando>
    <Loader2 className="w-4 h-4 animate-spin" /> {texto}
  </div>
);

export const Vacio = ({ icono: Icono = Inbox, titulo, children }) => (
  <div className="p-5 text-center text-slate-500">
    <Icono className="w-9 h-9 mx-auto mb-2 text-slate-300" />
    <p className="font-semibold text-slate-600">{titulo}</p>
    {children && <div className="text-sm mt-1">{children}</div>}
  </div>
);

export const ErrorCaja = ({ mensaje, onReintentar }) => (
  <div className="p-4 text-center bg-rose-50 text-rose-700 rounded-xl border border-rose-100" role="alert">
    <AlertTriangle className="w-7 h-7 mx-auto mb-2 opacity-60" />
    <p className="text-sm font-medium">{mensaje}</p>
    {onReintentar && (
      <button onClick={onReintentar}
        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 tactil:min-h-11 tactil:px-4 text-sm font-semibold bg-white border border-rose-200 rounded-lg hover:bg-rose-100">
        <RefreshCw className="w-3.5 h-3.5" /> Reintentar
      </button>
    )}
  </div>
);

const AVISOS = {
  exito: { clase: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icono: CheckCircle2 },
  error: { clase: 'bg-rose-50 text-rose-700 border-rose-200', Icono: AlertTriangle },
  alerta: { clase: 'bg-amber-50 text-amber-900 border-amber-200', Icono: AlertTriangle },
  info: { clase: 'bg-blue-50 text-blue-800 border-blue-200', Icono: Info },
};

export const Aviso = ({ tipo = 'info', children, onCerrar, className = '' }) => {
  const { clase, Icono } = AVISOS[tipo] || AVISOS.info;
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm ${clase} ${className}`}
      role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">{children}</div>
      {onCerrar && (
        // En el celular y la tablet, 44 px para el dedo sin agrandar el aviso (los márgenes negativos lo compensan)
        <button onClick={onCerrar} className="p-0.5 tactil:p-3.5 tactil:-m-3 rounded-sm hover:bg-black/5 shrink-0" aria-label="Cerrar aviso">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

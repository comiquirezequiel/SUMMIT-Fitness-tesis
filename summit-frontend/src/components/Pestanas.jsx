import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Pestañas de una pantalla o de una tarjeta (el estilo de Caja y Pagos). pestanas: [{ id, texto, icon?, contador?,
 * alerta? }]: el contador va en un globito (rojo con alerta). children: lo que va a la derecha en la misma fila (un
 * filtro, un botón); si no entra, baja a otra fila.
 */
const Pestanas = ({ pestanas, activa, onCambiar, children, className = '' }) => (
  <div className={`flex flex-wrap items-end justify-between gap-x-3 border-b border-slate-200 ${className}`}>
    <div className="flex gap-1 overflow-x-auto hide-scrollbar -mb-px" role="tablist">
      {pestanas.map((p) => {
        const Icono = p.icon;
        const elegida = activa === p.id;
        return (
          <button key={p.id} type="button" role="tab" aria-selected={elegida} onClick={() => onCambiar(p.id)}
            className={`px-3 py-2 tactil:min-h-11 text-sm font-semibold border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors ${elegida ? 'border-bronce-500 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {Icono && <Icono className="w-3.5 h-3.5" />}
            {p.texto}
            {p.contador > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold text-white flex items-center justify-center ${p.alerta ? 'bg-rose-600' : 'bg-blue-600'}`}>
                {p.contador > 99 ? '99+' : p.contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
    {children && <div className="flex flex-wrap items-center gap-2 py-1.5 ml-auto">{children}</div>}
  </div>
);

/**
 * La pestaña abierta queda en la dirección (?vista=...): se puede compartir el link, recargar sin perderla y llegar
 * directo desde otra pantalla (las direcciones viejas de las pantallas que ahora son pestañas mandan acá). Si la
 * dirección no trae una pestaña que exista (o que el rol vea), abre la primera. Cambiar de pestaña no suma pasos al
 * "Atrás" del navegador.
 */
export const usePestana = (ids, parametro = 'vista') => {
  const [params, setParams] = useSearchParams();
  const pedida = params.get(parametro);
  const activa = ids.includes(pedida) ? pedida : ids[0];
  const cambiar = (id) => setParams((actuales) => {
    const nuevos = new URLSearchParams(actuales);
    if (id === ids[0]) nuevos.delete(parametro); else nuevos.set(parametro, id);
    return nuevos;
  }, { replace: true });
  return [activa, cambiar];
};

/**
 * Cambio de pestaña sin saltos ni recargas:
 * - Las pestañas ya abiertas quedan armadas (ocultas con hidden): volver a una es instantáneo, sin pedir los datos de
 *   nuevo y sin perder lo que se estaba escribiendo. abierta(id) dice si una pestaña se arma.
 * - Al cambiar, el panel (ref panel, style estilo) conserva el alto que tenía mientras la nueva carga (hasta que no
 *   queda ningún aviso con data-cargando a la vista y el contenido dejó de cambiar). Después guarda solo el alto que
 *   hace falta para que la página no se mueva (si la pestaña nueva es más corta, queda espacio abajo) y ese espacio se
 *   va achicando a medida que se sube: las pestañas no se corren de lugar al hacer clic.
 * Uso: const { panel, estilo, abierta, cambiar } = usePanelPestanas(pestana, setPestana);
 */
export const usePanelPestanas = (activa, alCambiar) => {
  const panel = useRef(null);
  // reserva: alto mínimo del panel; fase: 'cargando' (la pestaña nueva todavía carga) o 'ajustando' (ya cargó)
  const [reserva, setReserva] = useState({ alto: 0, fase: null });
  const [visitadas, setVisitadas] = useState([]);

  // Alto que necesita el panel para que la parte de la página que se ve no se mueva: 0 arriba de todo (no hay nada
  // que sostener) o si con su alto natural ya alcanza. El natural es la suma de las pestañas (las ocultas miden 0) y
  // el relleno del panel: sacarle la reserva para medirlo achicaría la página y el navegador movería la vista.
  const altoParaNoMoverse = () => {
    if (window.scrollY === 0) return 0;
    const resto = document.documentElement.scrollHeight - panel.current.offsetHeight;
    const estilo = getComputedStyle(panel.current);
    const natural = [...panel.current.children].reduce((suma, hijo) => suma + hijo.offsetHeight, 0)
      + parseFloat(estilo.paddingTop) + parseFloat(estilo.paddingBottom);
    const necesario = Math.round(window.scrollY + window.innerHeight - resto);
    return necesario > natural ? necesario : 0;
  };

  useEffect(() => {
    if (reserva.fase !== 'cargando' || !panel.current) return undefined;
    let espera;
    const terminar = () => {
      const alto = altoParaNoMoverse();
      setReserva(alto ? { alto, fase: 'ajustando' } : { alto: 0, fase: null });
    };
    const revisar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        const cargando = [...(panel.current?.querySelectorAll('[data-cargando]') || [])].some((e) => e.offsetParent);
        if (!cargando && panel.current) terminar();
      }, 150);
    };
    const observador = new MutationObserver(revisar);
    observador.observe(panel.current, { childList: true, subtree: true });
    revisar();
    // Si algo nunca termina de cargar, se pasa igual a ajustar
    const tope = setTimeout(() => { if (panel.current) terminar(); }, 4000);
    return () => { clearTimeout(espera); clearTimeout(tope); observador.disconnect(); };
  }, [reserva.fase]);

  // Ya cargada: el espacio de más se achica al subir (nunca crece) y se suelta cuando no hace falta
  useEffect(() => {
    if (reserva.fase !== 'ajustando') return undefined;
    const ajustar = () => {
      if (!panel.current) return;
      const necesario = altoParaNoMoverse();
      setReserva((r) => (r.fase !== 'ajustando' || necesario >= r.alto ? r
        : necesario === 0 ? { alto: 0, fase: null } : { alto: necesario, fase: 'ajustando' }));
    };
    window.addEventListener('scroll', ajustar, { passive: true });
    window.addEventListener('resize', ajustar);
    return () => { window.removeEventListener('scroll', ajustar); window.removeEventListener('resize', ajustar); };
  }, [reserva.fase]);

  const cambiar = (id) => {
    if (id === activa) return;
    setReserva({ alto: panel.current?.offsetHeight || 0, fase: 'cargando' });
    setVisitadas((v) => (v.includes(activa) ? v : [...v, activa]));
    alCambiar(id);
  };
  const abierta = (id) => id === activa || visitadas.includes(id);

  return { panel, estilo: reserva.alto ? { minHeight: reserva.alto } : undefined, abierta, cambiar };
};

export default Pestanas;

import { createContext, useContext } from 'react';

// Dónde está la pantalla: sola (false), en una pestaña ('pestana') o como una sección más de una vista ('seccion')
const Contexto = createContext(false);

/** Lo que va adentro de la pestaña de otra pantalla: su encabezado no repite el título (ya lo dice la pestaña). */
export const DentroDePestana = ({ children }) => <Contexto.Provider value="pestana">{children}</Contexto.Provider>;

/** Varias pantallas una debajo de la otra en la misma vista: cada una con su título chico, como una sección. */
export const DentroDeSeccion = ({ children }) => <Contexto.Provider value="seccion">{children}</Contexto.Provider>;

/**
 * Encabezado compacto de una pantalla: título con su ícono, una línea de ayuda y las acciones a la derecha.
 * Dentro de una pestaña (DentroDePestana) queda solo la ayuda y las acciones, en una fila; dentro de una sección
 * (DentroDeSeccion), el título va más chico, como subtítulo de la vista.
 */
const Encabezado = ({ titulo, subtitulo, icono: Icono, colorIcono = 'text-blue-600', acciones }) => {
  const lugar = useContext(Contexto);
  if (lugar === 'pestana') {
    if (!subtitulo && !acciones) return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        {subtitulo && <p className="text-xs text-slate-500">{subtitulo}</p>}
        {acciones && <div className="flex flex-wrap items-center gap-2 ml-auto">{acciones}</div>}
      </div>
    );
  }
  const Titulo = lugar === 'seccion' ? 'h2' : 'h1';
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <Titulo className={`${lugar === 'seccion' ? 'text-base' : 'text-xl'} font-bold text-slate-800 leading-tight flex items-center gap-2`}>
          {Icono && <Icono className={`${lugar === 'seccion' ? 'w-4 h-4' : 'w-5 h-5'} shrink-0 ${colorIcono}`} />} {titulo}
        </Titulo>
        {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
};

export default Encabezado;

import { useEffect, useState } from 'react';
import { Dumbbell, AlertTriangle } from 'lucide-react';
import ModeloHumano from '../components/ModeloHumano';
import { cargarCatalogo, nombreGrupo, resolverUrlMedia } from '../components/entrenamiento/comun';
import { ejerciciosDelMusculo } from '../components/entrenamiento/musculos';

// Un ejercicio del catálogo del gimnasio en el panel del músculo elegido, con su espacio dedicado para el GIF
const EjercicioCatalogo = ({ ejercicio: e }) => {
  const urlGif = resolverUrlMedia(e);
  const [errorGif, setErrorGif] = useState(false);
  const tieneGif = Boolean(urlGif && !errorGif);

  return (
    <li className="p-3 space-y-2.5">
      <div>
        <p className="font-semibold text-slate-800 leading-snug">{e.nombre}</p>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-0.5">{nombreGrupo(e.grupoMuscular)}</p>
        {e.descripcion && <p className="text-sm text-slate-600 leading-relaxed mt-1">{e.descripcion}</p>}
        {e.patologiasContraindicadas && (
          <p className="text-xs text-amber-800 mt-1.5 flex items-start gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> Contraindicado con: {e.patologiasContraindicadas.split(',').map((p) => p.trim()).join(', ')}
          </p>
        )}
      </div>

      {/* Espacio habilitado para el GIF demostrativo del ejercicio */}
      <div
        className={`rounded-xl border overflow-hidden flex items-center justify-center ${
          tieneGif
            ? 'border-slate-200 bg-white p-2 shadow-2xs'
            : 'border-dashed border-slate-200 bg-slate-50/70 px-3 py-3'
        }`}
      >
        {tieneGif ? (
          <img
            src={urlGif}
            alt={`Demostración de ${e.nombre}`}
            onError={() => setErrorGif(true)}
            loading="lazy"
            className="w-44 h-44 sm:w-48 sm:h-48 object-contain rounded-lg select-none"
          />
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Dumbbell className="w-4 h-4 shrink-0 opacity-60" />
            <span>Espacio para GIF demostrativo</span>
          </div>
        )}
      </div>
    </li>
  );
};

const Entrenamiento = () => {
  const [catalogo, setCatalogo] = useState({ datos: [], cargando: true, error: '' });

  useEffect(() => {
    cargarCatalogo()
      .then((datos) => setCatalogo({ datos, cargando: false, error: '' }))
      .catch((e) => setCatalogo({ datos: [], cargando: false, error: e.message }));
  }, []);

  // Debajo de la explicación del músculo: los ejercicios que el gimnasio tiene cargados para él
  const ejerciciosDe = (idMusculo) => {
    if (catalogo.cargando) return <p className="text-sm text-slate-500 mt-3">Cargando el catálogo...</p>;
    if (catalogo.error) return <p className="text-sm text-rose-700 mt-3">{catalogo.error}</p>;
    const { directos, delGrupo, grupo } = ejerciciosDelMusculo(catalogo.datos, idMusculo);
    if (directos.length + delGrupo.length === 0) {
      return <p className="text-sm text-slate-500 mt-3">El catálogo del gimnasio todavía no tiene ejercicios para este músculo.</p>;
    }
    return (
      <div className="mt-3 space-y-3">
        {directos.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">En el catálogo del gimnasio</h3>
            <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">{directos.map((e) => <EjercicioCatalogo key={e.idEjercicio} ejercicio={e} />)}</ul>
          </section>
        )}
        {delGrupo.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Más de {nombreGrupo(grupo)}</h3>
            <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">{delGrupo.map((e) => <EjercicioCatalogo key={e.idEjercicio} ejercicio={e} />)}</ul>
          </section>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 w-full pb-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
          <Dumbbell className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800">Catálogo de Ejercicios y Biomecánica</h1>
          <p className="text-sm text-slate-500">
            Tocá una zona del cuerpo y después el músculo para ver su función, los ejercicios clave y los que tiene cargados el gimnasio.
          </p>
        </div>
      </div>

      {/* Modelo Humano Anatómico Completo */}
      <ModeloHumano contenidoExtra={ejerciciosDe} />
    </div>
  );
};

export default Entrenamiento;

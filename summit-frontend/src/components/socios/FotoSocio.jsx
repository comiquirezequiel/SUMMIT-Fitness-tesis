import React, { useEffect, useRef, useState } from 'react';
import { urlFotoSocio } from '../../services/fotos';

const iniciales = (nombre = '') => nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/**
 * Foto del socio, o sus iniciales si no tiene (o mientras carga). La foto se pide recién cuando el recuadro
 * aparece en pantalla: en una lista larga no se piden todas juntas.
 * className lleva el tamaño y la forma (ej. "w-10 h-10 rounded-full"); texto, el tamaño de las iniciales.
 * obtenerUrl: de dónde sale la foto (por defecto, la del socio; para un profesor, urlFotoProfesor).
 */
const FotoSocio = ({ idSocio, fotoVersion, nombre, className = 'w-10 h-10 rounded-full', texto = 'text-xs', obtenerUrl = urlFotoSocio }) => {
  const [url, setUrl] = useState(null);
  const [visible, setVisible] = useState(false);
  const recuadro = useRef(null);

  useEffect(() => {
    if (visible || !fotoVersion) return undefined;
    const observador = new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) setVisible(true);
    }, { rootMargin: '200px' });
    observador.observe(recuadro.current);
    return () => observador.disconnect();
  }, [visible, fotoVersion]);

  useEffect(() => {
    setUrl(null);
    if (!visible || !idSocio || !fotoVersion) return undefined;
    let vigente = true;
    obtenerUrl(idSocio, fotoVersion).then((u) => { if (vigente) setUrl(u); });
    return () => { vigente = false; };
  }, [visible, idSocio, fotoVersion, obtenerUrl]);

  return (
    <div ref={recuadro} className={`${className} shrink-0 overflow-hidden bg-blue-100 border border-blue-200 text-blue-700 font-semibold flex items-center justify-center ${texto}`}>
      {url ? <img src={url} alt={`Foto de ${nombre}`} className="w-full h-full object-cover" /> : iniciales(nombre)}
    </div>
  );
};

export default FotoSocio;

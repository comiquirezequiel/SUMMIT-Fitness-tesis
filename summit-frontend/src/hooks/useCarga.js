import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carga datos al abrir la pantalla y cada vez que cambian sus dependencias, con los estados de siempre: datos,
 * cargando y error (el mensaje del Error que lance pedir). Si se piden datos nuevos antes de que lleguen los
 * anteriores (por ejemplo, al cambiar rápido de período), solo cuenta la última respuesta.
 *
 * Uso: const { datos, cargando, error, cargar } = useCarga(() => obtenerInactividad(minDias), [minDias]);
 * cargar() vuelve a pedir los datos (por ejemplo, después de guardar algo).
 */
export const useCarga = (pedir, dependencias, inicial = null) => {
  const [datos, setDatos] = useState(inicial);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const ultimo = useRef(0);

  // pedir cambia en cada render: lo que manda son las dependencias que pasa la pantalla
  const cargar = useCallback(async () => {
    const numero = ++ultimo.current;
    setCargando(true);
    try {
      const nuevos = await pedir();
      if (numero === ultimo.current) {
        setDatos(nuevos);
        setError('');
      }
    } catch (e) {
      if (numero === ultimo.current) setError(e.message);
    } finally {
      if (numero === ultimo.current) setCargando(false);
    }
  }, dependencias); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargar(); }, [cargar]);

  return { datos, setDatos, cargando, error, setError, cargar };
};

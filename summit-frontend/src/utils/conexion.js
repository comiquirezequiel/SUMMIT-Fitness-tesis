import { useEffect, useState } from 'react';

// true si el celular tiene conexión. Se actualiza solo cuando se pierde o vuelve (modo avión, sin señal).
export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    return () => {
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, []);
  return enLinea;
}

// fetch rechaza con TypeError cuando no llega al servidor (sin conexión o servidor caído): no es un error de datos
export const esErrorDeConexion = (error) => error instanceof TypeError;

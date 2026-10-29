// Modo oscuro: cada uno lo elige con el botón sol/luna de la barra de arriba y queda guardado en este navegador.
// Mientras nadie elija, sigue al sistema. index.html lo aplica antes de pintar la página, para que no destelle.
import { useEffect, useState } from 'react';

const CLAVE = 'summit.tema';
const sistema = window.matchMedia('(prefers-color-scheme: dark)');

let elegido = (() => {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
})();

const esOscuro = () => (elegido ? elegido === 'oscuro' : sistema.matches);
const aplicar = () => document.documentElement.classList.toggle('dark', esOscuro());

/** [oscuro, alternar]: si está en modo oscuro y la función del botón. */
export const useModoOscuro = () => {
  const [oscuro, setOscuro] = useState(esOscuro);
  useEffect(() => {
    const alCambiarElSistema = () => { aplicar(); setOscuro(esOscuro()); };
    sistema.addEventListener('change', alCambiarElSistema);
    return () => sistema.removeEventListener('change', alCambiarElSistema);
  }, []);
  const alternar = () => {
    elegido = esOscuro() ? 'claro' : 'oscuro';
    try {
      localStorage.setItem(CLAVE, elegido);
    } catch {
      // sin almacenamiento: vale hasta que se recargue la página
    }
    aplicar();
    setOscuro(esOscuro());
  };
  return [oscuro, alternar];
};

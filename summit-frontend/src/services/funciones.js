// Funciones opcionales que decide el backend (GET /api/auth/funciones): "¿Olvidaste tu contraseña?" por email y la
// factura electrónica de ARCA (summit.arca.habilitada). Se piden una vez por carga de página y quedan guardadas en el
// navegador, así la pantalla arranca con lo último que se supo.
import { useSyncExternalStore } from 'react';
import { API_URL } from './config';

const CLAVE = 'summit.funciones';
const PREDETERMINADAS = { recuperacionPorEmail: false, facturacion: false };

const leerGuardadas = () => {
  try {
    return { ...PREDETERMINADAS, ...JSON.parse(localStorage.getItem(CLAVE)) };
  } catch {
    return PREDETERMINADAS;
  }
};

let funciones = leerGuardadas();
let pedidas = false;
const oyentes = new Set();

const pedir = () => {
  if (pedidas) return;
  pedidas = true;
  fetch(`${API_URL}/auth/funciones`)
    .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
    .then((datos) => {
      if (!datos) return;
      const nuevas = { ...PREDETERMINADAS, ...datos };
      if (JSON.stringify(nuevas) === JSON.stringify(funciones)) return;
      funciones = nuevas;
      try {
        localStorage.setItem(CLAVE, JSON.stringify(funciones));
      } catch {
        // sin almacenamiento: se vuelven a pedir en la próxima carga
      }
      oyentes.forEach((oyente) => oyente());
    })
    .catch(() => { pedidas = false; });
};

const suscribir = (oyente) => {
  oyentes.add(oyente);
  pedir();
  return () => oyentes.delete(oyente);
};

/** { recuperacionPorEmail, facturacion }: si están activas la recuperación por email y la factura electrónica. */
export const useFunciones = () => useSyncExternalStore(suscribir, () => funciones);

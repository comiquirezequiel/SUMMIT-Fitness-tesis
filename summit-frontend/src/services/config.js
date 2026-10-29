// URL del backend. Por defecto, /api en la misma dirección del frontend (en desarrollo, el proxy de
// vite.config.js lo deriva al backend). Se cambia con VITE_API_URL (ver .env.example) sin tocar el código
export const API_URL = import.meta.env.VITE_API_URL || '/api';

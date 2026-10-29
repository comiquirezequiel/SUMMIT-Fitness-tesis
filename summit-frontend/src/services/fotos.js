import { apiFetch } from './api';

// Fotos de los socios. La descarga necesita el token, así que no alcanza
// con poner la dirección en un <img>: se pide con apiFetch y se muestra como blob. Cada foto se pide una sola vez
// por versión: si se saca otra, cambia la versión y se pide la nueva.
const fotos = new Map(); // ruta con la versión -> Promise<dirección blob: o null>

const urlFoto = (ruta) => {
  if (!fotos.has(ruta)) {
    const pedido = apiFetch(ruta)
      .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : null))
      .catch(() => null)
      .then((url) => {
        if (!url) fotos.delete(ruta); // si falló, se vuelve a intentar la próxima vez que se muestre
        return url;
      });
    fotos.set(ruta, pedido);
  }
  return fotos.get(ruta);
};

export const urlFotoSocio = (idSocio, version) => urlFoto(`/socios/${idSocio}/foto?v=${version}`);

const subir = async (ruta, foto) => {
  const datos = new FormData();
  datos.append('foto', foto, 'foto.jpg');
  const res = await apiFetch(ruta, { method: 'POST', body: datos });
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: cuerpo.error || 'No se pudo guardar la foto' };
  return { ok: true, fotoVersion: cuerpo.fotoVersion };
};

const quitar = async (ruta) => {
  const res = await apiFetch(ruta, { method: 'DELETE' });
  if (res.ok) return { ok: true };
  const cuerpo = await res.json().catch(() => ({}));
  return { ok: false, error: cuerpo.error || 'No se pudo quitar la foto' };
};

/**
 * Sube la foto (un JPG ya recortado por CapturaFoto). Devuelven { ok, fotoVersion, error }.
 */
export const subirFotoSocio = (idSocio, foto) => subir(`/socios/${idSocio}/foto`, foto);

export const quitarFotoSocio = (idSocio) => quitar(`/socios/${idSocio}/foto`);

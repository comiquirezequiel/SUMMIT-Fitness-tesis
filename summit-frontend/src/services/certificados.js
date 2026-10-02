import { apiFetch } from './api';

export const TIPOS_APTO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const MAX_MB_APTO = 5;

// Validación previa en el navegador (el backend vuelve a validar el contenido real del archivo)
export const validarArchivoApto = (archivo) => {
  if (!archivo) return 'Adjuntá el certificado (PDF o imagen)';
  if (!TIPOS_APTO.includes(archivo.type)) return 'Formato no permitido: subí un PDF, JPG, PNG o WEBP';
  if (archivo.size > MAX_MB_APTO * 1024 * 1024) return `El archivo supera el máximo de ${MAX_MB_APTO} MB`;
  return null;
};

/**
 * Sube un certificado médico. Devuelve { ok, error }.
 */
export const subirCertificado = async (idSocio, archivo, fechaEmision, patologias) => {
  const datos = new FormData();
  datos.append('archivo', archivo);
  datos.append('fechaEmision', fechaEmision);
  if (patologias?.trim()) datos.append('observacionesPatologias', patologias.trim());

  const res = await apiFetch(`/socios/${idSocio}/certificados`, { method: 'POST', body: datos });
  if (res.ok) return { ok: true, certificado: await res.json() };
  const err = await res.json().catch(() => ({}));
  return { ok: false, error: err.error || 'No se pudo cargar el certificado' };
};

/**
 * Abre el archivo del certificado en otra pestaña (la descarga necesita el token, por eso no es un link directo).
 */
export const verArchivoCertificado = async (idSocio, idCertificado) => {
  const ventana = window.open('', '_blank'); // se abre antes del await para que el navegador no la bloquee
  const res = await apiFetch(`/socios/${idSocio}/certificados/${idCertificado}/archivo`);
  if (!res.ok) {
    ventana?.close();
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'No se pudo abrir el archivo');
  }
  const url = URL.createObjectURL(await res.blob());
  if (ventana) ventana.location.href = url;
  else window.location.href = url;
};

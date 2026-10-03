import { apiFetch } from './api';

// Asistente de IA local (Ollama). Todas las funciones devuelven { ok, datos } o { ok: false, error }.

const llamar = async (pedido, porDefecto) => {
  try {
    const res = await pedido();
    if (res.ok) return { ok: true, datos: await res.json() };
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || porDefecto };
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor' };
  }
};

// Se consulta una sola vez por sesión del navegador (si Ollama se levanta después, alcanza con recargar)
let estadoCacheado = null;
export const estadoIa = () => {
  if (!estadoCacheado) {
    estadoCacheado = llamar(() => apiFetch('/ia/estado'), 'No se pudo consultar el asistente')
      .then(r => (r.ok ? r.datos : { disponible: false, motivo: r.error }));
  }
  return estadoCacheado;
};

// Lee un certificado ANTES de subirlo: no guarda nada. Con el DNI del socio avisa si el certificado es de otra persona
export const analizarArchivo = (archivo, dni) => {
  const datos = new FormData();
  datos.append('archivo', archivo);
  if (dni) datos.append('dni', dni);
  return llamar(() => apiFetch('/ia/certificados/analizar', { method: 'POST', body: datos }), 'No se pudo analizar el certificado');
};

export const analizarCertificado = (idSocio, idCertificado) =>
  llamar(() => apiFetch(`/ia/socios/${idSocio}/certificados/${idCertificado}/analizar`, { method: 'POST' }),
    'No se pudo analizar el certificado');

export const ejerciciosAEvitar = (idSocio) =>
  llamar(() => apiFetch(`/ia/socios/${idSocio}/ejercicios-a-evitar`, { method: 'POST' }),
    'No se pudieron obtener las sugerencias');

// Guarda en el certificado lo que confirmó el personal
export const guardarObservaciones = (idSocio, idCertificado, observacionesPatologias, resumenIa) =>
  llamar(() => apiFetch(`/socios/${idSocio}/certificados/${idCertificado}`, {
    method: 'PATCH', body: JSON.stringify({ observacionesPatologias, resumenIa }),
  }), 'No se pudo guardar la ficha médica');

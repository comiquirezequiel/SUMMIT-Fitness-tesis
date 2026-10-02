// Formatos comunes para mostrar datos del backend.

// 'YYYY-MM-DD' (LocalDate de Java) -> 'dd/mm/aaaa'.
// Se separa a mano: new Date('2026-10-31') lo toma como UTC y en Argentina mostraría el día anterior.
export const formatFecha = (fechaIso) => {
  if (!fechaIso) return '—';
  const [anio, mes, dia] = fechaIso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

// LocalDateTime de Java ('2026-10-01T21:43:04') -> '21:43'
export const formatHora = (fechaHoraIso) => {
  if (!fechaHoraIso) return '—';
  return new Date(fechaHoraIso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

// LocalDateTime de Java -> '01/10/2026 21:43'
export const formatFechaHora = (fechaHoraIso) => {
  if (!fechaHoraIso) return '—';
  return `${formatFecha(fechaHoraIso)} ${formatHora(fechaHoraIso)}`;
};

export const formatMoneda = (monto) =>
  `$ ${Number(monto || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

// Días hasta un vencimiento (negativo si ya venció) -> texto para mostrar
export const textoVencimiento = (dias) => {
  if (dias === null || dias === undefined) return '';
  if (dias === 0) return 'vence hoy';
  if (dias > 0) return `vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
  return `vencida hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
};

// Días entre hoy y una fecha 'YYYY-MM-DD' (negativo si ya pasó)
export const diasHasta = (fechaIso) => {
  if (!fechaIso) return null;
  const [anio, mes, dia] = fechaIso.substring(0, 10).split('-').map(Number);
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((new Date(anio, mes - 1, dia) - inicioHoy) / 86400000);
};

// Edad en años a partir de 'YYYY-MM-DD'
export const edad = (fechaNacimientoIso) => {
  if (!fechaNacimientoIso) return null;
  const [anio, mes, dia] = fechaNacimientoIso.split('-').map(Number);
  const hoy = new Date();
  let anios = hoy.getFullYear() - anio;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) anios--;
  return anios;
};

// Descarga un CSV que Excel abre bien en español (separador ";" y BOM UTF-8)
export const descargarCsv = (nombreArchivo, columnas, filas) => {
  const escapar = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
  const contenido = [columnas, ...filas].map(fila => fila.map(escapar).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  link.click();
  URL.revokeObjectURL(url);
};

// Fecha local de hoy en formato 'YYYY-MM-DD' (para inputs type="date" y la API)
export const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Usuario logueado guardado al iniciar sesión
export const usuarioActual = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
};

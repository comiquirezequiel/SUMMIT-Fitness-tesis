// Enlaces de WhatsApp (wa.me) para escribirle a un socio con el mensaje ya armado. Gratis: abre WhatsApp (o WhatsApp
// Web en la PC) y la persona solo toca Enviar.

/**
 * Número para wa.me a partir de un teléfono argentino como lo carga recepción ("11 2233-4455", "0351 15 555-1234",
 * "+54 9 11 2233 4455"). null si no se puede armar uno confiable.
 */
export const numeroWhatsApp = (telefono) => {
  if (!telefono) return null;
  let d = String(telefono).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);
  // El "15" de los celulares va después del código de área (de 2 a 4 dígitos): 351 15 555-1234 → 351 555-1234
  if (d.length === 12) {
    const area = [2, 3, 4].find(largo => d.slice(largo, largo + 2) === '15');
    if (area) d = d.slice(0, area) + d.slice(area + 2);
  }
  return d.length === 10 ? `549${d}` : null;
};

/** Enlace que abre WhatsApp con el mensaje. Sin un número válido, WhatsApp pide elegir el contacto. */
export const enlaceWhatsApp = (telefono, texto) =>
  `https://wa.me/${numeroWhatsApp(telefono) || ''}?text=${encodeURIComponent(texto)}`;

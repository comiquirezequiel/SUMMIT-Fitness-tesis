// Membrete de los PDF del gimnasio: encabezado de la primera página, encabezado chico de las siguientes y pie con
// los números de página. Lo comparten todos los documentos (rutinas; después, comprobantes y facturas).
import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { COLORES, FUENTES, MARGENES, textoPdf } from './marca';

const s = StyleSheet.create({
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORES.bordo,
  },
  logo: { width: 46, height: 46, objectFit: 'contain', marginRight: 12 },
  // flexBasis 0: ocupa lo que queda y el contacto largo pasa a otra línea en vez de empujar la columna de la derecha
  gimnasio: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  nombreGimnasio: {
    fontFamily: FUENTES.titulos,
    fontWeight: 700,
    fontSize: 19,
    lineHeight: 1.1,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORES.bordo,
  },
  contacto: { fontSize: 8.5, color: COLORES.textoSuave, marginTop: 2 },
  documento: { alignItems: 'flex-end', marginLeft: 16, flexShrink: 0, maxWidth: 190 },
  tipo: {
    fontFamily: FUENTES.titulos,
    fontWeight: 600,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORES.bronceTexto,
    textAlign: 'right',
  },
  detalle: { fontSize: 8.5, color: COLORES.textoSuave, marginTop: 2, textAlign: 'right' },
  // Va en el margen de arriba, fuera del flujo: no le quita lugar al contenido
  continuacionCaja: { position: 'absolute', top: 20, left: MARGENES.costados, right: MARGENES.costados },
  continuacion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORES.linea,
    fontSize: 8,
    color: COLORES.textoSuave,
  },
  pie: {
    position: 'absolute',
    bottom: 24,
    left: MARGENES.costados,
    right: MARGENES.costados,
    paddingTop: 5,
    paddingRight: 90, // lugar para el número de página
    borderTopWidth: 0.75,
    borderTopColor: COLORES.bronce,
    fontSize: 8,
    color: COLORES.textoSuave,
  },
  // Va aparte del pie y sin ancho fijo: en el navegador, la librería no escribe un número de página con ancho propio
  pagina: {
    position: 'absolute',
    bottom: 24,
    left: MARGENES.costados,
    right: MARGENES.costados,
    textAlign: 'right',
    fontSize: 8,
    fontWeight: 600,
    color: COLORES.texto,
  },
});

// "Av. Siempre Viva 742, Córdoba · Tel. 351 555-1234 · @gimnasio": lo que haya cargado el admin en Datos del gimnasio
export const contactoDe = (gimnasio) => {
  if (!gimnasio) return '';
  const lugar = [gimnasio.direccion, gimnasio.ciudad].map(textoPdf).filter(Boolean).join(', ');
  const telefono = gimnasio.telefono ? `Tel. ${textoPdf(gimnasio.telefono)}`
    : gimnasio.whatsapp ? `WhatsApp +${textoPdf(gimnasio.whatsapp)}` : '';
  return [lugar, telefono, textoPdf(gimnasio.email), gimnasio.instagram ? `@${textoPdf(gimnasio.instagram)}` : '']
    .filter(Boolean).join(' · '); // un solo espacio: con dos, al cortar la línea la librería agrega un guion
};

/**
 * Encabezado de la primera página: logo (opcional), nombre y contacto del gimnasio a la izquierda; a la derecha, el
 * tipo de documento y un detalle (por ejemplo, la fecha de emisión).
 * - gimnasio: lo que devuelve /api/configuracion/gimnasio (o null: sale solo el tipo de documento)
 * - logoUrl (opcional): imagen PNG o JPG (data URL o dirección); conviene pasarla antes por imagenParaPdf (index.js),
 *   que acepta cualquier formato y devuelve null si no se puede bajar
 */
export const Encabezado = ({ gimnasio, logoUrl, tipo, detalle }) => (
  <View style={s.encabezado}>
    {logoUrl && <Image src={logoUrl} style={s.logo} />}
    <View style={s.gimnasio}>
      {gimnasio?.nombre && <Text style={s.nombreGimnasio}>{textoPdf(gimnasio.nombre)}</Text>}
      {contactoDe(gimnasio) !== '' && <Text style={s.contacto}>{contactoDe(gimnasio)}</Text>}
    </View>
    <View style={s.documento}>
      <Text style={s.tipo}>{tipo}</Text>
      {detalle && <Text style={s.detalle}>{detalle}</Text>}
    </View>
  </View>
);

/** Encabezado chico de las páginas 2 en adelante: de quién es y qué es, por si las hojas se separan */
export const EncabezadoContinuacion = ({ izquierda, derecha }) => (
  <View fixed style={s.continuacionCaja} render={({ pageNumber }) => (pageNumber > 1 ? (
    <View style={s.continuacion}>
      <Text>{izquierda}</Text>
      <Text>{derecha}</Text>
    </View>
  ) : null)} />
);

/** Pie de todas las páginas: un texto (por ejemplo, el contacto del gimnasio) y "Página X de Y" */
export const Pie = ({ texto }) => (
  <>
    <View fixed style={s.pie}>
      <Text>{texto}</Text>
    </View>
    <Text fixed style={s.pagina} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
  </>
);

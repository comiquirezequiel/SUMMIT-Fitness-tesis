// Comprobante de un cobro en PDF (A5 vertical), para imprimirlo o mandarlo por WhatsApp. No es una factura: lo dice
// abajo. Se genera desde comprobante.js (documentoComprobante): no importarlo directo desde una pantalla.
import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORES, FUENTES, estilosBase, textoPdf } from './marca';
import { Encabezado, Pie, contactoDe } from './Membrete';
import { formatFecha, formatHora, formatMoneda } from '../../utils/formato';
import { textoMetodoPago } from '../../utils/constantes';

const s = StyleSheet.create({
  socio: { marginTop: 16 },
  nombre: { fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 18, lineHeight: 1.15, color: COLORES.texto, marginTop: 2 },
  dni: { fontSize: 9, color: COLORES.textoSuave, marginTop: 1 },

  tabla: { marginTop: 14, borderTopWidth: 1, borderTopColor: COLORES.bordo },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORES.lineaSuave,
  },
  concepto: { fontSize: 10, lineHeight: 1.3, color: COLORES.texto, flexShrink: 1, paddingRight: 12 },
  conceptoDetalle: { fontSize: 8.5, color: COLORES.textoSuave },
  importe: { fontSize: 10, lineHeight: 1.3, fontWeight: 600, color: COLORES.texto },
  descuento: { color: COLORES.bronceTexto },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.bordo,
  },
  totalTexto: { fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORES.bordo },
  totalImporte: { fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 20, lineHeight: 1.1, color: COLORES.texto },

  datos: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap' },
  dato: { width: '50%', marginBottom: 8, paddingRight: 8 },
  datoValor: { fontSize: 10, lineHeight: 1.3, fontWeight: 600, marginTop: 2, color: COLORES.texto },

  aviso: {
    marginTop: 6,
    padding: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORES.bronce,
    backgroundColor: COLORES.fondoSuave,
    fontSize: 8.5,
    lineHeight: 1.4,
    color: COLORES.texto,
  },
  leyenda: { marginTop: 14, fontSize: 8, lineHeight: 1.4, color: COLORES.textoSuave },
});

const Fila = ({ concepto, detalle, importe, estiloImporte }) => (
  <View style={s.fila} wrap={false}>
    <Text style={s.concepto}>
      {concepto}
      {detalle ? <Text style={s.conceptoDetalle}>{`\n${detalle}`}</Text> : null}
    </Text>
    <Text style={[s.importe, estiloImporte]}>{importe}</Text>
  </View>
);

const Dato = ({ etiqueta, valor }) => (
  <View style={s.dato}>
    <Text style={estilosBase.etiqueta}>{etiqueta}</Text>
    <Text style={s.datoValor}>{valor}</Text>
  </View>
);

const ComprobantePdf = ({ pago, numero, gimnasio, logoUrl }) => {
  const conDetalle = pago.precioLista !== null && pago.precioLista !== undefined;
  const matricula = pago.matriculaMonto === null || pago.matriculaMonto === undefined ? null : Number(pago.matriculaMonto);
  return (
    <Document title={`Comprobante de pago ${numero}`} author={textoPdf(gimnasio?.nombre) || 'SUMMIT'}>
      <Page size="A5" style={estilosBase.pagina}>
        <Encabezado gimnasio={gimnasio} logoUrl={logoUrl} tipo="Comprobante de pago"
          detalle={`N.º ${numero} · ${formatFecha(pago.fechaPago)} ${formatHora(pago.fechaPago)}`} />

        <View style={s.socio}>
          <Text style={estilosBase.etiqueta}>Recibimos de</Text>
          <Text style={s.nombre}>{textoPdf(pago.nombreSocio)}</Text>
          <Text style={s.dni}>DNI {textoPdf(pago.dniSocio)}</Text>
        </View>

        <View style={s.tabla}>
          <Fila concepto={`Plan ${textoPdf(pago.plan)}`} importe={formatMoneda(conDetalle ? pago.precioLista : pago.monto)} />
          {pago.descuentoNombre && (
            <Fila concepto="Descuento" detalle={textoPdf(pago.descuentoNombre)}
              importe={`− ${formatMoneda(pago.descuentoMonto)}`} estiloImporte={s.descuento} />
          )}
          {matricula !== null && (
            <Fila concepto="Matrícula de inscripción" importe={matricula > 0 ? formatMoneda(matricula) : 'Bonificada'} />
          )}
          <View style={s.total} wrap={false}>
            <Text style={s.totalTexto}>Total abonado</Text>
            <Text style={s.totalImporte}>{formatMoneda(pago.monto)}</Text>
          </View>
        </View>

        <View style={s.datos}>
          <Dato etiqueta="Medio de pago" valor={textoMetodoPago(pago.metodoPago)} />
          {pago.comprobante ? <Dato etiqueta="Comprobante del pago" valor={textoPdf(pago.comprobante)} /> : null}
          {pago.venceMembresia ? <Dato etiqueta="Membresía paga hasta" valor={formatFecha(pago.venceMembresia)} /> : null}
          {pago.registradoPor ? <Dato etiqueta="Atendió" valor={textoPdf(pago.registradoPor)} /> : null}
        </View>

        {pago.estado === 'PENDIENTE' && (
          <Text style={s.aviso}>Pago a verificar: la membresía se extiende cuando el gimnasio confirme que se acreditó.</Text>
        )}
        {pago.estado === 'RECHAZADO' && (
          <Text style={s.aviso}>Este pago fue rechazado: no extendió la membresía.</Text>
        )}

        <Text style={s.leyenda}>Documento no válido como factura. Conservalo como constancia de tu pago.</Text>
        <Pie texto={contactoDe(gimnasio)} />
      </Page>
    </Document>
  );
};

export default ComprobantePdf;

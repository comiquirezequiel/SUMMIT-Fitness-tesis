// Factura o nota de crédito electrónica en PDF (A4) con los datos que pide ARCA (RG 1415 y RG 4291): emisor, letra y
// código, punto de venta y número, receptor, detalle, CAE con su vencimiento y el código QR (RG 4892). En la B, el IVA
// contenido (Ley 27.743). Si no es de producción (simulador o pruebas de ARCA) lleva "SIN VALIDEZ FISCAL" de marca de
// agua. Se genera desde factura.js: no importarlo directo desde una pantalla.
import { Document, Page, View, Text, Image, Svg, Path, StyleSheet } from '@react-pdf/renderer';
import { COLORES, FUENTES, estilosBase, textoPdf } from './marca';
import { Pie, contactoDe } from './Membrete';
import { formatFecha } from '../../utils/formato';
import { textoMetodoPago } from '../../utils/constantes';
import { cuitConGuiones } from '../../services/facturacion';

const s = StyleSheet.create({
  marcaAgua: { position: 'absolute', top: 330, left: 0, right: 0, alignItems: 'center', transform: 'rotate(-30deg)' },
  marcaAguaTexto: { fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 64, letterSpacing: 4, color: '#F3E3E7' },
  marcaAguaDetalle: { fontFamily: FUENTES.titulos, fontWeight: 600, fontSize: 18, letterSpacing: 2, color: '#EDD3DA', marginTop: 2 },

  cabecera: { flexDirection: 'row', borderWidth: 1, borderColor: COLORES.bordo },
  emisor: { width: '45%', padding: 10 },
  logo: { width: 40, height: 40, objectFit: 'contain', marginBottom: 6 },
  fantasia: {
    fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 17, lineHeight: 1.1, letterSpacing: 0.5,
    textTransform: 'uppercase', color: COLORES.bordo, marginBottom: 4,
  },
  emisorDato: { fontSize: 8.5, lineHeight: 1.4, color: COLORES.texto },
  centro: { width: '10%', alignItems: 'center' },
  letraCaja: {
    width: 46, alignItems: 'center', paddingTop: 2, paddingBottom: 3, borderWidth: 1, borderTopWidth: 0,
    borderColor: COLORES.bordo, backgroundColor: COLORES.blanco,
  },
  letra: { fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 30, lineHeight: 1, color: COLORES.texto },
  codigo: { fontSize: 6.5, fontWeight: 600, letterSpacing: 0.4, color: COLORES.texto },
  divisor: { flexGrow: 1, width: 0, borderLeftWidth: 1, borderLeftColor: COLORES.bordo },
  comprobante: { width: '45%', padding: 10 },
  tipoDocumento: {
    fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 18, lineHeight: 1.1, letterSpacing: 1,
    textTransform: 'uppercase', color: COLORES.texto, marginBottom: 4,
  },
  linea: { flexDirection: 'row', fontSize: 8.5, lineHeight: 1.45 },
  lineaEtiqueta: { width: 92, color: COLORES.textoSuave },
  lineaValor: { flexGrow: 1, flexShrink: 1, fontWeight: 600, color: COLORES.texto },

  caja: { marginTop: 8, borderWidth: 1, borderColor: COLORES.linea, padding: 8 },
  fila: { flexDirection: 'row', flexWrap: 'wrap' },
  par: { flexDirection: 'row', marginRight: 18, fontSize: 8.5, lineHeight: 1.45 },
  parEtiqueta: { color: COLORES.textoSuave, marginRight: 4 },
  parValor: { fontWeight: 600, color: COLORES.texto },
  receptorNombre: { fontSize: 10.5, fontWeight: 700, color: COLORES.texto, marginBottom: 2 },
  aviso: { marginTop: 4, fontSize: 8.5, lineHeight: 1.4, color: COLORES.texto },

  tabla: { marginTop: 12 },
  encabezadoTabla: {
    flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, backgroundColor: COLORES.fondoSuave,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORES.bordo,
  },
  filaTabla: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.75, borderBottomColor: COLORES.lineaSuave },
  colDescripcion: { flexGrow: 1, flexShrink: 1, paddingRight: 8 },
  colCantidad: { width: 46, textAlign: 'right' },
  colPrecio: { width: 92, textAlign: 'right' },
  colSubtotal: { width: 92, textAlign: 'right' },
  th: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORES.textoSuave },
  td: { fontSize: 9.5, lineHeight: 1.3, color: COLORES.texto },
  tdDetalle: { fontSize: 8, color: COLORES.textoSuave },
  negativo: { color: COLORES.bronceTexto },

  totales: { marginTop: 8, alignSelf: 'flex-end', width: 240 },
  totalLinea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, fontSize: 9 },
  total: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4, paddingTop: 6,
    borderTopWidth: 1, borderTopColor: COLORES.bordo,
  },
  totalTexto: { fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORES.bordo },
  totalImporte: { fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 18, lineHeight: 1.1, color: COLORES.texto },

  transparencia: { marginTop: 14, width: 280, padding: 8, borderWidth: 1, borderColor: COLORES.linea },
  transparenciaTitulo: { fontSize: 8, fontWeight: 600, color: COLORES.texto, marginBottom: 3 },

  autorizacion: { marginTop: 18, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1.5, borderTopColor: COLORES.bordo, paddingTop: 10 },
  // Fondo blanco y margen alrededor del QR: así la marca de agua no se mete entre los módulos y el celular lo lee
  qrMarco: { padding: 6, marginRight: 10, backgroundColor: COLORES.blanco },
  qr: { width: 92, height: 92 },
  caeLinea: { flexDirection: 'row', fontSize: 10, lineHeight: 1.5 },
  caeEtiqueta: { width: 120, color: COLORES.textoSuave },
  caeValor: { fontWeight: 700, color: COLORES.texto },
  leyenda: { marginTop: 4, fontSize: 8, lineHeight: 1.4, color: COLORES.textoSuave },
});

// Con centavos, como va en una factura: 45.000,00
const importe = (monto) => Number(monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const conPesos = (monto) => `$ ${importe(monto)}`;
const capitalizar = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '');

const Linea = ({ etiqueta, valor }) => (
  <View style={s.linea}>
    <Text style={s.lineaEtiqueta}>{etiqueta}</Text>
    <Text style={s.lineaValor}>{valor}</Text>
  </View>
);

const Par = ({ etiqueta, valor }) => (
  <View style={s.par}>
    <Text style={s.parEtiqueta}>{etiqueta}</Text>
    <Text style={s.parValor}>{valor}</Text>
  </View>
);

const Renglon = ({ descripcion, detalle, cantidad, precio, subtotal, negativo }) => (
  <View style={s.filaTabla} wrap={false}>
    <Text style={[s.td, s.colDescripcion]}>
      {descripcion}
      {detalle ? <Text style={s.tdDetalle}>{`\n${detalle}`}</Text> : null}
    </Text>
    <Text style={[s.td, s.colCantidad]}>{cantidad ?? ''}</Text>
    <Text style={[s.td, s.colPrecio]}>{precio ?? ''}</Text>
    <Text style={[s.td, s.colSubtotal, negativo ? s.negativo : null]}>{subtotal}</Text>
  </View>
);

// Los renglones del cobro: el plan, el descuento y la matrícula (o solo el plan por el total, en los cobros sin detalle)
const renglones = (c) => {
  if (c.notaCredito) {
    return [{ descripcion: `Anulación de la ${textoPdf(c.asociado)}`, detalle: `Cuota del plan ${textoPdf(c.plan)}`,
      cantidad: '1', precio: importe(c.total), subtotal: importe(c.total) }];
  }
  const conDetalle = c.precioLista !== null && c.precioLista !== undefined;
  const lista = [{
    descripcion: `Cuota del plan ${textoPdf(c.plan)}`,
    detalle: c.servicioDesde ? `Del ${formatFecha(c.servicioDesde)} al ${formatFecha(c.servicioHasta)}` : null,
    cantidad: '1',
    precio: importe(conDetalle ? c.precioLista : c.total),
    subtotal: importe(conDetalle ? c.precioLista : c.total),
  }];
  if (conDetalle && c.descuentoNombre) {
    lista.push({ descripcion: 'Descuento', detalle: textoPdf(c.descuentoNombre), subtotal: `− ${importe(c.descuentoMonto)}`, negativo: true });
  }
  const matricula = c.matriculaMonto === null || c.matriculaMonto === undefined ? null : Number(c.matriculaMonto);
  if (conDetalle && matricula !== null && matricula > 0) {
    lista.push({ descripcion: 'Matrícula de inscripción', cantidad: '1', precio: importe(matricula), subtotal: importe(matricula) });
  }
  return lista;
};

const AMBIENTE_SIN_VALIDEZ = {
  SIMULADOR: 'Simulador de ARCA',
  HOMOLOGACION: 'Pruebas de ARCA (homologación)',
};

const FacturaPdf = ({ comprobante: c, gimnasio, logoUrl, qr }) => {
  const nombre = `${c.nombreTipo} ${c.letra} ${c.numeroCompleto}`;
  const fantasia = textoPdf(gimnasio?.nombre) || textoPdf(c.emisorRazonSocial);
  const identificado = c.docTipo === 96;
  return (
    <Document title={nombre} author={textoPdf(c.emisorRazonSocial) || 'SUMMIT'}>
      <Page size="A4" style={estilosBase.pagina}>
        {!c.deVerdad && (
          <View fixed style={s.marcaAgua}>
            <Text style={s.marcaAguaTexto}>SIN VALIDEZ FISCAL</Text>
            <Text style={s.marcaAguaDetalle}>{AMBIENTE_SIN_VALIDEZ[c.ambiente] || 'Comprobante de prueba'}</Text>
          </View>
        )}

        <View style={s.cabecera}>
          <View style={s.emisor}>
            {logoUrl && <Image src={logoUrl} style={s.logo} />}
            <Text style={s.fantasia}>{fantasia}</Text>
            <Text style={s.emisorDato}>Razón social: {textoPdf(c.emisorRazonSocial)}</Text>
            <Text style={s.emisorDato}>Domicilio comercial: {textoPdf(c.emisorDomicilio)}</Text>
            <Text style={s.emisorDato}>Condición frente al IVA: {textoPdf(c.emisorCondicionIva)}</Text>
          </View>
          <View style={s.centro}>
            <View style={s.letraCaja}>
              <Text style={s.letra}>{c.letra}</Text>
              <Text style={s.codigo}>COD. {String(c.codigoTipo).padStart(2, '0')}</Text>
            </View>
            <View style={s.divisor} />
          </View>
          <View style={s.comprobante}>
            <Text style={s.tipoDocumento}>{c.nombreTipo}</Text>
            <Linea etiqueta="Punto de venta" valor={String(c.puntoVenta).padStart(5, '0')} />
            <Linea etiqueta="Comprobante N.º" valor={String(c.numero).padStart(8, '0')} />
            <Linea etiqueta="Fecha de emisión" valor={formatFecha(c.fecha)} />
            <Linea etiqueta="CUIT" valor={cuitConGuiones(c.emisorCuit)} />
            <Linea etiqueta="Ingresos Brutos" valor={textoPdf(c.emisorIngresosBrutos)} />
            <Linea etiqueta="Inicio de actividades" valor={formatFecha(c.emisorInicioActividades)} />
          </View>
        </View>

        <View style={s.caja}>
          <View style={s.fila}>
            <Par etiqueta="Período facturado desde:" valor={formatFecha(c.servicioDesde)} />
            <Par etiqueta="hasta:" valor={formatFecha(c.servicioHasta)} />
            <Par etiqueta="Fecha de vto. para el pago:" valor={formatFecha(c.vencimientoPago)} />
          </View>
        </View>

        <View style={s.caja}>
          <Text style={s.receptorNombre}>{identificado ? textoPdf(c.receptorNombre) : 'A CONSUMIDOR FINAL'}</Text>
          <View style={s.fila}>
            {identificado && <Par etiqueta="DNI:" valor={String(c.docNro)} />}
            <Par etiqueta="Condición frente al IVA:" valor="Consumidor Final" />
            <Par etiqueta="Condición de venta:" valor={`Contado (${textoMetodoPago(c.metodoPago).toLowerCase()})`} />
          </View>
          {c.notaCredito && (
            <Text style={s.aviso}>
              Comprobante asociado: {capitalizar(textoPdf(c.asociado))}
              {c.motivo ? ` · Motivo: ${textoPdf(c.motivo)}` : ''}
            </Text>
          )}
        </View>

        <View style={s.tabla}>
          <View style={s.encabezadoTabla}>
            <Text style={[s.th, s.colDescripcion]}>Descripción</Text>
            <Text style={[s.th, s.colCantidad]}>Cant.</Text>
            <Text style={[s.th, s.colPrecio]}>Precio unit.</Text>
            <Text style={[s.th, s.colSubtotal]}>Subtotal</Text>
          </View>
          {renglones(c).map((r, i) => <Renglon key={i} {...r} />)}
        </View>

        <View style={s.totales} wrap={false}>
          <View style={s.total}>
            <Text style={s.totalTexto}>Importe total</Text>
            <Text style={s.totalImporte}>{conPesos(c.total)}</Text>
          </View>
        </View>

        {c.letra === 'B' && (
          <View style={s.transparencia} wrap={false}>
            <Text style={s.transparenciaTitulo}>Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</Text>
            <View style={s.totalLinea}><Text>IVA Contenido</Text><Text>{conPesos(c.iva)}</Text></View>
            <View style={s.totalLinea}><Text>Otros Impuestos Nacionales Indirectos</Text><Text>{conPesos(0)}</Text></View>
          </View>
        )}

        <View style={s.autorizacion} wrap={false}>
          {qr && (
            <View style={s.qrMarco}>
              <Svg viewBox={qr.viewBox} style={s.qr}>
                <Path d={qr.d} fill="#000000" />
              </Svg>
            </View>
          )}
          <View>
            <View style={s.caeLinea}><Text style={s.caeEtiqueta}>CAE N.º</Text><Text style={s.caeValor}>{c.cae}</Text></View>
            <View style={s.caeLinea}>
              <Text style={s.caeEtiqueta}>Fecha de vto. de CAE</Text>
              <Text style={s.caeValor}>{formatFecha(c.caeVencimiento)}</Text>
            </View>
            <Text style={s.leyenda}>
              {c.deVerdad
                ? 'Comprobante autorizado por ARCA. Se puede verificar escaneando el código QR.'
                : `${AMBIENTE_SIN_VALIDEZ[c.ambiente] || 'Comprobante de prueba'}: este comprobante no tiene validez fiscal.`}
            </Text>
          </View>
        </View>

        <Pie texto={contactoDe(gimnasio) || textoPdf(c.emisorRazonSocial)} />
      </Page>
    </Document>
  );
};

export default FacturaPdf;

// Rutina del socio en PDF (A4 vertical), para imprimirla o mandarla por WhatsApp. Pensada para seguirla en el
// gimnasio: cada día en su bloque, los ejercicios numerados en el orden en que se hacen y los números grandes.
// Se genera desde rutina.js (documentoRutina): no importarlo directo desde una pantalla.
import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORES, FUENTES, MARGENES, estilosBase, textoPdf } from './marca';
import { Encabezado, EncabezadoContinuacion, Pie, contactoDe } from './Membrete';
import { agruparPorDia, formatDescanso, formatKg, nombreGrupo } from '../entrenamiento/comun';
import { formatFecha } from '../../utils/formato';

// Anchos de las columnas (puntos; el ejercicio ocupa el resto)
const COL = { numero: 28, series: 78, carga: 78, descanso: 80 };
// Alto útil de una hoja A4 (842 puntos) sin los márgenes
const ALTO_UTIL = 841.89 - MARGENES.arriba - MARGENES.abajo;

const s = StyleSheet.create({
  titulo: { marginTop: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  nombreRutina: {
    fontFamily: FUENTES.titulos,
    fontWeight: 700,
    fontSize: 24,
    lineHeight: 1.1,
    color: COLORES.texto,
    flexShrink: 1,
  },
  resumen: { fontSize: 9.5, color: COLORES.textoSuave, marginLeft: 12, marginBottom: 3, flexShrink: 0 },
  datos: {
    flexDirection: 'row',
    marginTop: 10,
    borderWidth: 0.75,
    borderColor: COLORES.linea,
    borderRadius: 4,
    backgroundColor: COLORES.fondoSuave,
  },
  dato: { paddingVertical: 7, paddingHorizontal: 9, borderLeftWidth: 0.75, borderLeftColor: COLORES.linea },
  datoPrimero: { borderLeftWidth: 0 },
  datoValor: { fontSize: 11, fontWeight: 600, marginTop: 2, color: COLORES.texto },
  guia: {
    marginTop: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORES.bronce,
    fontSize: 8.5,
    lineHeight: 1.4,
    color: COLORES.textoSuave,
  },
  negrita: { fontWeight: 600, color: COLORES.texto },

  dia: { marginTop: 18 },
  diaEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.bordo,
  },
  diaEtiqueta: {
    backgroundColor: COLORES.bordo,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginRight: 9,
  },
  diaNumero: {
    fontFamily: FUENTES.titulos,
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORES.blanco,
  },
  diaGrupos: { fontFamily: FUENTES.titulos, fontWeight: 600, fontSize: 13, color: COLORES.texto, flexGrow: 1, flexShrink: 1 },
  diaCantidad: { fontSize: 8.5, color: COLORES.textoSuave, marginLeft: 8, flexShrink: 0 },
  columnas: { flexDirection: 'row', paddingTop: 6, paddingBottom: 4, borderBottomWidth: 0.75, borderBottomColor: COLORES.linea },

  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORES.lineaSuave,
  },
  filaPar: { backgroundColor: COLORES.fondoSuave },
  colNumero: { width: COL.numero, alignItems: 'center' },
  colEjercicio: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingLeft: 6, paddingRight: 8 },
  colSeries: { width: COL.series, alignItems: 'center' },
  colCarga: { width: COL.carga, alignItems: 'center' },
  colDescanso: { width: COL.descanso, alignItems: 'center' },
  numero: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 1,
    borderColor: COLORES.bordo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroTexto: { fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 10.5, lineHeight: 1, color: COLORES.bordo },
  nombreEjercicio: { fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, color: COLORES.texto },
  grupo: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: COLORES.textoSuave, marginTop: 1.5 },
  nota: { fontSize: 9, fontStyle: 'italic', lineHeight: 1.3, color: COLORES.texto, marginTop: 3 },
  seriesReps: { fontFamily: FUENTES.titulos, fontWeight: 700, fontSize: 16, lineHeight: 1.1, color: COLORES.texto },
  valor: { fontSize: 10.5, fontWeight: 600, textAlign: 'center', color: COLORES.texto },
  valorSuave: { fontSize: 9.5, textAlign: 'center', color: COLORES.textoSuave },
  centro: { textAlign: 'center' },
  vacia: { marginTop: 24, fontSize: 11, color: COLORES.textoSuave, textAlign: 'center' },
});

// Alto aproximado de un día (puntos), para saber si entra entero en una hoja. Se estima de más a propósito: un bloque
// que no se corta y no entra en una hoja se sale de ella. Si no entra, el día se corta entre ejercicios y su encabezado
// se repite arriba de la hoja siguiente. Medido: fila simple 38, cada línea más del nombre 15, cada línea de nota 14.
const altoFila = (e) => {
  const lineasNombre = Math.max(1, Math.ceil(textoPdf(e.nombreEjercicio).length / 40));
  const lineasNota = e.observaciones ? Math.ceil(textoPdf(e.observaciones).length / 62) : 0;
  return 40 + (lineasNombre - 1) * 16 + lineasNota * 15;
};
const altoDia = (ejercicios) => 70 + ejercicios.reduce((t, e) => t + altoFila(e), 0);

// "Pecho · Tríceps · Hombros": los grupos del día en el orden en que aparecen
const gruposDelDia = (ejercicios) => [...new Set(ejercicios.map((e) => nombreGrupo(e.grupoMuscular)))].join(' · ');

const Dato = ({ etiqueta, valor, flex, primero }) => (
  <View style={[s.dato, primero && s.datoPrimero, { flexGrow: flex, flexShrink: 1, flexBasis: 0 }]}>
    <Text style={estilosBase.etiqueta}>{etiqueta}</Text>
    <Text style={s.datoValor}>{valor}</Text>
  </View>
);

const Fila = ({ ejercicio: e, numero }) => {
  const descanso = formatDescanso(e.descansoSegundos);
  const sinCarga = e.pesoSugeridoKg === null || e.pesoSugeridoKg === undefined;
  return (
    <View style={[s.fila, numero % 2 === 0 && s.filaPar]} wrap={false}>
      <View style={s.colNumero}>
        <View style={s.numero}><Text style={s.numeroTexto}>{numero}</Text></View>
      </View>
      <View style={s.colEjercicio}>
        <Text style={s.nombreEjercicio}>{textoPdf(e.nombreEjercicio)}</Text>
        <Text style={s.grupo}>{nombreGrupo(e.grupoMuscular)}</Text>
        {textoPdf(e.observaciones) !== '' && <Text style={s.nota}>{textoPdf(e.observaciones)}</Text>}
      </View>
      <View style={s.colSeries}>
        <Text style={s.seriesReps}>{e.series ?? '—'} × {e.repeticiones ?? '—'}</Text>
      </View>
      <View style={s.colCarga}>
        <Text style={sinCarga ? s.valorSuave : s.valor}>{formatKg(e.pesoSugeridoKg)}</Text>
      </View>
      <View style={s.colDescanso}>
        <Text style={descanso ? s.valor : s.valorSuave}>{descanso || '—'}</Text>
      </View>
    </View>
  );
};

const Dia = ({ numero, ejercicios }) => {
  const entero = altoDia(ejercicios) <= ALTO_UTIL - 24;
  return (
    // Si entra en una hoja, el día no se corta: pasa entero a la hoja siguiente cuando no hay lugar
    <View style={s.dia} wrap={!entero}>
      {/* fixed: si el día no entra en una hoja, el encabezado se repite arriba de la siguiente */}
      <View fixed minPresenceAhead={60}>
        <View style={s.diaEncabezado}>
          <View style={s.diaEtiqueta}><Text style={s.diaNumero}>Día {numero}</Text></View>
          <Text style={s.diaGrupos}>{gruposDelDia(ejercicios)}</Text>
          <Text style={s.diaCantidad}>{ejercicios.length} {ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}</Text>
        </View>
        <View style={s.columnas}>
          <Text style={[estilosBase.etiqueta, { width: COL.numero, textAlign: 'center' }]}>N.º</Text>
          <Text style={[estilosBase.etiqueta, s.colEjercicio]}>Ejercicio</Text>
          <Text style={[estilosBase.etiqueta, s.centro, { width: COL.series }]}>Series × reps</Text>
          <Text style={[estilosBase.etiqueta, s.centro, { width: COL.carga }]}>Carga</Text>
          <Text style={[estilosBase.etiqueta, s.centro, { width: COL.descanso }]}>Descanso</Text>
        </View>
      </View>
      {ejercicios.map((e, i) => <Fila key={e.idRutinaEjercicio ?? i} ejercicio={e} numero={i + 1} />)}
    </View>
  );
};

/**
 * - rutina: la de GET /api/rutinas/{id} (nombre, objetivo, socio, profesor, fechaCreacion y ejercicios)
 * - objetivo: el de la rutina o, si no tiene, el del perfil del socio
 * - gimnasio: datos del gimnasio (o null); logoUrl: logo para el encabezado (opcional, ver Encabezado)
 * - emitida: fecha de hoy, 'YYYY-MM-DD'
 */
const RutinaPdf = ({ rutina, objetivo, gimnasio, logoUrl, emitida }) => {
  const dias = agruparPorDia(rutina.ejercicios);
  const socio = textoPdf(rutina.nombreSocio);
  const cantidad = rutina.ejercicios?.length || 0;
  return (
    <Document
      title={`Rutina de ${socio}: ${textoPdf(rutina.nombre)}`}
      author={textoPdf(gimnasio?.nombre) || 'SUMMIT'}
      subject="Rutina de entrenamiento"
      creator="SUMMIT"
      producer="SUMMIT"
      language="es-AR"
    >
      <Page size="A4" style={estilosBase.pagina}>
        <EncabezadoContinuacion izquierda={`${socio} · ${textoPdf(rutina.nombre)}`} derecha={textoPdf(gimnasio?.nombre)} />

        <Encabezado gimnasio={gimnasio} logoUrl={logoUrl} tipo="Rutina de entrenamiento" detalle={`Emitida el ${formatFecha(emitida)}`} />

        <View style={s.titulo}>
          <Text style={s.nombreRutina}>{textoPdf(rutina.nombre)}</Text>
          <Text style={s.resumen}>
            {dias.length} {dias.length === 1 ? 'día' : 'días'} · {cantidad} {cantidad === 1 ? 'ejercicio' : 'ejercicios'}
          </Text>
        </View>
        <View style={s.datos}>
          <Dato primero etiqueta="Socio" valor={socio} flex={1.5} />
          <Dato etiqueta="Objetivo" valor={textoPdf(objetivo) || 'Sin indicar'} flex={1.5} />
          <Dato etiqueta="Profesor" valor={textoPdf(rutina.nombreProfesor) || 'Sin indicar'} flex={1.2} />
          <Dato etiqueta="Vigente desde" valor={formatFecha(rutina.fechaCreacion)} flex={0.9} />
        </View>
        <Text style={s.guia}>
          <Text style={s.negrita}>Cómo seguirla: </Text>
          hacé los ejercicios de cada día en el orden numerado. <Text style={s.negrita}>4 × 10</Text> son 4 series de
          10 repeticiones; la carga es la sugerida y el descanso, la pausa entre series. Ante un dolor (no cansancio),
          pará y consultá a tu profesor.
        </Text>

        {dias.length === 0
          ? <Text style={s.vacia}>La rutina todavía no tiene ejercicios.</Text>
          : dias.map(([numero, ejercicios]) => <Dia key={numero} numero={numero} ejercicios={ejercicios} />)}

        <Pie texto={[textoPdf(gimnasio?.nombre), contactoDe(gimnasio)].filter(Boolean).join(' · ') || 'Rutina de entrenamiento'} />
      </Page>
    </Document>
  );
};

export default RutinaPdf;

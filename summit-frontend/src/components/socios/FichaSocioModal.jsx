import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, HeartPulse, Wallet, User, LogIn, Sparkles } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import { apiFetch } from '../../services/api';
import DebitoSocio from '../debito/DebitoSocio';
import { subirCertificado, validarArchivoApto, verArchivoCertificado } from '../../services/certificados';
import { analizarArchivo, analizarCertificado, guardarObservaciones } from '../../services/ia';
import { useEstadoIa, BotonIa, ResultadoAnalisis, AvisoIaNoDisponible } from '../ia/AsistenteIa';
import { formatFecha, formatFechaHora, textoVencimiento, diasHasta, edad, hoyIso } from '../../utils/formato';

const Dato = ({ label, valor }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="text-sm text-slate-800 font-medium break-words">{valor || '—'}</p>
  </div>
);

const Seccion = ({ icon: Icon, titulo, children }) => (
  <section className="space-y-3">
    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
      <Icon className="w-4 h-4 text-blue-500" /> {titulo}
    </h4>
    {children}
  </section>
);

/**
 * Ficha del socio: datos, membresía, certificados médicos (con carga de uno nuevo) y últimos ingresos.
 */
const FichaSocioModal = ({ socio, onClose, onActualizado, puedeEditar }) => {
  const [certificados, setCertificados] = useState([]);
  const [ingresos, setIngresos] = useState([]);
  const [nuevoApto, setNuevoApto] = useState({ archivo: null, fechaEmision: '', patologias: '', resumenIa: '' });
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  // Asistente de IA: { clave: idCertificado o 'nuevo', datos, patologias (editables antes de guardar) }
  // Un solo estado sirve para todas las filas: "clave" indica a qué certificado pertenece la lectura
  // (el id de un certificado guardado, o 'nuevo' para el archivo del formulario de carga). Así se muestra
  // la tarjeta debajo del certificado correcto y nunca dos lecturas a la vez.
  const estadoIa = useEstadoIa();
  const [analisis, setAnalisis] = useState(null);
  const [analizando, setAnalizando] = useState(null); // clave del certificado que se está leyendo
  const [errorIa, setErrorIa] = useState(null);       // { clave, texto }

  const cargar = useCallback(async () => {
    const [resCert, resIngresos] = await Promise.all([
      apiFetch(`/socios/${socio.idSocio}/certificados`),
      puedeEditar ? apiFetch(`/asistencia/historial/${socio.idSocio}`) : Promise.resolve(null),
    ]);
    if (resCert.ok) setCertificados(await resCert.json());
    if (resIngresos?.ok) setIngresos((await resIngresos.json()).slice(0, 6));
  }, [socio.idSocio, puedeEditar]);

  useEffect(() => { cargar(); }, [cargar]);

  // Pide la lectura: si es 'nuevo' manda el archivo elegido (con el DNI del socio para el control de identidad);
  // si es un id, el backend lee el certificado ya guardado.
  const analizar = async (clave) => {
    setAnalisis(null);
    setErrorIa(null);
    setAnalizando(clave);
    const r = clave === 'nuevo'
      ? await analizarArchivo(nuevoApto.archivo, socio.dni)
      : await analizarCertificado(socio.idSocio, clave);
    setAnalizando(null);
    if (r.ok) setAnalisis({ clave, datos: r.datos, patologias: r.datos.observacionesSugeridas || '' });
    else setErrorIa({ clave, texto: r.error });
  };

  // Confirma en un certificado ya cargado lo que leyó la IA (con las patologías revisadas)
  const guardarAnalisis = async () => {
    const r = await guardarObservaciones(socio.idSocio, analisis.clave, analisis.patologias, analisis.datos.resumen);
    if (r.ok) {
      setAnalisis(null);
      setMensaje({ tipo: 'ok', texto: 'Ficha médica actualizada con la lectura de la IA' });
      cargar();
      onActualizado();
    } else {
      setErrorIa({ clave: analisis.clave, texto: r.error });
    }
  };

  // En la carga nueva, la lectura completa el formulario (se guarda al subir el certificado)
  const usarEnCargaNueva = () => {
    setNuevoApto(prev => ({ ...prev, fechaEmision: analisis.datos.fechaEmision || prev.fechaEmision,
      patologias: analisis.patologias, resumenIa: analisis.datos.resumen || '' }));
    setAnalisis(null);
  };

  // Muestran el error o la tarjeta de lectura solo debajo del certificado que corresponde a la "clave".
  // La tarjeta incluye un campo para CORREGIR las patologías antes de guardarlas (supervisión humana).
  const errorDe = (clave) => (errorIa?.clave === clave ? <p className="text-sm text-rose-600">{errorIa.texto}</p> : null);

  const resultadoDe = (clave) => (analisis?.clave === clave ? (
    <ResultadoAnalisis analisis={analisis.datos} acciones={<>
      <Campo label="Patologías a guardar (separadas por coma)" className="w-full">
        <input value={analisis.patologias} onChange={e => setAnalisis({ ...analisis, patologias: e.target.value })} className={inputClass} />
      </Campo>
      <button type="button" onClick={() => setAnalisis(null)} className={botonSecundario}>Descartar</button>
      {clave === 'nuevo'
        ? <button type="button" onClick={usarEnCargaNueva} className={botonPrimario}>Usar estos datos</button>
        : <button type="button" onClick={guardarAnalisis} className={botonPrimario}>Guardar en la ficha</button>}
    </>} />
  ) : null);

  const verArchivo = async (idCertificado) => {
    try {
      await verArchivoCertificado(socio.idSocio, idCertificado);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const cargarApto = async (e) => {
    e.preventDefault();
    const errorArchivo = validarArchivoApto(nuevoApto.archivo);
    if (errorArchivo) return setMensaje({ tipo: 'error', texto: errorArchivo });
    if (!nuevoApto.fechaEmision) return setMensaje({ tipo: 'error', texto: 'Indicá la fecha de emisión' });

    setSubiendo(true);
    setMensaje(null);
    const resultado = await subirCertificado(socio.idSocio, nuevoApto.archivo, nuevoApto.fechaEmision,
      nuevoApto.patologias, nuevoApto.resumenIa);
    setSubiendo(false);
    if (resultado.ok) {
      setNuevoApto({ archivo: null, fechaEmision: '', patologias: '', resumenIa: '' });
      setMensaje({ tipo: 'ok', texto: `Certificado cargado: vence el ${formatFecha(resultado.certificado.fechaVencimiento)}` });
      cargar();
      onActualizado();
    } else {
      setMensaje({ tipo: 'error', texto: resultado.error });
    }
  };

  const anios = edad(socio.fechaNacimiento);

  return (
    <Modal titulo={socio.nombreCompleto} subtitulo={`DNI ${socio.dni} · socio desde ${formatFecha(socio.fechaCreacion)}`}
      onClose={onClose} ancho="max-w-3xl" pie={<button onClick={onClose} className={botonSecundario}>Cerrar</button>}>
      <div className="space-y-6">
        <Seccion icon={User} titulo="Datos personales">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Dato label="Email" valor={socio.email} />
            <Dato label="Teléfono" valor={socio.telefono} />
            <Dato label="Nacimiento" valor={socio.fechaNacimiento && `${formatFecha(socio.fechaNacimiento)} (${anios} años)`} />
            <Dato label="Género" valor={socio.genero} />
            <Dato label="Domicilio" valor={[socio.domicilio, socio.ciudad].filter(Boolean).join(', ')} />
            <Dato label="Objetivo" valor={socio.objetivo} />
          </div>
          {socio.observaciones && <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{socio.observaciones}</p>}
        </Seccion>

        <Seccion icon={Wallet} titulo="Membresía">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Dato label="Plan" valor={socio.planActual} />
            <Dato label="Vencimiento" valor={socio.vencimientoMembresia && `${formatFecha(socio.vencimientoMembresia)} (${textoVencimiento(diasHasta(socio.vencimientoMembresia))})`} />
            <Dato label="Estado" valor={socio.membresiaAlDia ? 'Al día' : 'Vencida o sin plan'} />
          </div>
          {puedeEditar && <DebitoSocio socio={socio} />}
        </Seccion>

        <Seccion icon={HeartPulse} titulo="Certificados médicos">
          {certificados.length === 0 ? (
            <p className="text-sm text-slate-500">No tiene certificados cargados.</p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {certificados.map((c, i) => (
                <li key={c.idCertificado} className="p-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div className="text-sm">
                    <p className="font-semibold text-slate-800">
                      Emitido {formatFecha(c.fechaEmision)} · vence {formatFecha(c.fechaVencimiento)}
                      {i === 0 && <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">ACTUAL</span>}
                    </p>
                    <p className="text-slate-500">
                      {textoVencimiento(diasHasta(c.fechaVencimiento))} · Patologías: {c.observacionesPatologias || 'ninguna'}
                    </p>
                    {c.resumenIa && (
                      <p className="text-slate-600 mt-1 flex items-start gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 mt-0.5 text-violet-500 shrink-0" /> {c.resumenIa}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                    {puedeEditar && (
                      <BotonIa estado={estadoIa} cargando={analizando === c.idCertificado} className="!px-3 !py-1.5 !text-xs"
                        onClick={() => analizar(c.idCertificado)}>
                        Analizar con IA
                      </BotonIa>
                    )}
                    <button onClick={() => verArchivo(c.idCertificado)}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Ver archivo
                    </button>
                  </div>
                  </div>
                  {errorDe(c.idCertificado)}
                  {resultadoDe(c.idCertificado)}
                </li>
              ))}
            </ul>
          )}

          {puedeEditar && <AvisoIaNoDisponible estado={estadoIa} />}
          {puedeEditar && (
            <form onSubmit={cargarApto} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Cargar nuevo certificado</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Campo label="Archivo (PDF o imagen)" className="md:col-span-3">
                  <label className="flex items-center gap-3 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600 truncate">{nuevoApto.archivo ? nuevoApto.archivo.name : 'Seleccionar archivo...'}</span>
                    <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden"
                      onChange={e => { setNuevoApto({ ...nuevoApto, archivo: e.target.files[0] || null, resumenIa: '' }); setAnalisis(null); }} />
                  </label>
                </Campo>
                {nuevoApto.archivo && (
                  <div className="md:col-span-3 space-y-2">
                    <BotonIa estado={estadoIa} cargando={analizando === 'nuevo'} onClick={() => analizar('nuevo')}>
                      Leer el certificado con IA
                    </BotonIa>
                    {errorDe('nuevo')}
                    {resultadoDe('nuevo')}
                    {nuevoApto.resumenIa && analisis?.clave !== 'nuevo' && (
                      <p className="text-xs text-violet-700">Se va a guardar el resumen de la IA: {nuevoApto.resumenIa}</p>
                    )}
                  </div>
                )}
                <Campo label="Fecha de emisión">
                  <input type="date" max={hoyIso()} value={nuevoApto.fechaEmision}
                    onChange={e => setNuevoApto({ ...nuevoApto, fechaEmision: e.target.value })} className={inputClass} />
                </Campo>
                <Campo label="Patologías (separadas por coma)" className="md:col-span-2">
                  <input value={nuevoApto.patologias} placeholder="Ninguna"
                    onChange={e => setNuevoApto({ ...nuevoApto, patologias: e.target.value })} className={inputClass} />
                </Campo>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={subiendo} className={botonPrimario}>
                  <Upload className="w-4 h-4" /> {subiendo ? 'Subiendo...' : 'Cargar certificado'}
                </button>
              </div>
            </form>
          )}
          {mensaje && (
            <p className={`text-sm font-medium ${mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-600'}`}>{mensaje.texto}</p>
          )}
        </Seccion>

        {puedeEditar && (
          <Seccion icon={LogIn} titulo="Últimos ingresos">
            {ingresos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin ingresos registrados.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {ingresos.map(i => (
                  <li key={i.idLog}>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">{formatFechaHora(i.fechaHora)}</span>
                      {i.tipoEvento === 'INGRESO_EXCEPCION' ? (
                        <span className="text-amber-700 font-medium">Por excepción</span>
                      ) : (
                        <span className={i.resultado === 'PERMITIDO' ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                          {i.resultado === 'PERMITIDO' ? 'Permitido' : i.resultado.replace('DENEGADO_', '').replaceAll('_', ' ').toLowerCase()}
                        </span>
                      )}
                    </div>
                    {i.tipoEvento === 'INGRESO_EXCEPCION' && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Autorizó {i.autorizadoPorNombre || 'recepción'}: {i.motivoExcepcion}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        )}
      </div>
    </Modal>
  );
};

export default FichaSocioModal;

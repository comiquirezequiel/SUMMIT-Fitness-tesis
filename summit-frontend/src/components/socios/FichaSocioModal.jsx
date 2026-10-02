import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, HeartPulse, Wallet, User, LogIn } from 'lucide-react';
import Modal from '../Modal';
import Campo, { inputClass, botonPrimario, botonSecundario } from '../Campo';
import { apiFetch } from '../../services/api';
import { subirCertificado, validarArchivoApto, verArchivoCertificado } from '../../services/certificados';
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
  const [nuevoApto, setNuevoApto] = useState({ archivo: null, fechaEmision: '', patologias: '' });
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const cargar = useCallback(async () => {
    const [resCert, resIngresos] = await Promise.all([
      apiFetch(`/socios/${socio.idSocio}/certificados`),
      puedeEditar ? apiFetch(`/asistencia/historial/${socio.idSocio}`) : Promise.resolve(null),
    ]);
    if (resCert.ok) setCertificados(await resCert.json());
    if (resIngresos?.ok) setIngresos((await resIngresos.json()).slice(0, 6));
  }, [socio.idSocio, puedeEditar]);

  useEffect(() => { cargar(); }, [cargar]);

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
    const resultado = await subirCertificado(socio.idSocio, nuevoApto.archivo, nuevoApto.fechaEmision, nuevoApto.patologias);
    setSubiendo(false);
    if (resultado.ok) {
      setNuevoApto({ archivo: null, fechaEmision: '', patologias: '' });
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
        </Seccion>

        <Seccion icon={HeartPulse} titulo="Certificados médicos">
          {certificados.length === 0 ? (
            <p className="text-sm text-slate-500">No tiene certificados cargados.</p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {certificados.map((c, i) => (
                <li key={c.idCertificado} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div className="text-sm">
                    <p className="font-semibold text-slate-800">
                      Emitido {formatFecha(c.fechaEmision)} · vence {formatFecha(c.fechaVencimiento)}
                      {i === 0 && <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">ACTUAL</span>}
                    </p>
                    <p className="text-slate-500">
                      {textoVencimiento(diasHasta(c.fechaVencimiento))} · Patologías: {c.observacionesPatologias || 'ninguna'}
                    </p>
                  </div>
                  <button onClick={() => verArchivo(c.idCertificado)}
                    className="self-start sm:self-auto px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Ver archivo
                  </button>
                </li>
              ))}
            </ul>
          )}

          {puedeEditar && (
            <form onSubmit={cargarApto} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Cargar nuevo certificado</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Campo label="Archivo (PDF o imagen)" className="md:col-span-3">
                  <label className="flex items-center gap-3 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600 truncate">{nuevoApto.archivo ? nuevoApto.archivo.name : 'Seleccionar archivo...'}</span>
                    <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden"
                      onChange={e => setNuevoApto({ ...nuevoApto, archivo: e.target.files[0] || null })} />
                  </label>
                </Campo>
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
                  <li key={i.idLog} className="flex justify-between gap-4">
                    <span className="text-slate-600">{formatFechaHora(i.fechaHora)}</span>
                    <span className={i.resultado === 'PERMITIDO' ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                      {i.resultado === 'PERMITIDO' ? 'Permitido' : i.resultado.replace('DENEGADO_', '').replaceAll('_', ' ').toLowerCase()}
                    </span>
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

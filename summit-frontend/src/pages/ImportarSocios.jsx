import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Download, Upload, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Users } from 'lucide-react';
import { pedirJson, conJson } from '../services/api';
import { COLUMNAS_EJEMPLO, FILA_EJEMPLO, leerPlanilla, sociosDePlanilla } from '../utils/planilla';
import { descargarCsv, formatFecha } from '../utils/formato';

const ESTADOS = {
  CREADO: { texto: 'Importado', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: CheckCircle2 },
  EXISTE: { texto: 'Ya estaba', clase: 'bg-slate-100 text-slate-600 border-slate-200', icono: Users },
  ERROR: { texto: 'Con error', clase: 'bg-rose-50 text-rose-700 border-rose-200', icono: XCircle },
};

const Resumen = ({ titulo, valor, clase }) => (
  <div className={`rounded-xl border p-4 ${clase}`}>
    <p className="text-sm font-medium">{titulo}</p>
    <p className="text-3xl font-bold mt-1">{valor}</p>
  </div>
);

/**
 * Importar socios desde una planilla de Excel o CSV (por ejemplo, la del sistema anterior). Primero se ve una vista
 * previa con lo que está mal; después cada fila se importa por separado y se ve cómo terminó. Un DNI que ya estaba no
 * se modifica. Con plan y vencimiento, el socio queda con su membresía hasta esa fecha.
 */
const ImportarSocios = () => {
  const entrada = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [socios, setSocios] = useState(null);
  const [error, setError] = useState('');
  const [importando, setImportando] = useState(false);
  const [resultados, setResultados] = useState(null);

  const elegir = async (elegido) => {
    if (!elegido) return;
    setError('');
    setResultados(null);
    setSocios(null);
    setArchivo(elegido.name);
    try {
      const { socios: leidos, faltan } = sociosDePlanilla(await leerPlanilla(elegido));
      if (faltan.length) throw new Error(`No encontré las columnas: ${faltan.join(', ')}. Usá los títulos de la planilla de ejemplo.`);
      if (leidos.length === 0) throw new Error('La planilla no tiene socios debajo de los títulos.');
      setSocios(leidos);
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo.');
    } finally {
      if (entrada.current) entrada.current.value = '';
    }
  };

  const validos = (socios || []).filter((s) => s.problemas.length === 0);

  const importar = async () => {
    setImportando(true);
    setError('');
    try {
      const filas = validos.map(({ problemas, ...fila }) => ({
        ...fila, fechaNacimiento: fila.fechaNacimiento || null, vence: fila.vence || null,
      }));
      setResultados(await pedirJson('/socios/importar', conJson('POST', { filas }), 'No se pudo importar la planilla'));
    } catch (err) {
      setError(err.message);
    } finally {
      setImportando(false);
    }
  };

  const contar = (estado) => (resultados || []).filter((r) => r.estado === estado).length;
  const socioDe = (numero) => (socios || []).find((s) => s.numero === numero);
  const bajarErrores = () => descargarCsv('socios-con-error.csv', ['Fila', 'Nombre', 'DNI', 'Problema'],
    [...(socios || []).filter((s) => s.problemas.length).map((s) => [s.numero, s.nombreCompleto, s.dni, s.problemas.join(' · ')]),
      ...(resultados || []).filter((r) => r.estado === 'ERROR').map((r) => [r.numero, socioDe(r.numero)?.nombreCompleto, socioDe(r.numero)?.dni, r.mensaje])]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
        <div>
          <Link to="/socios" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Volver a la lista de socios
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /> Importar socios</h1>
          <p className="text-sm text-slate-500 mt-1">Desde una planilla de Excel (.xlsx) o CSV, por ejemplo la del sistema que usaban antes.</p>
        </div>
        <button onClick={() => descargarCsv('planilla-socios.csv', COLUMNAS_EJEMPLO, [FILA_EJEMPLO])}
          className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 bg-white shrink-0">
          <Download className="w-4 h-4" /> Bajar planilla de ejemplo
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div className="text-sm text-slate-600 space-y-1">
          <p><span className="font-semibold text-slate-800">Columnas obligatorias:</span> Nombre y apellido (o Nombre y Apellido por separado), DNI y Email.</p>
          <p><span className="font-semibold text-slate-800">Opcionales:</span> Teléfono, Fecha de nacimiento, Género, Domicilio, Ciudad, Objetivo y Observaciones. Con <span className="font-semibold">Plan</span> (el nombre de uno de tus planes) y <span className="font-semibold">Vence</span> (la fecha), el socio queda con su membresía hasta ese día, sin cobro.</p>
          <p>Un DNI que ya está registrado no se modifica. Los socios importados no tienen contraseña para la app: si vuelve, se la da recepción.</p>
        </div>
        <input ref={entrada} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
        <button onClick={() => entrada.current?.click()} disabled={importando}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2">
          <Upload className="w-4 h-4" /> {archivo ? 'Elegir otra planilla' : 'Elegir la planilla'}
        </button>
        {archivo && <p className="text-sm text-slate-500">Archivo: <span className="font-medium text-slate-700">{archivo}</span></p>}
        {error && <p className="text-sm text-rose-600 font-medium flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</p>}
      </div>

      {resultados && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Resumen titulo="Importados" valor={contar('CREADO')} clase="border-emerald-200 bg-emerald-50 text-emerald-800" />
          <Resumen titulo="Ya estaban" valor={contar('EXISTE')} clase="border-slate-200 bg-slate-50 text-slate-700" />
          <Resumen titulo="Con error" valor={contar('ERROR') + (socios.length - validos.length)} clase="border-rose-200 bg-rose-50 text-rose-800" />
        </div>
      )}

      {socios && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{socios.length}</span> filas · <span className="font-semibold text-emerald-700">{validos.length} listas</span>
              {socios.length > validos.length && <> · <span className="font-semibold text-rose-700">{socios.length - validos.length} con problemas</span> (no se importan)</>}
            </p>
            <div className="flex gap-2">
              {(socios.length > validos.length || contar('ERROR') > 0) && (
                <button onClick={bajarErrores} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Download className="w-4 h-4" /> Bajar los que tienen problemas
                </button>
              )}
              {!resultados && (
                <button onClick={importar} disabled={importando || validos.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                  <Upload className="w-4 h-4" /> {importando ? 'Importando...' : `Importar ${validos.length} ${validos.length === 1 ? 'socio' : 'socios'}`}
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-xs tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">Fila</th>
                  <th className="px-4 py-3 font-medium">Socio</th>
                  <th className="px-4 py-3 font-medium">Email y teléfono</th>
                  <th className="px-4 py-3 font-medium">Membresía</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {socios.map((s) => {
                  const resultado = (resultados || []).find((r) => r.numero === s.numero);
                  const estado = resultado ? ESTADOS[resultado.estado] : null;
                  return (
                    <tr key={s.numero} className={s.problemas.length ? 'bg-rose-50/40' : ''}>
                      <td className="px-4 py-2.5 text-slate-500">{s.numero}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{s.nombreCompleto || '—'}</div>
                        <div className="text-xs text-slate-500">DNI {s.dni || '—'}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        <div>{s.email || '—'}</div>
                        <div className="text-xs text-slate-500">{s.telefono}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                        {s.plan ? `${s.plan}${s.vence ? ` · vence ${formatFecha(s.vence)}` : ''}` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {s.problemas.length > 0 ? (
                          <span className="text-xs font-semibold text-rose-700">{s.problemas.join(' · ')}</span>
                        ) : estado ? (
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${estado.clase}`}>
                              <estado.icono className="w-3 h-3" /> {estado.texto}
                            </span>
                            <div className="text-xs text-slate-500 mt-0.5">{resultado.mensaje}</div>
                            {resultado.aviso && <div className="text-xs text-amber-700 mt-0.5">{resultado.aviso}</div>}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700">Lista para importar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarSocios;

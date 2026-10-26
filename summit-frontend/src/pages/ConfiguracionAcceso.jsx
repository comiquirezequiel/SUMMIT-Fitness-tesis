import React, { useState, useEffect } from 'react';
import { Save, Settings, Info, AlertTriangle, CheckCircle, QrCode, MapPin, Printer, RefreshCw, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch } from '../services/api';
import { PREFIJO_QR_INGRESO } from '../utils/constantes';
import { useFunciones } from '../services/funciones';

// Interruptor de las reglas (mismo estilo en toda la pantalla)
const Interruptor = ({ activo, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer shrink-0">
    <input type="checkbox" className="sr-only peer" checked={activo} onChange={(e) => onChange(e.target.checked)} />
    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
  </label>
);

const claseCampo = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800';

const ConfiguracionAcceso = () => {
  const { appSocios } = useFunciones();
  const [config, setConfig] = useState({
    requerirMembresiaActiva: true,
    requerirCertificadoMedico: true,
    permitirOverrideManual: false,
    diasGraciaMembresia: 3,
    diasGraciaCertificado: 7,
    ingresoQrHabilitado: false,
    latitudGimnasio: null,
    longitudGimnasio: null,
    radioIngresoMetros: 20,
    codigoQrIngreso: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [ubicando, setUbicando] = useState(false);
  const [precisionLeida, setPrecisionLeida] = useState(null);
  const [regenerando, setRegenerando] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await apiFetch('/configuracion/acceso');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  };

  const mostrar = (text, type) => {
    setMessage({ text, type });
    if (type === 'success') setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const response = await apiFetch('/configuracion/acceso', {
        method: 'PUT',
        body: JSON.stringify(config)
      });

      if (response.status === 403) throw new Error('Solo un administrador puede modificar las reglas de acceso.');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Error al guardar la configuración.');

      setConfig(data);
      mostrar('Configuración guardada exitosamente.', 'success');
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  // La ubicación del navegador solo está disponible con HTTPS o en la misma PC (localhost)
  const usarMiUbicacion = () => {
    if (!navigator.geolocation) {
      mostrar('Este navegador no puede leer la ubicación.', 'error');
      return;
    }
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setConfig(prev => ({
          ...prev,
          latitudGimnasio: Number(posicion.coords.latitude.toFixed(6)),
          longitudGimnasio: Number(posicion.coords.longitude.toFixed(6)),
        }));
        setPrecisionLeida(Math.round(posicion.coords.accuracy));
        setUbicando(false);
      },
      (error) => {
        setUbicando(false);
        mostrar(error.code === error.PERMISSION_DENIED
          ? 'El navegador no dio permiso para leer la ubicación.'
          : 'No se pudo leer la ubicación. Probá de nuevo o cargala a mano.', 'error');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const regenerarQr = async () => {
    if (!window.confirm('¿Generar un QR nuevo? Los QR impresos hasta ahora dejan de servir y hay que imprimir el nuevo.')) return;
    setRegenerando(true);
    try {
      const response = await apiFetch('/configuracion/acceso/codigo-qr', { method: 'POST' });
      if (response.status === 403) throw new Error('Solo un administrador puede generar un QR nuevo.');
      if (!response.ok) throw new Error('No se pudo generar el QR nuevo.');
      const data = await response.json();
      setConfig(prev => ({ ...prev, codigoQrIngreso: data.codigoQrIngreso }));
      mostrar('Se generó un QR nuevo: imprimilo y reemplazá el anterior.', 'success');
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setRegenerando(false);
    }
  };

  const numeroOVacio = (valor) => (valor === '' || valor === null || valor === undefined ? null : Number(valor));
  const contenidoQr = config.codigoQrIngreso ? `${PREFIJO_QR_INGRESO}${config.codigoQrIngreso}` : null;

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando configuración...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Configuración de Acceso</h1>
          <p className="text-sm text-slate-500">Administra las reglas de negocio, validaciones y tolerancias para el ingreso de socios al gimnasio.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sección: Requisitos de Acceso */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Requisitos de Acceso</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-700">Requerir Membresía Activa</p>
                <p className="text-xs text-slate-500 mt-0.5">Bloquea el ingreso si el socio no tiene un plan de entrenamiento pagado y vigente.</p>
              </div>
              <Interruptor activo={config.requerirMembresiaActiva} onChange={(v) => handleChange('requerirMembresiaActiva', v)} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-700">Requerir Apto Médico (Ley 5397)</p>
                <p className="text-xs text-slate-500 mt-0.5">Bloquea el acceso o reservas si el certificado del socio ha vencido.</p>
              </div>
              <Interruptor activo={config.requerirCertificadoMedico} onChange={(v) => handleChange('requerirCertificadoMedico', v)} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-700">Permitir ingresos por excepción</p>
                <p className="text-xs text-slate-500 mt-0.5">Recepción puede dejar pasar a un socio con la cuota vencida o sin días de su plan, escribiendo el motivo (queda registrado quién lo autorizó). Nunca sin apto médico vigente.</p>
              </div>
              <Interruptor activo={config.permitirOverrideManual} onChange={(v) => handleChange('permitirOverrideManual', v)} />
            </div>
          </div>
        </div>

        {/* Sección: Períodos de Gracia */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Info className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Períodos de Gracia</h2>
          </div>

          <div className="space-y-6 flex-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Días de gracia (Membresía Vencida)</label>
              <p className="text-xs text-slate-500 mb-3">Tiempo adicional permitido para ingresar luego de vencer el plan.</p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={config.diasGraciaMembresia}
                  onChange={(e) => handleChange('diasGraciaMembresia', parseInt(e.target.value) || 0)}
                  className={claseCampo}
                />
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 text-sm font-medium">días</div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Días de gracia (Apto Médico Vencido)</label>
              <p className="text-xs text-slate-500 mb-3">Días extra para traer el nuevo certificado antes de bloquear el molinete/reservas.</p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={config.diasGraciaCertificado}
                  onChange={(e) => handleChange('diasGraciaCertificado', parseInt(e.target.value) || 0)}
                  className={claseCampo}
                />
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 text-sm font-medium">días</div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 leading-relaxed text-center">
              Los cambios guardados aplicarán inmediatamente al sistema de Check-In por molinetes y a las reservas online desde la App Móvil.
            </p>
          </div>
        </div>
      </div>

      {/* Sección: Ingreso con QR desde la app del socio (PLAN-APP-SOCIOS.md, A4). Con la app suspendida no aparece */}
      {appSocios && (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <QrCode className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Ingreso con QR desde la app</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-700">Permitir ingresar con el QR</p>
                <p className="text-xs text-slate-500 mt-0.5">El socio toca «Ingresar» en la app y escanea el QR impreso en recepción. Solo puede si su celular está dentro del radio del gimnasio, y se aplican las mismas reglas que en recepción.</p>
              </div>
              <Interruptor activo={!!config.ingresoQrHabilitado} onChange={(v) => handleChange('ingresoQrHabilitado', v)} />
            </div>

            <div>
              <p className="font-semibold text-slate-700 mb-1">Ubicación del gimnasio</p>
              <p className="text-xs text-slate-500 mb-3">Cargala parado en el gimnasio con «Usar mi ubicación actual» (funciona desde esta PC o desde la app por HTTPS), o escribila a mano.</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="any" placeholder="Latitud (ej. -34.6037)" value={config.latitudGimnasio ?? ''}
                  onChange={(e) => handleChange('latitudGimnasio', numeroOVacio(e.target.value))} className={claseCampo} aria-label="Latitud del gimnasio" />
                <input type="number" step="any" placeholder="Longitud (ej. -58.3816)" value={config.longitudGimnasio ?? ''}
                  onChange={(e) => handleChange('longitudGimnasio', numeroOVacio(e.target.value))} className={claseCampo} aria-label="Longitud del gimnasio" />
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <button onClick={usarMiUbicacion} disabled={ubicando}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2">
                  {ubicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} Usar mi ubicación actual
                </button>
                {precisionLeida !== null && (
                  <span className="text-xs text-slate-500">Precisión de la lectura: ±{precisionLeida} m{precisionLeida > 30 ? ' (conviene acercarse a una ventana y volver a leer)' : ''}</span>
                )}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Radio de ingreso</label>
              <p className="text-xs text-slate-500 mb-3">Distancia máxima al gimnasio. Adentro de un edificio el GPS erra, así que se descuenta la precisión del celular (hasta 30 m más).</p>
              <div className="relative max-w-xs">
                <input type="number" min="5" max="500" value={config.radioIngresoMetros ?? 20}
                  onChange={(e) => handleChange('radioIngresoMetros', parseInt(e.target.value) || null)} className={claseCampo} />
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 text-sm font-medium">metros</div>
              </div>
            </div>
            <p className="text-xs text-slate-500">Guardá los cambios para que se apliquen.</p>
          </div>

          {/* QR para imprimir y pegar en recepción */}
          <div className="flex flex-col items-center gap-3">
            {contenidoQr && (
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <QRCodeSVG value={contenidoQr} size={176} level="M" title="QR de ingreso del gimnasio" />
              </div>
            )}
            <button onClick={() => window.print()} disabled={!contenidoQr}
              className="w-full px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Imprimir QR
            </button>
            <button onClick={regenerarQr} disabled={regenerando}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center justify-center gap-2">
              {regenerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Generar un QR nuevo
            </button>
            <p className="text-[11px] text-slate-400 max-w-[200px] text-center">Si el QR se llega a publicar, generá uno nuevo: el impreso deja de servir.</p>
          </div>
        </div>
      </div>
      )}

      {/* Lo único que se imprime (ver .zona-impresion en index.css): el QR grande con las instrucciones */}
      {appSocios && contenidoQr && (
        <div className="zona-impresion hidden print:flex flex-col items-center justify-center gap-8 text-center">
          <p className="text-4xl font-black tracking-[0.3em]">SUMMIT</p>
          <QRCodeSVG value={contenidoQr} size={420} level="M" />
          <div>
            <p className="text-2xl font-bold">Ingresá con la app</p>
            <p className="text-lg mt-2">Abrí la app SUMMIT, tocá «Ingresar al gimnasio» y escaneá este código.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfiguracionAcceso;

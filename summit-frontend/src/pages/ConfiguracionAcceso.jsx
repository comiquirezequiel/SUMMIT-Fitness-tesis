import { useState, useEffect } from 'react';
import { Save, Settings, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiFetch } from '../services/api';

// Interruptor de las reglas (mismo estilo en toda la pantalla)
const Interruptor = ({ activo, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer shrink-0">
    <input type="checkbox" className="sr-only peer" checked={activo} onChange={(e) => onChange(e.target.checked)} />
    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
  </label>
);

const claseCampo = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800';

const ConfiguracionAcceso = () => {
  const [config, setConfig] = useState({
    requerirMembresiaActiva: true,
    requerirCertificadoMedico: true,
    permitirOverrideManual: false,
    diasGraciaMembresia: 3,
    diasGraciaCertificado: 7,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

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
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors shadow-xs"
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
              Los cambios guardados se aplican enseguida al control de acceso de recepción y a las reservas de clases.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracionAcceso;

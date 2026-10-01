import React, { useState, useEffect } from 'react';
import { Save, Settings, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../services/api';

const ConfiguracionAcceso = () => {
  const [config, setConfig] = useState({
    requerirMembresiaActiva: true,
    requerirCertificadoMedico: true,
    permitirOverrideManual: false,
    diasGraciaMembresia: 3,
    diasGraciaCertificado: 7
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/configuracion/acceso');
      setConfig(response.data);
    } catch (err) {
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dark mode variants for ConfiguracionAcceso
  const darkClasses = {
    bg: 'bg-white dark:bg-gray-800',
    border: 'border-slate-200 dark:border-gray-700',
    text: 'text-slate-800 dark:text-gray-100',
    textMuted: 'text-slate-500 dark:text-gray-400',
    hover: 'hover:bg-slate-50 dark:hover:bg-gray-700',
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await api.put('/configuracion/acceso', config);

      setMessage({ text: 'Configuración guardada exitosamente.', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: 'Error al guardar la configuración.', type: 'error' });
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Requisitos de Acceso</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-700">Requerir Membresía Activa</p>
                <p className="text-xs text-slate-500 mt-0.5">Bloquea el ingreso si el socio no tiene un plan de entrenamiento pagado y vigente.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={config.requerirMembresiaActiva} onChange={(e) => handleChange('requerirMembresiaActiva', e.target.checked)} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-700">Requerir Apto Médico (Ley 5397)</p>
                <p className="text-xs text-slate-500 mt-0.5">Bloquea el acceso o reservas si el certificado del socio ha vencido.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={config.requerirCertificadoMedico} onChange={(e) => handleChange('requerirCertificadoMedico', e.target.checked)} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-700">Permitir Override Manual</p>
                <p className="text-xs text-slate-500 mt-0.5">Habilita a Recepción para autorizar un ingreso bloqueado por el sistema bajo su responsabilidad.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={config.permitirOverrideManual} onChange={(e) => handleChange('permitirOverrideManual', e.target.checked)} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800"
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
    </div>
  );
};

export default ConfiguracionAcceso;

import { useState, useEffect } from 'react';
import { Save, Settings, Info, AlertTriangle, CheckCircle, ShieldCheck, Lock } from 'lucide-react';
import { botonPrimario } from '../components/Campo';
import Encabezado from '../components/Encabezado';
import { apiFetch } from '../services/api';
import { usuarioActual } from '../utils/formato';

// Interruptor de las reglas (mismo estilo en toda la pantalla)
const Interruptor = ({ activo, onChange, deshabilitado }) => (
  <label className={`relative inline-flex items-center shrink-0 ${deshabilitado ? 'opacity-60' : 'cursor-pointer'}`}>
    <input type="checkbox" className="sr-only peer" checked={activo} disabled={deshabilitado} onChange={(e) => onChange(e.target.checked)} />
    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
  </label>
);

const claseCampo = 'w-full px-2.5 py-1.5 tactil:py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm tactil:text-base font-medium text-slate-800 disabled:opacity-60';

const Regla = ({ titulo, detalle, children }) => (
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{detalle}</p>
    </div>
    {children}
  </div>
);

const Tarjeta = ({ icon: Icon, color, titulo, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col">
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
      <div className={`p-1.5 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
      <h2 className="text-sm font-bold text-slate-800">{titulo}</h2>
    </div>
    {children}
  </div>
);

/**
 * Reglas de acceso (pestaña de Configuración y reglas): qué se exige para entrar, los ingresos por excepción y los
 * días de gracia. Recepción las ve; solo el administrador las cambia (el backend tampoco deja otra cosa).
 */
const ConfiguracionAcceso = () => {
  const esAdmin = usuarioActual()?.rol === 'ADMIN';
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
    return <div className="p-5 text-center text-sm text-slate-500 aparece-tarde" role="status" data-cargando>Cargando configuración...</div>;
  }

  return (
    <div className="space-y-3">
      <Encabezado titulo="Reglas de acceso" icono={ShieldCheck}
        subtitulo="Qué se exige para entrar al gimnasio, los ingresos por excepción y las tolerancias"
        acciones={esAdmin ? (
          <button onClick={handleSave} disabled={saving} className={botonPrimario}>
            <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        ) : (
          <span className="text-xs text-slate-500 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Solo el administrador las cambia</span>
        )} />

      {message.text && (
        <div className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Tarjeta icon={Settings} color="bg-blue-50 text-blue-600" titulo="Requisitos de acceso">
          <div className="space-y-3">
            <Regla titulo="Requerir membresía activa" detalle="Bloquea el ingreso si el socio no tiene un plan de entrenamiento pagado y vigente.">
              <Interruptor activo={config.requerirMembresiaActiva} deshabilitado={!esAdmin} onChange={(v) => handleChange('requerirMembresiaActiva', v)} />
            </Regla>
            <Regla titulo="Requerir apto médico (Ley 5397)" detalle="Bloquea el acceso o reservas si el certificado del socio ha vencido.">
              <Interruptor activo={config.requerirCertificadoMedico} deshabilitado={!esAdmin} onChange={(v) => handleChange('requerirCertificadoMedico', v)} />
            </Regla>
            <Regla titulo="Permitir ingresos por excepción"
              detalle="Recepción puede dejar pasar a un socio con la cuota vencida o sin días de su plan, escribiendo el motivo (queda registrado quién lo autorizó). Nunca sin apto médico vigente.">
              <Interruptor activo={config.permitirOverrideManual} deshabilitado={!esAdmin} onChange={(v) => handleChange('permitirOverrideManual', v)} />
            </Regla>
          </div>
        </Tarjeta>

        <Tarjeta icon={Info} color="bg-amber-50 text-amber-600" titulo="Períodos de gracia">
          <div className="space-y-3 flex-1">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Días de gracia (membresía vencida)</label>
              <p className="text-xs text-slate-500 mb-1.5">Tiempo adicional permitido para ingresar luego de vencer el plan.</p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={config.diasGraciaMembresia}
                  disabled={!esAdmin}
                  onChange={(e) => handleChange('diasGraciaMembresia', parseInt(e.target.value) || 0)}
                  className={claseCampo}
                />
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500 text-sm font-medium">días</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Días de gracia (apto médico vencido)</label>
              <p className="text-xs text-slate-500 mb-1.5">Días extra para traer el nuevo certificado antes de bloquear el molinete/reservas.</p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={config.diasGraciaCertificado}
                  disabled={!esAdmin}
                  onChange={(e) => handleChange('diasGraciaCertificado', parseInt(e.target.value) || 0)}
                  className={claseCampo}
                />
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500 text-sm font-medium">días</div>
              </div>
            </div>
          </div>

          <p className="mt-3 px-2.5 py-2 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500 leading-relaxed">
            Los cambios guardados se aplican enseguida al control de acceso de recepción y a las reservas de clases.
          </p>
        </Tarjeta>
      </div>
    </div>
  );
};

export default ConfiguracionAcceso;

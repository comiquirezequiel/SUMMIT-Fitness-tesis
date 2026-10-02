import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, ChevronRight, ChevronLeft,
  User, Mail, Phone, Calendar, CreditCard,
  MapPin, FileText, AlertTriangle, Check, X
} from 'lucide-react';

// --- Campo de formulario reutilizable ---
const FormField = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
  </div>
);

const inputClass =
  "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-shadow placeholder:text-slate-300";

const STEPS = ['Datos Personales', 'Contacto', 'Membresía', 'Confirmación'];

const NuevoSocio = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    fechaNacimiento: '',
    genero: '',
    email: '',
    telefono: '',
    domicilio: '',
    ciudad: '',
    plan: '',
    metodoPago: '',
    observaciones: '',
    certificadoMedico: false,
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const siguiente = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const anterior = () => setStep(s => Math.max(s - 1, 0));

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, idx) => (
        <React.Fragment key={idx}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              idx < step ? 'bg-blue-600 border-blue-600 text-white' :
              idx === step ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' :
              'bg-white border-slate-200 text-slate-400'
            }`}>
              {idx < step ? <Check className="w-4 h-4" /> : idx + 1}
            </div>
            <span className={`text-[10px] mt-1 font-medium ${idx === step ? 'text-blue-600' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`h-0.5 w-16 mx-1 mb-4 transition-all ${idx < step ? 'bg-blue-600' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-blue-600" /> Nuevo Socio
          </h1>
          <p className="text-sm text-slate-500">Completá los datos para registrar un nuevo socio</p>
        </div>
        <button
          onClick={() => navigate('/socios')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <X className="w-4 h-4" /> Cancelar
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <StepIndicator />

        {/* PASO 1: Datos Personales */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-5 h-5 text-blue-500" /> Datos Personales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Nombre" required>
                <input
                  type="text" placeholder="Ej: Juan" value={form.nombre}
                  onChange={e => update('nombre', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Apellido" required>
                <input
                  type="text" placeholder="Ej: Pérez" value={form.apellido}
                  onChange={e => update('apellido', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="DNI / Documento" required>
                <input
                  type="text" placeholder="Ej: 38.456.789" value={form.dni}
                  onChange={e => update('dni', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Fecha de Nacimiento" required>
                <input
                  type="date" value={form.fechaNacimiento}
                  onChange={e => update('fechaNacimiento', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Género">
                <select
                  value={form.genero}
                  onChange={e => update('genero', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="NB">No binario</option>
                  <option value="NS">Prefiero no decirlo</option>
                </select>
              </FormField>
            </div>
          </div>
        )}

        {/* PASO 2: Contacto */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Mail className="w-5 h-5 text-blue-500" /> Datos de Contacto
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Email" required>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-300 absolute left-3 top-3" />
                  <input
                    type="email" placeholder="correo@ejemplo.com" value={form.email}
                    onChange={e => update('email', e.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </FormField>
              <FormField label="Teléfono" required>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-300 absolute left-3 top-3" />
                  <input
                    type="tel" placeholder="+54 9 11 1234 5678" value={form.telefono}
                    onChange={e => update('telefono', e.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </FormField>
              <FormField label="Domicilio">
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-300 absolute left-3 top-3" />
                  <input
                    type="text" placeholder="Av. Siempreviva 742" value={form.domicilio}
                    onChange={e => update('domicilio', e.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </FormField>
              <FormField label="Ciudad">
                <input
                  type="text" placeholder="Buenos Aires" value={form.ciudad}
                  onChange={e => update('ciudad', e.target.value)}
                  className={inputClass}
                />
              </FormField>
            </div>
          </div>
        )}

        {/* PASO 3: Membresía */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="w-5 h-5 text-blue-500" /> Membresía y Pago
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Plan" required>
                <select
                  value={form.plan}
                  onChange={e => update('plan', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Seleccionar plan...</option>
                  <option value="musculacion">Musculación Mensual — $5.000</option>
                  <option value="crossfit">Crossfit Mensual — $6.500</option>
                  <option value="yoga">Yoga Flow — $4.000</option>
                  <option value="pase-libre">Pase Libre Anual — $15.000</option>
                </select>
              </FormField>
              <FormField label="Método de Pago" required>
                <select
                  value={form.metodoPago}
                  onChange={e => update('metodoPago', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Seleccionar...</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="mercadopago">MercadoPago</option>
                  <option value="debito">Débito Automático</option>
                </select>
              </FormField>
              <FormField label="Fecha de Inicio" required>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-300 absolute left-3 top-3" />
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </FormField>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Certificado Médico</p>
                <p className="text-xs text-amber-700 mt-1">
                  El socio debe presentar un certificado médico de aptitud física.
                </p>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.certificadoMedico}
                    onChange={e => update('certificadoMedico', e.target.checked)}
                    className="rounded border-amber-300 text-amber-500 focus:ring-amber-300"
                  />
                  <span className="text-xs font-medium text-amber-800">
                    Confirmo que el certificado médico fue recibido
                  </span>
                </label>
              </div>
            </div>

            <FormField label="Observaciones">
              <textarea
                rows={3} placeholder="Lesiones previas, notas especiales..."
                value={form.observaciones}
                onChange={e => update('observaciones', e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </FormField>
          </div>
        )}

        {/* PASO 4: Confirmación */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-5 h-5 text-blue-500" /> Resumen del Registro
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Datos Personales</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Nombre completo</span><span className="font-medium text-slate-800">{form.nombre} {form.apellido}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">DNI</span><span className="font-medium text-slate-800">{form.dni || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Fecha de nac.</span><span className="font-medium text-slate-800">{form.fechaNacimiento || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Género</span><span className="font-medium text-slate-800">{form.genero || '—'}</span></div>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Contacto</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-medium text-slate-800">{form.email || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Teléfono</span><span className="font-medium text-slate-800">{form.telefono || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Domicilio</span><span className="font-medium text-slate-800">{form.domicilio || '—'}</span></div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 md:col-span-2">
                <h3 className="font-semibold text-blue-700 text-sm uppercase tracking-wide">Membresía</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-blue-600">Plan</span><span className="font-bold text-blue-800">{form.plan || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-blue-600">Método de pago</span><span className="font-bold text-blue-800">{form.metodoPago || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-blue-600">Certificado médico</span><span className={`font-bold ${form.certificadoMedico ? 'text-emerald-600' : 'text-rose-600'}`}>{form.certificadoMedico ? 'Presentado ✓' : 'Pendiente ✗'}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navegación */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={anterior}
            disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={siguiente}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" /> Registrar Socio
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NuevoSocio;

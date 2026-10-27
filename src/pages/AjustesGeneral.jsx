import React from 'react';
import { Settings, Save, Calendar, Globe, DollarSign, Check } from 'lucide-react';

const AjustesGeneral = () => {
  return (
    <div className="space-y-6 w-full pb-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
            <p className="text-sm text-slate-500">Configura los formatos de fecha, moneda e idioma para tu gimnasio</p>
          </div>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          <Save className="w-4 h-4" /> Guardar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          
          {/* Fecha y Hora Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800 mb-5">
              <Calendar className="w-5 h-5 text-slate-500" /> Fecha y Hora
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Formato de fecha</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option>DD/MM/YYYY (31/12/2024)</option>
                  <option>MM/DD/YYYY (12/31/2024)</option>
                  <option>YYYY-MM-DD (2024-12-31)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Formato de hora</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option>24 horas (14:30)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zona horaria</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option>Argentina (Buenos Aires)</option>
                  <option>México (Ciudad de México)</option>
                  <option>Brasil (São Paulo)</option>
                  <option>Colombia (Bogotá)</option>
                  <option>Perú (Lima)</option>
                  <option>Chile (Santiago)</option>
                  <option>EE.UU. (Nueva York)</option>
                  <option>EE.UU. (Los Ángeles)</option>
                  <option>España (Madrid)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">La semana comienza el</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option>Lunes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Regional Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800 mb-5">
              <Globe className="w-5 h-5 text-slate-500" /> Regional
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Idioma predeterminado</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option>Español</option>
                  <option>English</option>
                  <option>Português</option>
                </select>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <p className="text-xs text-slate-500 text-center">
                  El idioma predeterminado se aplicará a nuevos usuarios. Cada usuario puede cambiar su preferencia de idioma en su perfil.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Moneda Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800 mb-5">
              <DollarSign className="w-5 h-5 text-slate-500" /> Moneda
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Moneda predeterminada</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option>ARS - Peso Argentino</option>
                  <option>MXN - Peso Mexicano</option>
                  <option>BRL - Real Brasileño</option>
                  <option>USD - Dólar Estadounidense</option>
                  <option>EUR - Euro</option>
                  <option>CLP - Peso Chileno</option>
                  <option>COP - Peso Colombiano</option>
                  <option>PEN - Sol Peruano</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Símbolo de moneda</label>
                <input type="text" defaultValue="$" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Posición del símbolo</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option>Antes del monto ($100)</option>
                </select>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Separador decimal</label>
                  <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                    <option>Coma (1.234,56)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Separador de miles</label>
                  <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                    <option>Punto (1.234)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Decimales</label>
                <input type="number" defaultValue="2" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
          </div>

          {/* Vista previa Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800 mb-5">
              <Check className="w-5 h-5 text-slate-500" /> Vista previa
            </h2>
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Ejemplo de fecha (hoy):</p>
                <p className="text-lg font-medium text-slate-800">12/09/2026</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Ejemplo de moneda ($1.234,56):</p>
                <p className="text-lg font-medium text-slate-800">$1.234,56</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AjustesGeneral;

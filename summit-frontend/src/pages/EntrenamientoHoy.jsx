import React from 'react';
import { CalendarCheck, User, ChevronsUpDown } from 'lucide-react';

const EntrenamientoHoy = () => {
  return (
    <div className="space-y-6 w-full pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rutina de Hoy</h1>
          <p className="text-sm text-slate-500">Consulta qué entrenamiento corresponde hoy</p>
        </div>
      </div>

      {/* Seleccionar Socio */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
          <User className="w-4 h-4 text-slate-500" /> Seleccionar Socio
        </label>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Buscar socio..." 
            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <ChevronsUpDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Estado vacío */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col items-center justify-center p-12 min-h-[300px]">
        <User className="w-10 h-10 text-slate-400 mb-4" />
        <p className="text-slate-800 font-semibold mb-1">Selecciona un socio</p>
        <p className="text-slate-500 text-sm">Elige un socio para ver su rutina de hoy</p>
      </div>
    </div>
  );
};

export default EntrenamientoHoy;

import React from 'react';
import { Clipboard, Users, Clock, CalendarDays } from 'lucide-react';

const AjustesAsistencia = () => {
  // Para mostrar la fecha actual como en la captura
  const fechaActual = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
          <Clipboard className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Asistencia del Staff</h1>
          <p className="text-sm text-slate-500">Entradas, salidas y horas del personal — {fechaActual}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* En el gym ahora */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-slate-700">En el gym ahora</h3>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="text-4xl font-bold text-slate-800">0</p>
            <p className="text-sm text-slate-500 mt-1">de 0 que ficharon hoy</p>
          </div>
        </div>

        {/* Última fichada */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-slate-700">Última fichada</h3>
            <Clock className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="text-4xl font-bold text-slate-800">-</p>
            <p className="text-sm text-slate-500 mt-1">Sin registros</p>
          </div>
        </div>
      </div>

      {/* Fichadas de hoy */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px] flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800 text-lg">
            <CalendarDays className="w-5 h-5 text-slate-500" /> Fichadas de hoy
          </h2>
          <p className="text-sm text-slate-500 mt-1">Entrada, salida y horas trabajadas por persona</p>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/30">
          <p className="text-slate-500 text-sm">Todavía no hay fichadas para hoy</p>
        </div>
      </div>

    </div>
  );
};

export default AjustesAsistencia;

import React, { useState } from 'react';
import { ClipboardList, Sparkles, Plus, Search, Star, MoreHorizontal, Target, Users, CalendarDays, Clock, X, Eye } from 'lucide-react';

const PlanCard = ({ title, description, objetivo, asignado, duracion, frecuencia, semanas, sesiones }) => (
  <div className="bg-white rounded-xl border-l-4 border-l-purple-500 border-y border-r border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col h-full">
    <div className="flex justify-between items-start mb-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-500">
          <Star className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-slate-800 text-[15px] leading-tight">{title}</h3>
      </div>
      <button className="text-slate-400 hover:text-slate-600 transition-colors">
        <MoreHorizontal className="w-5 h-5" />
      </button>
    </div>
    
    <div className="flex gap-2 mb-4">
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">Activo</span>
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">Plantilla</span>
    </div>

    <p className="text-slate-500 text-sm mb-6 flex-1">{description}</p>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600"><Target className="w-4 h-4" /></div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Objetivo</p>
          <p className="text-sm font-semibold text-slate-700">{objetivo}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><Users className="w-4 h-4" /></div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Asignado</p>
          <p className="text-sm font-semibold text-slate-700">{asignado}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><CalendarDays className="w-4 h-4" /></div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Duración</p>
          <p className="text-sm font-semibold text-slate-700">{duracion}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Clock className="w-4 h-4" /></div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Frecuencia</p>
          <p className="text-sm font-semibold text-slate-700">{frecuencia}</p>
        </div>
      </div>
    </div>

    <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-auto">
      <div className="flex gap-3 text-xs text-slate-500 font-medium">
        <span>{semanas} semanas</span>
        <span>{sesiones} sesiones</span>
      </div>
      <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
        <Eye className="w-3.5 h-3.5" /> Ver detalle
      </button>
    </div>
  </div>
);

const NuevoPlanModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[600px] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-800">Nuevo Plan</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto bg-white flex-1">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Nombre del Plan *</label>
              <input type="text" placeholder="Ej: Plan de Hipertrofia 12 Semanas" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Objetivo</label>
                <select defaultValue="Hipertrofia" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option>Fuerza</option>
                  <option>Hipertrofia</option>
                  <option>Resistencia</option>
                  <option>Pérdida de peso</option>
                  <option>Fitness general</option>
                  <option>Deporte específico</option>
                  <option>Rehabilitación</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Nivel</label>
                <select defaultValue="Intermedio" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option>Principiante</option>
                  <option>Intermedio</option>
                  <option>Avanzado</option>
                  <option>Elite</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Duración (semanas)</label>
                <input type="number" defaultValue="4" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Días por semana</label>
                <input type="number" defaultValue="4" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Duración sesión (min)</label>
                <input type="number" defaultValue="60" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Descripción</label>
              <textarea 
                rows="3" 
                placeholder="Descripción del plan de entrenamiento..."
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              ></textarea>
            </div>

            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input type="checkbox" className="mt-1 border-slate-300 rounded text-blue-600 focus:ring-blue-500" />
              <div>
                <p className="text-sm font-bold text-slate-800">Guardar como plantilla</p>
                <p className="text-xs text-slate-500 mt-0.5">Las plantillas se pueden usar para crear nuevos planes rápidamente</p>
              </div>
            </label>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Asignar a Socio</label>
              <select className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Buscar socio por nombre, email o DNI...</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Si asignas a un socio, este plan será su rutina personalizada</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold transition-colors">
            Cancelar
          </button>
          <button className="bg-[#2a64f6] hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

const EntrenamientoPlanes = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('plantillas');

  return (
    <div className="space-y-6 w-full pb-8 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Planes de Entrenamiento</h1>
          <p className="text-sm text-slate-500 mt-1">Crea y gestiona planes de entrenamiento para tus socios</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
            <Sparkles className="w-4 h-4" /> Cargar plantillas base
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#2a64f6] hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo Plan
          </button>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 mb-4 pt-2 px-2">
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('plantillas')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'plantillas' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Plantillas (5)</span>
            </button>
            <button 
              onClick={() => setActiveTab('asignadas')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'asignadas' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Rutinas Asignadas (2)</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 px-2 pb-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Buscar planes..." 
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex gap-3">
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option>Todos los niveles</option>
              <option>Principiante</option>
              <option>Intermedio</option>
              <option>Avanzado</option>
              <option>Elite</option>
            </select>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option>Todos los objetivos</option>
              <option>Fuerza</option>
              <option>Hipertrofia</option>
              <option>Resistencia</option>
              <option>Pérdida de peso</option>
              <option>Fitness general</option>
              <option>Deporte específico</option>
              <option>Rehabilitación</option>
            </select>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option>Todos los estados</option>
              <option>Borrador</option>
              <option>Activo</option>
              <option>Archivado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid de Planes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <PlanCard 
          title="Fuerza básica 3 días"
          description="Enfocada en fuerza con básicos y pocas repeticiones. Lunes, miércoles y viernes."
          objetivo="general"
          asignado="0 socios"
          duracion="4 sem"
          frecuencia="3x/sem"
          semanas={0}
          sesiones={0}
        />
        <PlanCard 
          title="Tren Superior / Tren Inferior 4 días"
          description="Split superior/inferior, intermedia. Lunes y jueves (superior), martes y viernes (inferior)."
          objetivo="general"
          asignado="0 socios"
          duracion="4 sem"
          frecuencia="4x/sem"
          semanas={0}
          sesiones={0}
        />
        <PlanCard 
          title="Push / Pull / Legs 3 días"
          description="Empuje / tirón / pierna. Intermedia. Lunes (push), miércoles (pull), viernes (legs)."
          objetivo="general"
          asignado="0 socios"
          duracion="4 sem"
          frecuencia="3x/sem"
          semanas={0}
          sesiones={0}
        />
      </div>

      <NuevoPlanModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default EntrenamientoPlanes;

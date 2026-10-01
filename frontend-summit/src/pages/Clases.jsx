import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Plus, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import api from '../services/api';

const ClassCard = ({ title, time, instructor, capacity, enrolled, color, room }) => {
  const isFull = enrolled >= capacity;
  return (
    <div className={`p-4 rounded-xl border ${color} relative shadow-sm group hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-slate-800 dark:text-gray-100">{title}</h3>
        <span className={`text-xs font-bold px-2 py-1 rounded ${isFull ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
          {enrolled}/{capacity}
        </span>
      </div>
      <div className="space-y-1.5 mt-3">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>{time}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
          <Users className="w-4 h-4 text-slate-400" />
          <span>{instructor}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span>{room}</span>
        </div>
      </div>
    </div>
  );
};

const Clases = () => {
  const days = ['Lunes 10', 'Martes 11', 'Miércoles 12', 'Jueves 13', 'Viernes 14', 'Sábado 15', 'Domingo 16'];
  const [activeDay, setActiveDay] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel de Clases</h1>
          <p className="text-sm text-slate-500">Gestión de horarios, reservas y asistencias</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Nueva Clase
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-2 overflow-x-auto">
            {days.map((day, idx) => (
              <button
                key={idx}
                onClick={() => setActiveDay(idx)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  activeDay === idx
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <ClassCard
            title="Crossfit Avanzado"
            time="08:00 - 09:00"
            instructor="Marcos Silva"
            capacity={20}
            enrolled={20}
            room="Box Principal"
            color="border-l-4 border-l-rose-500"
          />
          <ClassCard
            title="Yoga Flow"
            time="09:00 - 10:00"
            instructor="Laura M."
            capacity={15}
            enrolled={12}
            room="Sala 1"
            color="border-l-4 border-l-indigo-500"
          />
          <ClassCard
            title="Zumba"
            time="10:30 - 11:30"
            instructor="Carla D."
            capacity={30}
            enrolled={18}
            room="Salón Principal"
            color="border-l-4 border-l-pink-500"
          />
          <ClassCard
            title="Spinning"
            time="18:00 - 19:00"
            instructor="Diego T."
            capacity={25}
            enrolled={22}
            room="Sala Bici"
            color="border-l-4 border-l-orange-500"
          />
          <ClassCard
            title="Musculación Dirigida"
            time="19:00 - 20:00"
            instructor="Marcos Silva"
            capacity={10}
            enrolled={5}
            room="Zona Pesas"
            color="border-l-4 border-l-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

export default Clases;

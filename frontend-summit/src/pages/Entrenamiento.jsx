import React from 'react';
import { Dumbbell } from 'lucide-react';
import ModeloHumano from '../components/ModeloHumano';

const Entrenamiento = () => {
  return (
    <div className="space-y-4 w-full pb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
          <Dumbbell className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Catálogo de Ejercicios y Biomecánica</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Explora el modelo anatómico, selecciona una región para ver el detalle y conoce la función biomecánica y ejercicios clave.
          </p>
        </div>
      </div>

      <ModeloHumano />
    </div>
  );
};

export default Entrenamiento;

import React, { useState } from 'react';
import { GitBranch, Users, CreditCard, Receipt, Package, Dumbbell, ChevronDown, ChevronUp, Plus, Edit2, Trash2 } from 'lucide-react';

const TablaParametrica = ({ title, count, columns, data }) => (
  <div className="mb-8">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-sm font-semibold text-slate-700">{title} ({count})</h3>
      <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Agregar
      </button>
    </div>
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm text-left text-slate-600">
        <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200 uppercase">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className="px-4 py-3 font-medium">{col}</th>
            ))}
            <th className="px-4 py-3 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-3">{cell}</td>
              ))}
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const AccordionItem = ({ icon: Icon, title, subtitle, isOpen, onClick, children }) => (
  <div className="border border-slate-200 rounded-xl bg-white mb-4 overflow-hidden">
    <button 
      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-500'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
    </button>
    {isOpen && (
      <div className="p-6 border-t border-slate-200 bg-white">
        {children}
      </div>
    )}
  </div>
);

const AjustesTablas = () => {
  const [openSection, setOpenSection] = useState('socios');

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
          <GitBranch className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configuración del Sistema</h1>
          <p className="text-sm text-slate-500">Administra las tablas paramétricas y configuraciones generales</p>
        </div>
      </div>

      <div>
        <AccordionItem 
          icon={Users} 
          title="Datos de Socios" 
          subtitle="Géneros, Tipos de Documento, Ocupaciones"
          isOpen={openSection === 'socios'}
          onClick={() => setOpenSection(openSection === 'socios' ? '' : 'socios')}
        >
          <TablaParametrica 
            title="Géneros" 
            count={4} 
            columns={['Nombre']} 
            data={[['Masculino'], ['No binario'], ['Femenino'], ['Otro']]} 
          />
          <TablaParametrica 
            title="Tipos de Documento" 
            count={3} 
            columns={['Nombre', 'Código']} 
            data={[
              ['Documento Nacional de Identidad', 'DNI'], 
              ['Pasaporte', 'PASSPORT'], 
              ['Otro', 'OTHER']
            ]} 
          />
          <TablaParametrica 
            title="Ocupaciones" 
            count={2} 
            columns={['Nombre']} 
            data={[['Empleado'], ['Mecánico']]} 
          />
          <TablaParametrica 
            title="Canales de captación (cómo nos conoció)" 
            count={7} 
            columns={['Nombre']} 
            data={[
              ['Instagram'], ['Facebook'], ['Recomendación'], 
              ['Cartel / Pasaba por el frente'], ['Google'], ['WhatsApp'], ['Otro']
            ]} 
          />
        </AccordionItem>

        <AccordionItem 
          icon={CreditCard} 
          title="Métodos de Pago" 
          subtitle="Efectivo, Tarjeta, Transferencia, etc."
          isOpen={openSection === 'pagos'}
          onClick={() => setOpenSection(openSection === 'pagos' ? '' : 'pagos')}
        >
          <div className="text-sm text-slate-500 italic">Contenido de Métodos de Pago (en desarrollo)</div>
        </AccordionItem>

        <AccordionItem 
          icon={Receipt} 
          title="Gastos" 
          subtitle="Categorías de Gastos, Proveedores"
          isOpen={openSection === 'gastos'}
          onClick={() => setOpenSection(openSection === 'gastos' ? '' : 'gastos')}
        >
          <div className="text-sm text-slate-500 italic">Contenido de Gastos (en desarrollo)</div>
        </AccordionItem>

        <AccordionItem 
          icon={Package} 
          title="Productos" 
          subtitle="Categorías de Productos"
          isOpen={openSection === 'productos'}
          onClick={() => setOpenSection(openSection === 'productos' ? '' : 'productos')}
        >
          <div className="text-sm text-slate-500 italic">Contenido de Productos (en desarrollo)</div>
        </AccordionItem>

        <AccordionItem 
          icon={Dumbbell} 
          title="Entrenamiento" 
          subtitle="Biblioteca de Ejercicios, Planes y Rutinas"
          isOpen={openSection === 'entrenamiento'}
          onClick={() => setOpenSection(openSection === 'entrenamiento' ? '' : 'entrenamiento')}
        >
          <div className="text-sm text-slate-500 italic">Contenido de Entrenamiento (en desarrollo)</div>
        </AccordionItem>
      </div>
    </div>
  );
};

export default AjustesTablas;

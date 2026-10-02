import React, { useState } from 'react';
import { Users, UserPlus, MoreVertical, X } from 'lucide-react';

const MiembroRow = ({ nombre, telefono, email, roles, estado }) => (
  <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
    <td className="px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
          {nombre.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-slate-800 text-sm">{nombre}</p>
          {telefono && <p className="text-xs text-slate-500 mt-0.5">{telefono}</p>}
        </div>
      </div>
    </td>
    <td className="px-6 py-4 text-sm text-slate-600">
      {email}
    </td>
    <td className="px-6 py-4">
      <div className="flex gap-2 flex-wrap">
        {roles.map((rol, idx) => {
          let badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
          let icon = null;
          if (rol === 'Admin') badgeClass = "bg-red-50 text-red-700 border-red-200";
          if (rol === 'Staff') badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
          if (rol === 'Instructor') {
            badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
            icon = '🧘‍♂️';
          }

          return (
            <span key={idx} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${badgeClass}`}>
              {icon && <span>{icon}</span>}
              {rol}
            </span>
          );
        })}
      </div>
    </td>
    <td className="px-6 py-4">
      {estado === 'Activo' && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          ✓ Activo
        </span>
      )}
    </td>
    <td className="px-6 py-4 text-right">
      <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
    </td>
  </tr>
);

const InvitarModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[500px] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Invitar miembro
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto bg-white flex-1">
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Nombre *</label>
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Apellido *</label>
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Email *</label>
              <input type="email" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Teléfono</label>
              <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">DNI *</label>
              <input type="text" placeholder="Necesario para fichar por DNI" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Rol *</label>
              <select className="w-full p-2.5 border border-blue-500 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option>Empleado</option>
                <option>Admin</option>
                <option>Staff</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">El rol determina qué acciones puede realizar el usuario en el sistema</p>
            </div>

            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input type="checkbox" className="mt-1 border-slate-300 rounded text-blue-600 focus:ring-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">Puede dar clases</p>
                <p className="text-xs text-slate-500 mt-0.5">Marcar si esta persona puede ser asignada como instructor de clases</p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold transition-colors">
            Cancelar
          </button>
          <button className="bg-[#2a64f6] hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
            <UserPlus className="w-4 h-4" /> Invitar
          </button>
        </div>
      </div>
    </div>
  );
};

const AjustesEquipo = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const miembros = [
    {
      nombre: 'Julio Profe',
      telefono: '114778-9877',
      email: 'julio@profe.com.ar',
      roles: ['Staff', 'Instructor'],
      estado: 'Activo'
    },
    {
      nombre: 'Pablo bastidas',
      telefono: '01163309378',
      email: 'p.bastidascarbonell@gmail.com',
      roles: ['Staff', 'Instructor'],
      estado: 'Activo'
    },
    {
      nombre: 'Test GymMT',
      telefono: '',
      email: 'test_gymmt@test.com',
      roles: ['Admin'],
      estado: 'Activo'
    }
  ];

  return (
    <div className="space-y-6 w-full pb-8 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Equipo</h1>
            <p className="text-sm text-slate-500">Administra los empleados y colaboradores de tu gimnasio</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#2a64f6] hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Invitar miembro
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-lg">Miembros del equipo</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Miembro</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Rol</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((m, idx) => (
                <MiembroRow key={idx} {...m} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InvitarModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default AjustesEquipo;

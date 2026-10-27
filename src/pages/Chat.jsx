import React, { useState } from 'react';
import { Search, MessageCircle, Edit3 } from 'lucide-react';

const Chat = () => {
  const [activeChat, setActiveChat] = useState(null);
  const contacts = []; // Se conectará al backend

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mensajes</h1>
        <p className="text-sm text-slate-500">Comunícate directamente con los socios</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex overflow-hidden" style={{ height: 'calc(100vh - 12rem)' }}>
        {/* Panel izquierdo: Lista de contactos */}
        <div className="w-72 border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-slate-500" /> Mensajes
            </h2>
            <button className="text-slate-400 hover:text-blue-600 transition-colors">
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <MessageCircle className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">No hay mensajes</p>
              </div>
            ) : (
              contacts.map(c => (
                <div
                  key={c.id}
                  onClick={() => setActiveChat(c.id)}
                  className={`p-4 border-b border-slate-50 cursor-pointer flex gap-3 transition-colors ${activeChat === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                    {c.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-semibold text-slate-800 text-sm truncate">{c.name}</h3>
                      <span className="text-[10px] text-slate-400">{c.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.lastMessage}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel derecho: Conversación o estado vacío */}
        <div className="flex-1 flex items-center justify-center bg-slate-50/50">
          {!activeChat ? (
            <div className="text-center text-slate-400">
              <MessageCircle className="w-14 h-14 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Selecciona una conversación</p>
            </div>
          ) : (
            <div className="text-center text-slate-400">
              <p className="text-sm">Conversación activa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;

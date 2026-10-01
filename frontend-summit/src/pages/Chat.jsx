import React, { useState, useEffect } from 'react';
import { Search, MessageCircle, Edit3 } from 'lucide-react';
import api from '../services/api';

const Chat = () => {
  const [activeChat, setActiveChat] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await api.get('/usuarios');
        setContacts(response.data);
      } catch (err) {
        console.error('Error fetching contacts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);

  const contactsFiltrados = contacts.filter(c => {
    if (!search) return true;
    const termino = search.toLowerCase();
    return c.nombreCompleto?.toLowerCase().includes(termino);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Mensajes</h1>
        <p className="text-sm text-slate-500 dark:text-gray-400">Comunícate directamente con los socios</p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm flex overflow-hidden" style={{ height: 'calc(100vh - 12rem)' }}>
        <div className="w-72 border-r border-slate-200 dark:border-gray-700 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-slate-500 dark:text-gray-400" /> Mensajes
            </h2>
            <button className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 border-b border-slate-100 dark:border-gray-700">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <p className="text-sm">Cargando contactos...</p>
              </div>
            ) : contactsFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <MessageCircle className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">No hay mensajes</p>
              </div>
            ) : (
              contactsFiltrados.map(c => (
                <div
                  key={c.idSocio || c.id}
                  onClick={() => setActiveChat(c.idSocio || c.id)}
                  className={`p-4 border-b border-slate-50 dark:border-gray-700 cursor-pointer flex gap-3 transition-colors ${activeChat === (c.idSocio || c.id) ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-gray-700'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-gray-600 flex items-center justify-center text-slate-600 dark:text-gray-300 font-bold text-sm shrink-0">
                    {c.nombreCompleto?.split(' ').map(n => n[0]).join('').substring(0, 2) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-semibold text-slate-800 dark:text-gray-100 text-sm truncate">{c.nombreCompleto || 'Sin nombre'}</h3>
                      <span className="text-[10px] text-slate-400">Ahora</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-400 truncate">{c.email || 'Sin email'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center bg-slate-50/50 dark:bg-gray-800/50">
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

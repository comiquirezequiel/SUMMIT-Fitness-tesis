import React, { useState, useRef, useEffect } from 'react';
import { QrCode, Search, ScanLine, X, ShieldCheck, XCircle, AlertTriangle } from 'lucide-react';

const CheckInModal = ({ isOpen, onClose }) => {
  const [dni, setDni] = useState('');
  const [resultado, setResultado] = useState(null); // null | 'PERMITIDO' | 'DENEGADO'
  const [mensaje, setMensaje] = useState('');
  const [nombreSocio, setNombreSocio] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Focus the input when modal opens or result clears
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, resultado]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dni) return;
    
    setLoading(true);
    setResultado(null);
    setMensaje('');
    setNombreSocio('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/asistencia/molinete/verificar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dni })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResultado('PERMITIDO');
        setMensaje(data.mensaje);
        setNombreSocio(data.nombreSocio);
      } else {
        setResultado('DENEGADO');
        setMensaje(data.mensaje || data.error);
        setNombreSocio(data.nombreSocio || '');
      }
    } catch (err) {
      setResultado('DENEGADO');
      setMensaje('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
      setDni('');
      
      setTimeout(() => {
        setResultado(null);
      }, 5000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
            <ScanLine className="w-5 h-5 text-blue-600" />
            Control de Acceso (Molinete)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 flex flex-col items-center">
          <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto mb-8 relative">
            <input 
              ref={inputRef}
              type="text" 
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Escanear DNI..."
              className="w-full text-center text-3xl font-bold py-4 px-6 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner tracking-widest placeholder:text-slate-300"
              autoComplete="off"
              disabled={loading}
            />
            <button type="submit" className="hidden">Enviar</button>
          </form>

          {/* Visual Alerts */}
          {loading && (
            <div className="text-center animate-pulse text-slate-400 font-bold text-xl h-40 flex items-center justify-center">
              Verificando acceso...
            </div>
          )}

          {!loading && resultado === null && (
            <div className="text-center text-slate-400 h-40 flex flex-col items-center justify-center">
              <ScanLine className="w-12 h-12 mb-3 opacity-20" />
              <p>Esperando lectura del molinete...</p>
            </div>
          )}

          {resultado === 'PERMITIDO' && (
            <div className="w-full bg-emerald-500 text-white p-8 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg animate-in zoom-in duration-300">
              <ShieldCheck className="w-16 h-16 mb-4" />
              <h2 className="text-3xl font-black uppercase tracking-wide mb-1">Acceso Permitido</h2>
              <p className="text-emerald-100 text-lg font-medium">{nombreSocio}</p>
            </div>
          )}

          {resultado === 'DENEGADO' && (
            <div className="w-full bg-rose-500 text-white p-8 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg animate-in zoom-in duration-300">
              <XCircle className="w-16 h-16 mb-4" />
              <h2 className="text-3xl font-black uppercase tracking-wide mb-1">Acceso Denegado</h2>
              {nombreSocio && <p className="text-rose-100 font-medium mb-3">{nombreSocio}</p>}
              <div className="bg-white/20 px-4 py-1.5 rounded-full backdrop-blur-sm inline-block">
                <p className="text-lg font-bold">{mensaje}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckInModal;

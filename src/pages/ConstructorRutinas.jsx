import React, { useState, useEffect } from 'react';
import { Search, User, FileText, AlertTriangle, CheckCircle, Save, Plus, ChevronRight, Info } from 'lucide-react';

const ConstructorRutinas = () => {
  const [socios, setSocios] = useState([]);
  const [ejercicios, setEjercicios] = useState([]);
  
  const [selectedSocio, setSelectedSocio] = useState(null);
  const [socioSearch, setSocioSearch] = useState('');
  
  // Ficha médica
  const [patologias, setPatologias] = useState([]);
  
  // Constructor
  const [rutinaNombre, setRutinaNombre] = useState('Rutina Base');
  const [rutinaObjetivo, setRutinaObjetivo] = useState('Hipertrofia');
  const [ejerciciosRutina, setEjerciciosRutina] = useState([]); // { ejercicio, series, repeticiones, peso }
  
  // Selector
  const [selectedEjercicioId, setSelectedEjercicioId] = useState('');
  const [riesgosActuales, setRiesgosActuales] = useState([]);
  const [asumiendoRiesgo, setAsumiendoRiesgo] = useState(false);

  // Mensaje
  const [mensaje, setMensaje] = useState(null);

  // Fetch initial data
  useEffect(() => {
    fetchSocios();
    fetchEjercicios();
  }, []);

  const fetchSocios = async () => {
    try {
      const res = await fetch('/api/socios', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setSocios(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEjercicios = async () => {
    try {
      const res = await fetch('/api/ejercicios', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setEjercicios(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  // Buscar historial médico al seleccionar socio
  useEffect(() => {
    if (selectedSocio) {
      fetchFichaMedica(selectedSocio.idSocio);
      setEjerciciosRutina([]);
      setSelectedEjercicioId('');
      setRiesgosActuales([]);
    }
  }, [selectedSocio]);

  const fetchFichaMedica = async (idSocio) => {
    try {
      const res = await fetch(`/api/socios/${idSocio}/certificados/actual`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const cert = await res.json();
        if (cert && cert.observacionesPatologias) {
          setPatologias(cert.observacionesPatologias.split(',').map(p => p.trim()));
        } else {
          setPatologias([]);
        }
      }
    } catch (e) {
      setPatologias([]);
    }
  };

  // Validar ejercicio contraindicado al seleccionarlo
  useEffect(() => {
    if (selectedSocio && selectedEjercicioId) {
      validarEjercicio(selectedEjercicioId);
    } else {
      setRiesgosActuales([]);
      setAsumiendoRiesgo(false);
    }
  }, [selectedEjercicioId]);

  const validarEjercicio = async (idEjercicio) => {
    try {
      const res = await fetch(`/api/rutinas/validar-ejercicio?idSocio=${selectedSocio.idSocio}&idEjercicio=${idEjercicio}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRiesgosActuales(data.riesgos || []);
        setAsumiendoRiesgo(false); // Resetear checkbox
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddEjercicio = () => {
    if (!selectedEjercicioId) return;
    
    const ej = ejercicios.find(e => e.idEjercicio.toString() === selectedEjercicioId);
    if (!ej) return;

    // Si tiene riesgos y no asume, no agregar
    if (riesgosActuales.length > 0 && !asumiendoRiesgo) {
      alert("Debes asumir la responsabilidad para agregar un ejercicio contraindicado.");
      return;
    }

    setEjerciciosRutina([...ejerciciosRutina, { 
      ejercicio: ej, 
      series: 4, 
      repeticiones: 10, 
      peso: 0,
      riesgoAsumido: riesgosActuales.length > 0
    }]);
    
    setSelectedEjercicioId('');
  };

  const handleGuardarRutina = async () => {
    try {
      // 1. Crear Rutina
      const resRutina = await fetch('/api/rutinas', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nombre: rutinaNombre,
          objetivo: rutinaObjetivo,
          socio: { idUsuario: selectedSocio.idSocio }
        })
      });

      if (!resRutina.ok) throw new Error('Error al crear rutina');
      const rutinaData = await resRutina.json();

      // 2. Agregar Ejercicios
      for (const item of ejerciciosRutina) {
        await fetch(`/api/rutinas/${rutinaData.idRutina}/ejercicios?forzar=${item.riesgoAsumido}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ejercicio: { idEjercicio: item.ejercicio.idEjercicio },
            series: item.series,
            repeticiones: item.repeticiones,
            pesoSugeridoKg: item.peso
          })
        });
      }

      setMensaje({ type: 'success', text: 'Rutina guardada exitosamente.' });
      setEjerciciosRutina([]);
      setTimeout(() => setMensaje(null), 3000);

    } catch (e) {
      setMensaje({ type: 'error', text: e.message });
    }
  };

  const sociosFiltrados = socios.filter(s => s.nombreCompleto.toLowerCase().includes(socioSearch.toLowerCase()) || s.dni.includes(socioSearch));

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto h-[calc(100vh-8rem)]">
      
      {/* Panel Izquierdo: Buscador y Ficha Médica */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        
        {/* Buscador de Socio */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Seleccionar Socio
          </h2>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar socio..." 
              value={socioSearch}
              onChange={(e) => setSocioSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {sociosFiltrados.slice(0, 5).map(socio => (
              <button 
                key={socio.idSocio}
                onClick={() => setSelectedSocio(socio)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedSocio?.idSocio === socio.idSocio ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-700'}`}
              >
                {socio.nombreCompleto} <span className="opacity-70 text-xs ml-1">({socio.dni})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ficha Médica */}
        <div className={`flex-1 rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border transition-all ${selectedSocio ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-50'}`}>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-500" />
            Ficha Médica
          </h2>
          
          {!selectedSocio ? (
            <p className="text-sm text-slate-400 text-center py-8">Seleccione un socio para ver su ficha</p>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Paciente</p>
                <p className="font-bold text-slate-800">{selectedSocio.nombreCompleto}</p>
                <p className="text-sm text-slate-600">{selectedSocio.aptoMedicoVigente ? 'Apto Médico Vigente' : 'Sin Apto Médico'}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Patologías / Observaciones</p>
                {patologias.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {patologias.map((pat, i) => (
                      <span key={i} className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg border border-rose-200">
                        {pat.toUpperCase()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-100">
                    <CheckCircle className="w-4 h-4" />
                    Sin contraindicaciones
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel Derecho: Constructor */}
      <div className={`flex-1 flex flex-col bg-white rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border transition-all ${selectedSocio ? 'border-slate-200' : 'border-slate-100 opacity-50 pointer-events-none'}`}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
          <div>
            <input 
              type="text" 
              value={rutinaNombre}
              onChange={(e) => setRutinaNombre(e.target.value)}
              className="text-xl font-black text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full"
            />
            <input 
              type="text" 
              value={rutinaObjetivo}
              onChange={(e) => setRutinaObjetivo(e.target.value)}
              className="text-sm font-medium text-slate-500 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full mt-1"
            />
          </div>
          <button 
            onClick={handleGuardarRutina}
            disabled={ejerciciosRutina.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" /> Guardar Plan
          </button>
        </div>

        {mensaje && (
          <div className={`m-5 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${mensaje.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {mensaje.text}
          </div>
        )}

        <div className="p-5 flex-1 flex flex-col min-h-0">
          {/* Añadir Ejercicio */}
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Añadir Ejercicio</h3>
            <div className="flex gap-3">
              <select 
                value={selectedEjercicioId}
                onChange={(e) => setSelectedEjercicioId(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="">Seleccione un ejercicio...</option>
                {ejercicios.map(ej => (
                  <option key={ej.idEjercicio} value={ej.idEjercicio}>{ej.nombre} ({ej.grupoMuscular})</option>
                ))}
              </select>
              <button 
                onClick={handleAddEjercicio}
                disabled={!selectedEjercicioId || (riesgosActuales.length > 0 && !asumiendoRiesgo)}
                className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-xl transition-colors font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Añadir
              </button>
            </div>

            {/* Warning de Cruce Preventivo */}
            {riesgosActuales.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900">¡Advertencia Médica!</h4>
                    <p className="text-sm text-amber-700 mt-1">Este ejercicio está contraindicado por las siguientes patologías del socio:</p>
                    <ul className="list-disc ml-5 mt-1 text-sm font-bold text-rose-600">
                      {riesgosActuales.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                    
                    <label className="flex items-center gap-2 mt-4 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={asumiendoRiesgo}
                        onChange={(e) => setAsumiendoRiesgo(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                      />
                      <span className="text-sm font-medium text-amber-900">
                        Soy consciente del riesgo y asumo la responsabilidad de prescribir este ejercicio adaptado.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lista de Ejercicios en la Rutina */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {ejerciciosRutina.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Info className="w-10 h-10 mb-2 opacity-50" />
                <p>La rutina está vacía.</p>
                <p className="text-sm">Añada ejercicios desde el selector superior.</p>
              </div>
            ) : (
              <div className="space-y-3 pr-2">
                {ejerciciosRutina.map((item, index) => (
                  <div key={index} className={`flex items-center justify-between p-4 rounded-xl border ${item.riesgoAsumido ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-sm border border-slate-200 shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800">{item.ejercicio.nombre}</h4>
                          {item.riesgoAsumido && <span className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Riesgo Asumido</span>}
                        </div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{item.ejercicio.grupoMuscular}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Series</p>
                        <input type="number" value={item.series} onChange={e => {
                          const newArr = [...ejerciciosRutina];
                          newArr[index].series = e.target.value;
                          setEjerciciosRutina(newArr);
                        }} className="w-14 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded p-1" />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Reps</p>
                        <input type="number" value={item.repeticiones} onChange={e => {
                          const newArr = [...ejerciciosRutina];
                          newArr[index].repeticiones = e.target.value;
                          setEjerciciosRutina(newArr);
                        }} className="w-14 text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded p-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ConstructorRutinas;

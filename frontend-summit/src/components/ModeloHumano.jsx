import React, { useState, useRef } from 'react';
import { MUSCULOS_DATA } from '../data/musculos';
import './modelo-humano.css';

const ModeloHumano = ({ onMuscleSelect }) => {
  const [activeDetail, setActiveDetail] = useState(null);
  const [activeSubMusculo, setActiveSubMusculo] = useState(null);
  const [currentTitle, setCurrentTitle] = useState('—');
  const [tooltip, setTooltip] = useState({ text: '', visible: false, x: 0, y: 0 });
  const [badge, setBadge] = useState({ text: '', visible: false });

  const lastViewedTitleRef = useRef('');
  const badgeTimeoutRef = useRef(null);

  const infoMecanicaData = MUSCULOS_DATA.musculos;
  const leyendasPorVista = MUSCULOS_DATA.leyendas;

  const showBadge = (titulo) => {
    if (badgeTimeoutRef.current) clearTimeout(badgeTimeoutRef.current);
    setBadge({ text: `↩ ${titulo}`, visible: true });
    badgeTimeoutRef.current = setTimeout(() => {
      setBadge((prev) => ({ ...prev, visible: false }));
    }, 2500);
  };

  const handleMouseEnterGeneral = (e, titulo) => {
    setTooltip({ text: titulo, visible: true, x: e.clientX + 16, y: e.clientY - 10 });
  };

  const handleMouseMoveGeneral = (e) => {
    setTooltip((prev) => ({ ...prev, x: e.clientX + 16, y: e.clientY - 10 }));
  };

  const handleMouseLeaveGeneral = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  const handleGeneralPartClick = (detailId, titulo) => {
    setTooltip((prev) => ({ ...prev, visible: false }));
    lastViewedTitleRef.current = titulo || 'Detalle Muscular';
    setCurrentTitle(titulo || 'Detalle Muscular');
    setActiveSubMusculo(null);
    setActiveDetail(detailId);
  };

  const handleSubMusculoClick = (subId) => {
    setActiveSubMusculo(subId);
    const datos = infoMecanicaData[subId];
    if (datos) {
      setCurrentTitle(datos.titulo);
      if (onMuscleSelect) {
        onMuscleSelect(subId, datos.titulo);
      }
    }
  };

  const handleBack = () => {
    const prevTitle = lastViewedTitleRef.current;
    setActiveDetail(null);
    setActiveSubMusculo(null);
    setCurrentTitle('—');
    if (prevTitle) showBadge(prevTitle);
  };

  const selectedMuscleData = activeSubMusculo ? infoMecanicaData[activeSubMusculo] : null;
  const currentLeyendaIds = activeDetail ? leyendasPorVista[activeDetail] || [] : [];

  const vistasGenerales = [
    { id: 'brazos-frente', label: 'Brazos (Vista Frontal)', detailId: 'vista-brazos-frente', color: '#EAB308' },
    { id: 'pecho', label: 'Detalle del Pectoral Mayor', detailId: 'vista-pecho', color: '#F97316' },
    { id: 'abdominal', label: 'Detalle del Abdomen', detailId: 'vista-abdomen', color: '#F87171' },
    { id: 'piernas-frente', label: 'Detalle de las Piernas (Frente)', detailId: 'vista-piernas-frente', color: '#84CC16' },
    { id: 'brazos-trasero', label: 'Brazos (Vista Trasera)', detailId: 'vista-brazos-trasero', color: '#EC407A' },
    { id: 'espalda', label: 'Detalle de la Espalda', detailId: 'vista-espalda', color: '#2DD4BF' },
    { id: 'piernas-trasera', label: 'Detalle de las Piernas (Trasera)', detailId: 'vista-piernas-trasera', color: '#6366F1' },
  ];

  // SVG paths for body regions
  const bodyRegions = {
    'brazos-frente': "M 120 80 Q 100 100 95 140 Q 90 180 100 220 L 110 220 Q 105 180 110 140 Q 115 100 130 85 Z M 280 80 Q 300 100 305 140 Q 310 180 300 220 L 290 220 Q 295 180 290 140 Q 285 100 270 85 Z",
    'pecho': "M 140 90 Q 200 70 260 90 Q 270 120 260 150 Q 200 170 140 150 Q 130 120 140 90 Z",
    'abdominal': "M 145 155 Q 200 145 255 155 Q 260 200 255 240 Q 200 250 145 240 Q 140 200 145 155 Z",
    'piernas-frente': "M 150 245 Q 175 240 195 245 L 190 400 Q 175 410 160 400 Z M 205 245 Q 225 240 250 245 L 240 400 Q 225 410 210 400 Z",
    'brazos-trasero': "M 115 85 Q 95 105 90 145 Q 85 185 95 225 L 105 225 Q 100 185 105 145 Q 110 105 125 90 Z M 285 85 Q 305 105 310 145 Q 315 185 305 225 L 295 225 Q 300 185 295 145 Q 290 105 275 90 Z",
    'espalda': "M 135 85 Q 200 65 265 85 Q 275 130 265 175 Q 200 195 135 175 Q 125 130 135 85 Z",
    'piernas-trasera': "M 148 248 Q 172 243 192 248 L 188 405 Q 172 415 158 405 Z M 208 248 Q 232 243 252 248 L 248 405 Q 232 415 218 405 Z",
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100">Modelo Muscular Interactivo</h2>
        {badge.visible && (
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold animate-pulse">
            {badge.text}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Visual */}
        <div className={`lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 ${activeDetail ? 'ring-2 ring-blue-500' : ''}`}>
          {activeDetail && (
            <button
              onClick={handleBack}
              className="mb-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-semibold text-sm transition-colors"
            >
              ← Volver al Cuerpo
            </button>
          )}

          {/* SVG del cuerpo humano con regiones musculares */}
          <svg viewBox="0 0 400 600" className="w-full h-auto max-h-[500px] mx-auto">
            {/* Fondo */}
            <rect x="0" y="0" width="400" height="600" fill="#f8fafc" rx="12" />
            
            {/* Silueta del cuerpo */}
            <g opacity="0.1">
              <ellipse cx="200" cy="50" rx="35" ry="40" fill="#64748b" />
              <path d="M 165 90 Q 200 75 235 90 L 240 250 Q 200 260 160 250 Z" fill="#64748b" />
              <path d="M 160 250 L 155 420 Q 175 430 195 420 L 195 250 Z" fill="#64748b" />
              <path d="M 240 250 L 245 420 Q 225 430 205 420 L 205 250 Z" fill="#64748b" />
              <path d="M 165 90 L 130 100 Q 110 130 105 180 L 115 180 Q 120 130 140 105 Z" fill="#64748b" />
              <path d="M 235 90 L 270 100 Q 290 130 295 180 L 285 180 Q 280 130 260 105 Z" fill="#64748b" />
            </g>

            {/* Regiones musculares interactivas */}
            {!activeDetail && vistasGenerales.map((vista) => (
              <g
                key={vista.id}
                onClick={() => handleGeneralPartClick(vista.detailId, vista.label)}
                onMouseEnter={(e) => handleMouseEnterGeneral(e, vista.label)}
                onMouseMove={handleMouseMoveGeneral}
                onMouseLeave={handleMouseLeaveGeneral}
                className="cursor-pointer"
              >
                <path
                  d={bodyRegions[vista.id]}
                  fill={vista.color}
                  opacity="0.4"
                  stroke={vista.color}
                  strokeWidth="2"
                  className="hover:opacity-70 transition-opacity"
                />
              </g>
            ))}

            {/* Vista detallada activa */}
            {activeDetail && (
              <g>
                <rect x="50" y="50" width="300" height="500" fill="#f1f5f9" rx="8" />
                <text x="200" y="280" textAnchor="middle" fill="#64748b" fontSize="16">
                  {currentTitle}
                </text>
                <text x="200" y="310" textAnchor="middle" fill="#94a3b8" fontSize="12">
                  Selecciona un músculo de la lista
                </text>
              </g>
            )}
          </svg>

          {/* Tooltip */}
          {tooltip.visible && (
            <div
              className="fixed z-50 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg pointer-events-none"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              {tooltip.text}
            </div>
          )}
        </div>

        {/* Columna Lista */}
        <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 ${activeDetail ? 'visible' : ''}`}>
          <div className="mb-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Análisis Biomecánico</div>
            <h3 className="text-xl font-extrabold text-gray-800 dark:text-gray-100">{currentTitle}</h3>
          </div>

          <div className="mb-6">
            {!selectedMuscleData ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">◎</div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Seleccioná una de las regiones coloreadas para ver su análisis biomecánico y ejercicios recomendados.</p>
              </div>
            ) : (
              <div
                className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: selectedMuscleData.mecanica }}
              />
            )}
          </div>

          {currentLeyendaIds.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Regiones</div>
              <div className="space-y-2">
                {currentLeyendaIds.map((id) => {
                  const datos = infoMecanicaData[id];
                  if (!datos) return null;
                  const isActivo = activeSubMusculo === id;
                  return (
                    <button
                      key={id}
                      onClick={() => handleSubMusculoClick(id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isActivo
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: datos.color }}
                        />
                        <span className={`font-semibold text-sm ${isActivo ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>
                          {datos.titulo}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModeloHumano;

import React from 'react';
import {
  Users, TrendingDown, DollarSign, AlertTriangle,
  RefreshCw, TrendingUp, PieChart, Activity
} from 'lucide-react';

const BarCol = ({ height, color }) => (
  <div className="w-8 flex flex-col justify-end items-center h-full">
    <div className={`w-full rounded-t-sm ${color} transition-all`} style={{ height: `${height}%` }}></div>
  </div>
);

const LinePoint = ({ x, y }) => (
  <div
    className="absolute w-2 h-2 rounded-full bg-blue-500 border-2 border-white shadow-sm -ml-1 -mt-1"
    style={{ left: `${x}%`, bottom: `${y}%` }}
  />
);

const MetricasPlanes = () => {
  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Estadísticas de Membresías</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Análisis de evolución y tendencias</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg px-4 py-2 focus:outline-none focus:border-blue-400 shadow-sm">
            <option>Últimos 12 meses</option>
            <option>Este año</option>
            <option>Mes actual</option>
          </select>
          <button className="p-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 shadow-sm transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm flex flex-col justify-between h-36">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-800 dark:text-gray-100">1</p>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">Membresías Activas</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm flex flex-col justify-between h-36 relative">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> -76 en 12 meses
            </span>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-800 dark:text-gray-100">-76</p>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">Crecimiento Neto</p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">+231 nuevas, -307 bajas</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm flex flex-col justify-between h-36">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-800 dark:text-gray-100">$ 5.502.100</p>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">Ingresos Total</p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Promedio mensual: $ 458.508</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm flex flex-col justify-between h-36">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-800 dark:text-gray-100">0</p>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">En Riesgo</p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">0 críticos (7 días o menos)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-gray-100 mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" /> Evolución de Membresías
          </h3>
          <div className="relative h-48 border-b border-l border-slate-100 dark:border-gray-700 flex items-end justify-between px-2 pb-2">
            <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-between text-[10px] text-slate-400 dark:text-gray-500 py-2">
              <span>300</span><span>225</span><span>150</span><span>75</span><span>0</span>
            </div>

            <div className="w-full h-full relative flex items-end justify-between gap-1">
              <BarCol height={20} color="bg-emerald-400" />
              <BarCol height={22} color="bg-emerald-400" />
              <BarCol height={30} color="bg-emerald-400" />

              <div className="w-8 flex flex-col justify-end h-full">
                <div className="w-full bg-rose-500 rounded-t-sm" style={{ height: '90%' }}></div>
              </div>

              <BarCol height={2} color="bg-emerald-400" />
              <BarCol height={0} color="bg-emerald-400" />
              <BarCol height={0} color="bg-emerald-400" />
              <BarCol height={1} color="bg-rose-500" />
              <BarCol height={0} color="bg-emerald-400" />
              <BarCol height={0} color="bg-emerald-400" />

              <div className="absolute bottom-1 left-0 w-full h-[1px] bg-blue-300"></div>
              <LinePoint x={5} y={1} />
              <LinePoint x={15} y={2} />
              <LinePoint x={25} y={4} />
              <LinePoint x={35} y={1} />
              <LinePoint x={45} y={0} />
              <LinePoint x={55} y={0} />
              <LinePoint x={65} y={0} />
              <LinePoint x={75} y={0} />
              <LinePoint x={85} y={0} />
              <LinePoint x={95} y={0} />
            </div>
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-400 dark:text-gray-500 px-2">
            <span>Nov 2025</span>
            <span>Jan 2026</span>
            <span>Mar 2026</span>
            <span>May 2026</span>
            <span>Jul 2026</span>
            <span>Sep 2026</span>
          </div>
          <div className="flex justify-center gap-4 mt-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-gray-300"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Activas</span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-gray-300"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Bajas</span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-gray-300"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Nuevas</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-gray-100 mb-6 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" /> Ingresos por Mes
          </h3>
          <div className="relative h-48 border-b border-l border-slate-100 dark:border-gray-700 flex items-end justify-between px-4 pb-2">
            <div className="absolute -left-10 top-0 bottom-0 flex flex-col justify-between text-[10px] text-slate-400 dark:text-gray-500 py-2">
              <span>$1800k</span><span>$1350k</span><span>$900k</span><span>$450k</span><span>$0k</span>
            </div>

            <div className="w-full h-full flex items-end justify-between gap-2">
              <div className="w-1/6 bg-emerald-400 rounded-t-sm transition-all hover:opacity-80" style={{ height: '65%' }}></div>
              <div className="w-1/6 bg-emerald-400 rounded-t-sm transition-all hover:opacity-80" style={{ height: '75%' }}></div>
              <div className="w-1/6 bg-emerald-400 rounded-t-sm transition-all hover:opacity-80" style={{ height: '90%' }}></div>
              <div className="w-1/6 bg-emerald-400 rounded-t-sm transition-all hover:opacity-80" style={{ height: '70%' }}></div>
              <div className="w-1/6 bg-emerald-400 rounded-t-sm transition-all hover:opacity-80" style={{ height: '3%' }}></div>
              <div className="w-1/6 bg-emerald-400 rounded-t-sm transition-all hover:opacity-80" style={{ height: '4%' }}></div>
              <div className="w-1/6 bg-emerald-400 rounded-t-sm transition-all hover:opacity-80" style={{ height: '0%' }}></div>
              <div className="w-1/6 bg-emerald-400 rounded-t-sm transition-all hover:opacity-80" style={{ height: '0%' }}></div>
            </div>
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-400 dark:text-gray-500 px-4">
            <span>Nov 2025</span>
            <span>Jan 2026</span>
            <span>Mar 2026</span>
            <span>May 2026</span>
            <span>Jul 2026</span>
            <span>Sep 2026</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-800 dark:text-gray-100 mb-6 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-slate-400" /> Distribución por Plan
          </h3>
          <div className="flex-1 flex items-center justify-center gap-12">
            <div className="relative w-32 h-32 rounded-full border-[24px] border-blue-500">
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between min-w-[150px]">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> catem
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-gray-100">1 (100%)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-gray-100 mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" /> Tasa de Retención
          </h3>
          <div className="relative h-32 border-b border-l border-slate-100 dark:border-gray-700 flex items-end justify-between px-2 pb-2">
            <div className="absolute -left-8 top-0 bottom-0 flex flex-col justify-between text-[10px] text-slate-400 dark:text-gray-500 py-1">
              <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
            </div>

            <div className="w-full h-full relative">
              <div className="absolute top-[0%] left-0 w-full h-[2px] bg-purple-500"></div>
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(pos => (
                <div
                  key={pos}
                  className="absolute w-2.5 h-2.5 rounded-full bg-purple-500 border-2 border-white shadow-sm -ml-1 -mt-1"
                  style={{ left: `${pos}%`, top: `0%` }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-400 dark:text-gray-500 px-2">
            <span>Nov 2025</span>
            <span>Jan 2026</span>
            <span>Mar 2026</span>
            <span>May 2026</span>
            <span>Jul 2026</span>
            <span>Sep 2026</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm p-6">
        <h3 className="font-bold text-slate-800 dark:text-gray-100 mb-10 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" /> Socios en Riesgo de No Renovar
          <span className="text-xs font-normal text-slate-400 dark:text-gray-500 ml-1">(Próximos 30 días)</span>
        </h3>

        <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-gray-500">
          <Users className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">No hay socios en riesgo de no renovar</p>
        </div>
      </div>

    </div>
  );
};

export default MetricasPlanes;

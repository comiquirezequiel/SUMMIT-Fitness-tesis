import { Info } from 'lucide-react';

// icon: componente de lucide-react (ej. Users). Se pasa el componente y no un nombre
// para no incluir todos los íconos de la librería en el bundle.
const StatCard = ({ title, value, subtitle, icon: Icon, iconColor, iconBg }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-start shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-0.5">
      <div className="flex flex-col">
        <h3 className="text-slate-500 text-[13px] font-semibold flex items-center gap-1.5 mb-2">
          {title} <Info className="w-3.5 h-3.5 text-slate-300" />
        </h3>
        <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-2 font-medium">{subtitle}</p>}
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
        {Icon && <Icon className={`w-5 h-5 ${iconColor}`} />}
      </div>
    </div>
  );
};

export default StatCard;

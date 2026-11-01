// icon: componente de lucide-react (ej. Users). Se pasa el componente y no un nombre
// para no incluir todos los íconos de la librería en el bundle.
const StatCard = ({ title, value, subtitle, icon: Icon, iconColor, iconBg }) => {
  return (
    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 flex justify-between items-center gap-3 shadow-xs">
      <div className="flex flex-col min-w-0">
        <h3 className="text-slate-500 text-xs font-semibold truncate">{title}</h3>
        <p className="text-xl font-bold text-slate-800 tracking-tight leading-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      </div>
    </div>
  );
};

export default StatCard;

export default function KpiCard({ title, value, subtitle, icon: Icon, color = 'terracotta', clickable = false }) {
  const colorMap = {
    terracotta: 'bg-terracotta-50 text-terracotta-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-3 sm:p-5 flex items-start gap-3 sm:gap-4 h-full ${clickable ? 'hover:border-terracotta-500 hover:shadow-sm transition-all cursor-pointer' : ''}`}>
      <div className={`p-2 sm:p-3 rounded-lg ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1 truncate">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function InsightSection({ icon: Icon, title, count, color, children }) {
  const colorMap = {
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    terracotta: 'bg-terracotta-50 text-terracotta-600 border-terracotta-200',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className={`p-2 rounded-lg border ${colorMap[color]}`}>
          <Icon size={18} />
        </div>
        <h2 className="text-base font-semibold text-gray-900 flex-1">{title}</h2>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

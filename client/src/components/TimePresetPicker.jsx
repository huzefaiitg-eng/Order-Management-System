/**
 * TimePresetPicker
 * ----------------
 * Preset time-range picker used inside CardFilterModal.
 * Supports: All Time, Today, Yesterday, Last 7 Days, Last 30 Days, Custom.
 *
 * Props:
 *   preset      — current preset key
 *   customRange — { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 *   onChange    — ({ preset, customRange }) => void
 */

const PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom' },
];

export default function TimePresetPicker({ preset = 'all', customRange = { startDate: '', endDate: '' }, onChange }) {
  function handlePreset(key) {
    onChange?.({ preset: key, customRange });
  }
  function handleRangeField(field, value) {
    onChange?.({ preset: 'custom', customRange: { ...customRange, [field]: value } });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handlePreset(key)}
            className={`px-2.5 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors ${
              preset === key
                ? 'bg-terracotta-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">From</label>
            <input
              type="date"
              value={customRange.startDate}
              onChange={e => handleRangeField('startDate', e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">To</label>
            <input
              type="date"
              value={customRange.endDate}
              min={customRange.startDate || undefined}
              onChange={e => handleRangeField('endDate', e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

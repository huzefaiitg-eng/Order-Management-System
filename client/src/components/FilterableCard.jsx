import { SlidersHorizontal, X } from 'lucide-react';

/**
 * FilterableCard
 * --------------
 * Presentational wrapper for dashboard cards with per-card filters.
 * Renders a card shell with a header row (icon + title + filter button) and
 * a chip row for active filters. Body content goes in `children`.
 *
 * Props:
 *   title         — card title string
 *   icon          — lucide-react icon component
 *   iconBg        — tailwind classes for the icon wrapper (bg + text color)
 *   activeChips   — array of { key, label, color, onRemove } where color is
 *                   one of: 'terracotta' | 'blue' | 'amber'
 *   filterCount   — number shown as badge on the filter button
 *   onOpenFilters — click handler for the filter button
 *   headerExtra   — optional additional element rendered between chips and body
 *   children      — body content (charts, KPIs, etc.)
 */

const CHIP_CLASSES = {
  terracotta: 'bg-terracotta-50 text-terracotta-700 border-terracotta-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function FilterableCard({
  title,
  icon: Icon,
  iconBg,
  activeChips = [],
  filterCount = 0,
  onOpenFilters,
  headerExtra,
  children,
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div className={`p-1.5 rounded-lg ${iconBg || 'bg-gray-50 text-gray-600'}`}>
              <Icon size={15} className="opacity-80" />
            </div>
          )}
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide truncate">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onOpenFilters}
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
        >
          <SlidersHorizontal size={13} />
          <span className="hidden sm:inline">Filters</span>
          {filterCount > 0 && (
            <span className="bg-terracotta-600 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active chips row */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {activeChips.map(chip => (
            <span
              key={chip.key}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full font-medium border ${CHIP_CLASSES[chip.color] || CHIP_CLASSES.terracotta}`}
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="hover:opacity-70"
                aria-label={`Remove ${chip.label}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {headerExtra}

      <div className="h-px bg-gray-100 mb-3" />

      {/* Body */}
      {children}
    </div>
  );
}

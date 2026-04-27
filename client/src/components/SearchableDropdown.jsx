import { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';

/**
 * SearchableDropdown
 * ------------------
 * Single-select (default) or multi-select (multi=true) searchable picker.
 *
 * Props:
 * - label            — field label (optional)
 * - placeholder      — input placeholder
 * - items            — full array of items
 * - displayFn        — (item) => string
 * - keyFn            — (item) => string/number unique key (defaults to displayFn result)
 * - onSelect         — (item) => void (single mode) or not used (multi mode)
 * - onAddNew         — optional "+ add new" handler
 * - addNewLabel      — label for add-new button
 *
 * Multi-select props (when multi={true}):
 * - multi            — boolean
 * - selected         — array of currently-selected items
 * - onChange         — (nextSelectedArray) => void
 * - chipClassName    — tailwind classes for the selected chips
 */
export default function SearchableDropdown({
  label,
  placeholder = 'Search...',
  items = [],
  displayFn,
  keyFn,
  onSelect,
  onAddNew,
  addNewLabel,
  multi = false,
  selected = [],
  onChange,
  chipClassName = 'bg-terracotta-50 text-terracotta-700',
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getKey = keyFn || displayFn;
  const selectedKeys = new Set(selected.map(getKey));

  const filtered = items.filter(item => {
    const display = displayFn(item).toLowerCase();
    if (!display.includes(search.toLowerCase())) return false;
    if (multi && selectedKeys.has(getKey(item))) return false;
    return true;
  });

  function handlePick(item) {
    if (multi) {
      onChange?.([...selected, item]);
      setSearch('');
      // Keep open so user can pick more
    } else {
      onSelect?.(item);
      setSearch(displayFn(item));
      setOpen(false);
    }
  }

  function handleRemoveChip(item) {
    onChange?.(selected.filter(s => getKey(s) !== getKey(item)));
  }

  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

      {/* Selected chips (multi mode) */}
      {multi && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((item, i) => (
            <span
              key={`${getKey(item)}-${i}`}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium ${chipClassName}`}
            >
              {displayFn(item)}
              <button
                type="button"
                onClick={() => handleRemoveChip(item)}
                className="hover:opacity-70"
                aria-label={`Remove ${displayFn(item)}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 pr-8"
        />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col max-h-48">
          {/* Scrollable list */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {filtered.map((item, i) => (
              <button
                key={`${getKey(item)}-${i}`}
                type="button"
                onClick={() => handlePick(item)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-terracotta-50 transition-colors"
              >
                {displayFn(item)}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">
                {multi && selected.length > 0 && items.length === selected.length
                  ? 'All items selected'
                  : 'No results'}
              </p>
            )}
          </div>

          {/* Sticky "Add New" footer */}
          {onAddNew && (
            <div className="border-t border-gray-100 px-3 py-2.5 flex items-center justify-between bg-white shrink-0 rounded-b-lg">
              <span className="text-xs text-gray-400">Not able to find your {addNewLabel}?</span>
              <button
                type="button"
                onClick={() => {
                  onAddNew();
                  setOpen(false);
                }}
                className="text-sm text-terracotta-600 font-semibold hover:underline ml-2 shrink-0"
              >
                Add New
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

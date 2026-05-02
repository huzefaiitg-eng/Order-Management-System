import { Phone, Mail, X } from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';

/**
 * CustomerSelector
 * ----------------
 * Two-state customer picker matching the inventory picker pattern in
 * ProductLineEditor: when nothing is selected, a SearchableDropdown shows;
 * once a customer is picked, the dropdown is replaced by a "selected card"
 * with a Change button.
 *
 * Props:
 *   customers           — array of customer objects (passed to dropdown)
 *   selected            — { customerName, customerPhone, customerEmail?, customerAddress? } or null
 *   onSelect(customer)  — called when an item is picked from the dropdown
 *   onClear()           — called when the user hits "Change"
 *   onAddNew()          — called when the dropdown's "Add New" footer is clicked
 *   placeholder         — search input placeholder
 */
export default function CustomerSelector({
  customers = [],
  selected = null,
  onSelect,
  onClear,
  onAddNew,
  placeholder = 'Search by name or phone...',
}) {
  if (selected && selected.customerName) {
    return (
      <div className="flex items-start gap-2.5 bg-white rounded-lg border border-gray-300 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{selected.customerName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
            {selected.customerPhone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={11} className="shrink-0" /> {selected.customerPhone}
              </span>
            )}
            {selected.customerEmail && (
              <span className="inline-flex items-center gap-1 truncate max-w-[18rem]">
                <Mail size={11} className="shrink-0" />
                <span className="truncate">{selected.customerEmail}</span>
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-gray-400 hover:text-terracotta-700 hover:bg-terracotta-50 p-1 rounded transition-colors"
          title="Change customer"
          aria-label="Change customer"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <SearchableDropdown
      label=""
      placeholder={placeholder}
      items={customers}
      displayFn={c => `${c.customerName} — ${c.customerPhone}`}
      keyFn={c => c.customerPhone}
      onSelect={onSelect}
      onAddNew={onAddNew}
      addNewLabel="customer"
    />
  );
}

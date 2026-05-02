import { Trash2, Plus, Package, Pencil, X } from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';
import NumberField from './NumberField';
import { formatCurrency } from '../utils/formatters';

/**
 * ProductLineEditor
 * -----------------
 * Reusable multi-line product editor used by Add Order and Add Lead.
 *
 * Each line shape:
 *   { productName, productCost, sellingPrice, quantity, articleId }
 *
 * Props:
 *   lines                 — array of product lines
 *   onChange(nextLines)   — setter for the array
 *   inventory             — array of active inventory products (from fetchInventory)
 *   hasInventoryAccess    — boolean. When false, the From-Inventory toggle is hidden
 *                           and every line is forced into Custom mode.
 *   sellingPriceLocked    — boolean. When true, the selling-price input is read-only
 *                           for inventory lines (orders use this — selling price is
 *                           the inventory's price). Defaults to false (leads).
 */
export default function ProductLineEditor({
  lines,
  onChange,
  inventory = [],
  hasInventoryAccess = true,
  sellingPriceLocked = false,
}) {
  const safeLines = Array.isArray(lines) && lines.length > 0
    ? lines
    : [emptyLine()];

  function emptyLine() {
    return { productName: '', productCost: 0, sellingPrice: 0, quantity: 1, articleId: '' };
  }

  function updateLine(idx, patch) {
    const next = safeLines.map((l, i) => i === idx ? { ...l, ...patch } : l);
    onChange(next);
  }

  function removeLine(idx) {
    if (safeLines.length === 1) {
      // Don't remove the last line — just clear it
      onChange([emptyLine()]);
      return;
    }
    onChange(safeLines.filter((_, i) => i !== idx));
  }

  function addLine() {
    onChange([...safeLines, emptyLine()]);
  }

  function setMode(idx, mode) {
    // mode === 'inventory' or 'custom'
    if (mode === 'custom') {
      // Clear articleId — line becomes free-form
      updateLine(idx, { articleId: '', productName: '', productCost: 0, sellingPrice: 0 });
    } else {
      // Mark for inventory selection — keep qty, clear name/cost/price/articleId
      updateLine(idx, { articleId: '', productName: '', productCost: 0, sellingPrice: 0 });
    }
  }

  function pickInventoryProduct(idx, product) {
    updateLine(idx, {
      articleId: product.articleId,
      productName: product.productName,
      productCost: Number(product.productCost) || 0,
      sellingPrice: Number(product.sellingPrice) || Number(product.productCost) || 0,
    });
  }

  return (
    <div className="space-y-3">
      {safeLines.map((line, idx) => {
        // No inventory access → force custom. Otherwise honor the line's _mode flag,
        // defaulting to 'inventory' when neither is set (so new lines start in inventory mode).
        const isCustom = !hasInventoryAccess || line._mode === 'custom';
        const isInventory = !isCustom;
        const lineTotal = (Number(line.sellingPrice) || 0) * (Number(line.quantity) || 1);

        return (
          <div key={idx} className="border border-gray-200 rounded-xl bg-gray-50/40 p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Product {idx + 1}
              </span>
              {safeLines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                  title="Remove this line"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            {/* Mode toggle (only when inventory access is enabled) */}
            {hasInventoryAccess && (
              <ModeToggle
                value={isInventory ? 'inventory' : 'custom'}
                onChange={(mode) => updateLine(idx, { _mode: mode, articleId: '', productName: '', productCost: 0, sellingPrice: 0 })}
              />
            )}

            {/* Body — Inventory mode */}
            {isInventory ? (
              <InventoryLineFields
                line={line}
                inventory={inventory}
                onPickProduct={(p) => pickInventoryProduct(idx, p)}
                onUpdate={(patch) => updateLine(idx, patch)}
                sellingPriceLocked={sellingPriceLocked}
              />
            ) : (
              <CustomLineFields
                line={line}
                onUpdate={(patch) => updateLine(idx, patch)}
              />
            )}

            {/* Footer — line subtotal */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                {line.quantity || 0} × {formatCurrency(line.sellingPrice || 0)}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(lineTotal)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Add line button */}
      <button
        type="button"
        onClick={addLine}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm border border-dashed border-gray-300 rounded-xl text-gray-600 hover:bg-white hover:border-terracotta-400 hover:text-terracotta-700 transition-colors"
      >
        <Plus size={15} /> Add Another Product
      </button>
    </div>
  );
}

// ── Mode toggle ───────────────────────────────────────────────────────

function ModeToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-white border border-gray-200 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange('inventory')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
          value === 'inventory' ? 'bg-terracotta-600 text-white' : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Package size={13} /> From Inventory
      </button>
      <button
        type="button"
        onClick={() => onChange('custom')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
          value === 'custom' ? 'bg-terracotta-600 text-white' : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Pencil size={13} /> Custom
      </button>
    </div>
  );
}

// ── Inventory line fields ─────────────────────────────────────────────

function InventoryLineFields({ line, inventory, onPickProduct, onUpdate, sellingPriceLocked }) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
        {!line.articleId ? (
          <SearchableDropdown
            placeholder="Search inventory product..."
            items={inventory}
            displayFn={p => `${p.productName} (${p.articleId})`}
            keyFn={p => p.articleId}
            onSelect={onPickProduct}
            addNewLabel="product"
            // No onAddNew here — add new products from the Inventory page
          />
        ) : (
          // Selected card — name + article ID + cost shown inline; X icon clears
          // the selection and re-opens the search.
          <div className="flex items-start gap-2.5 bg-white rounded-lg border border-gray-300 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{line.productName}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                {line.articleId} · Cost {formatCurrency(line.productCost)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdate({ articleId: '', productName: '', productCost: 0, sellingPrice: 0 })}
              className="shrink-0 text-gray-400 hover:text-terracotta-700 hover:bg-terracotta-50 p-1 rounded transition-colors"
              title="Change product"
              aria-label="Change product"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Selling Price + Qty on a 2-col row — gives the qty stepper plenty of room on mobile. */}
      {line.articleId && (
        <div className="grid grid-cols-2 gap-2.5">
          <NumberField
            label="Selling Price"
            value={line.sellingPrice}
            onChange={(v) => onUpdate({ sellingPrice: v })}
            readOnly={sellingPriceLocked}
          />
          <NumberField
            label="Qty"
            value={line.quantity || 1}
            onChange={(v) => onUpdate({ quantity: Math.max(1, v || 1) })}
            min={1}
            integer
            stepper
          />
        </div>
      )}
    </div>
  );
}

// ── Custom line fields ────────────────────────────────────────────────

function CustomLineFields({ line, onUpdate }) {
  return (
    <div className="space-y-2.5">
      {/* Row 1: Name + Cost. Stacks to one column on mobile so the inputs
          don't shrink past usable width. */}
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-2.5">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Product Name</label>
          <input
            type="text"
            value={line.productName}
            onChange={e => onUpdate({ productName: e.target.value })}
            placeholder="e.g. Adidas Casual Sneaker"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 bg-white"
          />
        </div>
        <NumberField
          label="Your Cost"
          value={line.productCost}
          onChange={(v) => onUpdate({ productCost: v })}
        />
      </div>

      {/* Row 2: Selling Price + Qty — same 2-col rhythm as inventory mode. */}
      <div className="grid grid-cols-2 gap-2.5">
        <NumberField
          label="Selling Price"
          value={line.sellingPrice}
          onChange={(v) => onUpdate({ sellingPrice: v })}
        />
        <NumberField
          label="Qty"
          value={line.quantity || 1}
          onChange={(v) => onUpdate({ quantity: Math.max(1, v || 1) })}
          min={1}
          integer
          stepper
        />
      </div>
    </div>
  );
}

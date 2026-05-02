import { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * NumberField
 * -----------
 * Drop-in replacement for `<input type="number">` that solves the
 * "can't delete the leading zero" problem. Internally stores a string
 * draft so the user can fully clear and re-type the field; emits a
 * number to the parent via `onChange`.
 *
 * Props:
 *   value         — number (current committed value)
 *   onChange(n)   — emits a number whenever the parsed draft is valid
 *   label         — optional small label above the input
 *   placeholder   — optional placeholder text (defaults vary by mode)
 *   min           — minimum value (default 0; used for stepper clamping)
 *   max           — maximum value (optional)
 *   integer       — true → only whole numbers (rounded on commit)
 *   stepper       — true → render − / + buttons on either side of the input
 *   readOnly      — display only
 *   className     — passthrough for the wrapper div
 *   inputClassName — passthrough for the <input> element
 *
 * Display rule:
 *   - When `value === 0` AND the user hasn't typed (draft empty) → input
 *     shows '' so the placeholder is visible. No more frustrated backspacing.
 *   - Otherwise the input mirrors the current value (or in-flight draft
 *     while the user is typing).
 */
export default function NumberField({
  value,
  onChange,
  label,
  placeholder,
  min = 0,
  max,
  integer = false,
  stepper = false,
  readOnly = false,
  className = '',
  inputClassName = '',
}) {
  // String draft — what the input element actually shows.
  const [draft, setDraft] = useState(() => (value === 0 || value == null ? '' : String(value)));

  // Re-sync draft if the parent updates `value` from outside (e.g. picking
  // an inventory product that fills cost/price). Skip the sync when the
  // current draft already represents the same number — avoids stomping on
  // in-flight typing.
  useEffect(() => {
    const num = draft === '' ? 0 : parseFloat(draft);
    if (Number.isNaN(num) || num !== value) {
      setDraft(value === 0 || value == null ? '' : String(value));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(raw) {
    if (raw === '' || raw === '-' || raw === '.') {
      onChange(0);
      return;
    }
    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    let next = parsed;
    if (typeof min === 'number' && next < min) next = min;
    if (typeof max === 'number' && next > max) next = max;
    onChange(next);
  }

  function handleChange(e) {
    const raw = e.target.value;
    // Allow only digits, optional decimal point (when not integer mode),
    // and an optional leading minus (when min < 0). Anything else is dropped.
    const allowDecimal = !integer;
    const allowNegative = typeof min === 'number' ? min < 0 : true;
    const re = allowNegative
      ? (allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/)
      : (allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/);
    if (raw !== '' && !re.test(raw)) return;
    setDraft(raw);
    commit(raw);
  }

  function handleBlur() {
    // Normalize: if draft is empty/invalid, snap to 0 and clear the draft so
    // the placeholder shows again. If draft is something like '12.' or '.5',
    // re-render the parsed value cleanly.
    if (draft === '' || draft === '-' || draft === '.') {
      setDraft('');
      onChange(0);
      return;
    }
    const parsed = integer ? parseInt(draft, 10) : parseFloat(draft);
    if (Number.isNaN(parsed)) {
      setDraft('');
      onChange(0);
      return;
    }
    let next = parsed;
    if (typeof min === 'number' && next < min) next = min;
    if (typeof max === 'number' && next > max) next = max;
    setDraft(next === 0 ? '' : String(next));
    onChange(next);
  }

  function bump(delta) {
    if (readOnly) return;
    let next = (typeof value === 'number' ? value : 0) + delta;
    if (typeof min === 'number' && next < min) next = min;
    if (typeof max === 'number' && next > max) next = max;
    onChange(integer ? Math.round(next) : next);
  }

  const baseInputClasses = `w-full px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-terracotta-500 ${
    readOnly ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-white border-gray-300'
  }`;

  if (stepper) {
    return (
      <div className={className}>
        {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
        <div className="flex items-stretch rounded-lg border border-gray-300 overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => bump(-1)}
            disabled={readOnly || value <= min}
            tabIndex={-1}
            className="px-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white border-r border-gray-300"
            aria-label="Decrease"
          >
            <Minus size={14} />
          </button>
          <input
            type="text"
            inputMode={integer ? 'numeric' : 'decimal'}
            value={draft}
            placeholder={placeholder ?? '0'}
            onChange={handleChange}
            onBlur={handleBlur}
            readOnly={readOnly}
            className={`${baseInputClasses} border-0 text-center flex-1 ${inputClassName}`}
          />
          <button
            type="button"
            onClick={() => bump(1)}
            disabled={readOnly || (typeof max === 'number' && value >= max)}
            tabIndex={-1}
            className="px-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white border-l border-gray-300"
            aria-label="Increase"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        value={draft}
        placeholder={placeholder ?? (integer ? '0' : '0.00')}
        onChange={handleChange}
        onBlur={handleBlur}
        readOnly={readOnly}
        className={`${baseInputClasses} rounded-lg ${inputClassName}`}
      />
    </div>
  );
}

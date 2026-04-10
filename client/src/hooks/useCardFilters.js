import { useState, useCallback, useMemo } from 'react';
import { countActiveFilters } from '../utils/dashboardAggregations';

const EMPTY = {
  timePreset: 'all',
  customRange: { startDate: '', endDate: '' },
  sources: [],
  customers: [],       // array of { customerName, customerPhone }
  products: [],        // array of { productName, articleId }
};

/**
 * useCardFilters
 * --------------
 * Two-tier (pending vs applied) filter state for a single dashboard card.
 *
 * Each card owns its own instance of this hook, giving per-card independence.
 *
 * Usage:
 *   const f = useCardFilters();
 *   f.openModal();              // copies applied → pending, opens modal
 *   f.setPending({...});        // user edits in modal
 *   f.apply();                  // commits pending → applied, closes modal
 *   f.clearAll();               // wipes pending (doesn't affect applied until apply())
 *   f.removeChip('source', 'Amazon'); // removes a single dimension from applied
 *   f.applied                   // read applied filters (for aggregation)
 *   f.activeCount               // number of active filter dimensions (for badge)
 *
 * The "applied" shape is:
 *   { timePreset, customRange, sources[], customers[], products[] }
 *
 * Note that `customers` and `products` store the full item objects; callers
 * derive the phone/name arrays for `filterOrders()` separately.
 */
export function useCardFilters() {
  const [applied, setApplied] = useState(EMPTY);
  const [pending, setPending] = useState(EMPTY);
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => {
    setPending(applied);
    setIsOpen(true);
  }, [applied]);

  const closeModal = useCallback(() => setIsOpen(false), []);

  const apply = useCallback(() => {
    setApplied(pending);
    setIsOpen(false);
  }, [pending]);

  const clearAll = useCallback(() => {
    setPending(EMPTY);
  }, []);

  const removeChip = useCallback((type, key) => {
    setApplied(prev => {
      switch (type) {
        case 'time':
          return { ...prev, timePreset: 'all', customRange: { startDate: '', endDate: '' } };
        case 'source':
          return { ...prev, sources: prev.sources.filter(s => s !== key) };
        case 'customer':
          return { ...prev, customers: prev.customers.filter(c => c.customerPhone !== key) };
        case 'product':
          return { ...prev, products: prev.products.filter(p => p.productName !== key) };
        default:
          return prev;
      }
    });
  }, []);

  // Derived: the shape expected by dashboardAggregations.filterOrders()
  const filterQuery = useMemo(() => ({
    timePreset: applied.timePreset,
    customRange: applied.customRange,
    sources: applied.sources,
    customerPhones: applied.customers.map(c => c.customerPhone),
    productNames: applied.products.map(p => p.productName),
  }), [applied]);

  const activeCount = useMemo(() => countActiveFilters({
    timePreset: applied.timePreset,
    sources: applied.sources,
    customerPhones: applied.customers.map(c => c.customerPhone),
    productNames: applied.products.map(p => p.productName),
  }), [applied]);

  return {
    applied,
    pending,
    setPending,
    isOpen,
    openModal,
    closeModal,
    apply,
    clearAll,
    removeChip,
    filterQuery,
    activeCount,
  };
}

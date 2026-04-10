import { useState, useEffect, useCallback } from 'react';
import { fetchDashboard } from '../services/api';

/**
 * Fetches the dashboard raw payload (orders + customer/inventory KPIs) once
 * on mount. Per-card filtering happens client-side in Dashboard.jsx via
 * `dashboardAggregations.js`, so this hook takes no arguments.
 */
export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchDashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}

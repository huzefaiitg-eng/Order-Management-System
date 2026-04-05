import { useState, useEffect } from 'react';
import { fetchDashboard } from '../services/api';

export function useDashboard(filters = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDashboard(filters)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  return { data, loading, error };
}

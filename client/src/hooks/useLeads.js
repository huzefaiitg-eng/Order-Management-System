import { useState, useEffect, useCallback } from 'react';
import { fetchLeads } from '../services/api';

export function useLeads(filters = {}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filterKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLeads(filters);
      setLeads(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return { leads, loading, error, refetch: load, setLeads };
}

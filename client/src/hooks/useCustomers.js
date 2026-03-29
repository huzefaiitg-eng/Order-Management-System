import { useState, useEffect, useCallback } from 'react';
import { fetchCustomers } from '../services/api';

export function useCustomers(search = '', status = 'Active') {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCustomers(search, status);
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { load(); }, [load]);

  return { customers, loading, error, refresh: load };
}

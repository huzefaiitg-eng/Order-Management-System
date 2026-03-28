const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'API request failed');
  return data.data;
}

export function fetchOrders(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  const query = params.toString();
  return request(`/orders${query ? `?${query}` : ''}`);
}

export function updateOrderStatus(rowIndex, status) {
  return request(`/orders/${rowIndex}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function fetchDashboard() {
  return request('/dashboard');
}

export function fetchInsights() {
  return request('/insights');
}

export function fetchCustomers(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/customers${query}`);
}

export function fetchCustomerByPhone(phone) {
  return request(`/customers/${encodeURIComponent(phone)}`);
}

export function fetchInventory(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  const query = params.toString();
  return request(`/inventory${query ? `?${query}` : ''}`);
}

export function fetchInventorySummary() {
  return request('/inventory/summary');
}

export function fetchProductByArticleId(articleId) {
  return request(`/inventory/${encodeURIComponent(articleId)}`);
}

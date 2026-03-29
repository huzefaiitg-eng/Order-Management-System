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

export function fetchCustomers(search = '', status = 'Active') {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  const query = params.toString();
  return request(`/customers${query ? `?${query}` : ''}`);
}

export function fetchCustomerByPhone(phone) {
  return request(`/customers/${encodeURIComponent(phone)}`);
}

export function fetchInventory(filters = {}) {
  const params = new URLSearchParams();
  const withDefaults = { status: 'Active', ...filters };
  Object.entries(withDefaults).forEach(([key, value]) => {
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

export function addCustomer(customerData) {
  return request('/customers', {
    method: 'POST',
    body: JSON.stringify(customerData),
  });
}

export function updateCustomer(phone, updates) {
  return request(`/customers/${encodeURIComponent(phone)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function addProduct(productData) {
  return request('/inventory', {
    method: 'POST',
    body: JSON.stringify(productData),
  });
}

export function updateProduct(articleId, updates) {
  return request(`/inventory/${encodeURIComponent(articleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function archiveCustomer(phone) {
  return request(`/customers/${encodeURIComponent(phone)}/archive`, { method: 'PATCH' });
}

export function unarchiveCustomer(phone) {
  return request(`/customers/${encodeURIComponent(phone)}/unarchive`, { method: 'PATCH' });
}

export function deleteCustomer(phone) {
  return request(`/customers/${encodeURIComponent(phone)}`, { method: 'DELETE' });
}

export function archiveProduct(articleId) {
  return request(`/inventory/${encodeURIComponent(articleId)}/archive`, { method: 'PATCH' });
}

export function unarchiveProduct(articleId) {
  return request(`/inventory/${encodeURIComponent(articleId)}/unarchive`, { method: 'PATCH' });
}

export function deleteProduct(articleId) {
  return request(`/inventory/${encodeURIComponent(articleId)}`, { method: 'DELETE' });
}

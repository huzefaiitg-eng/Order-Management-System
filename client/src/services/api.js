const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const TOKEN_KEY = 'oms_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
  } catch (err) {
    throw new Error('Network error: could not reach the server');
  }

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    throw new Error('Session expired. Please log in again.');
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(`Server error (${res.status}): invalid response`);
  }
  if (!data.success) throw new Error(data.error || 'API request failed');
  return data.data;
}

// Auth
export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Login failed');
  localStorage.setItem(TOKEN_KEY, data.data.token);
  return data.data;
}

export function fetchProfile() {
  return request('/auth/profile');
}

export function updateProfile(updates) {
  return request('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = '/login';
}

export function isAuthenticated() {
  return !!getToken();
}

// Orders
export function fetchOrders(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, Array.isArray(value) ? value.join(',') : value);
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

export function addOrder(orderData) {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
}

export function fetchOrderAudit(rowIndex) {
  return request(`/orders/${rowIndex}/audit`);
}

// Dashboard & Insights
// Returns { orders, customerKpis, inventoryKpis }. Filtering is now client-side.
export function fetchDashboard() {
  return request('/dashboard');
}

export function fetchInsights() {
  return request('/insights');
}

// Customers
export function fetchCustomers(search = '', status = 'Active', hasActiveOrders = false) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  if (hasActiveOrders) params.append('hasActiveOrders', 'true');
  const query = params.toString();
  return request(`/customers${query ? `?${query}` : ''}`);
}

export function fetchCustomerByPhone(phone) {
  return request(`/customers/${encodeURIComponent(phone)}`);
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

export function archiveCustomer(phone) {
  return request(`/customers/${encodeURIComponent(phone)}/archive`, { method: 'PATCH' });
}

export function unarchiveCustomer(phone) {
  return request(`/customers/${encodeURIComponent(phone)}/unarchive`, { method: 'PATCH' });
}

export function deleteCustomer(phone) {
  return request(`/customers/${encodeURIComponent(phone)}`, { method: 'DELETE' });
}

// Inventory
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

export function archiveProduct(articleId) {
  return request(`/inventory/${encodeURIComponent(articleId)}/archive`, { method: 'PATCH' });
}

export function unarchiveProduct(articleId) {
  return request(`/inventory/${encodeURIComponent(articleId)}/unarchive`, { method: 'PATCH' });
}

export function deleteProduct(articleId) {
  return request(`/inventory/${encodeURIComponent(articleId)}`, { method: 'DELETE' });
}

// Upload
export async function uploadImage(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    throw new Error('Session expired. Please log in again.');
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Upload failed');
  return data.data.url;
}

// Settings — Categories
export function fetchCategories() {
  return request('/settings/categories');
}

export function addCategorySettingApi(data) {
  return request('/settings/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteCategorySettingApi(data) {
  return request('/settings/categories', {
    method: 'DELETE',
    body: JSON.stringify(data),
  });
}

export function deleteCategoryAllApi(category) {
  return request('/settings/categories/category', {
    method: 'DELETE',
    body: JSON.stringify({ category }),
  });
}

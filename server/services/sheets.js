const { google } = require('googleapis');
const path = require('path');
const env = require('../config/env');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheetsClient = null;

async function getClient() {
  if (sheetsClient) return sheetsClient;

  let auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
  } else {
    auth = new google.auth.GoogleAuth({
      keyFile: path.resolve(env.GOOGLE_CREDENTIALS_PATH),
      scopes: SCOPES,
    });
  }

  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return sheetsClient;
}

// ── Orders ──────────────────────────────────────────────────

const COLUMN_MAP = {
  orderFrom: 0,
  orderDate: 1,
  customerName: 2,
  customerPhone: 3,
  customerAddress: 4,
  modeOfPayment: 5,
  productOrdered: 6,
  productCost: 7,
  quantityOrdered: 8,
  pricePaid: 9,
  orderStatus: 10,
};

function rowToOrder(row, rowIndex) {
  const productCost = parseFloat(row[COLUMN_MAP.productCost]) || 0;
  const pricePaid = parseFloat(row[COLUMN_MAP.pricePaid]) || 0;

  return {
    rowIndex,
    orderFrom: row[COLUMN_MAP.orderFrom] || '',
    orderDate: row[COLUMN_MAP.orderDate] || '',
    customerName: row[COLUMN_MAP.customerName] || '',
    customerPhone: row[COLUMN_MAP.customerPhone] || '',
    customerAddress: row[COLUMN_MAP.customerAddress] || '',
    modeOfPayment: row[COLUMN_MAP.modeOfPayment] || '',
    productOrdered: row[COLUMN_MAP.productOrdered] || '',
    productCost,
    quantityOrdered: parseInt(row[COLUMN_MAP.quantityOrdered]) || 1,
    pricePaid,
    orderStatus: row[COLUMN_MAP.orderStatus] || '',
    profit: pricePaid - productCost,
  };
}

async function getAllOrders() {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: 'Orders!A2:K',
  });

  const rows = response.data.values || [];
  return rows.map((row, i) => rowToOrder(row, i + 2));
}

async function updateOrderStatus(rowIndex, newStatus) {
  const sheets = await getClient();
  const cell = `Orders!K${rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: cell,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[newStatus]],
    },
  });

  return { rowIndex, orderStatus: newStatus };
}

// ── Customers ───────────────────────────────────────────────

const CUSTOMER_COLUMN_MAP = {
  customerId: 0,
  customerName: 1,
  customerPhone: 2,
  customerEmail: 3,
  customerAddress: 4,
  numberOfOrders: 5,
  anyActiveOrder: 6,
  status: 7,
};

function rowToCustomer(row, rowIndex) {
  return {
    rowIndex,
    customerId: row[CUSTOMER_COLUMN_MAP.customerId] || '',
    customerName: row[CUSTOMER_COLUMN_MAP.customerName] || '',
    customerPhone: row[CUSTOMER_COLUMN_MAP.customerPhone] || '',
    customerAddress: row[CUSTOMER_COLUMN_MAP.customerAddress] || '',
    numberOfOrders: parseInt(row[CUSTOMER_COLUMN_MAP.numberOfOrders]) || 0,
    anyActiveOrder: row[CUSTOMER_COLUMN_MAP.anyActiveOrder] || '',
    customerEmail: row[CUSTOMER_COLUMN_MAP.customerEmail] || '',
    status: row[CUSTOMER_COLUMN_MAP.status] || 'Active',
  };
}

async function getAllCustomers() {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: 'Customers!A2:H',
  });

  const rows = response.data.values || [];
  return rows.map((row, i) => rowToCustomer(row, i + 2));
}

async function getCustomerByPhone(phone) {
  const customers = await getAllCustomers();
  return customers.find(c => c.customerPhone === phone) || null;
}

async function addCustomer({ customerName, customerPhone, customerAddress, customerEmail }) {
  const customers = await getAllCustomers();

  // Check duplicate phone
  if (customers.find(c => c.customerPhone === customerPhone)) {
    throw new Error('A customer with this phone number already exists');
  }

  // Auto-generate Customer ID
  const maxNum = customers.reduce((max, c) => {
    const num = parseInt(c.customerId.replace('CUST', '')) || 0;
    return Math.max(max, num);
  }, 0);
  const newId = `CUST${String(maxNum + 1).padStart(3, '0')}`;

  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: 'Customers!A:H',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[newId, customerName, customerPhone, customerEmail || '', customerAddress || '', 0, 'No', 'Active']],
    },
  });

  return {
    customerId: newId,
    customerName,
    customerPhone,
    customerAddress: customerAddress || '',
    customerEmail: customerEmail || '',
    numberOfOrders: 0,
    anyActiveOrder: 'No',
    status: 'Active',
  };
}

async function updateCustomer(phone, updates) {
  const customers = await getAllCustomers();
  const customer = customers.find(c => c.customerPhone === phone);
  if (!customer) throw new Error('Customer not found');

  const sheets = await getClient();
  const rowIdx = customer.rowIndex;

  const data = [];
  if (updates.customerName !== undefined) data.push({ range: `Customers!B${rowIdx}`, values: [[updates.customerName]] });
  if (updates.customerPhone !== undefined) data.push({ range: `Customers!C${rowIdx}`, values: [[updates.customerPhone]] });
  if (updates.customerEmail !== undefined) data.push({ range: `Customers!D${rowIdx}`, values: [[updates.customerEmail]] });
  if (updates.customerAddress !== undefined) data.push({ range: `Customers!E${rowIdx}`, values: [[updates.customerAddress]] });

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.GOOGLE_SHEET_ID,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }

  return { ...customer, ...updates };
}

// ── Inventory ───────────────────────────────────────────────

const INVENTORY_COLUMN_MAP = {
  articleId: 0,
  productName: 1,
  productDescription: 2,
  category: 3,
  subCategory: 4,
  productImages: 5,
  productCost: 6,
  instockQuantity: 7,
  quantityInActiveOrders: 8,
  status: 9,
};

function rowToProduct(row, rowIndex) {
  const instockQuantity = parseInt(row[INVENTORY_COLUMN_MAP.instockQuantity]) || 0;
  const quantityInActiveOrders = parseInt(row[INVENTORY_COLUMN_MAP.quantityInActiveOrders]) || 0;

  return {
    rowIndex,
    articleId: row[INVENTORY_COLUMN_MAP.articleId] || '',
    productName: row[INVENTORY_COLUMN_MAP.productName] || '',
    productDescription: row[INVENTORY_COLUMN_MAP.productDescription] || '',
    category: row[INVENTORY_COLUMN_MAP.category] || '',
    subCategory: row[INVENTORY_COLUMN_MAP.subCategory] || '',
    productImages: row[INVENTORY_COLUMN_MAP.productImages] || '',
    productCost: parseFloat(row[INVENTORY_COLUMN_MAP.productCost]) || 0,
    instockQuantity,
    quantityInActiveOrders,
    availableQuantity: instockQuantity - quantityInActiveOrders,
    status: row[INVENTORY_COLUMN_MAP.status] || 'Active',
  };
}

async function getAllInventory() {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: 'Inventory!A2:J',
  });

  const rows = response.data.values || [];
  return rows.map((row, i) => rowToProduct(row, i + 2));
}

async function getProductByArticleId(articleId) {
  const products = await getAllInventory();
  return products.find(p => p.articleId === articleId) || null;
}

async function addProduct({ productName, productDescription, category, subCategory, productImages, productCost, instockQuantity }) {
  const products = await getAllInventory();

  // Auto-generate Article ID
  const maxNum = products.reduce((max, p) => {
    const num = parseInt(p.articleId.replace('ART-', '')) || 0;
    return Math.max(max, num);
  }, 0);
  const newId = `ART-${String(maxNum + 1).padStart(3, '0')}`;

  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: 'Inventory!A:J',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[newId, productName, productDescription || '', category, subCategory, productImages || '', productCost, instockQuantity, 0, 'Active']],
    },
  });

  return {
    articleId: newId,
    productName,
    productDescription: productDescription || '',
    category,
    subCategory,
    productImages: productImages || '',
    productCost,
    instockQuantity,
    quantityInActiveOrders: 0,
    availableQuantity: instockQuantity,
    status: 'Active',
  };
}

async function updateProduct(articleId, updates) {
  const products = await getAllInventory();
  const product = products.find(p => p.articleId === articleId);
  if (!product) throw new Error('Product not found');

  const sheets = await getClient();
  const rowIdx = product.rowIndex;

  const data = [];
  if (updates.productName !== undefined) data.push({ range: `Inventory!B${rowIdx}`, values: [[updates.productName]] });
  if (updates.productDescription !== undefined) data.push({ range: `Inventory!C${rowIdx}`, values: [[updates.productDescription]] });
  if (updates.category !== undefined) data.push({ range: `Inventory!D${rowIdx}`, values: [[updates.category]] });
  if (updates.subCategory !== undefined) data.push({ range: `Inventory!E${rowIdx}`, values: [[updates.subCategory]] });
  if (updates.productCost !== undefined) data.push({ range: `Inventory!G${rowIdx}`, values: [[updates.productCost]] });
  if (updates.instockQuantity !== undefined) data.push({ range: `Inventory!H${rowIdx}`, values: [[updates.instockQuantity]] });

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.GOOGLE_SHEET_ID,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }

  return { ...product, ...updates };
}

async function addOrder({ orderFrom, orderDate, customerName, customerPhone, customerAddress, modeOfPayment, productOrdered, productCost, quantityOrdered, pricePaid }) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: 'Orders!A:K',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[orderFrom, orderDate, customerName, customerPhone, customerAddress || '', modeOfPayment, productOrdered, productCost, quantityOrdered || 1, pricePaid, 'Pending']],
    },
  });

  // Extract row index from updatedRange (e.g. "Orders!A15:K15" → 15)
  const updatedRange = response.data.updates.updatedRange;
  const match = updatedRange.match(/(\d+)/g);
  const newRowIndex = parseInt(match[match.length - 1]);

  return {
    rowIndex: newRowIndex,
    orderFrom,
    orderDate,
    customerName,
    customerPhone,
    customerAddress: customerAddress || '',
    modeOfPayment,
    productOrdered,
    productCost: parseFloat(productCost) || 0,
    quantityOrdered: parseInt(quantityOrdered) || 1,
    pricePaid: parseFloat(pricePaid) || 0,
    orderStatus: 'Pending',
    profit: (parseFloat(pricePaid) || 0) - (parseFloat(productCost) || 0),
  };
}

async function getOrderStatus(rowIndex) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `Orders!K${rowIndex}`,
  });
  const values = response.data.values;
  return values && values[0] ? values[0][0] : '';
}

// ── Audit ───────────────────────────────────────────────────

async function addAuditEntry({ orderRowIndex, previousStatus, newStatus }) {
  const changedAt = new Date().toISOString();
  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: "'Audit History'!A:D",
    valueInputOption: 'RAW',
    requestBody: {
      values: [[String(orderRowIndex), previousStatus, newStatus, changedAt]],
    },
  });
  return { orderRowIndex, previousStatus, newStatus, changedAt };
}

async function getAuditHistory(orderRowIndex) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: "'Audit History'!A2:D",
  });

  const rows = response.data.values || [];
  return rows
    .filter(row => row[0] === String(orderRowIndex))
    .map(row => ({
      orderRowIndex: parseInt(row[0]),
      previousStatus: row[1] || '',
      newStatus: row[2] || '',
      changedAt: row[3] || '',
    }))
    .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
}

async function getSheetNames() {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    fields: 'sheets.properties.title',
  });
  return response.data.sheets.map(s => s.properties.title);
}

async function getSheetId(sheetName) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    fields: 'sheets.properties',
  });
  const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  return sheet.properties.sheetId;
}

// ── Archive / Unarchive / Delete — Customers ─────────────────

async function archiveCustomer(phone) {
  const customers = await getAllCustomers();
  const customer = customers.find(c => c.customerPhone === phone);
  if (!customer) throw new Error('Customer not found');

  const sheets = await getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `Customers!H${customer.rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Archived']] },
  });

  return { ...customer, status: 'Archived' };
}

async function unarchiveCustomer(phone) {
  const customers = await getAllCustomers();
  const customer = customers.find(c => c.customerPhone === phone);
  if (!customer) throw new Error('Customer not found');

  const sheets = await getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `Customers!H${customer.rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Active']] },
  });

  return { ...customer, status: 'Active' };
}

async function deleteCustomer(phone) {
  const customers = await getAllCustomers();
  const customer = customers.find(c => c.customerPhone === phone);
  if (!customer) throw new Error('Customer not found');

  const sheetId = await getSheetId('Customers');
  const sheets = await getClient();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: customer.rowIndex - 1,
            endIndex: customer.rowIndex,
          },
        },
      }],
    },
  });

  return { deleted: true, phone };
}

// ── Archive / Unarchive / Delete — Inventory ─────────────────

async function archiveProduct(articleId) {
  const products = await getAllInventory();
  const product = products.find(p => p.articleId === articleId);
  if (!product) throw new Error('Product not found');

  const sheets = await getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `Inventory!J${product.rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Archived']] },
  });

  return { ...product, status: 'Archived' };
}

async function unarchiveProduct(articleId) {
  const products = await getAllInventory();
  const product = products.find(p => p.articleId === articleId);
  if (!product) throw new Error('Product not found');

  const sheets = await getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `Inventory!J${product.rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Active']] },
  });

  return { ...product, status: 'Active' };
}

async function deleteProduct(articleId) {
  const products = await getAllInventory();
  const product = products.find(p => p.articleId === articleId);
  if (!product) throw new Error('Product not found');

  const sheetId = await getSheetId('Inventory');
  const sheets = await getClient();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: product.rowIndex - 1,
            endIndex: product.rowIndex,
          },
        },
      }],
    },
  });

  return { deleted: true, articleId };
}

module.exports = {
  getAllOrders, updateOrderStatus, addOrder, getOrderStatus,
  getAllCustomers, getCustomerByPhone, addCustomer, updateCustomer,
  archiveCustomer, unarchiveCustomer, deleteCustomer,
  getAllInventory, getProductByArticleId, addProduct, updateProduct,
  archiveProduct, unarchiveProduct, deleteProduct,
  addAuditEntry, getAuditHistory,
  getSheetNames,
};

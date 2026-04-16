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
  orderNumber: 11,
  sellingPrice: 12,
  discount: 13,
};

function rowToOrder(row, rowIndex) {
  const productsRaw = (row[COLUMN_MAP.productOrdered] || '').split('|').map(s => s.trim()).filter(Boolean);
  const costsRaw = (row[COLUMN_MAP.productCost] || '0').split('|').map(s => parseFloat(s.trim()) || 0);
  const qtysRaw = (row[COLUMN_MAP.quantityOrdered] || '1').split('|').map(s => parseInt(s.trim()) || 1);
  const sellingPricesRaw = (row[COLUMN_MAP.sellingPrice] || '').split('|').map(s => parseFloat(s.trim()) || 0);
  const pricePaid = parseFloat(row[COLUMN_MAP.pricePaid]) || 0;
  const discount = parseFloat(row[COLUMN_MAP.discount]) || 0;
  const totalCost = costsRaw.reduce((sum, c, i) => sum + c * (qtysRaw[i] || 1), 0);
  const subtotal = sellingPricesRaw.some(v => v > 0)
    ? sellingPricesRaw.reduce((sum, sp, i) => sum + sp * (qtysRaw[i] || 1), 0)
    : pricePaid + discount; // backward compat for old orders

  return {
    rowIndex,
    orderFrom: row[COLUMN_MAP.orderFrom] || '',
    orderDate: row[COLUMN_MAP.orderDate] || '',
    customerName: row[COLUMN_MAP.customerName] || '',
    customerPhone: row[COLUMN_MAP.customerPhone] || '',
    customerAddress: row[COLUMN_MAP.customerAddress] || '',
    modeOfPayment: row[COLUMN_MAP.modeOfPayment] || '',
    productOrdered: row[COLUMN_MAP.productOrdered] || '',
    productCost: totalCost,
    quantityOrdered: qtysRaw.reduce((a, b) => a + b, 0),
    pricePaid,
    discount,
    subtotal,
    orderStatus: row[COLUMN_MAP.orderStatus] || '',
    orderNumber: row[COLUMN_MAP.orderNumber] || '',
    productLines: productsRaw.length > 0 ? productsRaw.map((name, i) => ({
      productName: name,
      unitCost: costsRaw[i] || 0,
      unitSellingPrice: sellingPricesRaw[i] || costsRaw[i] || 0,
      quantity: qtysRaw[i] || 1,
      lineTotal: (costsRaw[i] || 0) * (qtysRaw[i] || 1),
      sellingLineTotal: (sellingPricesRaw[i] || costsRaw[i] || 0) * (qtysRaw[i] || 1),
    })) : [{ productName: '', unitCost: 0, unitSellingPrice: 0, quantity: 1, lineTotal: 0, sellingLineTotal: 0 }],
    profit: pricePaid - totalCost,
  };
}

async function getAllOrders(sheetId) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Orders!A2:N',
  });

  const rows = response.data.values || [];
  return rows.map((row, i) => rowToOrder(row, i + 2));
}

async function updateOrderStatus(sheetId, rowIndex, newStatus) {
  const sheets = await getClient();
  const cell = `Orders!K${rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
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

async function getAllCustomers(sheetId) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Customers!A2:H',
  });

  const rows = response.data.values || [];
  return rows.map((row, i) => rowToCustomer(row, i + 2));
}

async function getCustomerByPhone(sheetId, phone) {
  const customers = await getAllCustomers(sheetId);
  return customers.find(c => c.customerPhone === phone) || null;
}

async function addCustomer(sheetId, { customerName, customerPhone, customerAddress, customerEmail }) {
  const customers = await getAllCustomers(sheetId);

  if (customers.find(c => c.customerPhone === customerPhone)) {
    throw new Error('A customer with this phone number already exists');
  }

  const maxNum = customers.reduce((max, c) => {
    const num = parseInt(c.customerId.replace('CUST', '')) || 0;
    return Math.max(max, num);
  }, 0);
  const newId = `CUST${String(maxNum + 1).padStart(3, '0')}`;

  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
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

async function updateCustomer(sheetId, phone, updates) {
  const customers = await getAllCustomers(sheetId);
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
      spreadsheetId: sheetId,
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
  sellingPrice: 7,
  instockQuantity: 8,
  quantityInActiveOrders: 9,
  status: 10,
  minStock: 11,
  maxStock: 12,
};

function rowToProduct(row, rowIndex) {
  const instockQuantity = parseInt(row[INVENTORY_COLUMN_MAP.instockQuantity]) || 0;
  const quantityInActiveOrders = parseInt(row[INVENTORY_COLUMN_MAP.quantityInActiveOrders]) || 0;
  const rawMin = row[INVENTORY_COLUMN_MAP.minStock];
  const rawMax = row[INVENTORY_COLUMN_MAP.maxStock];
  const minStock = rawMin === undefined || rawMin === '' ? 5 : parseInt(rawMin) || 0;
  const maxStock = rawMax === undefined || rawMax === '' ? 0 : parseInt(rawMax) || 0;

  return {
    rowIndex,
    articleId: row[INVENTORY_COLUMN_MAP.articleId] || '',
    productName: row[INVENTORY_COLUMN_MAP.productName] || '',
    productDescription: row[INVENTORY_COLUMN_MAP.productDescription] || '',
    category: row[INVENTORY_COLUMN_MAP.category] || '',
    subCategory: row[INVENTORY_COLUMN_MAP.subCategory] || '',
    productImages: row[INVENTORY_COLUMN_MAP.productImages] || '',
    productCost: parseFloat(row[INVENTORY_COLUMN_MAP.productCost]) || 0,
    sellingPrice: parseFloat(row[INVENTORY_COLUMN_MAP.sellingPrice]) || 0,
    instockQuantity,
    quantityInActiveOrders,
    availableQuantity: instockQuantity - quantityInActiveOrders,
    status: row[INVENTORY_COLUMN_MAP.status] || 'Active',
    minStock,
    maxStock,
  };
}

async function getAllInventory(sheetId) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Inventory!A2:M',
  });

  const rows = response.data.values || [];
  return rows.map((row, i) => rowToProduct(row, i + 2));
}

async function getProductByArticleId(sheetId, articleId) {
  const products = await getAllInventory(sheetId);
  return products.find(p => p.articleId === articleId) || null;
}

async function addProduct(sheetId, { productName, productDescription, category, subCategory, productImages, productCost, sellingPrice, instockQuantity, minStock, maxStock }) {
  const products = await getAllInventory(sheetId);

  const maxNum = products.reduce((max, p) => {
    const num = parseInt(p.articleId.replace('ART-', '')) || 0;
    return Math.max(max, num);
  }, 0);
  const newId = `ART-${String(maxNum + 1).padStart(3, '0')}`;

  const resolvedMin = minStock === undefined || minStock === '' ? 5 : parseInt(minStock) || 0;
  const resolvedMax = maxStock === undefined || maxStock === '' ? 0 : parseInt(maxStock) || 0;

  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Inventory!A:M',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[newId, productName, productDescription || '', category, subCategory, productImages || '', productCost, sellingPrice || 0, instockQuantity, 0, 'Active', resolvedMin, resolvedMax]],
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
    sellingPrice: sellingPrice || 0,
    instockQuantity,
    quantityInActiveOrders: 0,
    availableQuantity: instockQuantity,
    status: 'Active',
    minStock: resolvedMin,
    maxStock: resolvedMax,
  };
}

async function updateProduct(sheetId, articleId, updates) {
  const products = await getAllInventory(sheetId);
  const product = products.find(p => p.articleId === articleId);
  if (!product) throw new Error('Product not found');

  const sheets = await getClient();
  const rowIdx = product.rowIndex;

  const data = [];
  if (updates.productName !== undefined) data.push({ range: `Inventory!B${rowIdx}`, values: [[updates.productName]] });
  if (updates.productDescription !== undefined) data.push({ range: `Inventory!C${rowIdx}`, values: [[updates.productDescription]] });
  if (updates.category !== undefined) data.push({ range: `Inventory!D${rowIdx}`, values: [[updates.category]] });
  if (updates.subCategory !== undefined) data.push({ range: `Inventory!E${rowIdx}`, values: [[updates.subCategory]] });
  if (updates.productImages !== undefined) data.push({ range: `Inventory!F${rowIdx}`, values: [[updates.productImages]] });
  if (updates.productCost !== undefined) data.push({ range: `Inventory!G${rowIdx}`, values: [[updates.productCost]] });
  if (updates.sellingPrice !== undefined) data.push({ range: `Inventory!H${rowIdx}`, values: [[updates.sellingPrice]] });
  if (updates.instockQuantity !== undefined) data.push({ range: `Inventory!I${rowIdx}`, values: [[updates.instockQuantity]] });
  if (updates.minStock !== undefined) data.push({ range: `Inventory!L${rowIdx}`, values: [[updates.minStock]] });
  if (updates.maxStock !== undefined) data.push({ range: `Inventory!M${rowIdx}`, values: [[updates.maxStock]] });

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }

  return { ...product, ...updates };
}

async function addOrder(sheetId, { orderFrom, orderDate, customerName, customerPhone, customerAddress, modeOfPayment, productOrdered, productCost, quantityOrdered, pricePaid, sellingPrice, discount }) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const orderNumber = 'INV-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  const productStr = Array.isArray(productOrdered) ? productOrdered.join(' | ') : productOrdered;
  const costStr = Array.isArray(productCost) ? productCost.join(' | ') : String(productCost);
  const qtyStr = Array.isArray(quantityOrdered) ? quantityOrdered.join(' | ') : String(quantityOrdered);
  const sellingPriceStr = Array.isArray(sellingPrice) ? sellingPrice.join(' | ') : String(sellingPrice || 0);

  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Orders!A:N',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[orderFrom, orderDate, customerName, customerPhone, customerAddress || '', modeOfPayment, productStr, costStr, qtyStr, pricePaid, 'Pending', orderNumber, sellingPriceStr, discount || 0]],
    },
  });

  const updatedRange = response.data.updates.updatedRange;
  const match = updatedRange.match(/(\d+)/g);
  const newRowIndex = parseInt(match[match.length - 1]);

  // Parse back for response
  const productsArr = Array.isArray(productOrdered) ? productOrdered : [productOrdered];
  const costsArr = Array.isArray(productCost) ? productCost.map(Number) : [parseFloat(productCost) || 0];
  const qtysArr = Array.isArray(quantityOrdered) ? quantityOrdered.map(Number) : [parseInt(quantityOrdered) || 1];
  const sellingArr = Array.isArray(sellingPrice) ? sellingPrice.map(Number) : [parseFloat(sellingPrice) || 0];
  const totalCost = costsArr.reduce((sum, c, i) => sum + c * (qtysArr[i] || 1), 0);
  const subtotal = sellingArr.reduce((sum, sp, i) => sum + sp * (qtysArr[i] || 1), 0);
  const discountVal = parseFloat(discount) || 0;

  return {
    rowIndex: newRowIndex,
    orderFrom,
    orderDate,
    customerName,
    customerPhone,
    customerAddress: customerAddress || '',
    modeOfPayment,
    productOrdered: productStr,
    productCost: totalCost,
    quantityOrdered: qtysArr.reduce((a, b) => a + b, 0),
    pricePaid: parseFloat(pricePaid) || 0,
    discount: discountVal,
    subtotal,
    orderStatus: 'Pending',
    orderNumber,
    productLines: productsArr.map((name, i) => ({
      productName: name,
      unitCost: costsArr[i] || 0,
      unitSellingPrice: sellingArr[i] || 0,
      quantity: qtysArr[i] || 1,
      lineTotal: (costsArr[i] || 0) * (qtysArr[i] || 1),
      sellingLineTotal: (sellingArr[i] || 0) * (qtysArr[i] || 1),
    })),
    profit: (parseFloat(pricePaid) || 0) - totalCost,
  };
}

async function getOrderStatus(sheetId, rowIndex) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `Orders!K${rowIndex}`,
  });
  const values = response.data.values;
  return values && values[0] ? values[0][0] : '';
}

// ── Audit ───────────────────────────────────────────────────

async function addAuditEntry(sheetId, { orderRowIndex, previousStatus, newStatus }) {
  const changedAt = new Date().toISOString();
  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "'Audit History'!A:D",
    valueInputOption: 'RAW',
    requestBody: {
      values: [[String(orderRowIndex), previousStatus, newStatus, changedAt]],
    },
  });
  return { orderRowIndex, previousStatus, newStatus, changedAt };
}

async function getAuditHistory(sheetId, orderRowIndex) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
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

// ── Inventory Audit ─────────────────────────────────────────

async function addInventoryAuditEntry(sheetId, { articleId, productName, changeType, previousQty, newQty, reason }) {
  const delta = (parseInt(newQty) || 0) - (parseInt(previousQty) || 0);
  const changedAt = new Date().toISOString();
  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "'Inventory Audit'!A:H",
    valueInputOption: 'RAW',
    requestBody: {
      values: [[articleId, productName, changeType, String(previousQty), String(newQty), String(delta), reason || '', changedAt]],
    },
  });
  return { articleId, productName, changeType, previousQty, newQty, delta, reason: reason || '', changedAt };
}

async function getInventoryAuditHistory(sheetId, articleId) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'Inventory Audit'!A2:H",
  });

  const rows = response.data.values || [];
  return rows
    .filter(row => row[0] === articleId)
    .map(row => ({
      articleId: row[0] || '',
      productName: row[1] || '',
      changeType: row[2] || '',
      previousQty: parseInt(row[3]) || 0,
      newQty: parseInt(row[4]) || 0,
      delta: parseInt(row[5]) || 0,
      reason: row[6] || '',
      changedAt: row[7] || '',
    }))
    .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
}

async function adjustStock(sheetId, articleId, { delta, reason, changeType }) {
  const products = await getAllInventory(sheetId);
  const product = products.find(p => p.articleId === articleId);
  if (!product) throw new Error('Product not found');

  const previousQty = product.instockQuantity;
  const newQty = Math.max(0, previousQty + (parseInt(delta) || 0));

  const sheets = await getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Inventory!I${product.rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[newQty]] },
  });

  await addInventoryAuditEntry(sheetId, {
    articleId: product.articleId,
    productName: product.productName,
    changeType: changeType || 'adjust',
    previousQty,
    newQty,
    reason,
  });

  return { ...product, instockQuantity: newQty, availableQuantity: newQty - product.quantityInActiveOrders };
}

async function getOrderByRowIndex(sheetId, rowIndex) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `Orders!A${rowIndex}:N${rowIndex}`,
  });
  const row = (response.data.values || [])[0];
  if (!row) return null;
  return rowToOrder(row, rowIndex);
}

async function getSheetNames(sheetId) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties.title',
  });
  return response.data.sheets.map(s => s.properties.title);
}

async function getSheetId(sheetId, sheetName) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties',
  });
  const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  return sheet.properties.sheetId;
}

// ── Archive / Unarchive / Delete — Customers ─────────────────

async function archiveCustomer(sheetId, phone) {
  const customers = await getAllCustomers(sheetId);
  const customer = customers.find(c => c.customerPhone === phone);
  if (!customer) throw new Error('Customer not found');

  const sheets = await getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Customers!H${customer.rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Archived']] },
  });

  return { ...customer, status: 'Archived' };
}

async function unarchiveCustomer(sheetId, phone) {
  const customers = await getAllCustomers(sheetId);
  const customer = customers.find(c => c.customerPhone === phone);
  if (!customer) throw new Error('Customer not found');

  const sheets = await getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Customers!H${customer.rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Active']] },
  });

  return { ...customer, status: 'Active' };
}

async function deleteCustomer(sheetId, phone) {
  const customers = await getAllCustomers(sheetId);
  const customer = customers.find(c => c.customerPhone === phone);
  if (!customer) throw new Error('Customer not found');

  const tabSheetId = await getSheetId(sheetId, 'Customers');
  const sheets = await getClient();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: tabSheetId,
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

async function archiveProduct(sheetId, articleId) {
  const products = await getAllInventory(sheetId);
  const product = products.find(p => p.articleId === articleId);
  if (!product) throw new Error('Product not found');

  const sheets = await getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Inventory!K${product.rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Archived']] },
  });

  return { ...product, status: 'Archived' };
}

async function unarchiveProduct(sheetId, articleId) {
  const products = await getAllInventory(sheetId);
  const product = products.find(p => p.articleId === articleId);
  if (!product) throw new Error('Product not found');

  const sheets = await getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Inventory!K${product.rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Active']] },
  });

  return { ...product, status: 'Active' };
}

async function deleteProduct(sheetId, articleId) {
  const products = await getAllInventory(sheetId);
  const product = products.find(p => p.articleId === articleId);
  if (!product) throw new Error('Product not found');

  const tabSheetId = await getSheetId(sheetId, 'Inventory');
  const sheets = await getClient();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: tabSheetId,
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

// ── Settings (Categories) ──────────────────────────────────

const DEFAULT_DEMO_CATEGORIES = [
  ['Men', 'Casual Wear'], ['Men', 'Office Wear'], ['Men', 'Party Wear'],
  ['Men', 'Sports'], ['Men', 'Ethnic'], ['Men', 'Daily Wear'],
  ['Women', 'Casual Wear'], ['Women', 'Office Wear'], ['Women', 'Party Wear'],
  ['Women', 'Sports'], ['Women', 'Ethnic'], ['Women', 'Daily Wear'],
  ['Kids', 'Casual Wear'], ['Kids', 'Office Wear'], ['Kids', 'Party Wear'],
  ['Kids', 'Sports'], ['Kids', 'Ethnic'], ['Kids', 'Daily Wear'],
];

const DEFAULT_GENERIC_CATEGORIES = [
  ['Category 1', 'Sub Category 1'], ['Category 1', 'Sub Category 2'],
  ['Category 2', 'Sub Category 1'], ['Category 2', 'Sub Category 2'],
  ['Category 3', 'Sub Category 1'], ['Category 3', 'Sub Category 2'],
];

async function ensureSettingsTab(sheetId) {
  const names = await getSheetNames(sheetId);
  if (names.includes('Settings')) return;

  const sheets = await getClient();

  // Create the tab
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'Settings' } } }],
      },
    });
  } catch (err) {
    // Tab may already exist due to race condition
    if (err.message && err.message.includes('already exists')) return;
    throw err;
  }

  // Write header
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Settings!A1:B1',
    valueInputOption: 'RAW',
    requestBody: { values: [['Category', 'SubCategory']] },
  });

  // Determine defaults based on existing inventory data
  let defaults = DEFAULT_GENERIC_CATEGORIES;
  try {
    const inventory = await getAllInventory(sheetId);
    const cats = new Set(inventory.map(p => p.category));
    if (cats.has('Men') || cats.has('Women') || cats.has('Kids')) {
      defaults = DEFAULT_DEMO_CATEGORIES;
    }
  } catch { /* inventory tab might not exist yet */ }

  // Populate defaults
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Settings!A:B',
    valueInputOption: 'RAW',
    requestBody: { values: defaults },
  });
}

async function getCategories(sheetId) {
  await ensureSettingsTab(sheetId);

  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Settings!A2:B',
  });

  const rows = response.data.values || [];
  const categorySubCategories = {};

  for (const row of rows) {
    const cat = (row[0] || '').trim();
    const sub = (row[1] || '').trim();
    if (!cat) continue;
    if (!categorySubCategories[cat]) categorySubCategories[cat] = [];
    if (sub && !categorySubCategories[cat].includes(sub)) {
      categorySubCategories[cat].push(sub);
    }
  }

  return {
    categories: Object.keys(categorySubCategories),
    categorySubCategories,
  };
}

async function addCategorySetting(sheetId, { category, subCategory }) {
  await ensureSettingsTab(sheetId);

  // Check for duplicate
  const existing = await getCategories(sheetId);
  const subs = existing.categorySubCategories[category] || [];
  if (subs.includes(subCategory)) {
    throw new Error(`"${subCategory}" already exists under "${category}"`);
  }

  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Settings!A:B',
    valueInputOption: 'RAW',
    requestBody: { values: [[category, subCategory]] },
  });

  return { category, subCategory };
}

async function deleteCategorySetting(sheetId, { category, subCategory }) {
  await ensureSettingsTab(sheetId);

  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Settings!A2:B',
  });

  const rows = response.data.values || [];
  let targetRowIndex = null;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] || '').trim() === category && (rows[i][1] || '').trim() === subCategory) {
      targetRowIndex = i + 2; // +2 for header row and 0-index
      break;
    }
  }

  if (!targetRowIndex) throw new Error('Category setting not found');

  const tabSheetId = await getSheetId(sheetId, 'Settings');
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: tabSheetId,
            dimension: 'ROWS',
            startIndex: targetRowIndex - 1,
            endIndex: targetRowIndex,
          },
        },
      }],
    },
  });

  return { deleted: true, category, subCategory };
}

async function deleteCategoryAll(sheetId, category) {
  await ensureSettingsTab(sheetId);

  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Settings!A2:B',
  });

  const rows = response.data.values || [];
  // Collect row indices (1-based sheet rows) that match, in reverse order
  const rowIndicesToDelete = [];
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] || '').trim() === category) {
      rowIndicesToDelete.push(i + 2); // +2 for header + 0-index
    }
  }

  if (rowIndicesToDelete.length === 0) throw new Error('Category not found');

  const tabSheetId = await getSheetId(sheetId, 'Settings');

  // Delete from bottom to top to preserve indices
  rowIndicesToDelete.reverse();
  for (const rowIdx of rowIndicesToDelete) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: tabSheetId,
              dimension: 'ROWS',
              startIndex: rowIdx - 1,
              endIndex: rowIdx,
            },
          },
        }],
      },
    });
  }

  return { deleted: true, category };
}

module.exports = {
  getClient,
  getAllOrders, updateOrderStatus, addOrder, getOrderStatus,
  getAllCustomers, getCustomerByPhone, addCustomer, updateCustomer,
  archiveCustomer, unarchiveCustomer, deleteCustomer,
  getAllInventory, getProductByArticleId, addProduct, updateProduct,
  archiveProduct, unarchiveProduct, deleteProduct,
  addAuditEntry, getAuditHistory,
  addInventoryAuditEntry, getInventoryAuditHistory, adjustStock, getOrderByRowIndex,
  getSheetNames,
  getCategories, addCategorySetting, deleteCategorySetting, deleteCategoryAll,
};

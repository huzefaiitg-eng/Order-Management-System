const { google } = require('googleapis');
const path = require('path');
const env = require('../config/env');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheetsClient = null;

async function getClient() {
  if (sheetsClient) return sheetsClient;

  let auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    // Production: load credentials from environment variable (JSON string)
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
  } else {
    // Local development: load from file
    auth = new google.auth.GoogleAuth({
      keyFile: path.resolve(env.GOOGLE_CREDENTIALS_PATH),
      scopes: SCOPES,
    });
  }

  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return sheetsClient;
}

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
  return rows.map((row, i) => rowToOrder(row, i + 2)); // +2 because row 1 is header, sheets are 1-indexed
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

// Customers tab column map
const CUSTOMER_COLUMN_MAP = {
  customerId: 0,
  customerName: 1,
  customerPhone: 2,
  customerAddress: 3,
  numberOfOrders: 4,
  anyActiveOrder: 5,
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
  };
}

async function getAllCustomers() {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: 'Customers!A2:F',
  });

  const rows = response.data.values || [];
  return rows.map((row, i) => rowToCustomer(row, i + 2));
}

async function getCustomerByPhone(phone) {
  const customers = await getAllCustomers();
  return customers.find(c => c.customerPhone === phone) || null;
}

// Inventory tab column map
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
  };
}

async function getAllInventory() {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: 'Inventory!A2:I',
  });

  const rows = response.data.values || [];
  return rows.map((row, i) => rowToProduct(row, i + 2));
}

async function getProductByArticleId(articleId) {
  const products = await getAllInventory();
  return products.find(p => p.articleId === articleId) || null;
}

async function getSheetNames() {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    fields: 'sheets.properties.title',
  });
  return response.data.sheets.map(s => s.properties.title);
}

module.exports = { getAllOrders, updateOrderStatus, getAllCustomers, getCustomerByPhone, getAllInventory, getProductByArticleId, getSheetNames };

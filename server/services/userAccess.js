const env = require('../config/env');
const { getClient } = require('./sheets');

const USER_COLUMN_MAP = {
  name: 0,
  companyName: 1,
  email: 2,
  phone: 3,
  address: 4,
  website: 5,
  password: 6,
  orderSheetLink: 7,
  inventoryAccess: 8,   // Column I — 'Yes' (case-insensitive) = enabled, anything else = disabled
};

function rowToUser(row, rowIndex) {
  const accessRaw = String(row[USER_COLUMN_MAP.inventoryAccess] || '').trim().toLowerCase();
  return {
    rowIndex,
    name: row[USER_COLUMN_MAP.name] || '',
    companyName: row[USER_COLUMN_MAP.companyName] || '',
    email: row[USER_COLUMN_MAP.email] || '',
    phone: row[USER_COLUMN_MAP.phone] || '',
    address: row[USER_COLUMN_MAP.address] || '',
    website: row[USER_COLUMN_MAP.website] || '',
    password: row[USER_COLUMN_MAP.password] || '',
    orderSheetLink: row[USER_COLUMN_MAP.orderSheetLink] || '',
    hasInventoryAccess: accessRaw === 'yes',
  };
}

function extractSheetId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function getUserByEmail(email) {
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.USER_ACCESS_SHEET_ID,
    range: 'Sheet1!A2:I',
  });

  const rows = response.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    const user = rowToUser(rows[i], i + 2);
    if (user.email.toLowerCase() === email.toLowerCase()) {
      return user;
    }
  }
  return null;
}

async function updateUserProfile(email, updates) {
  const user = await getUserByEmail(email);
  if (!user) throw new Error('User not found');

  const sheets = await getClient();
  const rowIdx = user.rowIndex;

  const data = [];
  if (updates.name !== undefined) data.push({ range: `Sheet1!A${rowIdx}`, values: [[updates.name]] });
  if (updates.companyName !== undefined) data.push({ range: `Sheet1!B${rowIdx}`, values: [[updates.companyName]] });
  if (updates.phone !== undefined) data.push({ range: `Sheet1!D${rowIdx}`, values: [[updates.phone]] });
  if (updates.address !== undefined) data.push({ range: `Sheet1!E${rowIdx}`, values: [[updates.address]] });
  if (updates.website !== undefined) data.push({ range: `Sheet1!F${rowIdx}`, values: [[updates.website]] });

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.USER_ACCESS_SHEET_ID,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }

  return { ...user, ...updates, password: undefined };
}

module.exports = { getUserByEmail, updateUserProfile, extractSheetId };

/**
 * One-off backfill: match existing leads' product names against inventory
 * and populate articleId + productCost + sellingPrice for matches.
 *
 * Usage:  node backfill-lead-products.js
 *
 * Requires GOOGLE_CREDENTIALS_PATH (or GOOGLE_CREDENTIALS) + USER_ACCESS_SHEET_ID
 */

require('dotenv').config();
const { google } = require('googleapis');

const USER_ACCESS_SHEET_ID = process.env.USER_ACCESS_SHEET_ID;

async function getClient() {
  const credPath = process.env.GOOGLE_CREDENTIALS_PATH;
  const credJson = process.env.GOOGLE_CREDENTIALS;
  let credentials;
  if (credJson) {
    credentials = JSON.parse(credJson);
  } else {
    credentials = require(`./${credPath || 'credentials.json'}`);
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function parseProductLines(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        return arr.map(line => ({
          productName: String(line.productName || '').trim(),
          productCost: Number(line.productCost) || 0,
          sellingPrice: Number(line.sellingPrice) || 0,
          quantity: Number(line.quantity) || 1,
          articleId: String(line.articleId || '').trim(),
        })).filter(l => l.productName);
      }
    } catch { /* fall through */ }
  }
  return s.split(',').map(n => n.trim()).filter(Boolean).map(name => ({
    productName: name, productCost: 0, sellingPrice: 0, quantity: 1, articleId: '',
  }));
}

async function run() {
  const sheets = await getClient();

  // 1. Get all users to find their sheetIds
  const usersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: USER_ACCESS_SHEET_ID,
    range: 'Sheet1!A2:I',
  });
  const userRows = usersRes.data.values || [];

  for (const uRow of userRows) {
    const email = (uRow[2] || '').trim();
    const sheetLink = (uRow[7] || '').trim();
    if (!sheetLink) continue;

    const match = sheetLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) continue;
    const sheetId = match[1];

    console.log(`\n── Processing user: ${email} (${sheetId}) ──`);

    // 2. Fetch inventory for this user
    let inventoryRows;
    try {
      const invRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Inventory!A2:J',
      });
      inventoryRows = invRes.data.values || [];
    } catch {
      console.log('  No Inventory tab, skipping.');
      continue;
    }

    const inventory = inventoryRows
      .filter(r => (r[9] || '').toLowerCase() !== 'archived')
      .map(r => ({
        articleId: (r[0] || '').trim(),
        productName: (r[1] || '').trim(),
        productCost: Number(r[6]) || 0,
        sellingPrice: Number(r[7]) || Number(r[6]) || 0,
      }));

    if (!inventory.length) {
      console.log('  No active inventory products, skipping.');
      continue;
    }

    // Build lookup by lowercase name
    const byName = new Map();
    for (const p of inventory) {
      byName.set(p.productName.toLowerCase(), p);
    }

    // 3. Fetch leads
    let leadRows;
    try {
      const leadsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Leads!A2:N',
      });
      leadRows = leadsRes.data.values || [];
    } catch {
      console.log('  No Leads tab, skipping.');
      continue;
    }

    let updatedCount = 0;
    const updates = [];

    for (let i = 0; i < leadRows.length; i++) {
      const row = leadRows[i];
      const rawProducts = (row[5] || '').trim();
      if (!rawProducts) continue;

      const lines = parseProductLines(rawProducts);
      let changed = false;

      for (const line of lines) {
        if (line.articleId) continue; // already linked to inventory
        const inv = byName.get(line.productName.toLowerCase());
        if (inv) {
          line.articleId = inv.articleId;
          line.productCost = inv.productCost;
          line.sellingPrice = inv.sellingPrice || inv.productCost;
          changed = true;
        }
      }

      if (changed) {
        const rowIdx = i + 2; // 1-based, skip header
        updates.push({
          range: `Leads!F${rowIdx}`,
          values: [[JSON.stringify(lines)]],
        });
        updatedCount++;
        console.log(`  Lead ${row[0]}: matched ${lines.filter(l => l.articleId).length}/${lines.length} products`);
      }
    }

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
      console.log(`  ✓ Updated ${updatedCount} leads.`);
    } else {
      console.log('  No leads needed updating.');
    }
  }

  console.log('\nDone.');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

/**
 * One-time migration: fix Product Cost (column H) in all Orders
 * ──────────────────────────────────────────────────────────────
 * For every order row:
 *   1. Look up each product's cost price from Inventory sheet
 *   2. Write the correct per-unit cost into column H (pipe-separated for multi-product)
 *
 * The app code already computes totalCost = Σ(unitCost × qty) so we only
 * need to store the correct per-unit cost from inventory.
 */

require('dotenv').config();
const { google } = require('googleapis');
const env = require('./config/env');

const SHEET_ID = '1p5IE2zLh0Z5uZjFlSGDiqUoGLcdxuolrt7w-Av_YcgE';

async function run() {
  /* ── Auth ─────────────────────────────────────────────── */
  const credentials = JSON.parse(
    process.env.GOOGLE_CREDENTIALS ||
      require('fs').readFileSync(env.GOOGLE_CREDENTIALS_PATH, 'utf8')
  );
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  /* ── 1. Read Inventory → productName → productCost map ── */
  const invRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Inventory!A2:K',
  });
  const invRows = invRes.data.values || [];

  // Inventory: 1=productName, 6=productCost
  const costMap = {};
  for (const row of invRows) {
    const name = (row[1] || '').trim().toLowerCase();
    if (!name) continue;
    costMap[name] = parseFloat(row[6]) || 0;
  }

  console.log(`Inventory loaded: ${Object.keys(costMap).length} products`);
  console.log('Sample costs:', Object.entries(costMap).slice(0, 5));

  /* ── 2. Read all Orders ─────────────────────────────────── */
  const ordRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Orders!A2:N',
  });
  const ordRows = ordRes.data.values || [];
  console.log(`Orders loaded: ${ordRows.length} rows`);

  // Orders: 6=productOrdered, 7=productCost (per-unit, pipe-sep), 8=quantityOrdered

  /* ── 3. Build batch updates ─────────────────────────────── */
  const batchData = [];
  let updated = 0;
  const notFound = [];

  for (let i = 0; i < ordRows.length; i++) {
    const row = ordRows[i];
    const sheetRow = i + 2;

    const products = (row[6] || '').split('|').map(s => s.trim()).filter(Boolean);
    if (products.length === 0) continue;

    // Look up each product's cost from inventory
    const unitCosts = products.map(pName => {
      const key = pName.toLowerCase();
      if (costMap[key] !== undefined) return costMap[key];
      notFound.push(pName);
      return 0;
    });

    // Write per-unit cost pipe-separated into column H
    const costStr = unitCosts.join(' | ');

    batchData.push({
      range: `Orders!H${sheetRow}`,
      values: [[costStr]],
    });
    updated++;
  }

  if (notFound.length > 0) {
    const unique = [...new Set(notFound)];
    console.warn(`\n⚠  Products not found in inventory (${unique.length}):`);
    unique.forEach(n => console.warn(`   - ${n}`));
  }

  /* ── 4. Write batch ─────────────────────────────────────── */
  if (batchData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: batchData },
    });
    console.log(`\n✅ Updated cost price for ${updated} orders`);
  } else {
    console.log('No orders to update.');
  }

  /* ── 5. Verify: print first 10 rows with computed totals ── */
  const verify = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Orders!G2:N11',
  });
  console.log('\nVerification (first 10 orders):');
  console.log('─'.repeat(90));
  (verify.data.values || []).forEach((r, i) => {
    const products = (r[0] || '').split('|').map(s => s.trim());
    const costs = (r[1] || '0').split('|').map(s => parseFloat(s.trim()) || 0);
    const qtys = (r[2] || '1').split('|').map(s => parseInt(s.trim()) || 1);
    const totalCost = costs.reduce((sum, c, j) => sum + c * (qtys[j] || 1), 0);
    const pricePaid = parseFloat(r[3]) || 0;
    const profit = pricePaid - totalCost;

    console.log(`  Row ${i + 2}: ${products.join(' + ')}`);
    console.log(`    Unit costs: [${costs.join(', ')}]  Qtys: [${qtys.join(', ')}]  Total cost: ₹${totalCost}  Price paid: ₹${pricePaid}  Profit: ₹${profit}`);
  });
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

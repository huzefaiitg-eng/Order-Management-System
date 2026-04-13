/**
 * One-time migration: generate INV-XXXX invoice numbers
 * for every order row that doesn't already have one (column L).
 */

require('dotenv').config();
const { google } = require('googleapis');
const env = require('./config/env');

const SHEET_ID = '1p5IE2zLh0Z5uZjFlSGDiqUoGLcdxuolrt7w-Av_YcgE';
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateId() {
  return 'INV-' + Array.from({ length: 4 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('');
}

async function run() {
  const credentials = JSON.parse(
    process.env.GOOGLE_CREDENTIALS ||
      require('fs').readFileSync(env.GOOGLE_CREDENTIALS_PATH, 'utf8')
  );
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Read column L (orderNumber) for all orders
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Orders!L2:L',
  });
  const existing = (res.data.values || []).map(r => (r[0] || '').trim());
  console.log(`Total order rows: ${existing.length}`);
  console.log(`Already have invoice#: ${existing.filter(Boolean).length}`);

  // Collect all existing IDs so we can guarantee uniqueness
  const usedIds = new Set(existing.filter(Boolean));

  const batchData = [];
  let generated = 0;

  for (let i = 0; i < existing.length; i++) {
    if (existing[i]) continue; // already has an invoice number

    let id;
    do { id = generateId(); } while (usedIds.has(id));
    usedIds.add(id);

    batchData.push({
      range: `Orders!L${i + 2}`,
      values: [[id]],
    });
    generated++;
  }

  if (batchData.length === 0) {
    console.log('All orders already have invoice numbers. Nothing to do.');
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'RAW', data: batchData },
  });

  console.log(`\n✅ Generated ${generated} invoice numbers`);

  // Verify first 10
  const verify = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Orders!G2:L11',
  });
  console.log('\nVerification (first 10 orders — product + invoice#):');
  (verify.data.values || []).forEach((r, i) => {
    console.log(`  Row ${i + 2}: product="${r[0]}"  invoice="${r[5] || '(empty)'}"`);
  });
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

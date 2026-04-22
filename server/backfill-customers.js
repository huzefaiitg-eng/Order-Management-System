/**
 * backfill-customers.js
 *
 * Reads every row in the Leads tab and creates a Customer record for any
 * phone number that doesn't already exist in the Customers sheet.
 *
 * Safe to run multiple times — it skips phones that are already present.
 *
 * Usage:
 *   cd server && node backfill-customers.js
 */

const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

async function getClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function backfill() {
  const sheets = await getClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // ── 1. Read all existing customers ───────────────────────────
  console.log('Reading existing customers…');
  const custRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Customers!A2:H',
  });
  const custRows = custRes.data.values || [];

  // Build a Set of existing phone numbers (col C = index 2)
  const existingPhones = new Set(custRows.map(r => (r[2] || '').trim()).filter(Boolean));

  // Find highest existing CUST number
  let maxCustNum = custRows.reduce((max, r) => {
    const num = parseInt((r[0] || '').replace('CUST', '')) || 0;
    return Math.max(max, num);
  }, 0);

  console.log(`Found ${existingPhones.size} existing customers. Max ID: CUST${String(maxCustNum).padStart(3, '0')}`);

  // ── 2. Read all leads ─────────────────────────────────────────
  console.log('Reading leads…');
  const leadsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Leads!A2:M',
  });
  const leadRows = leadsRes.data.values || [];
  console.log(`Found ${leadRows.length} lead rows.`);

  // Deduplicate: collect unique phone → { name, email } keeping first occurrence
  const phoneMap = new Map();
  for (const row of leadRows) {
    const name  = (row[2] || '').trim();  // col C
    const phone = (row[3] || '').trim();  // col D
    const email = (row[4] || '').trim();  // col E
    if (!phone || !name) continue;
    if (!phoneMap.has(phone)) phoneMap.set(phone, { name, email });
  }

  console.log(`Found ${phoneMap.size} unique phones across leads.`);

  // ── 3. Create missing customers ───────────────────────────────
  const toCreate = [...phoneMap.entries()].filter(([phone]) => !existingPhones.has(phone));
  console.log(`Need to create ${toCreate.length} new customer records.`);

  if (toCreate.length === 0) {
    console.log('✓ Nothing to do — all lead customers already exist.');
    return;
  }

  // Build rows to append
  const newRows = toCreate.map(([phone, { name, email }]) => {
    maxCustNum += 1;
    const custId = `CUST${String(maxCustNum).padStart(3, '0')}`;
    // Columns: A=ID, B=Name, C=Phone, D=Email, E=Address, F=Orders, G=ActiveOrder, H=Status
    return [custId, name, phone, email, '', 0, 'No', 'Active'];
  });

  // Write in batches of 200
  const BATCH = 200;
  let created = 0;
  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Customers!A:H',
      valueInputOption: 'RAW',
      requestBody: { values: batch },
    });
    created += batch.length;
    console.log(`  Created ${created} / ${newRows.length}…`);
  }

  console.log(`\n✓ Backfill complete! Created ${newRows.length} customer records.`);
}

backfill().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});

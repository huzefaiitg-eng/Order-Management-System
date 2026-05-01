const { getClient, getCustomerByPhone, addCustomer } = require('./sheets');

// ── Column indices for Leads tab ────────────────────────────────
// A  B          C              D               E               F                     G            H            I               J       K      L                    M           N
// ID Date       CustomerName   CustomerPhone   CustomerEmail   ProductsInterested    LeadStatus   LeadSource   FollowUpDate    Budget  Notes  ConvertedOrderRow    CreatedAt   ArchivedAt

const COL = {
  leadId: 0,
  leadDate: 1,
  customerName: 2,
  customerPhone: 3,
  customerEmail: 4,
  productsInterested: 5,
  leadStatus: 6,
  leadSource: 7,
  followUpDate: 8,   // kept for backward compat but no longer written by new code
  budget: 9,
  notes: 10,
  convertedOrderRow: 11,
  createdAt: 12,
  archivedAt: 13,   // N — empty = active; ISO timestamp = archived
};

// ── Column indices for LeadFollowUps tab ────────────────────────
// A            B       C               D         E        F
// FollowUpId   LeadId  ScheduledDate   Happened  Remarks  CreatedAt

const COL_FU = {
  followUpId:    0,
  leadId:        1,
  scheduledDate: 2,
  happened:      3,   // '' = pending | 'Yes' = done
  remarks:       4,
  createdAt:     5,
};

// ── Helpers ───────────────────────────────────────────────────

/**
 * Parses the productsInterested cell (column F) into a productLines array.
 *
 * Supports two formats:
 *   1. New canonical: JSON array `[{productName, productCost, sellingPrice, quantity, articleId}, ...]`
 *   2. Legacy: comma-separated names "Air Max, Casual Loafer" → lines with empty cost/price/qty
 *
 * Returns [] if the cell is empty or unparseable.
 */
function parseProductLines(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        return arr.map(line => ({
          productName:  String(line.productName || '').trim(),
          productCost:  Number(line.productCost) || 0,
          sellingPrice: Number(line.sellingPrice) || 0,
          quantity:     Number(line.quantity) || 1,
          articleId:    String(line.articleId || '').trim(),
        })).filter(l => l.productName);
      }
    } catch { /* fall through to legacy */ }
  }
  // Legacy comma-separated names
  return s.split(',')
    .map(n => n.trim())
    .filter(Boolean)
    .map(name => ({
      productName: name,
      productCost: 0,
      sellingPrice: 0,
      quantity: 1,
      articleId: '',
    }));
}

/**
 * Serialize a productLines array → JSON string for column F.
 * Falls back to '' for empty arrays.
 */
function serializeProductLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return '';
  const clean = lines
    .map(line => ({
      productName:  String(line.productName || '').trim(),
      productCost:  Number(line.productCost) || 0,
      sellingPrice: Number(line.sellingPrice) || 0,
      quantity:     Number(line.quantity) || 1,
      articleId:    String(line.articleId || '').trim(),
    }))
    .filter(l => l.productName);
  return clean.length === 0 ? '' : JSON.stringify(clean);
}

/** Derive a legacy comma-separated product names string from productLines. */
function productLinesToNames(lines) {
  if (!Array.isArray(lines)) return '';
  return lines.map(l => l.productName).filter(Boolean).join(', ');
}

function rowToLead(row, rowIndex) {
  const rawStatus = row[COL.leadStatus] || 'New Lead';
  const productLines = parseProductLines(row[COL.productsInterested]);
  return {
    leadId: row[COL.leadId] || '',
    leadDate: row[COL.leadDate] || '',
    customerName: row[COL.customerName] || '',
    customerPhone: row[COL.customerPhone] || '',
    customerEmail: row[COL.customerEmail] || '',
    // Canonical: productLines array with cost/price/qty/articleId per item
    productLines,
    // Backward-compat: comma-separated names derived from productLines
    productsInterested: productLinesToNames(productLines),
    // Silently migrate any legacy "Follow-up" status leads → "Interested"
    leadStatus: rawStatus === 'Follow-up' ? 'Interested' : rawStatus,
    leadSource: row[COL.leadSource] || '',
    budget: parseFloat(row[COL.budget]) || 0,
    notes: row[COL.notes] || '',
    convertedOrderRow: row[COL.convertedOrderRow] || '',
    createdAt: row[COL.createdAt] || '',
    archivedAt: row[COL.archivedAt] || '',
    rowIndex,
  };
}

function rowToFollowUp(row) {
  return {
    followUpId:    row[COL_FU.followUpId]    || '',
    leadId:        row[COL_FU.leadId]        || '',
    scheduledDate: row[COL_FU.scheduledDate] || '',
    happened:      row[COL_FU.happened]      || '',   // '' or 'Yes'
    remarks:       row[COL_FU.remarks]       || '',
    createdAt:     row[COL_FU.createdAt]     || '',
  };
}

function formatDate(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Parse DD/MM/YYYY → Date (midnight). Returns null on bad input. */
function parseDDMMYYYY(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  d.setHours(0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

// ── Ensure Leads tab exists ───────────────────────────────────

async function ensureLeadsTab(sheetId) {
  const { getSheetNames } = require('./sheets');
  const names = await getSheetNames(sheetId);
  if (names.includes('Leads')) return;

  const sheets = await getClient();
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'Leads' } } }],
      },
    });
  } catch (err) {
    if (err.message && err.message.includes('already exists')) return;
    throw err;
  }

  // Write header row
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Leads!A1:N1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Lead ID', 'Lead Date', 'Customer Name', 'Customer Phone', 'Customer Email',
        'Products Interested', 'Lead Status', 'Lead Source', 'Follow-up Date',
        'Budget', 'Notes', 'Converted Order Row', 'Created At', 'Archived At']],
    },
  });
}

// ── Ensure LeadFollowUps tab exists ──────────────────────────

async function ensureFollowUpsTab(sheetId) {
  const { getSheetNames } = require('./sheets');
  const names = await getSheetNames(sheetId);
  if (names.includes('LeadFollowUps')) return;

  const sheets = await getClient();
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'LeadFollowUps' } } }],
      },
    });
  } catch (err) {
    if (err.message && err.message.includes('already exists')) return;
    throw err;
  }

  // Write header row
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'LeadFollowUps!A1:F1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Follow Up ID', 'Lead ID', 'Scheduled Date', 'Happened', 'Remarks', 'Created At']],
    },
  });
}

// ── Leads — Read ──────────────────────────────────────────────

async function getAllLeads(sheetId) {
  await ensureLeadsTab(sheetId);
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Leads!A2:N',
  });
  const rows = response.data.values || [];
  return rows
    .map((row, i) => rowToLead(row, i + 2))
    .filter(lead => lead.leadId && !lead.archivedAt); // skip blank and archived rows
}

async function getAllArchivedLeads(sheetId) {
  await ensureLeadsTab(sheetId);
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Leads!A2:N',
  });
  const rows = response.data.values || [];
  return rows
    .map((row, i) => rowToLead(row, i + 2))
    .filter(lead => lead.leadId && lead.archivedAt); // only archived rows
}

async function getLeadById(sheetId, leadId) {
  const leads = await getAllLeads(sheetId);
  return leads.find(l => l.leadId === leadId) || null;
}

// ── Leads — Create ────────────────────────────────────────────

async function getNextLeadId(sheetId) {
  const leads = await getAllLeads(sheetId);
  const maxNum = leads.reduce((max, l) => {
    const num = parseInt(l.leadId.replace('LEAD-', '')) || 0;
    return Math.max(max, num);
  }, 0);
  return `LEAD-${String(maxNum + 1).padStart(3, '0')}`;
}

async function addLead(sheetId, {
  customerName, customerPhone, customerEmail = '',
  productsInterested = '', productLines = null,
  leadStatus = 'New Lead', leadSource = '',
  budget = 0, notes = '',
}) {
  await ensureLeadsTab(sheetId);

  const leadId = await getNextLeadId(sheetId);
  const leadDate = formatDate();
  const createdAt = new Date().toISOString();

  // Prefer productLines (canonical). Fall back to legacy productsInterested string.
  const productsCell = Array.isArray(productLines) && productLines.length > 0
    ? serializeProductLines(productLines)
    : (productsInterested || '');

  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Leads!A:N',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        leadId, leadDate, customerName, customerPhone, customerEmail,
        productsCell, leadStatus, leadSource, '',         // followUpDate always empty now
        String(budget || 0), notes, '', createdAt, '',    // archivedAt empty
      ]],
    },
  });

  // Auto-create or link customer record
  try {
    const existing = await getCustomerByPhone(sheetId, customerPhone);
    if (!existing) {
      await addCustomer(sheetId, {
        customerName,
        customerPhone,
        customerAddress: '',
        customerEmail: customerEmail || '',
      });
    }
  } catch (err) {
    // Non-fatal — customer might already exist with same phone (race) or have some other error
    console.warn('Lead creation: customer auto-create skipped:', err.message);
  }

  return rowToLead([
    leadId, leadDate, customerName, customerPhone, customerEmail,
    productsCell, leadStatus, leadSource, '',
    String(budget || 0), notes, '', createdAt,
  ], -1); // rowIndex unknown at append time, refresh to get it
}

// ── Leads — Update ────────────────────────────────────────────

async function updateLead(sheetId, leadId, updates) {
  const leads = await getAllLeads(sheetId);
  const lead = leads.find(l => l.leadId === leadId);
  if (!lead) throw new Error('Lead not found');

  const sheets = await getClient();
  const rowIdx = lead.rowIndex;
  const data = [];

  // followUpDate intentionally removed — no longer written by new code
  const fieldColMap = {
    customerName:      { col: 'C' },
    customerPhone:     { col: 'D' },
    customerEmail:     { col: 'E' },
    productsInterested:{ col: 'F' },
    leadStatus:        { col: 'G' },
    leadSource:        { col: 'H' },
    budget:            { col: 'J' },
    notes:             { col: 'K' },
    convertedOrderRow: { col: 'L' },
  };

  // productLines (canonical) → JSON in column F. Wins over legacy productsInterested.
  if (updates.productLines !== undefined) {
    data.push({
      range: `Leads!F${rowIdx}`,
      values: [[serializeProductLines(updates.productLines)]],
    });
  }

  for (const [field, { col }] of Object.entries(fieldColMap)) {
    // Skip productsInterested if productLines was provided — productLines wins
    if (field === 'productsInterested' && updates.productLines !== undefined) continue;
    if (updates[field] !== undefined) {
      data.push({
        range: `Leads!${col}${rowIdx}`,
        values: [[String(updates[field] === null ? '' : updates[field])]],
      });
    }
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }

  const merged = { ...lead, ...updates };
  // Keep productsInterested string in sync with productLines if productLines changed
  if (updates.productLines !== undefined) {
    merged.productsInterested = productLinesToNames(updates.productLines);
  }
  return merged;
}

// ── Leads — Delete ────────────────────────────────────────────

async function deleteLead(sheetId, leadId) {
  const leads = await getAllLeads(sheetId);
  const lead = leads.find(l => l.leadId === leadId);
  if (!lead) throw new Error('Lead not found');

  const { getSheetNames } = require('./sheets');
  const sheetNames = await getSheetNames(sheetId);
  if (!sheetNames.includes('Leads')) throw new Error('Leads sheet not found');

  const sheets = await getClient();
  // Get the numeric sheetId of the Leads tab
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties',
  });
  const leadsTab = spreadsheet.data.sheets.find(s => s.properties.title === 'Leads');
  if (!leadsTab) throw new Error('Leads tab not found');
  const leadsTabId = leadsTab.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: leadsTabId,
            dimension: 'ROWS',
            startIndex: lead.rowIndex - 1,
            endIndex: lead.rowIndex,
          },
        },
      }],
    },
  });

  return { deleted: true, leadId };
}

// ── LeadFollowUps — Read ──────────────────────────────────────

async function getAllFollowUps(sheetId) {
  // Auto-creates the LeadFollowUps tab for any user who doesn't have it yet
  await ensureFollowUpsTab(sheetId);
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'LeadFollowUps!A2:F',
  });
  const rows = response.data.values || [];
  return rows
    .map(row => rowToFollowUp(row))
    .filter(fu => fu.followUpId); // skip blank rows
}

async function getFollowUpsForLead(sheetId, leadId) {
  const all = await getAllFollowUps(sheetId);
  return all
    .filter(fu => fu.leadId === leadId)
    .sort((a, b) => {
      const da = parseDDMMYYYY(a.scheduledDate);
      const db = parseDDMMYYYY(b.scheduledDate);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
}

/**
 * Returns a Map<leadId, {followUpId, date}> containing the earliest
 * pending (not happened) follow-up date per lead. Used by GET /api/leads
 * to attach nextFollowUp to every lead in one extra Sheets API call.
 */
async function getNextFollowUpPerLead(sheetId) {
  const all = await getAllFollowUps(sheetId);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const map = new Map(); // leadId → { followUpId, date }
  all.forEach(fu => {
    if (fu.happened === 'Yes') return; // skip done follow-ups
    if (!fu.scheduledDate) return;
    const current = map.get(fu.leadId);
    if (!current) {
      map.set(fu.leadId, { followUpId: fu.followUpId, date: fu.scheduledDate });
    } else {
      // Keep the earlier date
      const dNew = parseDDMMYYYY(fu.scheduledDate);
      const dCur = parseDDMMYYYY(current.date);
      if (dNew && dCur && dNew < dCur) {
        map.set(fu.leadId, { followUpId: fu.followUpId, date: fu.scheduledDate });
      }
    }
  });
  return map;
}

// ── LeadFollowUps — Create ────────────────────────────────────

async function getNextFollowUpId(sheetId) {
  const all = await getAllFollowUps(sheetId);
  const maxNum = all.reduce((max, fu) => {
    const num = parseInt((fu.followUpId || '').replace('FU-', '')) || 0;
    return Math.max(max, num);
  }, 0);
  return `FU-${String(maxNum + 1).padStart(3, '0')}`;
}

async function addFollowUp(sheetId, { leadId, scheduledDate }) {
  await ensureFollowUpsTab(sheetId);
  const followUpId = await getNextFollowUpId(sheetId);
  const createdAt = new Date().toISOString();

  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'LeadFollowUps!A:F',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[followUpId, leadId, scheduledDate, '', '', createdAt]],
    },
  });

  return rowToFollowUp([followUpId, leadId, scheduledDate, '', '', createdAt]);
}

// ── LeadFollowUps — Update ────────────────────────────────────

async function markFollowUpHappened(sheetId, followUpId, remarks = '') {
  const all = await getAllFollowUps(sheetId);
  // Find index (0-based) in the fetched array → row number in sheet = index + 2 (header at row 1)
  const idx = all.findIndex(fu => fu.followUpId === followUpId);
  if (idx === -1) throw new Error('Follow-up not found');
  const rowIdx = idx + 2;

  const sheets = await getClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `LeadFollowUps!D${rowIdx}`, values: [['Yes']] },
        { range: `LeadFollowUps!E${rowIdx}`, values: [[remarks || '']] },
      ],
    },
  });

  return { ...all[idx], happened: 'Yes', remarks: remarks || '' };
}

// ── Leads — Archive / Unarchive ──────────────────────────────

async function archiveLead(sheetId, leadId) {
  const leads = await getAllLeads(sheetId);
  const lead = leads.find(l => l.leadId === leadId);
  if (!lead) throw new Error('Lead not found');

  const sheets = await getClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [{ range: `Leads!N${lead.rowIndex}`, values: [[new Date().toISOString()]] }],
    },
  });
  return { ...lead, archivedAt: new Date().toISOString() };
}

async function unarchiveLead(sheetId, leadId) {
  // Unarchive needs to scan ALL rows (active + archived)
  await ensureLeadsTab(sheetId);
  const sheets = await getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Leads!A2:N',
  });
  const rows = response.data.values || [];
  const all = rows.map((row, i) => rowToLead(row, i + 2));
  const lead = all.find(l => l.leadId === leadId);
  if (!lead) throw new Error('Lead not found');
  if (!lead.archivedAt) throw new Error('Lead is not archived');

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [{ range: `Leads!N${lead.rowIndex}`, values: [['']] }],
    },
  });
  return { ...lead, archivedAt: '' };
}

module.exports = {
  // Leads
  getAllLeads,
  getAllArchivedLeads,
  getLeadById,
  addLead,
  updateLead,
  deleteLead,
  archiveLead,
  unarchiveLead,
  // LeadFollowUps
  getAllFollowUps,
  getFollowUpsForLead,
  getNextFollowUpPerLead,
  addFollowUp,
  markFollowUpHappened,
};

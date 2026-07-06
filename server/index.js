'use strict';
const express  = require('express');
const path     = require('path');
const https    = require('https');
const http     = require('http');
const fs       = require('fs');
const { execSync } = require('child_process');
const multiparty = require('multiparty');
let XLSX;
try { XLSX = require('xlsx'); } catch(e) { XLSX = null; }
const { computeProfitAudit, computeRevenueAudit } = require('./audit-compute');
const { profitNarrative, revenueNarrative } = require('../public/components/audit-narrative');

const app  = express();
const PORT = process.env.PORT || 3000;

// Skip JSON parsing for the Stripe webhook route — it needs the raw body for signature verification
app.use((req, res, next) => {
  if (req.path === '/api/stripe-webhook') return next();
  express.json({ limit: '50mb' })(req, res, next);
});

// No-cache headers for JS/CSS
app.use((req, res, next) => {
  if (req.url.match(/\.(js|css)(\?.*)?$/)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// (Removed the /api/claude proxy — the app makes no Anthropic API calls anymore;
//  audits are computed and narrated entirely in code. Left no unauthenticated
//  passthrough to Claude.)

// ── Profit audit — JSON only, no PDF ──────────────────────────────────────────
app.post('/api/generate-profit-audit', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;   // unused now; audit is code-only

  const form = new multiparty.Form({ maxFilesSize: 50 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Form parse error: ' + err.message });

    const appDataStr = fields.appData?.[0] || '{}';
    let appData = {};
    try { appData = JSON.parse(appDataStr); } catch(e) {}
    let practices = {};
    try { practices = JSON.parse(fields.practices?.[0] || '{}'); } catch(e) {}

    const uploadedFiles = [];
    for (const [key, fileArr] of Object.entries(files)) {
      for (const f of fileArr) {
        if (f.size > 0) uploadedFiles.push({ field: key, path: f.path, name: f.originalFilename, size: f.size });
      }
    }

    let controlData = null;
    try { controlData = JSON.parse(fields.controlData?.[0] || 'null'); } catch(e) {}

    try {
      const auditData = await generateProfitAudit(apiKey, uploadedFiles, appData, practices, controlData);
      res.json({ ok: true, auditData });
    } catch(e) {
      console.error('Profit audit error:', e);
      res.status(500).json({ error: e.message || 'Audit generation failed' });
    } finally {
      for (const f of uploadedFiles) fs.unlink(f.path, () => {});
    }
  });
});

/* ── Profit audit — honest pipeline (2026-05-29 rebuild) ───────────────────────
   1. EXTRACTION (only if files uploaded): the model reads uploads and returns a
      small JSON of raw observed input metrics — no scores, no gaps, no prose.
   2. COMPUTE: code (computeProfitAudit) calculates every score and dollar figure
      from intake + Control data + extracted inputs. This is the source of truth.
   3. NARRATIVE: the model is GIVEN the computed numbers and writes only the
      operator-voice prose, echoing the numbers, never recomputing.
   4. MERGE: computed numbers overwrite anything the model returned, so code's
      figures are always authoritative. See memory: audit-honesty-rebuild. */
async function generateProfitAudit(apiKey, files, appData, practices, controlData) {
  // Audits no longer intake uploaded files, so nothing is extracted from them.
  // This keeps xlsx out of the request path (no ReDoS surface) and makes no
  // Anthropic API call. Scores come purely from in-app + Control data.
  const extracted = {};
  // Honest-by-construction: the audit scores solely on measured data. Self-reported
  // operating practices are intentionally ignored (nothing sends them) so a claim
  // can never override, or inflate past, what the data actually shows.
  const numbers = computeProfitAudit(appData, controlData, extracted);
  // Stamp identifiers code owns (not the model).
  numbers.AUDIT_ID = 'PFA-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
  numbers.AUDIT_DATE = new Date().toISOString().slice(0, 10);
  const prose = profitNarrative(numbers);   // code-generated findings, no API
  // Computed numbers win over anything the model echoed back.
  return Object.assign({}, prose, numbers);
}

/* Extraction pass — returns observed input metrics from uploaded files only.
   Returns {} when no files (the common case: data already in app/Control). */
async function extractProfitInputs(apiKey, files) {
  const fileContent = buildFileContent(files);
  if (fileContent.length === 0) return {};
  const instruction = `You are reading uploaded operator documents (a P&L or sales summary, a voids/comps/cash report, invoices, a recipe costing sheet, inventory counts) for a bar and restaurant profit audit. Extract ONLY the raw values you can actually see in the documents. Report dollar amounts as plain numbers and percentages as plain numbers (e.g. 27.4 not "27.4%"). Do NOT calculate ratios or scores yourself — if a report shows revenue and COGS dollars but not a cost %, return the dollars and leave the % null; the system computes the ratio. Respond with a single JSON object, no other text. Use null for anything not present. Fields:
{"audit_period":[the month or date range the data covers, e.g. "April 2026", or null],"bar_revenue_monthly":[total bar/beverage revenue for the period or null],"food_revenue_monthly":[total food revenue for the period or null],"bar_cogs_monthly":[bar/beverage cost of goods in dollars or null],"food_cogs_monthly":[food cost of goods in dollars or null],"bar_cost_pct":[only if the report states it directly, else null],"food_cost_pct":[only if stated directly, else null],"labor_cost_monthly":[total labor cost for the period or null],"pour_method":["Free pour" / "Jiggered" / "Measured" or null],"inv_variance_pct":[number or null],"draft_yield_pct":[only if a report states draft beer yield or keg yield as a percent, else null],"draft_kegs_purchased":[number of kegs purchased in the period, else null],"draft_units_sold":[draft beer units/pints sold in the period from POS, else null],"draft_units_per_keg":[only if stated, the theoretical units/pints a full keg yields at this bar's keg size and pour, else null],"void_comp_pct":[voids+comps as % of sales if stated, else null],"voids_total":[voids+comps dollars if shown, else null],"voids_no_approval_pct":[number or null],"discount_total":[total discount/promo dollars for the period from a POS exception or discount report, else null],"discount_count":[number of discounts applied, else null],"no_sale_count":[number of no-sale register/drawer opens from a POS exception report, else null],"void_approval":[true if a manager-approval policy is evidenced, else null],"cash_recon_count":[number of drawer reconciliations shown or null],"cash_short_count":[number of shifts that came up short or null],"food_var_pct":[number or null],"inv_freq":["Weekly" / "Monthly" / "Never" or null],"waste_log":["Yes" or null],"bev_invoice_count":[integer or null],"food_invoice_count":[integer or null],"invoice_vs_po":["Matched every delivery" / "Spot checked" / "Never matched" or null],"backup_vendors":[text or null],"recipe_count":[number of costed recipes shown or null],"rplh_tracked":["Yes" or null]}`;
  const content = fileContent.concat([{ type: 'text', text: instruction }]);
  try {
    return await callClaudeForJSON(apiKey, content, 1500);
  } catch (e) {
    console.warn('[audit] profit extraction failed, proceeding with app/Control data only:', e.message);
    return {};
  }
}

/* Narrative pass — the model writes prose around the code-computed numbers. */
async function generateProfitNarrative(apiKey, d) {
  const instruction = `You are a 30-year bar and restaurant operator writing the narrative for a profit audit that another seasoned owner will read. The NUMBERS BELOW ARE FINAL AND CORRECT. Never change, recompute, or contradict them, and reference them verbatim where relevant.

VOICE, follow exactly:
- Write operator to operator. The reader runs a bar and knows the trade. State findings and give direct orders. Never explain a concept, define a term, or justify why a metric matters. The reader already knows.
- Banned framing that reads like teaching or a consultant: "this tells you", "this shows you", "what this means is", "the key is", "keep in mind", "remember that", "because", "reads as". Cut them. State the fact, not the lesson behind it.
- You can be dry and a little funny, and a quick bit of bar-floor storytelling is fine where it makes a rough number read easy instead of stinging, never at the operator's expense and never invented. Give the good, the bad, and the ugly straight, and never talk down to the reader.
- NARRATIVE: one or two sentences naming the number and what it indicates for this specific operation. FINDING: the specific data behind it, the worst offender, the concentration, the dollar gap. TOOL: a direct instruction that names the Bar Cop screen and the action, like "Jigger every well and watch pour variance in Spot Check." Never soft advice or "you should consider".
- Risk signals: EVIDENCE and GAP are short factual statements. TOOL is one direct action.
- Keep every field specific to the numbers given. No generic best-practice lines that would fit any bar.
- Plain words. No emdashes (use a period or comma). Banned words: "leverage", "compounds", "robust", "seamless", "utilize", "synergy", "cadence", "package", "ecosystem".

Respond with a single JSON object, no other text, with exactly these prose fields:
{"S1_NARRATIVE":"","S1_FINDING":"","S1_TOOL":"","S2_NARRATIVE":"","S2_FINDING":"","S2_TOOL":"","S3_NARRATIVE":"","S3_FINDING":"","S3_TOOL":"","S4_NARRATIVE":"","S4_FINDING":"","S4_TOOL":"","S5_NARRATIVE":"","S5_FINDING":"","S5_TOOL":"","S6_SIG1_SCORE":"[HIGH/MEDIUM/LOW]","S6_SIG1_LABEL":"","S6_SIG1_EVIDENCE":"","S6_SIG1_GAP":"","S6_SIG1_TOOL":"","S6_SIG2_SCORE":"[HIGH/MEDIUM/LOW]","S6_SIG2_LABEL":"","S6_SIG2_EVIDENCE":"","S6_SIG2_GAP":"","S6_SIG2_TOOL":"","S6_SIG3_SCORE":"[HIGH/MEDIUM/LOW]","S6_SIG3_LABEL":"","S6_SIG3_EVIDENCE":"","S6_SIG3_GAP":"","S6_SIG3_TOOL":"","S6_SIG4_SCORE":"[HIGH/MEDIUM/LOW]","S6_SIG4_LABEL":"","S6_SIG4_EVIDENCE":"","S6_SIG4_GAP":"","S6_SIG4_TOOL":""}

COMPUTED NUMBERS (final):
${JSON.stringify(d, null, 1)}`;
  try {
    return await callClaudeForJSON(apiKey, [{ type: 'text', text: instruction }], 4000);
  } catch (e) {
    console.warn('[audit] profit narrative failed, returning numbers without prose:', e.message);
    return {};
  }
}

/* Build Claude content blocks from uploaded files (PDF/image inline, sheets as text). */
function buildFileContent(files) {
  const content = [];
  const sheetTexts = [];
  for (const f of (files || [])) {
    const ext = path.extname(f.name).toLowerCase();
    if (ext === '.pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fs.readFileSync(f.path).toString('base64') } });
    } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      const mt = ext === '.png' ? 'image/png' : 'image/jpeg';
      content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: fs.readFileSync(f.path).toString('base64') } });
    } else if (['.xlsx', '.xls', '.csv', '.doc', '.docx'].includes(ext)) {
      const text = parseSpreadsheetToText(f.path, f.name);
      if (text) sheetTexts.push(text);
    }
  }
  if (sheetTexts.length) content.unshift({ type: 'text', text: 'SUBMITTED DATA FILES:\n\n' + sheetTexts.join('\n\n---\n\n') });
  return content;
}

/* Call Claude with content blocks, parse a single JSON object from the reply. */
async function callClaudeForJSON(apiKey, content, maxTokens) {
  const body = JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens || 4000, messages: [{ role: 'user', content }] });
  const responseData = await callClaude(apiKey, body);
  const rawText = responseData.content?.[0]?.text || '';
  const first = rawText.indexOf('{'), last = rawText.lastIndexOf('}');
  if (first === -1 || last === -1) throw new Error('No JSON object in response: ' + rawText.slice(0, 200));
  return JSON.parse(rawText.slice(first, last + 1));
}

// ── Revenue audit — JSON only, no PDF ─────────────────────────────────────────
app.post('/api/generate-revenue-audit', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;   // unused now; audit is code-only

  const form = new multiparty.Form({ maxFilesSize: 50 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Form parse error: ' + err.message });

    const appDataStr = fields.appData?.[0] || '{}';
    let appData = {};
    try { appData = JSON.parse(appDataStr); } catch(e) {}
    let practices = {};
    try { practices = JSON.parse(fields.practices?.[0] || '{}'); } catch(e) {}

    const uploadedFiles = [];
    for (const [key, fileArr] of Object.entries(files)) {
      for (const f of fileArr) {
        if (f.size > 0) uploadedFiles.push({ field: key, path: f.path, name: f.originalFilename, size: f.size });
      }
    }

    let controlData = null;
    try { controlData = JSON.parse(fields.controlData?.[0] || 'null'); } catch(e) {}

    try {
      const auditData = await generateRevenueAudit(apiKey, uploadedFiles, appData, practices, controlData);
      res.json({ ok: true, auditData });
    } catch(e) {
      console.error('Revenue audit error:', e);
      res.status(500).json({ error: e.message || 'Audit generation failed' });
    } finally {
      for (const f of uploadedFiles) fs.unlink(f.path, () => {});
    }
  });
});

/* ── Revenue audit — same honest pipeline as Profit ───────────────────────────
   EXTRACT (files -> raw input numbers) -> COMPUTE (code) -> NARRATE (prose) ->
   MERGE with computed numbers authoritative. */
async function generateRevenueAudit(apiKey, files, appData, practices, controlData) {
  // No file intake anymore — keeps xlsx out of the request path and makes no
  // Anthropic API call. Scores come purely from in-app + Control data.
  const extracted = {};
  // Honest-by-construction: scores solely on measured data; self-reported practices
  // are intentionally ignored (nothing sends them) and never override the numbers.
  const numbers = computeRevenueAudit(appData, controlData, extracted);
  numbers.AUDIT_ID = 'RFA-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
  numbers.AUDIT_DATE = new Date().toISOString().slice(0, 10);
  const prose = revenueNarrative(numbers);   // code-generated findings, no API
  return Object.assign({}, prose, numbers);
}

async function extractRevenueInputs(apiKey, files) {
  const fileContent = buildFileContent(files);
  if (fileContent.length === 0) return {};
  const instruction = `You are reading uploaded operator documents (a POS sales summary, server sales report, menu sales mix, menu price list, labor schedule/payroll, event records) for a bar and restaurant REVENUE audit. Extract ONLY the raw values you can see. Numbers as plain numbers, percentages as plain numbers. Do NOT calculate ratios or scores — the system does that. Use null for anything not present. Respond with a single JSON object, no other text:
{"audit_period":[month or range or null],"monthly_revenue":[total monthly revenue or null],"monthly_covers":[total monthly guests/covers or null],"check_avg":[average check if stated, else null],"labor_pct":[labor as % of revenue if stated, else null],"rplh":[revenue per labor hour if stated, else null],"overtime_hrs":[number or null],"sched_vs_actual":[text like "214 scheduled / 247 actual" or null],"stars_count":[menu items, integer or null],"plowhorses_count":[integer or null],"puzzles_count":[integer or null],"dogs_count":[integer or null],"top_category":[best-selling category name or null],"server_count":[number of servers on the report or null],"top_check_avg":[highest server check average or null],"bottom_check_avg":[lowest server check average or null],"app_attach_rate":[appetizer attach % or null],"dessert_attach_rate":[dessert attach % or null],"catering_rev":[catering revenue for the period or null],"bev_units_sold":[total beverage/drink items sold for the period as a plain integer, from a POS product-mix or category sales report, else null],"bev_incidence_pct":[only if the report states the percent of checks that included a beverage, else null],"lunch_check_avg":[average check for the lunch daypart if the report breaks sales out by daypart, else null],"dinner_check_avg":[average check for the dinner daypart if broken out, else null],"late_check_avg":[average check for the late-night daypart if broken out, else null]}`;
  const content = fileContent.concat([{ type: 'text', text: instruction }]);
  try {
    return await callClaudeForJSON(apiKey, content, 1500);
  } catch (e) {
    console.warn('[audit] revenue extraction failed, proceeding with app/Control data only:', e.message);
    return {};
  }
}

async function generateRevenueNarrative(apiKey, d) {
  const instruction = `You are a 30-year bar and restaurant operator writing the narrative for a REVENUE audit that another seasoned owner will read. The NUMBERS BELOW ARE FINAL AND CORRECT. Never change, recompute, or contradict them, and reference them verbatim where relevant.

VOICE, follow exactly:
- Write operator to operator. The reader runs a bar and knows the trade. State findings and give direct orders. Never explain a concept, define a term, or justify why a metric matters. The reader already knows.
- Banned framing that reads like teaching or a consultant: "this tells you", "this shows you", "what this means is", "the key is", "keep in mind", "remember that", "because", "reads as". Cut them. State the fact, not the lesson behind it.
- You can be dry and a little funny, and a quick bit of bar-floor storytelling is fine where it makes a rough number read easy instead of stinging, never at the operator's expense and never invented. Give the good, the bad, and the ugly straight, and never talk down to the reader.
- NARRATIVE: one or two sentences naming the number and what it indicates for this specific operation. FINDING: the specific data behind it, the worst offender, the concentration, the gap. TOOL: a direct instruction that names the Bar Cop screen and the action, like "Track check average by server in Server Check and coach the bottom two." Never soft advice or "you should consider".
- Risk signals: EVIDENCE and GAP are short factual statements. TOOL is one direct action.
- Keep every field specific to the numbers given. No generic best-practice lines that would fit any bar.
- Plain words. No emdashes (use a period or comma). Banned words: "leverage", "compounds", "robust", "seamless", "utilize", "synergy", "cadence", "package", "ecosystem".
- Treat check-average, menu, server, and event figures as REVENUE OPPORTUNITY (potential growth), and labor as cost. Do not call opportunity "recovered" money.

Respond with a single JSON object, no other text, with exactly these prose fields:
{"S1_NARRATIVE":"","S1_FINDING":"","S1_TOOL":"","S2_NARRATIVE":"","S2_FINDING":"","S2_TOOL":"","S3_NARRATIVE":"","S3_FINDING":"","S3_TOOL":"","S4_NARRATIVE":"","S4_FINDING":"","S4_TOOL":"","S5_NARRATIVE":"","S5_FINDING":"","S5_TOOL":"","S6_SIG1_SCORE":"[HIGH/MEDIUM/LOW]","S6_SIG1_LABEL":"","S6_SIG1_EVIDENCE":"","S6_SIG1_GAP":"","S6_SIG1_TOOL":"","S6_SIG2_SCORE":"[HIGH/MEDIUM/LOW]","S6_SIG2_LABEL":"","S6_SIG2_EVIDENCE":"","S6_SIG2_GAP":"","S6_SIG2_TOOL":"","S6_SIG3_SCORE":"[HIGH/MEDIUM/LOW]","S6_SIG3_LABEL":"","S6_SIG3_EVIDENCE":"","S6_SIG3_GAP":"","S6_SIG3_TOOL":"","S6_SIG4_SCORE":"[HIGH/MEDIUM/LOW]","S6_SIG4_LABEL":"","S6_SIG4_EVIDENCE":"","S6_SIG4_GAP":"","S6_SIG4_TOOL":""}

COMPUTED NUMBERS (final):
${JSON.stringify(d, null, 1)}`;
  try {
    return await callClaudeForJSON(apiKey, [{ type: 'text', text: instruction }], 4000);
  } catch (e) {
    console.warn('[audit] revenue narrative failed, returning numbers without prose:', e.message);
    return {};
  }
}

// ── Parse spreadsheet/CSV file into readable text for Claude ──────────────────
function parseSpreadsheetToText(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  try {
    if (ext === '.csv') {
      const raw = fs.readFileSync(filePath, 'utf8');
      const lines = raw.trim().split('\n').slice(0, 200);
      return `FILE: ${fileName}\n${lines.join('\n')}`;
    }
    if (['.xlsx', '.xls'].includes(ext)) {
      if (!XLSX) return `FILE: ${fileName}\n[Excel parser not available — install xlsx package]`;
      const wb    = XLSX.readFile(filePath);
      const parts = [];
      for (const sheetName of wb.SheetNames.slice(0, 5)) {
        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
        const lines = rows.trim().split('\n').slice(0, 200);
        if (lines.length > 1) {
          parts.push(`FILE: ${fileName} | SHEET: ${sheetName}\n${lines.join('\n')}`);
        }
      }
      return parts.join('\n\n') || `FILE: ${fileName}\n[Empty spreadsheet]`;
    }
    if (ext === '.docx' || ext === '.doc') {
      return `FILE: ${fileName}\n[Word document submitted — operator should convert to PDF for best results]`;
    }
  } catch(e) {
    return `FILE: ${fileName}\n[Parse error: ${e.message}]`;
  }
  return null;
}

// ── Extract audit data from uploaded files ────────────────────────────────────
async function extractAuditData(apiKey, auditType, files, appData, notes='', controlData=null, urlData=null) {
  const prompts = {
    profit:  getExtractionPrompt_Profit(appData, controlData),
    revenue: getExtractionPrompt_Revenue(appData, controlData),
  };

  const prompt = prompts[auditType] || prompts.profit;

  const content = [];
  const spreadsheetTexts = [];

  for (const f of files) {
    const ext = path.extname(f.name).toLowerCase();

    if (ext === '.pdf') {
      const b64 = fs.readFileSync(f.path).toString('base64');
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: b64 }
      });
    } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      const mt  = ext === '.png' ? 'image/png' : 'image/jpeg';
      const b64 = fs.readFileSync(f.path).toString('base64');
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mt, data: b64 }
      });
    } else if (['.xlsx', '.xls', '.csv', '.doc', '.docx'].includes(ext)) {
      const text = parseSpreadsheetToText(f.path, f.name);
      if (text) spreadsheetTexts.push(text);
    }
  }

  if (spreadsheetTexts.length > 0) {
    content.push({
      type: 'text',
      text: 'SUBMITTED DATA FILES — Read all data carefully and use it to score each section:\n\n'
        + spreadsheetTexts.join('\n\n---\n\n')
    });
  }

  const fullPrompt = notes
    ? prompt + '\n\nOPERATOR NOTES (read carefully — these may affect how you interpret the data):\n' + notes
    : prompt;
  content.push({ type: 'text', text: fullPrompt });

  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content }]
  });

  const responseData = await callClaude(apiKey, body);
  const rawText = responseData.content?.[0]?.text || '';

  console.log('[audit] raw length:', rawText.length, '| first 300:', rawText.slice(0, 300));

  // Extract JSON robustly — find first { and last }
  const firstBrace = rawText.indexOf('{');
  const lastBrace  = rawText.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    console.error('[audit] no JSON braces found. raw:', rawText.slice(0, 500));
    throw new Error('Audit response contained no JSON object. Response: ' + rawText.slice(0, 300));
  }
  const clean = rawText.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(clean);
  } catch(e) {
    console.error('[audit] parse error:', e.message, '| tail:', rawText.slice(-300));
    throw new Error('Audit JSON parse failed: ' + e.message + ' | Response start: ' + rawText.slice(0, 300));
  }
}

// ── Claude HTTP helper — streaming to survive DO 60s timeout ──────────────────
function callClaude(apiKey, bodyObj) {
  const parsed = typeof bodyObj === 'string' ? JSON.parse(bodyObj) : bodyObj;
  const streamBody = JSON.stringify({ ...parsed, stream: true });
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(streamBody)
      }
    };
    let partial = '';
    let fullText = '';
    const req = https.request(options, res => {
      res.on('data', chunk => {
        partial += chunk.toString();
        const lines = partial.split('\n');
        partial = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              fullText += evt.delta.text || '';
            }
          } catch(e) { /* skip malformed SSE lines */ }
        }
      });
      res.on('end', () => {
        if (fullText) {
          resolve({ content: [{ type: 'text', text: fullText }] });
        } else {
          try { resolve(JSON.parse(partial)); }
          catch(e) { reject(new Error('Claude response parse error: ' + partial.slice(0, 200))); }
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(180000, () => { req.destroy(new Error('Claude request timed out after 3 minutes')); });
    req.write(streamBody);
    req.end();
  });
}

// ── Extraction Prompts ─────────────────────────────────────────────────────────
function getExtractionPrompt_Profit(appData, controlData) {
  const settings = appData.settings || {};
  const weeks    = appData.weeks    || [];
  const shifts   = appData.shifts   || [];
  const recons   = appData.reconciliations || [];
  const vendor   = appData.vendor_log || [];
  const theft    = appData.theft_scores || [];
  const products = appData.bar_products || [];
  const kitchen  = appData.kitchen_products || [];
  const recipes  = appData.recipes || [];

  const recentWeeks = weeks.slice(-4);
  const avgBarCost  = recentWeeks.length ? recentWeeks.reduce((s,w) => s+(w.bar?.cost_pct||0),0)/recentWeeks.length : null;
  const avgFoodCost = recentWeeks.length ? recentWeeks.reduce((s,w) => s+(w.food?.cost_pct||0),0)/recentWeeks.length : null;
  const avgBarRev   = recentWeeks.length ? recentWeeks.reduce((s,w) => s+(w.bar?.revenue||0),0)/recentWeeks.length : null;
  const avgFoodRev  = recentWeeks.length ? recentWeeks.reduce((s,w) => s+(w.food?.revenue||0),0)/recentWeeks.length : null;

  // Build weekly data summary for prompt
  const weeklySummary = recentWeeks.length
    ? recentWeeks.map((w,i) => {
        const parts = [`Week ${i+1}`];
        if (w.week_end) parts.push(w.week_end);
        if (w.bar && w.bar.revenue) parts.push('Bar rev $'+w.bar.revenue);
        if (w.bar && w.bar.cost_pct) parts.push('Bar cost '+w.bar.cost_pct+'%');
        if (w.food && w.food.revenue) parts.push('Food rev $'+w.food.revenue);
        if (w.food && w.food.cost_pct) parts.push('Food cost '+w.food.cost_pct+'%');
        if (w.labor_pct) parts.push('Labor '+w.labor_pct+'%');
        return '  ' + parts.join(' | ');
      }).join('\n')
    : '  No weekly data entered yet';

  const barProductsSummary = products.length
    ? products.slice(0,15).map(p => '  ' + (p.name||'Product') + ' | Cost: $' + (p.cost||0) + ' | Category: ' + (p.category||'')).join('\n')
    : '  No bar products entered';

  const reconSummary = recons.length
    ? recons.slice(-4).map(r => '  ' + (r.date||'') + ' | Expected: $' + (r.expected||0) + ' | Actual: $' + (r.actual||0) + ' | Variance: $' + ((r.actual||0)-(r.expected||0)).toFixed(2)).join('\n')
    : '  No cash reconciliation entries';

  // Verified Control-module data — real logged operational data the audit
  // treats as ground truth for the sections it covers (map Section 8).
  let controlBlock = '';
  if (controlData && typeof controlData === 'object') {
    const c = controlData, cl = [];
    if (c.bar_cost_pct != null)    cl.push('verified_bar_pour_cost_pct=' + c.bar_cost_pct + ' — S1 ground truth');
    if (c.food_cost_pct != null)   cl.push('verified_food_cost_pct=' + c.food_cost_pct + ' — S3 ground truth');
    if (c.prime_cost_pct != null)  cl.push('verified_prime_cost_pct=' + c.prime_cost_pct + ' — S5 ground truth');
    if (c.inventory_counts)        cl.push('inventory_counts_on_file=' + c.inventory_counts);
    if (c.spot_checks)             cl.push('spot_checks=' + c.spot_checks + ' flagged_items=' + (c.spot_check_flagged||0) + ' pour_variance_$=' + (c.spot_check_variance_dollar||0) + ' — S2 theft ground truth');
    if (c.void_comp_count != null) cl.push('void_comp_events=' + c.void_comp_count + ' total_$=' + c.void_comp_total + ' unauthorized=' + c.void_comp_unauthorized + ' — S2 ground truth');
    if (c.cash_reconciliations)    cl.push('drawer_reconciliations=' + c.cash_reconciliations + ' total_variance_$=' + c.cash_variance_total + ' short_count=' + c.cash_short_count + ' — S2 cash ground truth');
    if (c.cash_drops)              cl.push('cash_drops_logged=' + c.cash_drops);
    if (c.deliveries_logged)       cl.push('deliveries_logged=' + c.deliveries_logged + ' vendor_price_changes=' + c.vendor_price_changes + ' — S4 vendor ground truth');
    if (c.labor_hours != null)     cl.push('labor_hours=' + c.labor_hours + ' labor_cost_$=' + c.labor_cost + ' — S5 prime cost labor ground truth');
    if (cl.length) {
      controlBlock = '\nVERIFIED CONTROL DATA — this operator runs Bar Cop\'s Inventory, Shift and Labor Control modules. The figures below are real logged operational data, not estimates. Treat them as ground truth: score the sections they cover from these values, do not estimate those numbers or depend on uploaded files for them, and reflect this verified coverage in DATA_TIER_LABEL. Sections not covered here still rely on the uploads.\n'
        + cl.map(l => '  ' + l).join('\n') + '\n';
    }
  }

  return `PROFIT AUDIT — respond with a single JSON object, no other text. Use the app data below to populate every field. Never output 0 for a score.

SCORING (out of 100 each):
S1 Bar Cost: gap vs target — within 1pt=85, within 3=65, within 5=45, >5 over=25. +10 if recipes>0, +5 pour method known.
S2 Theft: base 50. +15 cash recon present, +10 shift checks present, +15 void/comp data from file, +10 approval policy documented.
S3 Food Cost: same scale as S1. +10 if kitchen products>0, +5 inventory freq known.
S4 Vendor: base 40. +15 vendor log entries>0, +10 recipes>5, +10 bar products>10, +15 invoices uploaded.
S5 Prime Cost: prime% vs target — within 2=80, within 5=60, within 8=40, >8 over=20. +${weeks.length>4?15:weeks.length>0?8:0} weekly tracking.
S6: 4 specific risk signals with HIGH/MEDIUM/LOW ratings.
OVERALL: weighted avg S1-S5.

APP DATA:
bar_name=${settings.bar_name||''} | city=${settings.city_state||''} | annual_bar_rev=$${settings.annual_bar_revenue||0} | annual_food_rev=$${settings.annual_food_revenue||0}
bar_cost_target=${(settings.targets&&settings.targets.bar_pour_cost_pct)||22}% | food_cost_target=${(settings.targets&&settings.targets.food_cost_pct)||32}% | prime_target=${(settings.targets&&settings.targets.prime_cost_pct)||60}%
avg_bar_cost_pct=${avgBarCost?avgBarCost.toFixed(1):'unknown'} | avg_food_cost_pct=${avgFoodCost?avgFoodCost.toFixed(1):'unknown'}
avg_weekly_bar_rev=$${avgBarRev?Math.round(avgBarRev):0} | avg_weekly_food_rev=$${avgFoodRev?Math.round(avgFoodRev):0}
monthly_bar_rev_est=$${avgBarRev?Math.round(avgBarRev*4.33):0} | monthly_food_rev_est=$${avgFoodRev?Math.round(avgFoodRev*4.33):0}
bar_products=${products.length} | kitchen_products=${kitchen.length} | recipes=${recipes.length} | weeks_data=${weeks.length}
shift_checks=${shifts.length} | cash_recons=${recons.length} | vendor_log_entries=${vendor.length}
theft_score=${theft.length?(theft[theft.length-1]&&theft[theft.length-1].total)||'unscored':'unscored'}
${weeklySummary?'WEEKLY:\n'+weeklySummary:''}
${reconSummary?'RECONS:\n'+reconSummary:''}
${controlBlock}
TOOL RULE: every _TOOL field must name a real Bar Cop tool or a plain floor action. Never invent a Bar Cop worksheet, policy, report, or feature, and never tell the operator to set something in their POS without also naming the Bar Cop tool that tracks it. Real Bar Cop tools: Profit Fix, This Week, Profit Forecast, Vendor Tracker (Scorecard / Price Changes / Discrepancies), Recipe Summary, Loss Prevention, Over and Short, Void and Comps, Waste and Spills, Cash Control, Shift Policies (comp authorization threshold), Take Inventory, Spot Check, Receive Delivery, Variance Report, Order Sheet, Build Schedule, Overtime Watch. Plain floor actions (jigger every pour, count at close, require a manager sign-off) are fine.

Return this exact JSON structure with all values calculated (not 0):
"BAR_NAME","BAR_CITY_STATE","REVENUE_TIER","AUDIT_DATE","AUDIT_ID":"PFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}","AUDIT_PERIOD","DATA_TIER_LABEL","WEEKLY_GAP_AMT","GAP_SOURCES","INDUSTRY_AVG":63,"TARGET_SCORE":70,
"OVERALL_SCORE":[calculated],
"S1_SCORE":[calc],"S1_BAR_COST_PCT":[from app:${avgBarCost?avgBarCost.toFixed(1):0}],"S1_BAR_REV_MONTHLY":[calc],"S1_BEV_COGS_PERIOD":[calc],"S1_BAR_REV_PERIOD":[calc],"S1_INV_VARIANCE_PCT":[from file or 0],"S1_INV_VARIANCE_AMT":[calc],"S1_POUR_METHOD":[from file],"S1_RECIPE_COVERAGE":"${recipes.length} recipes","S1_VARIANCE_FREQ":[obs],"S1_VARIANCE_SKU":[obs],"S1_TARGET_PCT":${(settings.targets&&settings.targets.bar_pour_cost_pct)||22},"S1_GAP_PTS":[calc],"S1_MONTHLY_GAP":[calc],"S1_ANNUAL_GAP":[calc],"S1_PTS_BAR_COST":[pts],"S1_PTS_RECIPE":[pts],"S1_PTS_POUR":[pts],"S1_PTS_VAR_FREQ":[pts],"S1_PTS_VAR_SKU":[pts],
"S2_SCORE":[calc],"S2_BEV_REV_MONTHLY":[calc],"S2_VOIDS_AMT":[file or 0],"S2_COMPS_AMT":[file or 0],"S2_VOID_COMP_PCT":[file or 1.5],"S2_VOID_COMP_AMT":[calc],"S2_VOIDS_NO_APPROVAL_PCT":[file or 0],"S2_VOIDS_NO_APPROVAL_AMT":[calc],"S2_CASH_POLICY":"${recons.length>0?'Reconciliation performed':'Not documented'}","S2_VOID_APPROVAL":[obs],"S2_DRAWER_RECON":"${recons.length>0?'Yes — '+recons.length+' entries':'No'}","S2_OVERSHORT_POLICY":[obs],"S2_BOTTLE_SECURITY":[obs],"S2_NOSALE_POLICY":[obs],"S2_SPILLAGE_LOG":"${shifts.length>0?'Yes — '+shifts.length+' shift checks':'Not documented'}","S2_BENCHMARK_PCT":2.0,"S2_GAP_PCT":[calc],"S2_MONTHLY_GAP":[calc],"S2_ANNUAL_GAP":[calc],"S2_PTS_VOID_COMP":[pts],"S2_PTS_VOID_APPROVAL":[pts],"S2_PTS_DRAWER":${recons.length>0?15:0},"S2_PTS_CASH_POLICY":[pts],"S2_PTS_BOTTLE":[pts],"S2_PTS_SPILLAGE":${shifts.length>0?10:0},
"S3_SCORE":[calc],"S3_FOOD_COST_PCT":[from app:${avgFoodCost?avgFoodCost.toFixed(1):0}],"S3_FOOD_REV_MONTHLY":[calc],"S3_FOOD_COGS_PERIOD":[calc],"S3_FOOD_VAR_PCT":[file or 0],"S3_FOOD_VAR_AMT":[calc],"S3_RECIPE_COVERAGE":"${kitchen.length} kitchen products","S3_PORTION_STANDARDS":[obs],"S3_INV_FREQ":[obs],"S3_THEO_ACTUAL":[obs],"S3_WASTE_LOG":[obs],"S3_TARGET_PCT":${(settings.targets&&settings.targets.food_cost_pct)||32},"S3_GAP_PTS":[calc],"S3_MONTHLY_GAP":[calc],"S3_ANNUAL_GAP":[calc],"S3_PTS_FOOD_COST":[pts],"S3_PTS_RECIPE":[pts],"S3_PTS_PORTION":[pts],"S3_PTS_INV":[pts],"S3_PTS_WASTE":[pts],
"S4_SCORE":[calc],"S4_BEV_INVOICE_COUNT":[file or ${vendor.length}],"S4_FOOD_INVOICE_COUNT":[file or 0],"S4_AUDIT_PERIOD_DESC":"4 weeks","S4_VENDOR_SPEND_MONTHLY":[calc],"S4_BEV_INVOICE_SPEND":[file or calc],"S4_FOOD_INVOICE_SPEND":[file or calc],"S4_INVOICE_VS_PO":[obs],"S4_PRICE_VERIFY":"${vendor.length>0?'Active — '+vendor.length+' changes logged':'Not documented'}","S4_DELIVERY_COUNT":[obs],"S4_CREDIT_MEMOS":[obs],"S4_PAYMENT_POLICY":[obs],"S4_EXPOSURE_PCT":3.0,"S4_EXPOSURE_MONTHLY":[calc 3% of COGS],"S4_EXPOSURE_ANNUAL":[calc],"S4_PTS_INVOICE_PO":[pts],"S4_PTS_PRICE_VERIFY":${vendor.length>0?15:0},"S4_PTS_DELIVERY":[pts],"S4_PTS_CREDIT":[pts],"S4_PTS_PAYMENT":[pts],
"S5_SCORE":[calc],"S5_BEV_REV_PERIOD":[calc],"S5_FOOD_REV_PERIOD":[calc],"S5_TOTAL_REV_PERIOD":[calc],"S5_BEV_COGS_PERIOD":[calc],"S5_FOOD_COGS_PERIOD":[calc],"S5_TOTAL_COGS_PERIOD":[calc],"S5_LABOR_PERIOD":[file or est 28% rev],"S5_LABOR_PCT":[file or 28],"S5_LABOR_SOURCE":"${weeks.length>0?'App data':'Estimated 28%'}","S5_PRIME_COST_AMT":[calc],"S5_PRIME_COST_PCT":[calc],"S5_TARGET_PCT":${(settings.targets&&settings.targets.prime_cost_pct)||60},"S5_BAR_COST_PCT":[from app],"S5_FOOD_COST_PCT":[from app],"S5_BLENDED_COGS_PCT":[calc],"S5_PRIME_WEEKLY":"${weeks.length>0?weeks.length+' weeks tracked':'Not tracked'}","S5_LABOR_BY_DEPT":[obs],"S5_SCHEDULE_FORECAST":[obs],"S5_RPLH_TRACKED":[obs],"S5_BAR_COST_GAP_MONTHLY":[calc],"S5_FOOD_COST_GAP_MONTHLY":[calc],"S5_COMBINED_COGS_GAP":[calc],"S5_TOTAL_REV_MONTHLY":[calc],"S5_LABOR_MONTHLY":[calc],"S5_PTS_PRIME_PCT":[pts],"S5_PTS_PRIME_WEEKLY":${weeks.length>4?15:weeks.length>0?8:0},"S5_PTS_LABOR_DEPT":[pts],"S5_PTS_SCHEDULE":[pts],"S5_PTS_RPLH":[pts],
"S6_SIG1_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG1_LABEL":[specific title],"S6_SIG1_EVIDENCE":[specific with numbers],"S6_SIG1_GAP":[specific gap],"S6_SIG1_TOOL":[action],
"S6_SIG2_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG2_LABEL":[specific],"S6_SIG2_EVIDENCE":[specific],"S6_SIG2_GAP":[specific],"S6_SIG2_TOOL":[action],
"S6_SIG3_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG3_LABEL":[specific],"S6_SIG3_EVIDENCE":[specific],"S6_SIG3_GAP":[specific],"S6_SIG3_TOOL":[action],
"S6_SIG4_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG4_LABEL":[specific],"S6_SIG4_EVIDENCE":[specific],"S6_SIG4_GAP":[specific],"S6_SIG4_TOOL":[action]`
}

function getExtractionPrompt_Revenue(appData, controlData) {
  const settings     = appData.settings || {};
  const targets      = settings.targets || {};
  const weeks        = appData.revenue_weeks || [];
  const servers      = appData.revenue_servers || [];
  const menuItems    = appData.revenue_menu_items || [];

  const recentWeeks  = weeks.slice(-4);
  const avgCheckAvg  = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.check_avg||0),0)/recentWeeks.length : null;
  const avgLaborPct  = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.labor_pct_blended||0),0)/recentWeeks.length : null;
  const avgRPLH      = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.rplh_blended||0),0)/recentWeeks.length : null;
  const avgCovers    = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.covers||0),0)/recentWeeks.length : null;
  const avgBarRev    = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.bar_revenue||0),0)/recentWeeks.length : null;
  const avgFloorRev  = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.floor_revenue||0),0)/recentWeeks.length : null;
  const totalAnnual  = (settings.annual_bar_revenue||0) + (settings.annual_food_revenue||0);

  // Build a compact server roster string for the prompt
  const serverRoster = servers.length
    ? servers.slice(0,20).map((sv,i) => `  ${i+1}. ${sv.name||('Server '+(i+1))}${sv.role?' ('+sv.role+')':''}${sv.wage?' $'+sv.wage+'/hr':''}`).join('\n')
    : '  None on roster';

  // Build recent weekly data summary
  const weeklySummary = recentWeeks.length
    ? recentWeeks.map((w,i) => {
        const parts = [`Week ${i+1}`];
        if (w.week_end) parts.push(w.week_end);
        if (w.total_revenue) parts.push('Rev $'+w.total_revenue);
        if (w.check_avg) parts.push('Check avg $'+w.check_avg);
        if (w.covers) parts.push('Covers '+w.covers);
        if (w.labor_pct_blended) parts.push('Labor '+w.labor_pct_blended+'%');
        if (w.rplh_blended) parts.push('RPLH $'+w.rplh_blended);
        return '  ' + parts.join(' | ');
      }).join('\n')
    : '  No weekly data entered yet';

  // Build menu items summary
  const menuSummary = menuItems.length
    ? menuItems.slice(0,30).map(m => `  ${m.name||'Item'} | ${m.category||''} | Price: $${m.price||0} | Cost: $${m.cost||0}`).join('\n')
    : '  No menu items entered yet';

  // Verified Control-module data — real logged Labor Control data the audit
  // treats as ground truth for the sections it covers (map Section 8).
  let controlBlock = '';
  if (controlData && typeof controlData === 'object') {
    const c = controlData, cl = [];
    if (c.check_average != null)     cl.push('verified_check_average=$' + c.check_average + ' — S1 ground truth');
    if (c.labor_pct_blended != null) cl.push('verified_labor_pct=' + c.labor_pct_blended + ' — S2 ground truth');
    if (c.rplh_blended != null)      cl.push('verified_rplh=$' + c.rplh_blended + ' — S2 ground truth');
    if (c.labor_hours != null)       cl.push('labor_hours_logged=' + c.labor_hours + ' labor_cost_$=' + c.labor_cost + ' — S2 ground truth');
    if (c.roster_count)              cl.push('staff_on_roster=' + c.roster_count + ' — S4 server count ground truth');
    if (cl.length) {
      controlBlock = '\nVERIFIED CONTROL DATA — this operator runs Bar Cop\'s Labor Control module, and the weekly revenue and labor figures are confirmed records fed from Control. The figures below are real logged operational data, not estimates. Treat them as ground truth: score the sections they cover from these values, do not estimate those numbers or depend on uploaded files for them, and reflect this verified coverage in DATA_TIER_LABEL. Sections not covered here still rely on the uploads.\n'
        + cl.map(l => '  ' + l).join('\n') + '\n';
    }
  }

  return `REVENUE AUDIT — respond with a single JSON object, no other text. Use app data below. Never output 0 for a score.

SCORING (out of 100 each):
S1 Check Avg: within $1 of target=85, within $3=70, within $5=55, >$5 below=35.
S2 Labor: labor% vs target — within 1pt=85, within 3=65, >5 over=35. RPLH tracked adds 15.
S3 Menu: items in system >20=60 base, 10-20=50, <10=40. POS mix data +30, pricing data +10.
S4 Server: no report=45 base. With report: score spread. Servers on roster >0 adds 5.
S5 Events: no data=50. Score if data present.
S6: 4 specific revenue-side risk signals with HIGH/MEDIUM/LOW ratings (server-level patterns, daypart staffing anomalies, menu-item complaint concentration, missing pre-shift, anything an experienced operator would flag on a walkthrough). Not scored, surfaced as signals only.
OVERALL: weighted avg S1-S5.

APP DATA:
bar_name=${settings.bar_name||''} | city=${settings.city_state||''}
annual_bar_rev=$${settings.annual_bar_revenue||0} | annual_food_rev=$${settings.annual_food_revenue||0}
check_avg_target=$${targets.check_avg||35} | labor_target=${targets.labor_cost_pct||30}%
rplh_targets: lunch=$${targets.rplh_lunch||50} dinner=$${targets.rplh_dinner||75} bar=$${targets.rplh_bar||65}
servers_on_roster=${servers.length} | menu_items=${menuItems.length} | weeks_data=${weeks.length}
avg_check_avg=$${avgCheckAvg?avgCheckAvg.toFixed(2):0} | avg_labor_pct=${avgLaborPct?avgLaborPct.toFixed(1):0}%
avg_rplh=$${avgRPLH?avgRPLH.toFixed(2):0} | avg_covers_week=${avgCovers?Math.round(avgCovers):0}
avg_bar_rev_week=$${avgBarRev?Math.round(avgBarRev):0} | avg_floor_rev_week=$${avgFloorRev?Math.round(avgFloorRev):0}
monthly_covers_est=${avgCovers?Math.round(avgCovers*4.33):0} | monthly_rev_est=$${avgBarRev&&avgFloorRev?Math.round((avgBarRev+avgFloorRev)*4.33):0}
${weeklySummary?'WEEKLY:\n'+weeklySummary:''}
${serverRoster?'SERVERS:\n'+serverRoster:''}
${controlBlock}
TOOL RULE: every _TOOL field must name a real Bar Cop tool or a plain floor action. Never invent a Bar Cop worksheet, sheet, script pack, report, or feature. Real Bar Cop tools: Revenue Fix, This Week, Revenue Forecast, Menu Items, Menu Engineering, Price Calculator, Dog Test Tracker, Server Check, and cross-module Loss Prevention, Shift Policies (comps), Build Schedule, Overtime Watch. Plain floor actions (run a daily pre-shift, set an upsell standard, reprice a plate) are fine.

Return this exact JSON (all values calculated):
"BAR_NAME","BAR_CITY_STATE","REVENUE_TIER","AUDIT_DATE","AUDIT_ID":"RFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}","AUDIT_PERIOD","DATA_TIER_LABEL","WEEKLY_GAP_AMT","GAP_SOURCES","INDUSTRY_AVG":61,"TARGET_SCORE":70,
"OVERALL_SCORE":[calc weighted avg],
"S1_SCORE":[calc],"S1_CHECK_AVG":[from app:${avgCheckAvg?avgCheckAvg.toFixed(2):0}],"S1_CHECK_AVG_TARGET":${targets.check_avg||35},"S1_BAR_CHECK_AVG":[from report or est],"S1_FOOD_CHECK_AVG":[from report or est],"S1_COVER_COUNT":${avgCovers?Math.round(avgCovers*4.33):0},"S1_MONTHLY_REVENUE":${avgBarRev&&avgFloorRev?Math.round((avgBarRev+avgFloorRev)*4.33):0},"S1_MONTHLY_GAP":[calc: (target-actual)*covers],"S1_ANNUAL_GAP":[calc],
"S2_SCORE":[calc],"S2_LABOR_PCT":[from app:${avgLaborPct?avgLaborPct.toFixed(1):30}],"S2_LABOR_TARGET_PCT":${targets.labor_cost_pct||30},"S2_RPLH":[from app:${avgRPLH?avgRPLH.toFixed(2):0}],"S2_RPLH_TARGET":${targets.rplh_dinner||75},"S2_LABOR_PERIOD":[calc],"S2_SCHED_VS_ACTUAL":[obs],"S2_OVERTIME_HRS":[file or null],"S2_MONTHLY_GAP":[calc],"S2_ANNUAL_GAP":[calc],
"S3_SCORE":[calc],"S3_STARS_COUNT":[file or 0],"S3_PLOWHORSES_COUNT":[file or 0],"S3_DOGS_COUNT":[file or 0],"S3_PUZZLES_COUNT":[file or 0],"S3_TOP_CATEGORY":[file or est],"S3_MONTHLY_GAP":[calc or 0],"S3_PRICING_OPPORTUNITY":[calc or 0],
"S4_SCORE":[calc],"S4_SERVER_COUNT":${servers.length||0},"S4_TOP_CHECK_AVG":[file or 0],"S4_BOTTOM_CHECK_AVG":[file or 0],"S4_PERFORMANCE_SPREAD":[calc],"S4_APP_ATTACH_RATE":[file or null],"S4_DESSERT_ATTACH_RATE":[file or null],"S4_PRESHIFT_BRIEFING":[obs],"S4_MONTHLY_GAP":[calc or 0],"S4_ANNUAL_GAP":[calc],
"S5_SCORE":50,"S5_EVENT_REV_PERIOD":[file or null],"S5_EVENTS_PER_MONTH":[file or null],"S5_AVG_EVENT_REVENUE":[file or null],"S5_MINIMUM_MET":[file or null],"S5_CATERING_REV_PERIOD":[file or null],"S5_ANNUAL_EVENT_GAP":[file or null],"S5_MONTHLY_GAP":[file or null],
"S6_SIG1_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG1_LABEL":[specific title],"S6_SIG1_EVIDENCE":[specific with numbers],"S6_SIG1_GAP":[specific gap],"S6_SIG1_TOOL":[action],
"S6_SIG2_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG2_LABEL":[specific],"S6_SIG2_EVIDENCE":[specific],"S6_SIG2_GAP":[specific],"S6_SIG2_TOOL":[action],
"S6_SIG3_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG3_LABEL":[specific],"S6_SIG3_EVIDENCE":[specific],"S6_SIG3_GAP":[specific],"S6_SIG3_TOOL":[action],
"S6_SIG4_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG4_LABEL":[specific],"S6_SIG4_EVIDENCE":[specific],"S6_SIG4_GAP":[specific],"S6_SIG4_TOOL":[action]`
}

// ── Stripe checkout session ───────────────────────────────────────────────────
// Per-bar billing, two prices on the one "Bar Cop" product. IDs come from env
// so the test→live swap is an env change, not a code edit. The fallbacks are the
// SANDBOX price IDs (safe test money); set the env vars to the LIVE IDs at launch.
const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || 'price_1TpwYXGow04S066UQ8BSpauR'; // $249/mo
const STRIPE_PRICE_ANNUAL  = process.env.STRIPE_PRICE_ANNUAL  || 'price_1TpwZ1Gow04S066UBcwhEPNK'; // $2,490/yr
const ALL_MODULES     = ['profit', 'revenue'];

app.post('/api/create-checkout-session', async (req, res) => {
  const { accountId, plan } = req.body || {};
  if (!accountId) return res.status(400).json({ error: 'Missing accountId' });

  try {
    // Verify the caller via their JWT and confirm they own/administer the target
    // account. Never trust a client-supplied user id, and never let a caller
    // start billing (which the webhook keys by account_id) for an account they
    // are not entitled to — otherwise an outsider could bind or overwrite a
    // subscription on someone else's bar.
    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid auth token' });
    const userId = userData.user.id;

    const { data: acct } = await supabaseAdmin
      .from('accounts').select('owner_user_id').eq('id', accountId).single();
    if (!acct) return res.status(404).json({ error: 'Account not found' });

    let allowed = acct.owner_user_id === userId;
    if (!allowed) {
      const { data: mem } = await supabaseAdmin
        .from('memberships').select('role').eq('account_id', accountId).eq('user_id', userId).single();
      allowed = !!(mem && mem.role === 'admin');
    }
    if (!allowed) return res.status(403).json({ error: 'Not allowed to start billing for this account.' });

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const priceId = plan === 'annual' ? STRIPE_PRICE_ANNUAL : STRIPE_PRICE_MONTHLY;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://app.barcop.com/?checkout=success',
      cancel_url:  'https://app.barcop.com/?checkout=cancelled',
      metadata: { user_id: userId, account_id: accountId }
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('Checkout session error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Stripe billing portal ─────────────────────────────────────────────────────
// Owner-only. Verifies the caller's JWT (never trusts a client-supplied user id)
// and confirms they own the target account before opening the portal. Billing
// lives with the account owner, so the subscription is looked up by owner id.
app.post('/api/billing-portal', async (req, res) => {
  const { accountId } = req.body || {};
  if (!accountId) return res.status(400).json({ error: 'Missing accountId' });

  try {
    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    const requesterUserId = userData.user.id;

    const { data: acct } = await supabaseAdmin
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .single();

    if (!acct || !acct.owner_user_id || acct.owner_user_id !== requesterUserId) {
      return res.status(403).json({ error: 'Only the account owner can manage billing.' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('account_id', accountId)
      .single();

    if (error || !data?.stripe_customer_id) {
      return res.status(404).json({ error: 'No Stripe customer found for this account.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: 'https://app.barcop.com/'
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('Billing portal error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Stripe webhook ────────────────────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseAdmin = createClient(
  'https://plpikfpintruksclkwyb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session    = event.data.object;
      const customerId = session.customer;
      const email      = session.customer_details?.email || session.customer_email;

      let userId    = session.metadata?.user_id || null;
      let accountId = session.metadata?.account_id || null;

      if (!userId && email) {
        const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
        const found = existing?.users?.find(u => u.email === email);
        if (found) {
          userId = found.id;
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { created_via: 'stripe_checkout' },
          });
          if (createErr) {
            console.error('Failed to create Supabase user:', createErr.message);
          } else {
            userId = created.user.id;
            console.log('Account created for new subscriber:', email);
          }
        }
      }

      // Billing is per bar (per account). The signup flow passes account_id in
      // metadata; if it is missing (e.g. a raw payment link), fall back to the
      // account this user owns.
      if (!accountId && userId) {
        const { data: acct } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('owner_user_id', userId)
          .limit(1)
          .maybeSingle();
        accountId = acct?.id || null;
      }

      if (accountId) {
        await supabaseAdmin.from('subscriptions').upsert({
          account_id:          accountId,
          user_id:             userId,
          stripe_customer_id:  customerId,
          subscription_status: 'active',
          subscription_plan:   'full_access',
          active_modules:      ALL_MODULES,
          current_period_end:  null,
          updated_at:          new Date().toISOString(),
        }, { onConflict: 'account_id' });
      } else {
        console.error('checkout.session.completed: no account_id resolved for customer', customerId);
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub        = event.data.object;
      const customerId = sub.customer;
      const status     = sub.status;
      const periodEnd  = new Date(sub.current_period_end * 1000).toISOString();

      await supabaseAdmin.from('subscriptions')
        .update({
          subscription_status: status,
          current_period_end:  periodEnd,
          updated_at:          new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub        = event.data.object;
      const customerId = sub.customer;

      await supabaseAdmin.from('subscriptions')
        .update({
          subscription_status: 'canceled',
          active_modules:      [],
          updated_at:          new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// ── Bug report notification ──────────────────────────────────────────────────
// Fires after the client successfully writes a bug report row to Supabase.
// The DB record is the source of truth; this endpoint just sends a courtesy
// email so the team gets pinged without polling the table. If Resend fails
// or the env vars are missing, we still return ok=true — the report itself
// is safely persisted, the email is best-effort.
app.post('/api/report-bug-notify', async (req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.BUG_REPORT_NOTIFY_EMAIL;
  const from   = process.env.BUG_REPORT_SENDER || 'onboarding@resend.dev';
  if (!apiKey || !to) {
    console.warn('report-bug-notify: RESEND_API_KEY or BUG_REPORT_NOTIFY_EMAIL not configured; skipping email');
    return res.json({ ok: true, emailed: false, reason: 'not_configured' });
  }
  try {
    const r = req.body || {};
    const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
    const sevLabel = { minor:'Minor', moderate:'Moderate', major:'Major', critical:'Critical' }[r.severity] || 'Moderate';
    const sevColor = { minor:'#888', moderate:'#9A5D34', major:'#C03828', critical:'#C03828' }[r.severity] || '#9A5D34';
    const subject  = 'Bar Cop Bug: ' + (r.title || 'Untitled report');
    const row = (label, value) => value
      ? '<tr><td style="padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:1px solid #eee;width:160px;vertical-align:top;">' + esc(label) + '</td>'
        + '<td style="padding:8px 12px;font-size:13px;color:#111;border-bottom:1px solid #eee;white-space:pre-wrap;">' + esc(value) + '</td></tr>'
      : '';
    const html =
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111;">'
      +   '<div style="border-bottom:3px solid ' + sevColor + ';padding-bottom:14px;margin-bottom:18px;">'
      +     '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#999;">Bar Cop Bug Report</div>'
      +     '<div style="font-size:18px;font-weight:700;color:#111;margin-top:4px;">' + esc(r.title || 'Untitled report') + '</div>'
      +     '<div style="font-size:12px;color:' + sevColor + ';font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:6px;">' + sevLabel + ' severity</div>'
      +   '</div>'
      +   '<table style="width:100%;border-collapse:collapse;">'
      +     row('What Happened',      r.what_happened)
      +     row('Steps to Reproduce', r.steps_to_reproduce)
      +     row('Expected Behavior',  r.expected_behavior)
      +     row('Reporter Email',     r.user_email)
      +     row('From Screen',        r.previous_screen)
      +     row('Browser',            r.user_agent)
      +     row('Viewport',           r.viewport)
      +     row('Submitted',          new Date().toLocaleString('en-US', { dateStyle:'medium', timeStyle:'short' }))
      +   '</table>'
      +   '<div style="margin-top:18px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:12px;">Full report is also in your Supabase bug_reports table.</div>'
      + '</div>';

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, reply_to: r.user_email || undefined })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Resend send failed:', resp.status, txt);
      return res.json({ ok: true, emailed: false, reason: 'send_failed' });
    }
    res.json({ ok: true, emailed: true });
  } catch (e) {
    console.error('report-bug-notify exception:', e);
    res.json({ ok: true, emailed: false, reason: 'exception' });
  }
});

// ── Support message notification ─────────────────────────────────────────────
// Email-only contact form from the Hub "Contact Support" screen. No DB row
// is kept — the support inbox is the record. The user's email is set as
// reply_to so the team can hit Reply and write back directly.
app.post('/api/support-message-notify', async (req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.SUPPORT_NOTIFY_EMAIL || process.env.BUG_REPORT_NOTIFY_EMAIL;
  const from   = process.env.BUG_REPORT_SENDER || 'onboarding@resend.dev';
  if (!apiKey || !to) {
    console.warn('support-message-notify: RESEND_API_KEY or notify email not configured');
    return res.json({ ok: false, emailed: false, reason: 'not_configured' });
  }
  try {
    const r = req.body || {};
    const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
    const subject = 'Bar Cop Support: ' + (r.subject || '(no subject)');
    const row = (label, value) => value
      ? '<tr><td style="padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:1px solid #eee;width:160px;vertical-align:top;">' + esc(label) + '</td>'
        + '<td style="padding:8px 12px;font-size:13px;color:#111;border-bottom:1px solid #eee;white-space:pre-wrap;">' + esc(value) + '</td></tr>'
      : '';
    const html =
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111;">'
      +   '<div style="border-bottom:3px solid #4C8EAB;padding-bottom:14px;margin-bottom:18px;">'
      +     '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#999;">Bar Cop Support Message</div>'
      +     '<div style="font-size:18px;font-weight:700;color:#111;margin-top:4px;">' + esc(r.subject || '(no subject)') + '</div>'
      +     '<div style="font-size:12px;color:#4C8EAB;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:6px;">' + esc(r.topic || 'Other') + '</div>'
      +   '</div>'
      +   '<table style="width:100%;border-collapse:collapse;">'
      +     row('Message',         r.message)
      +     row('Reporter Email',  r.user_email)
      +     row('From Screen',     r.previous_screen)
      +     row('Submitted',       new Date().toLocaleString('en-US', { dateStyle:'medium', timeStyle:'short' }))
      +   '</table>'
      +   '<div style="margin-top:18px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:12px;">Reply directly to this email to respond to the user.</div>'
      + '</div>';

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, reply_to: r.user_email || undefined })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Resend send failed:', resp.status, txt);
      return res.json({ ok: false, emailed: false, reason: 'send_failed' });
    }
    res.json({ ok: true, emailed: true });
  } catch (e) {
    console.error('support-message-notify exception:', e);
    res.json({ ok: false, emailed: false, reason: 'exception' });
  }
});

// ── Invite user to an account (Phase 2 multi-user) ────────────────────────────
// Admin sends an invite from App Settings → Team. Recipient gets a Supabase
// magic-link email. When they sign up, the 24a trigger reads the metadata
// (invited_to_account_id + invited_role) and links them to this account
// instead of creating a new one for them.
app.post('/api/invite-user', async (req, res) => {
  try {
    const { email, accountId, role, permissions } = req.body || {};
    if (!email || !accountId) {
      return res.status(400).json({ error: 'email and accountId required' });
    }
    // Permissions: optional JSON object { groupKey: 'add' | 'edit' } for staff role.
    // Sanitized so only known levels are stored.
    const cleanPerms = (permissions && typeof permissions === 'object')
      ? Object.fromEntries(
          Object.entries(permissions).filter(([k, v]) => v === 'add' || v === 'edit')
        )
      : {};

    // Verify the requester via their JWT (don't trust client-supplied user IDs)
    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    const inviterUserId = userData.user.id;

    // Inviter must be an admin of the target account
    const { data: membership, error: memberError } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('account_id', accountId)
      .eq('user_id', inviterUserId)
      .single();

    if (memberError || !membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only account admins can send invites' });
    }

    const validRoles = ['admin', 'staff', 'viewer'];
    const inviteRole = validRoles.includes(role) ? role : 'staff';
    const cleanEmail = String(email).toLowerCase().trim();

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        data: {
          invited_to_account_id: accountId,
          invited_role: inviteRole,
          invited_permissions: cleanPerms
        },
        redirectTo: 'https://app.barcop.com/'
      }
    );

    if (inviteError) {
      // Common case: this person was previously invited/removed. Their auth
      // row still exists, so Supabase refuses a new invite. Look up the
      // existing user by email and add a membership row directly.
      const errMsg = (inviteError.message || '').toLowerCase();
      const isAlreadyRegistered = errMsg.includes('already') &&
        (errMsg.includes('registered') || errMsg.includes('exists'));

      if (isAlreadyRegistered) {
        let existingUserId = null;
        try {
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = (usersData?.users || []).find(u => u.email && u.email.toLowerCase() === cleanEmail);
          if (found) existingUserId = found.id;
        } catch (e) {
          console.error('listUsers fallback failed:', e);
        }

        if (!existingUserId) {
          return res.status(500).json({ error: 'Email is already registered but the user record could not be located.' });
        }

        const { data: alreadyMember } = await supabaseAdmin
          .from('memberships')
          .select('id')
          .eq('account_id', accountId)
          .eq('user_id', existingUserId)
          .maybeSingle();

        if (alreadyMember) {
          return res.status(400).json({ error: 'This person is already a member of this account.' });
        }

        const { error: insertError } = await supabaseAdmin
          .from('memberships')
          .insert({ account_id: accountId, user_id: existingUserId, role: inviteRole, permissions: cleanPerms });

        if (insertError) {
          return res.status(500).json({ error: insertError.message });
        }

        // Also send a password recovery email so they can set (or reset) their
        // password and sign in. Triggers the recovery flow in app.js which
        // shows the set-password panel. Non-fatal if email send fails.
        let emailSent = false;
        try {
          const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: 'https://app.barcop.com/'
          });
          emailSent = !resetErr;
          if (resetErr) console.error('Password reset email failed:', resetErr);
        } catch (e) {
          console.error('Password reset email exception:', e);
        }

        return res.json({ ok: true, email: cleanEmail, role: inviteRole, addedDirectly: true, emailSent });
      }

      console.error('Invite error:', inviteError);
      return res.status(500).json({ error: inviteError.message || 'Invite failed' });
    }

    res.json({ ok: true, email: cleanEmail, role: inviteRole });
  } catch (e) {
    console.error('Invite exception:', e);
    res.status(500).json({ error: e.message || 'Invite failed' });
  }
});

// ── List members of an account (Phase 2 multi-user) ───────────────────────────
// Returns every member of the account along with their email and role. Caller
// must be a member of the account (any role) to see the list.
app.post('/api/list-members', async (req, res) => {
  try {
    const { accountId } = req.body || {};
    if (!accountId) return res.status(400).json({ error: 'accountId required' });

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    const requesterUserId = userData.user.id;

    const { data: requesterMembership } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('account_id', accountId)
      .eq('user_id', requesterUserId)
      .single();

    if (!requesterMembership) {
      return res.status(403).json({ error: 'Not a member of this account' });
    }

    // The account owner (accounts.owner_user_id) is the Owner tier — protected
    // in the UI (no role dropdown, no Remove) and on the server.
    const { data: acct } = await supabaseAdmin
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .single();
    const ownerUserId = acct?.owner_user_id || null;

    const { data: memberships, error: listError } = await supabaseAdmin
      .from('memberships')
      .select('id, user_id, role, permissions, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true });

    if (listError) {
      return res.status(500).json({ error: listError.message });
    }

    // Resolve emails via admin API
    const members = [];
    for (const m of memberships || []) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        members.push({
          id: m.id,
          user_id: m.user_id,
          email: u?.user?.email || '(unknown)',
          role: m.role,
          permissions: m.permissions || {},
          confirmed: !!u?.user?.confirmed_at,
          created_at: m.created_at,
          is_self: m.user_id === requesterUserId,
          is_owner: !!ownerUserId && m.user_id === ownerUserId
        });
      } catch (e) {
        members.push({
          id: m.id,
          user_id: m.user_id,
          email: '(unknown)',
          role: m.role,
          permissions: m.permissions || {},
          confirmed: false,
          created_at: m.created_at,
          is_self: m.user_id === requesterUserId,
          is_owner: !!ownerUserId && m.user_id === ownerUserId
        });
      }
    }

    res.json({ ok: true, members, requesterRole: requesterMembership.role, ownerUserId, requesterIsOwner: !!ownerUserId && requesterUserId === ownerUserId });
  } catch (e) {
    console.error('list-members exception:', e);
    res.status(500).json({ error: e.message || 'List members failed' });
  }
});

// ── Update a member's role (Phase 2 multi-user) ───────────────────────────────
// Only admins can call. Cannot demote the last admin. Cannot change your own role.
app.post('/api/update-member-role', async (req, res) => {
  try {
    const { accountId, membershipId, newRole } = req.body || {};
    if (!accountId || !membershipId || !newRole) {
      return res.status(400).json({ error: 'accountId, membershipId, newRole required' });
    }
    const validRoles = ['admin', 'staff', 'viewer'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    const requesterUserId = userData.user.id;

    const { data: requesterMembership } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('account_id', accountId)
      .eq('user_id', requesterUserId)
      .single();

    if (!requesterMembership || requesterMembership.role !== 'admin') {
      return res.status(403).json({ error: 'Only account admins can change roles' });
    }

    const { data: target } = await supabaseAdmin
      .from('memberships')
      .select('id, user_id, role')
      .eq('id', membershipId)
      .eq('account_id', accountId)
      .single();

    if (!target) return res.status(404).json({ error: 'Member not found in this account' });
    if (target.user_id === requesterUserId) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    // Owner protection: the account owner's role cannot be changed here. Ownership
    // moves only through Transfer Ownership, which reassigns owner_user_id.
    const { data: acctRole } = await supabaseAdmin
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .single();
    if (acctRole?.owner_user_id && target.user_id === acctRole.owner_user_id) {
      return res.status(400).json({ error: "The account owner's role cannot be changed. Use Transfer Ownership." });
    }

    // Last-admin protection: if demoting an admin, ensure another admin exists
    if (target.role === 'admin' && newRole !== 'admin') {
      const { count } = await supabaseAdmin
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('role', 'admin');
      if ((count || 0) <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last admin from this account' });
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({ role: newRole })
      .eq('id', membershipId);

    if (updateError) return res.status(500).json({ error: updateError.message });
    res.json({ ok: true });
  } catch (e) {
    console.error('update-member-role exception:', e);
    res.status(500).json({ error: e.message || 'Update role failed' });
  }
});

// ── Update a member's permissions (Phase 2 Item 25b) ──────────────────────────
// Only admins can call. Permissions is a JSON object { groupKey: 'add' | 'edit' }.
// Missing keys mean no access to that group.
app.post('/api/update-member-permissions', async (req, res) => {
  try {
    const { accountId, membershipId, permissions } = req.body || {};
    if (!accountId || !membershipId) {
      return res.status(400).json({ error: 'accountId and membershipId required' });
    }
    const cleanPerms = (permissions && typeof permissions === 'object')
      ? Object.fromEntries(
          Object.entries(permissions).filter(([k, v]) => v === 'add' || v === 'edit')
        )
      : {};

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    const requesterUserId = userData.user.id;

    const { data: requesterMembership } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('account_id', accountId)
      .eq('user_id', requesterUserId)
      .single();

    if (!requesterMembership || requesterMembership.role !== 'admin') {
      return res.status(403).json({ error: 'Only account admins can change permissions' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({ permissions: cleanPerms })
      .eq('id', membershipId)
      .eq('account_id', accountId);

    if (updateError) return res.status(500).json({ error: updateError.message });
    res.json({ ok: true });
  } catch (e) {
    console.error('update-member-permissions exception:', e);
    res.status(500).json({ error: e.message || 'Update permissions failed' });
  }
});

// ── Remove a member from an account (Phase 2 multi-user) ──────────────────────
// Only admins can call. Cannot remove the last admin. Cannot remove yourself.
app.post('/api/remove-member', async (req, res) => {
  try {
    const { accountId, membershipId } = req.body || {};
    if (!accountId || !membershipId) {
      return res.status(400).json({ error: 'accountId and membershipId required' });
    }

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    const requesterUserId = userData.user.id;

    const { data: requesterMembership } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('account_id', accountId)
      .eq('user_id', requesterUserId)
      .single();

    if (!requesterMembership || requesterMembership.role !== 'admin') {
      return res.status(403).json({ error: 'Only account admins can remove members' });
    }

    const { data: target } = await supabaseAdmin
      .from('memberships')
      .select('id, user_id, role')
      .eq('id', membershipId)
      .eq('account_id', accountId)
      .single();

    if (!target) return res.status(404).json({ error: 'Member not found in this account' });
    if (target.user_id === requesterUserId) {
      return res.status(400).json({ error: 'You cannot remove yourself' });
    }

    // Owner protection: the account owner cannot be removed. Transfer ownership first.
    const { data: acctOwn } = await supabaseAdmin
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .single();
    if (acctOwn?.owner_user_id && target.user_id === acctOwn.owner_user_id) {
      return res.status(400).json({ error: 'The account owner cannot be removed. Transfer ownership first.' });
    }

    if (target.role === 'admin') {
      const { count } = await supabaseAdmin
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('role', 'admin');
      if ((count || 0) <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last admin from this account' });
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('memberships')
      .delete()
      .eq('id', membershipId);

    if (deleteError) return res.status(500).json({ error: deleteError.message });
    res.json({ ok: true });
  } catch (e) {
    console.error('remove-member exception:', e);
    res.status(500).json({ error: e.message || 'Remove member failed' });
  }
});

// ── Transfer account ownership (Phase 2 owner tier) ───────────────────────────
// Only the current owner can call. Reassigns accounts.owner_user_id to another
// existing member and makes that member an admin (an owner needs full access).
// The old owner keeps their membership/role. Ownership is the transferable tier
// that holds billing, so this is the only path that moves owner_user_id.
app.post('/api/transfer-ownership', async (req, res) => {
  try {
    const { accountId, membershipId } = req.body || {};
    if (!accountId || !membershipId) {
      return res.status(400).json({ error: 'accountId and membershipId required' });
    }

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    const requesterUserId = userData.user.id;

    // Requester must be the CURRENT owner of this account.
    const { data: acct } = await supabaseAdmin
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .single();
    if (!acct || !acct.owner_user_id || acct.owner_user_id !== requesterUserId) {
      return res.status(403).json({ error: 'Only the account owner can transfer ownership.' });
    }

    // Target must be an existing member of this account.
    const { data: target } = await supabaseAdmin
      .from('memberships')
      .select('id, user_id, role')
      .eq('id', membershipId)
      .eq('account_id', accountId)
      .single();
    if (!target) return res.status(404).json({ error: 'Member not found in this account' });
    if (target.user_id === requesterUserId) {
      return res.status(400).json({ error: 'You already own this account.' });
    }

    // Promote the target to admin FIRST (owners need full access). Doing this
    // before the ownership reassign means a failure here never leaves the account
    // with an owner who is only a staff/viewer and can't manage the team.
    if (target.role !== 'admin') {
      const { error: promErr } = await supabaseAdmin
        .from('memberships')
        .update({ role: 'admin' })
        .eq('id', target.id)
        .eq('account_id', accountId);
      if (promErr) return res.status(500).json({ error: promErr.message });
    }

    // Reassign ownership.
    const { error: ownErr } = await supabaseAdmin
      .from('accounts')
      .update({ owner_user_id: target.user_id })
      .eq('id', accountId);
    if (ownErr) return res.status(500).json({ error: ownErr.message });

    res.json({ ok: true });
  } catch (e) {
    console.error('transfer-ownership exception:', e);
    res.status(500).json({ error: e.message || 'Transfer ownership failed' });
  }
});

// ── Add another bar (Phase 2 owner tier, multi-location Option A) ──────────────
// An existing owner spins up a second bar = its own account + subscription. The
// on_auth_user_created trigger only provisions for brand-new USERS, so an
// existing owner needs this explicit create (service role): new account owned by
// the caller + their admin membership. The client then sends them to checkout
// for the new account. onboarding_complete defaults false so the new bar
// onboards on first entry.
app.post('/api/add-account', async (req, res) => {
  try {
    const { name } = req.body || {};
    const barName = (name && String(name).trim()) || 'My Bar';

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid auth token' });
    const userId = userData.user.id;

    const { data: acct, error: acctErr } = await supabaseAdmin
      .from('accounts')
      .insert({ name: barName, owner_user_id: userId })
      .select('id')
      .single();
    if (acctErr || !acct) return res.status(500).json({ error: acctErr?.message || 'Could not create the bar.' });

    const { error: memErr } = await supabaseAdmin
      .from('memberships')
      .insert({ account_id: acct.id, user_id: userId, role: 'admin' });
    if (memErr) {
      // Roll back the orphan account so a retry starts clean.
      await supabaseAdmin.from('accounts').delete().eq('id', acct.id);
      return res.status(500).json({ error: memErr.message });
    }

    res.json({ ok: true, accountId: acct.id });
  } catch (e) {
    console.error('add-account exception:', e);
    res.status(500).json({ error: e.message || 'Add account failed' });
  }
});

// ── Set an account's display name (owner tier) ────────────────────────────────
// Keeps accounts.name (what the bar switcher shows) in sync with the in-app bar
// name (settings.bar_name), which onboarding + Business Profile write. Caller
// must be an owner or admin of the account.
app.post('/api/set-account-name', async (req, res) => {
  try {
    const { accountId, name } = req.body || {};
    if (!accountId || !name || !String(name).trim()) {
      return res.status(400).json({ error: 'accountId and name required' });
    }
    const barName = String(name).trim().slice(0, 120);

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid auth token' });
    const userId = userData.user.id;

    const { data: acct } = await supabaseAdmin
      .from('accounts').select('owner_user_id').eq('id', accountId).single();
    if (!acct) return res.status(404).json({ error: 'Account not found' });

    let allowed = acct.owner_user_id === userId;
    if (!allowed) {
      const { data: mem } = await supabaseAdmin
        .from('memberships').select('role').eq('account_id', accountId).eq('user_id', userId).single();
      allowed = !!(mem && mem.role === 'admin');
    }
    if (!allowed) return res.status(403).json({ error: 'Not allowed to rename this account' });

    const { error: upErr } = await supabaseAdmin
      .from('accounts').update({ name: barName }).eq('id', accountId);
    if (upErr) return res.status(500).json({ error: upErr.message });

    res.json({ ok: true });
  } catch (e) {
    console.error('set-account-name exception:', e);
    res.status(500).json({ error: e.message || 'Rename failed' });
  }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log('\n  Bar Cop Recovery\n  http://localhost:' + PORT + '\n');
});
server.timeout = 300000;
server.headersTimeout = 310000;

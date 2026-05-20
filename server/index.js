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

// ── Claude API proxy ──────────────────────────────────────────────────────────
app.post('/api/claude', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const body = JSON.stringify(req.body);
  const options = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length':    Buffer.byteLength(body)
    }
  };

  const proxyReq = https.request(options, proxyRes => {
    res.status(proxyRes.statusCode);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', err => {
    console.error('Claude proxy error:', err);
    res.status(502).json({ error: 'Proxy request failed' });
  });
  proxyReq.write(body);
  proxyReq.end();
});

// ── Profit audit — JSON only, no PDF ──────────────────────────────────────────
app.post('/api/generate-profit-audit', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const form = new multiparty.Form({ maxFilesSize: 50 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Form parse error: ' + err.message });

    const appDataStr = fields.appData?.[0] || '{}';
    const notes      = fields.notes?.[0]   || '';
    let appData = {};
    try { appData = JSON.parse(appDataStr); } catch(e) {}

    const uploadedFiles = [];
    for (const [key, fileArr] of Object.entries(files)) {
      for (const f of fileArr) {
        if (f.size > 0) uploadedFiles.push({ field: key, path: f.path, name: f.originalFilename, size: f.size });
      }
    }

    try {
      const auditData = await extractAuditData(apiKey, 'profit', uploadedFiles, appData, notes);
      res.json({ ok: true, auditData });
    } catch(e) {
      console.error('Profit audit error:', e);
      res.status(500).json({ error: e.message || 'Audit generation failed' });
    } finally {
      for (const f of uploadedFiles) fs.unlink(f.path, () => {});
    }
  });
});

// ── Traffic audit — JSON only, no PDF ─────────────────────────────────────────
app.post('/api/generate-traffic-audit', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const form = new multiparty.Form({ maxFilesSize: 50 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Form parse error: ' + err.message });

    const appDataStr = fields.appData?.[0] || '{}';
    const notes      = fields.notes?.[0]   || '';
    let appData = {};
    try { appData = JSON.parse(appDataStr); } catch(e) {}

    const uploadedFiles = [];
    for (const [key, fileArr] of Object.entries(files)) {
      for (const f of fileArr) {
        if (f.size > 0) uploadedFiles.push({ field: key, path: f.path, name: f.originalFilename, size: f.size });
      }
    }

    try {
      const auditData = await extractAuditData(apiKey, 'traffic', uploadedFiles, appData, notes);
      res.json({ ok: true, auditData });
    } catch(e) {
      console.error('Traffic audit error:', e);
      res.status(500).json({ error: e.message || 'Audit generation failed' });
    } finally {
      for (const f of uploadedFiles) fs.unlink(f.path, () => {});
    }
  });
});

// ── Revenue audit — JSON only, no PDF ─────────────────────────────────────────
app.post('/api/generate-revenue-audit', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const form = new multiparty.Form({ maxFilesSize: 50 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Form parse error: ' + err.message });

    const appDataStr = fields.appData?.[0] || '{}';
    const notes      = fields.notes?.[0]   || '';
    let appData = {};
    try { appData = JSON.parse(appDataStr); } catch(e) {}

    const uploadedFiles = [];
    for (const [key, fileArr] of Object.entries(files)) {
      for (const f of fileArr) {
        if (f.size > 0) uploadedFiles.push({ field: key, path: f.path, name: f.originalFilename, size: f.size });
      }
    }

    try {
      const auditData = await extractAuditData(apiKey, 'revenue', uploadedFiles, appData, notes);
      res.json({ ok: true, auditData });
    } catch(e) {
      console.error('Revenue audit error:', e);
      res.status(500).json({ error: e.message || 'Audit generation failed' });
    } finally {
      for (const f of uploadedFiles) fs.unlink(f.path, () => {});
    }
  });
});

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
async function extractAuditData(apiKey, auditType, files, appData, notes='') {
  const prompts = {
    profit:  getExtractionPrompt_Profit(appData),
    revenue: getExtractionPrompt_Revenue(appData),
    traffic: getExtractionPrompt_Traffic(appData),
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
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    messages: [{ role: 'user', content }]
  });

  const responseData = await callClaude(apiKey, body);
  const text  = responseData.content?.[0]?.text || '';
  const clean = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch(e) {
    throw new Error('Failed to parse extracted audit data: ' + text.slice(0, 200));
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
function getExtractionPrompt_Profit(appData) {
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

  return `You are generating a Bar Cop Profit Audit. Analyze all submitted documents AND the app data provided below. Use every data point from both sources to score and populate the audit.

APP DATA (live data from the customer's app — use this to fill fields where no uploaded file covers the topic):
Bar Name: ${settings.bar_name || 'Not provided'}
City/State: ${settings.city_state || 'Not provided'}
Annual Bar Revenue: ${settings.annual_bar_revenue ? '$'+settings.annual_bar_revenue.toLocaleString() : 'Not provided'}
Annual Food Revenue: ${settings.annual_food_revenue ? '$'+settings.annual_food_revenue.toLocaleString() : 'Not provided'}
Bar Pour Cost Target: ${settings.targets && settings.targets.bar_pour_cost_pct || 22}%
Food Cost Target: ${settings.targets && settings.targets.food_cost_pct || 32}%
Prime Cost Target: ${settings.targets && settings.targets.prime_cost_pct || 60}%
Recent 4-week avg bar pour cost: ${avgBarCost ? avgBarCost.toFixed(1)+'%' : 'Not tracked'}
Recent 4-week avg food cost: ${avgFoodCost ? avgFoodCost.toFixed(1)+'%' : 'Not tracked'}
Recent 4-week avg bar revenue/week: ${avgBarRev ? '$'+Math.round(avgBarRev) : 'Not tracked'}
Recent 4-week avg food revenue/week: ${avgFoodRev ? '$'+Math.round(avgFoodRev) : 'Not tracked'}
Bar products set up: ${products.length}
Kitchen products set up: ${kitchen.length}
Recipes costed: ${recipes.length}
Weeks of data entered: ${weeks.length}
Shift check entries: ${shifts.length}
Cash reconciliation entries: ${recons.length}
Vendor price changes logged: ${vendor.length}
Latest theft risk score: ${theft.length ? theft[theft.length-1] && theft[theft.length-1].total : 'Not scored'}

WEEKLY DATA (last 4 weeks entered in app):
${weeklySummary}

BAR PRODUCTS (sample):
${barProductsSummary}

CASH RECONCILIATION (last 4 entries):
${reconSummary}

Analyze all uploaded documents (POS reports, inventory sheets, invoices, exception reports, payroll) and extract ALL of the following variables. Use uploaded file data where available, use app data to fill gaps, use industry benchmarks for anything not determinable.

Return ONLY a valid JSON object with ALL these exact keys — no markdown, no explanation, just the JSON:

{
  "BAR_NAME": "${settings.bar_name || 'Customer Bar'}",
  "BAR_CITY_STATE": "${settings.city_state || 'Unknown'}",
  "REVENUE_TIER": "Based on revenue data",
  "AUDIT_DATE": "Current month and year",
  "AUDIT_ID": "PFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}",
  "AUDIT_PERIOD": "Period covered by submitted data",
  "DATA_TIER_LABEL": "Tier 1/2/3 based on data submitted",
  "WEEKLY_GAP_AMT": "Calculated dollar gap per week",
  "GAP_SOURCES": "Sources of recoverable profit",
  "INDUSTRY_AVG": 63,
  "TARGET_SCORE": 65,
  "OVERALL_SCORE": 0,
  "SECTIONS_WITH_DATA": 0,
  "SECTIONS_PARTIAL": 0,
  "SECTIONS_NA": 0,
  "SECTION_DATA": [],
  "S1_TIER": 1,
  "S1_BAR_COST_PCT": 0,
  "S1_BAR_REV_MONTHLY": 0,
  "S1_BEV_COGS_PERIOD": 0,
  "S1_BAR_REV_PERIOD": 0,
  "S1_INV_VARIANCE_PCT": 0,
  "S1_INV_VARIANCE_AMT": 0,
  "S1_POUR_METHOD": "Unknown — not submitted",
  "S1_RECIPE_COVERAGE": "0%",
  "S1_VARIANCE_FREQ": "Unknown",
  "S1_VARIANCE_SKU": "No",
  "S1_TARGET_PCT": ${settings.targets?.bar_pour_cost_pct || 21},
  "S1_GAP_PTS": 0,
  "S1_MONTHLY_GAP": 0,
  "S1_ANNUAL_GAP": 0,
  "S1_PTS_BAR_COST": 0,
  "S1_PTS_RECIPE": 0,
  "S1_PTS_POUR": 0,
  "S1_PTS_VAR_FREQ": 0,
  "S1_PTS_VAR_SKU": 0,
  "S1_SCORE": 0,
  "S2_TIER": 1,
  "S2_BEV_REV_MONTHLY": 0,
  "S2_VOIDS_AMT": 0,
  "S2_COMPS_AMT": 0,
  "S2_VOID_COMP_PCT": 0,
  "S2_VOID_COMP_AMT": 0,
  "S2_VOIDS_NO_APPROVAL_PCT": 0,
  "S2_VOIDS_NO_APPROVAL_AMT": 0,
  "S2_CASH_POLICY": "Unknown",
  "S2_VOID_APPROVAL": "Unknown",
  "S2_DRAWER_RECON": "${recons.length > 0 ? 'Yes' : 'No'}",
  "S2_OVERSHORT_POLICY": "Unknown",
  "S2_BOTTLE_SECURITY": "Unknown",
  "S2_NOSALE_POLICY": "Unknown",
  "S2_SPILLAGE_LOG": "Unknown",
  "S2_BENCHMARK_PCT": 2.0,
  "S2_GAP_PCT": 0,
  "S2_MONTHLY_GAP": 0,
  "S2_ANNUAL_GAP": 0,
  "S2_PTS_VOID_COMP": 0,
  "S2_PTS_VOID_APPROVAL": 0,
  "S2_PTS_DRAWER": 0,
  "S2_PTS_CASH_POLICY": 0,
  "S2_PTS_BOTTLE": 0,
  "S2_PTS_SPILLAGE": 0,
  "S2_SCORE": 0,
  "S3_TIER": 1,
  "S3_FOOD_COST_PCT": 0,
  "S3_FOOD_REV_MONTHLY": 0,
  "S3_FOOD_COGS_PERIOD": 0,
  "S3_FOOD_VAR_PCT": 0,
  "S3_FOOD_VAR_AMT": 0,
  "S3_RECIPE_COVERAGE": "0%",
  "S3_PORTION_STANDARDS": "Unknown",
  "S3_INV_FREQ": "Unknown",
  "S3_THEO_ACTUAL": "No",
  "S3_WASTE_LOG": "No",
  "S3_TARGET_PCT": ${settings.targets?.food_cost_pct || 31},
  "S3_GAP_PTS": 0,
  "S3_MONTHLY_GAP": 0,
  "S3_ANNUAL_GAP": 0,
  "S3_PTS_FOOD_COST": 0,
  "S3_PTS_RECIPE": 0,
  "S3_PTS_PORTION": 0,
  "S3_PTS_INV": 0,
  "S3_PTS_WASTE": 0,
  "S3_SCORE": 0,
  "S4_TIER": 1,
  "S4_BEV_INVOICE_COUNT": 0,
  "S4_FOOD_INVOICE_COUNT": 0,
  "S4_AUDIT_PERIOD_DESC": "4 weeks",
  "S4_VENDOR_SPEND_MONTHLY": 0,
  "S4_BEV_INVOICE_SPEND": 0,
  "S4_FOOD_INVOICE_SPEND": 0,
  "S4_INVOICE_VS_PO": "Unknown",
  "S4_PRICE_VERIFY": "Unknown",
  "S4_DELIVERY_COUNT": "Unknown",
  "S4_CREDIT_MEMOS": "Unknown",
  "S4_ANNUAL_BIDS": "Unknown",
  "S4_BACKUP_VENDORS": "Unknown",
  "S4_PAYMENT_POLICY": "Unknown",
  "S4_EXPOSURE_PCT": 3.0,
  "S4_EXPOSURE_MONTHLY": 0,
  "S4_EXPOSURE_ANNUAL": 0,
  "S4_PTS_INVOICE_PO": 0,
  "S4_PTS_PRICE_VERIFY": 0,
  "S4_PTS_DELIVERY": 0,
  "S4_PTS_CREDIT": 0,
  "S4_PTS_BIDS": 0,
  "S4_PTS_PAYMENT": 0,
  "S4_SCORE": 0,
  "S5_TIER": 1,
  "S5_BEV_REV_PERIOD": 0,
  "S5_FOOD_REV_PERIOD": 0,
  "S5_TOTAL_REV_PERIOD": 0,
  "S5_BEV_COGS_PERIOD": 0,
  "S5_FOOD_COGS_PERIOD": 0,
  "S5_TOTAL_COGS_PERIOD": 0,
  "S5_LABOR_PERIOD": 0,
  "S5_LABOR_PCT": 0,
  "S5_LABOR_SOURCE": "Not submitted",
  "S5_PRIME_COST_AMT": 0,
  "S5_PRIME_COST_PCT": 0,
  "S5_TARGET_PCT": ${settings.targets?.prime_cost_pct || 60},
  "S5_BAR_COST_PCT": 0,
  "S5_FOOD_COST_PCT": 0,
  "S5_BLENDED_COGS_PCT": 0,
  "S5_PRIME_WEEKLY": "Unknown",
  "S5_LABOR_BY_DEPT": "Unknown",
  "S5_SCHEDULE_FORECAST": "Unknown",
  "S5_RPLH_TRACKED": "Unknown",
  "S5_BAR_COST_GAP_MONTHLY": 0,
  "S5_FOOD_COST_GAP_MONTHLY": 0,
  "S5_COMBINED_COGS_GAP": 0,
  "S5_TOTAL_REV_MONTHLY": 0,
  "S5_LABOR_MONTHLY": 0,
  "S5_PTS_PRIME_PCT": 0,
  "S5_PTS_PRIME_WEEKLY": 0,
  "S5_PTS_LABOR_DEPT": 0,
  "S5_PTS_SCHEDULE": 0,
  "S5_PTS_RPLH": 0,
  "S5_SCORE": 0,
  "S6_SIG1_SCORE": "MEDIUM",
  "S6_SIG1_LABEL": "Inventory Counting Frequency",
  "S6_SIG1_EVIDENCE": "Based on submitted data",
  "S6_SIG1_GAP": "Recommended improvement",
  "S6_SIG1_TOOL": "Action step",
  "S6_SIG2_SCORE": "MEDIUM",
  "S6_SIG2_LABEL": "Variance Tracking",
  "S6_SIG2_EVIDENCE": "Based on submitted data",
  "S6_SIG2_GAP": "Recommended improvement",
  "S6_SIG2_TOOL": "Action step",
  "S6_SIG3_SCORE": "LOW",
  "S6_SIG3_LABEL": "Recipe Costing",
  "S6_SIG3_EVIDENCE": "Based on submitted data",
  "S6_SIG3_GAP": "Recommended improvement",
  "S6_SIG3_TOOL": "Action step",
  "S6_SIG4_SCORE": "MEDIUM",
  "S6_SIG4_LABEL": "Vendor Verification",
  "S6_SIG4_EVIDENCE": "Based on submitted data",
  "S6_SIG4_GAP": "Recommended improvement",
  "S6_SIG4_TOOL": "Action step"
}

Fill every field with real values extracted from the documents or calculated from app data. Use industry benchmarks where data is missing. Make the narrative fields specific and actionable based on the actual data submitted.`;
}

function getExtractionPrompt_Revenue(appData) {
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

  return `You are generating a Bar Cop Revenue Audit. Analyze all submitted documents AND the app data provided below. Use every data point from both sources to score and populate the audit.

APP DATA (live data from the customer's app — use this to fill fields where no uploaded file covers the topic):
Bar Name: ${settings.bar_name || 'Not provided'}
City/State: ${settings.city_state || 'Not provided'}
Annual Bar Revenue: ${settings.annual_bar_revenue ? '$'+settings.annual_bar_revenue.toLocaleString() : 'Not provided'}
Annual Food Revenue: ${settings.annual_food_revenue ? '$'+settings.annual_food_revenue.toLocaleString() : 'Not provided'}
Total Annual Revenue: ${totalAnnual ? '$'+totalAnnual.toLocaleString() : 'Not provided'}
Check Average Target: $${targets.check_avg || 35}
Bar Labor Target: ${targets.bar_labor_pct || 28}%
Kitchen Labor Target: ${targets.kitchen_labor_pct || 30}%
Floor Labor Target: ${targets.floor_labor_pct || 32}%
Lunch RPLH Target: $${targets.rplh_lunch || 50}
Dinner RPLH Target: $${targets.rplh_dinner || 75}
Bar RPLH Target: $${targets.rplh_bar || 65}
Servers on roster: ${servers.length}
Menu items entered: ${menuItems.length}
Weeks of revenue data entered: ${weeks.length}

RECENT 4-WEEK APP DATA AVERAGES:
Check Average: ${avgCheckAvg ? '$'+avgCheckAvg.toFixed(2) : 'Not tracked'}
Labor %: ${avgLaborPct ? avgLaborPct.toFixed(1)+'%' : 'Not tracked'}
RPLH: ${avgRPLH ? '$'+avgRPLH.toFixed(2) : 'Not tracked'}
Weekly Covers: ${avgCovers ? Math.round(avgCovers) : 'Not tracked'}
Bar Revenue/week: ${avgBarRev ? '$'+Math.round(avgBarRev) : 'Not tracked'}
Floor Revenue/week: ${avgFloorRev ? '$'+Math.round(avgFloorRev) : 'Not tracked'}

WEEKLY DATA (last 4 weeks entered in app):
${weeklySummary}

SERVER ROSTER:
${serverRoster}

MENU ITEMS:
${menuSummary}

SECTIONS IN THIS AUDIT (match these exactly — do not rename or reorder):
Section 1: Check Average and Revenue
Section 2: Labor Efficiency
Section 3: Menu Performance
Section 4: Server Performance
Section 5: Events and Private Dining

Use app data heavily. If a field can be derived from the app data above, calculate it and fill it in. Only mark something "Not available" if neither uploaded files nor app data contain enough information to estimate it.

Return ONLY valid JSON with these exact keys — no markdown, no explanation:

{
  "BAR_NAME": "${settings.bar_name || 'Customer Bar'}",
  "BAR_CITY_STATE": "${settings.city_state || 'Unknown'}",
  "REVENUE_TIER": "Based on revenue data submitted",
  "AUDIT_DATE": "Current month and year",
  "AUDIT_ID": "RFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}",
  "AUDIT_PERIOD": "Period covered by submitted data",
  "DATA_TIER_LABEL": "Tier 1/2/3 based on data submitted",
  "WEEKLY_GAP_AMT": "Calculated weekly revenue gap dollar amount",
  "GAP_SOURCES": "Primary sources of recoverable revenue gap",
  "INDUSTRY_AVG": 61,
  "TARGET_SCORE": 65,
  "OVERALL_SCORE": 0,
  "SECTIONS_WITH_DATA": 0,
  "SECTIONS_PARTIAL": 0,
  "SECTIONS_NA": 0,
  "SECTION_DATA": [],
  "S1_SCORE": 0,
  "S1_CHECK_AVG": ${avgCheckAvg || 0},
  "S1_CHECK_AVG_TARGET": ${targets.check_avg || 35},
  "S1_BAR_CHECK_AVG": ${avgBarRev && avgCovers ? (avgBarRev/avgCovers).toFixed(2) : 0},
  "S1_FOOD_CHECK_AVG": ${avgFloorRev && avgCovers ? (avgFloorRev/avgCovers).toFixed(2) : 0},
  "S1_COVER_COUNT": ${avgCovers ? Math.round(avgCovers * 4.33) : 0},
  "S1_MONTHLY_REVENUE": ${avgBarRev && avgFloorRev ? Math.round((avgBarRev + avgFloorRev) * 4.33) : 0},
  "S1_MONTHLY_GAP": 0,
  "S1_ANNUAL_GAP": 0,
  "S2_SCORE": 0,
  "S2_LABOR_PCT": ${avgLaborPct || 0},
  "S2_LABOR_TARGET_PCT": ${targets.floor_labor_pct || 32},
  "S2_RPLH": ${avgRPLH || 0},
  "S2_RPLH_TARGET": ${targets.rplh_dinner || 75},
  "S2_LABOR_PERIOD": 0,
  "S2_SCHED_VS_ACTUAL": "Not submitted",
  "S2_OVERTIME_HRS": null,
  "S2_MONTHLY_GAP": 0,
  "S2_ANNUAL_GAP": 0,
  "S3_SCORE": 0,
  "S3_STARS_COUNT": 0,
  "S3_PLOWHORSES_COUNT": 0,
  "S3_DOGS_COUNT": 0,
  "S3_PUZZLES_COUNT": 0,
  "S3_TOP_CATEGORY": "Not submitted",
  "S3_MONTHLY_GAP": 0,
  "S3_PRICING_OPPORTUNITY": 0,
  "S4_SCORE": 0,
  "S4_SERVER_COUNT": ${servers.length || 0},
  "S4_TOP_CHECK_AVG": 0,
  "S4_BOTTOM_CHECK_AVG": 0,
  "S4_PERFORMANCE_SPREAD": 0,
  "S4_APP_ATTACH_RATE": null,
  "S4_DESSERT_ATTACH_RATE": null,
  "S4_PRESHIFT_BRIEFING": "Not submitted",
  "S4_MONTHLY_GAP": 0,
  "S4_ANNUAL_GAP": 0,
  "S5_SCORE": 50,
  "S5_EVENT_REV_PERIOD": null,
  "S5_EVENTS_PER_MONTH": null,
  "S5_AVG_EVENT_REVENUE": null,
  "S5_MINIMUM_MET": null,
  "S5_CATERING_REV_PERIOD": null,
  "S5_ANNUAL_EVENT_GAP": null,
  "S5_MONTHLY_GAP": null
}`;
}

function getExtractionPrompt_Traffic(appData) {
  const settings      = appData.settings || {};
  const targets       = (appData.traffic_settings && appData.traffic_settings.targets) || {};
  const weeks         = appData.traffic_weeks || [];
  const recentWeeks   = weeks.slice(-4);
  const avg = (fn) => { const v = recentWeeks.map(fn).filter(x=>x!=null&&!isNaN(x)); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
  const avgGR  = avg(w=>w.google_rating);
  const avgRV  = avg(w=>w.new_reviews);
  const avgRR  = avg(w=>w.response_rate);
  const avgSS  = avg(w=>w.monthly_sessions);
  const avgBR  = avg(w=>w.bounce_rate);
  const avgIGF = avg(w=>w.ig_followers);
  const avgIGP = avg(w=>w.ig_posts_month);

  // Build weekly data summary
  const weeklySummary = recentWeeks.length
    ? recentWeeks.map((w,i) => {
        const parts = ['Week ' + (i+1)];
        if (w.week_end) parts.push(w.week_end);
        if (w.google_rating) parts.push('Google ' + w.google_rating + 'star');
        if (w.new_reviews) parts.push('New reviews: ' + w.new_reviews);
        if (w.response_rate) parts.push('Response rate: ' + w.response_rate + '%');
        if (w.monthly_sessions) parts.push('Sessions: ' + w.monthly_sessions);
        if (w.ig_followers) parts.push('IG followers: ' + w.ig_followers);
        if (w.ig_posts_month) parts.push('IG posts: ' + w.ig_posts_month);
        return '  ' + parts.join(' | ');
      }).join('\n')
    : '  No weekly traffic data entered yet';

  return `You are generating a Bar Cop Traffic Audit. Analyze all submitted screenshots, documents, and questionnaire answers AND the app data below to score and populate the audit.

APP DATA (live data from the customer's app — use this to fill fields where screenshots do not cover the topic):
Bar Name: ${settings.bar_name || 'Not provided'}
City/State: ${settings.city_state || 'Not provided'}
Google Rating Target: ${targets.google_rating || 4.3}
Review Velocity Target: ${targets.review_velocity || 8}/month
Response Rate Target: ${targets.response_rate || 75}%
Monthly Sessions Target: ${targets.monthly_sessions || 2000}
Social Posts/Month Target: ${targets.social_posts_month || 12}
Weeks of tracking data entered: ${weeks.length}
Recent 4-week avg Google Rating: ${avgGR ? avgGR.toFixed(2) : 'Not tracked'}
Recent 4-week avg New Reviews/Mo: ${avgRV ? avgRV.toFixed(1) : 'Not tracked'}
Recent 4-week avg Response Rate: ${avgRR ? avgRR.toFixed(1)+'%' : 'Not tracked'}
Recent 4-week avg Monthly Sessions: ${avgSS ? Math.round(avgSS) : 'Not tracked'}
Recent 4-week avg Bounce Rate: ${avgBR ? avgBR.toFixed(1)+'%' : 'Not tracked'}
Recent 4-week avg Instagram Followers: ${avgIGF ? Math.round(avgIGF) : 'Not tracked'}
Recent 4-week avg IG Posts/Month: ${avgIGP ? avgIGP.toFixed(1) : 'Not tracked'}

WEEKLY DATA (last 4 weeks entered in app):
${weeklySummary}

Return ONLY valid JSON with these exact keys:
{
  "BAR_NAME": "${settings.bar_name || 'Customer Bar'}",
  "BAR_CITY_STATE": "${settings.city_state || ''}",
  "REVENUE_TIER": "Revenue range if available",
  "AUDIT_DATE": "Current month year",
  "AUDIT_ID": "TFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}",
  "AUDIT_PERIOD": "Period covered",
  "DATA_TIER_LABEL": "Tier based on screenshots submitted",
  "WEEKLY_GAP_AMT": "Estimated weekly traffic gap value",
  "GAP_SOURCES": "Traffic gap sources",
  "INDUSTRY_AVG": 58, "TARGET_SCORE": 65, "OVERALL_SCORE": 0,
  "SECTIONS_WITH_DATA": 0, "SECTIONS_PARTIAL": 0, "SECTIONS_NA": 0, "SECTION_DATA": [],
  "S1_TIER": 1, "S1_LISTING_CLAIMED": false, "S1_LISTING_VERIFIED": false,
  "S1_HOURS_COMPLETE": false, "S1_PHONE_PRESENT": false, "S1_WEBSITE_LINKED": false,
  "S1_MENU_LINK_ACTIVE": false, "S1_CATEGORY_SET": false, "S1_ATTRIBUTES_COMPLETE": false,
  "S1_PHOTO_COUNT": 0, "S1_PHOTO_BENCHMARK": 100, "S1_POSTS_LAST_30_DAYS": 0,
  "S1_POSTS_BENCHMARK": 8, "S1_REVIEW_COUNT_GOOGLE": 0, "S1_RATING_GOOGLE": 0,
  "S1_REVIEW_RESPONSE_RATE": 0, "S1_RESPONSE_BENCHMARK": 75, "S1_QA_POPULATED": false,
  "S1_PROFILE_COMPLETENESS_PCT": 0, "S1_MONTHLY_GAP": 0, "S1_ANNUAL_GAP": 0,
  "S1_PTS_CLAIMED": 0, "S1_PTS_COMPLETENESS": 0, "S1_PTS_PHOTOS": 0,
  "S1_PTS_POSTS": 0, "S1_PTS_RESPONSE": 0, "S1_SCORE": 0,
  "S2_TIER": 1, "S2_WEBSITE_EXISTS": false, "S2_MOBILE_OPTIMIZED": false,
  "S2_MONTHLY_SESSIONS": 0, "S2_SESSIONS_BENCHMARK": 2000, "S2_BOUNCE_RATE": 0,
  "S2_BOUNCE_BENCHMARK": 60, "S2_MENU_PAGE_IN_TOP_3": false, "S2_MENU_PAGE_SESSIONS": 0,
  "S2_TOP_PAGES": [], "S2_ONLINE_ORDERING_PRESENT": false, "S2_RESERVATION_SYSTEM": false,
  "S2_AVG_SESSION_DURATION_SEC": 0, "S2_PAGE_LOAD_SCORE": null, "S2_SOURCE_BREAKDOWN": null,
  "S2_MONTHLY_GAP": 0, "S2_ANNUAL_GAP": 0,
  "S2_PTS_EXISTS_MOBILE": 0, "S2_PTS_SESSIONS": 0, "S2_PTS_BOUNCE": 0,
  "S2_PTS_MENU_PAGE": 0, "S2_PTS_ORDERING": 0, "S2_SCORE": 0,
  "S3_TIER": 1, "S3_GOOGLE_RATING": 0, "S3_GOOGLE_RATING_BENCHMARK": 4.3,
  "S3_GOOGLE_REVIEW_COUNT": 0, "S3_GOOGLE_COUNT_BENCHMARK": 200,
  "S3_RESPONSE_RATE": 0, "S3_RESPONSE_BENCHMARK": 75,
  "S3_YELP_RATING": 0, "S3_YELP_RATING_BENCHMARK": 4.0, "S3_YELP_REVIEW_COUNT": 0,
  "S3_TRIPADVISOR_PRESENT": false, "S3_MOST_RECENT_REVIEW_DAYS": 0,
  "S3_RECENCY_BENCHMARK": 7, "S3_NEGATIVE_PATTERN": "None identified",
  "S3_MONTHLY_GAP": 0, "S3_ANNUAL_GAP": 0,
  "S3_PTS_RATING": 0, "S3_PTS_COUNT": 0, "S3_PTS_RESPONSE": 0,
  "S3_PTS_YELP": 0, "S3_PTS_RECENCY": 0, "S3_SCORE": 0, "S3_UNANSWERED": 0,
  "S4_TIER": 1, "S4_MAPS_PACK_CONFIRMED": false, "S4_RANKING_REPORT_SUBMITTED": false,
  "S4_NAP_CONSISTENT": false, "S4_NAP_BUSINESS_NAME": "",
  "S4_NAP_ADDRESS": "Not verified", "S4_NAP_PHONE": "Not verified",
  "S4_WEBSITE_TITLES_ASSESSED": false, "S4_CITATION_COUNT": null,
  "S4_PRIMARY_KEYWORD": "bar [city]", "S4_SECONDARY_KEYWORDS": [],
  "S4_MONTHLY_GAP": null,
  "S4_PTS_MAPS_PACK": 0, "S4_PTS_RANKINGS": 0, "S4_PTS_NAP": 0,
  "S4_PTS_TITLES": 0, "S4_PTS_CITATIONS": 0, "S4_SCORE": 0,
  "S5_TIER": 1, "S5_IG_PROFILE_SUBMITTED": false, "S5_IG_FOLLOWERS": 0,
  "S5_IG_POSTS_LAST_30": 0, "S5_IG_POSTS_BENCHMARK": 12, "S5_IG_ENGAGEMENT_RATE": null,
  "S5_FB_FOLLOWERS": 0, "S5_FB_POSTS_LAST_30": 0,
  "S5_CONTENT_TYPE": "Mixed", "S5_FOOD_PHOTO_RATIO": 0,
  "S5_MONTHLY_GAP": 0, "S5_ANNUAL_GAP": 0,
  "S5_PTS_PROFILE": 0, "S5_PTS_FREQUENCY": 0, "S5_PTS_ENGAGEMENT": 0,
  "S5_PTS_CONTENT_MIX": 0, "S5_PTS_STORIES": 0, "S5_SCORE": 0,
  "S6_TIER": 1, "S6_DOORDASH_ACTIVE": false, "S6_UBEREATS_ACTIVE": false,
  "S6_GRUBHUB_ACTIVE": false, "S6_PLATFORM_COUNT": 0,
  "S6_DOORDASH_RATING": null, "S6_UBEREATS_RATING": null,
  "S6_PHOTO_COUNT_DELIVERY": 0, "S6_MENU_COMPLETE": false,
  "S6_PROMO_ACTIVE": false, "S6_MONTHLY_GAP": 0, "S6_ANNUAL_GAP": 0,
  "S6_PTS_PRESENCE": 0, "S6_PTS_RATING": 0, "S6_PTS_PHOTOS": 0,
  "S6_PTS_MENU": 0, "S6_PTS_PROMO": 0, "S6_SCORE": 0,
  "S7_TIER": 1, "S7_EMAIL_LIST_EXISTS": false, "S7_LIST_SIZE": 0,
  "S7_LIST_BENCHMARK": 500, "S7_LAST_SEND_DAYS_AGO": null,
  "S7_SEND_FREQUENCY": "Never", "S7_OPEN_RATE": null, "S7_OPEN_BENCHMARK": 35,
  "S7_GROWTH_MECHANISM": "None identified", "S7_LOYALTY_PROGRAM": false,
  "S7_MONTHLY_GAP": 0, "S7_ANNUAL_GAP": 0,
  "S7_PTS_EXISTS": 0, "S7_PTS_SIZE": 0, "S7_PTS_FREQUENCY": 0,
  "S7_PTS_OPEN_RATE": 0, "S7_PTS_GROWTH": 0, "S7_SCORE": 0
}`;
}

// ── Stripe checkout session ───────────────────────────────────────────────────
const BARCOP_PRICE_ID = 'price_1TZA54Gow04S066UjWZIRAlL';
const ALL_MODULES     = ['profit', 'revenue', 'traffic'];

app.post('/api/create-checkout-session', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: BARCOP_PRICE_ID, quantity: 1 }],
      success_url: 'https://app.barcop.com/?checkout=success',
      cancel_url:  'https://app.barcop.com/?checkout=cancelled',
      metadata: { user_id: userId }
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('Checkout session error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Stripe billing portal ─────────────────────────────────────────────────────
app.post('/api/billing-portal', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { createClient: mkClient } = require('@supabase/supabase-js');
    const adminDb = mkClient(
      'https://plpikfpintruksclkwyb.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await adminDb
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
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

      let userId = session.metadata?.user_id || null;

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

      if (userId) {
        await supabaseAdmin.from('subscriptions').upsert({
          user_id:             userId,
          stripe_customer_id:  customerId,
          subscription_status: 'active',
          subscription_plan:   'full_access',
          active_modules:      ALL_MODULES,
          current_period_end:  null,
          updated_at:          new Date().toISOString(),
        }, { onConflict: 'user_id' });
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

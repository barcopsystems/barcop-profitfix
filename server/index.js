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

  return `You are a bar and restaurant profit consultant generating a scored Bar Cop Profit Audit. You have the operator's live app data below AND any uploaded documents. Your job is to produce a complete scored audit — every section must have a real score, not zero.

CRITICAL RULES:
1. NEVER output 0 for a section score. Even with minimal data, score every section using app data + industry benchmarks.
2. S1_BAR_COST_PCT: use the app data avg bar cost % below. If no uploaded files contradict it, use it directly.
3. S3_FOOD_COST_PCT: use the app data avg food cost % below. Same rule.
4. S5_PRIME_COST_PCT: calculate from bar cost + food cost + labor. Estimate labor at 28% if not submitted.
5. S2 (Theft): score based on cash recon entries and shift check entries in the app data. 0 recon entries = score penalized. Has entries = score rewarded.
6. S4 (Vendor): score based on vendor_log entries and recipe count. More setup = higher score.
7. S6 (Risk Signals): always produce 4 specific signals based on the actual data patterns.
8. OVERALL_SCORE: weighted average of S1-S5 scores. Do not leave at 0.
9. All dollar gap fields: calculate from (actual % - target %) x monthly revenue.
10. Fill ALL string fields with real operator-specific observations, not placeholder text.

SCORING RUBRICS:
S1 Bar Cost (100 pts): bar_cost_pct vs target — within 1pt=85, within 3pts=65, within 5pts=45, >5pts over=25. Add pts for recipes (up to 10), pour method (up to 5).
S2 Theft (100 pts): start at 50. Cash recon entries present +15. Shift checks present +10. Void/comp data from POS +15. No exception report = cap at 65.
S3 Food Cost (100 pts): food_cost_pct vs target — same scale as S1. Add pts for inventory freq, waste log.
S4 Vendor (100 pts): start at 40. Vendor log entries >0 +15. Recipes set up >5 +10. Bar products >10 +10. Invoice data uploaded +15. Annual bids unknown = -5.
S5 Prime Cost (100 pts): prime_cost_pct vs target — within 2pts=80, within 5pts=60, within 8pts=40, >8pts over=20. Penalize if labor not tracked.
S6 Risk Signals: identify 4 specific operational risks from the actual data. Rate HIGH/MEDIUM/LOW each.

APP DATA (pre-seeded — use these values directly in the output JSON):
Bar Name: ${settings.bar_name || 'Not provided'}
City/State: ${settings.city_state || 'Not provided'}
Annual Bar Revenue: ${settings.annual_bar_revenue ? '$'+settings.annual_bar_revenue.toLocaleString() : 'Not provided'}
Annual Food Revenue: ${settings.annual_food_revenue ? '$'+settings.annual_food_revenue.toLocaleString() : 'Not provided'}
Bar Pour Cost Target: ${settings.targets && settings.targets.bar_pour_cost_pct || 22}%
Food Cost Target: ${settings.targets && settings.targets.food_cost_pct || 32}%
Prime Cost Target: ${settings.targets && settings.targets.prime_cost_pct || 60}%
4-week avg bar pour cost: ${avgBarCost ? avgBarCost.toFixed(1)+'%' : 'Not tracked — use 0 and score S1 at 40'}
4-week avg food cost: ${avgFoodCost ? avgFoodCost.toFixed(1)+'%' : 'Not tracked — use 0 and score S3 at 40'}
4-week avg weekly bar revenue: ${avgBarRev ? '$'+Math.round(avgBarRev) : 'Not tracked'}
4-week avg weekly food revenue: ${avgFoodRev ? '$'+Math.round(avgFoodRev) : 'Not tracked'}
Monthly bar revenue estimate: ${avgBarRev ? '$'+Math.round(avgBarRev*4.33) : 'Not tracked'}
Monthly food revenue estimate: ${avgFoodRev ? '$'+Math.round(avgFoodRev*4.33) : 'Not tracked'}
Bar products in system: ${products.length}
Kitchen products: ${kitchen.length}
Recipes costed: ${recipes.length}
Weeks of data: ${weeks.length}
Shift check entries: ${shifts.length}
Cash reconciliation entries: ${recons.length}
Vendor log entries: ${vendor.length}
Theft risk score: ${theft.length ? (theft[theft.length-1] && theft[theft.length-1].total) : 'Not scored'}

WEEKLY DATA (last 4 weeks):
${weeklySummary}

BAR PRODUCTS (sample):
${barProductsSummary}

CASH RECONCILIATION (last 4):
${reconSummary}

Return ONLY a valid JSON object. No markdown, no explanation. Replace EVERY placeholder value — especially all numeric 0s — with calculated values from the data above. String fields must contain real observations, not "Unknown" or "Based on submitted data" unless truly no data exists.

{
  "BAR_NAME": "${settings.bar_name || 'Customer Bar'}",
  "BAR_CITY_STATE": "${settings.city_state || 'Unknown'}",
  "REVENUE_TIER": "calculate from annual revenue",
  "AUDIT_DATE": "current month and year",
  "AUDIT_ID": "PFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}",
  "AUDIT_PERIOD": "period covered",
  "DATA_TIER_LABEL": "Tier 1, 2, or 3 — base on files uploaded",
  "WEEKLY_GAP_AMT": "calculate: (bar_cost_gap_monthly + food_cost_gap_monthly) / 4.33",
  "GAP_SOURCES": "list the top 2-3 specific gap sources",
  "INDUSTRY_AVG": 63,
  "TARGET_SCORE": 65,
  "OVERALL_SCORE": "CALCULATE: weighted avg of S1-S5 scores — must not be 0",
  "SECTIONS_WITH_DATA": "count of sections with real data",
  "SECTIONS_PARTIAL": "count partial",
  "SECTIONS_NA": "count N/A",
  "SECTION_DATA": [],
  "S1_TIER": 1,
  "S1_BAR_COST_PCT": "USE APP DATA: ${avgBarCost ? avgBarCost.toFixed(1) : 'estimate from context'}",
  "S1_BAR_REV_MONTHLY": "USE APP DATA: ${avgBarRev ? Math.round(avgBarRev*4.33) : 0}",
  "S1_BEV_COGS_PERIOD": "calculate if possible",
  "S1_BAR_REV_PERIOD": "calculate if possible",
  "S1_INV_VARIANCE_PCT": "from POS/inventory files or 0 if not submitted",
  "S1_INV_VARIANCE_AMT": "calculate from variance pct x revenue",
  "S1_POUR_METHOD": "from files or 'Not submitted'",
  "S1_RECIPE_COVERAGE": "${recipes.length > 0 ? 'Recipes costed: ' + recipes.length : '0 recipes — no coverage'}",
  "S1_VARIANCE_FREQ": "from files or 'Not documented'",
  "S1_VARIANCE_SKU": "from files or 'No'",
  "S1_TARGET_PCT": ${settings.targets && settings.targets.bar_pour_cost_pct || 22},
  "S1_GAP_PTS": "calculate: S1_BAR_COST_PCT - S1_TARGET_PCT",
  "S1_MONTHLY_GAP": "calculate: gap_pts/100 x monthly_bar_revenue",
  "S1_ANNUAL_GAP": "S1_MONTHLY_GAP x 12",
  "S1_PTS_BAR_COST": "score 0-50 per rubric",
  "S1_PTS_RECIPE": "score 0-20 based on recipe count",
  "S1_PTS_POUR": "score 0-15 based on pour method",
  "S1_PTS_VAR_FREQ": "score 0-10",
  "S1_PTS_VAR_SKU": "score 0-5",
  "S1_SCORE": "SUM of S1 pts — MUST NOT BE 0",
  "S2_TIER": 1,
  "S2_BEV_REV_MONTHLY": "USE APP DATA: ${avgBarRev ? Math.round(avgBarRev*4.33) : 0}",
  "S2_VOIDS_AMT": "from POS exception report or 0",
  "S2_COMPS_AMT": "from POS exception report or 0",
  "S2_VOID_COMP_PCT": "from files or estimate 1.5% if no data",
  "S2_VOID_COMP_AMT": "calculate from pct x bar revenue",
  "S2_VOIDS_NO_APPROVAL_PCT": "from exception report or 0",
  "S2_VOIDS_NO_APPROVAL_AMT": "calculate",
  "S2_CASH_POLICY": "from files or infer from recon entries: ${recons.length > 0 ? 'Reconciliation being performed' : 'No evidence of cash policy'}",
  "S2_VOID_APPROVAL": "from exception report or 'Not documented'",
  "S2_DRAWER_RECON": "${recons.length > 0 ? 'Yes — ' + recons.length + ' entries in app' : 'No entries recorded'}",
  "S2_OVERSHORT_POLICY": "from files or 'Not documented'",
  "S2_BOTTLE_SECURITY": "from files or 'Not documented'",
  "S2_NOSALE_POLICY": "from files or 'Not documented'",
  "S2_SPILLAGE_LOG": "${shifts.length > 0 ? 'Shift checks performed — ' + shifts.length + ' entries' : 'Not documented'}",
  "S2_BENCHMARK_PCT": 2.0,
  "S2_GAP_PCT": "void_comp_pct - 2.0 (benchmark)",
  "S2_MONTHLY_GAP": "calculate: gap_pct/100 x monthly bar revenue",
  "S2_ANNUAL_GAP": "S2_MONTHLY_GAP x 12",
  "S2_PTS_VOID_COMP": "score 0-30 per rubric",
  "S2_PTS_VOID_APPROVAL": "score 0-20",
  "S2_PTS_DRAWER": "${recons.length > 0 ? 15 : 0}",
  "S2_PTS_CASH_POLICY": "score 0-15",
  "S2_PTS_BOTTLE": "score 0-10",
  "S2_PTS_SPILLAGE": "${shifts.length > 0 ? 10 : 0}",
  "S2_SCORE": "SUM of S2 pts — MUST NOT BE 0",
  "S3_TIER": 1,
  "S3_FOOD_COST_PCT": "USE APP DATA: ${avgFoodCost ? avgFoodCost.toFixed(1) : 'estimate from context'}",
  "S3_FOOD_REV_MONTHLY": "USE APP DATA: ${avgFoodRev ? Math.round(avgFoodRev*4.33) : 0}",
  "S3_FOOD_COGS_PERIOD": "calculate if possible",
  "S3_FOOD_VAR_PCT": "from inventory files or 0",
  "S3_FOOD_VAR_AMT": "calculate",
  "S3_RECIPE_COVERAGE": "${kitchen.length > 0 ? kitchen.length + ' kitchen products in system' : '0 kitchen products'}",
  "S3_PORTION_STANDARDS": "from files or 'Not documented'",
  "S3_INV_FREQ": "from files or 'Not submitted'",
  "S3_THEO_ACTUAL": "from files or 'No'",
  "S3_WASTE_LOG": "from files or 'No'",
  "S3_TARGET_PCT": ${settings.targets && settings.targets.food_cost_pct || 32},
  "S3_GAP_PTS": "calculate: S3_FOOD_COST_PCT - S3_TARGET_PCT",
  "S3_MONTHLY_GAP": "calculate: gap_pts/100 x monthly_food_revenue",
  "S3_ANNUAL_GAP": "S3_MONTHLY_GAP x 12",
  "S3_PTS_FOOD_COST": "score 0-50 per rubric",
  "S3_PTS_RECIPE": "score 0-20 based on kitchen product count",
  "S3_PTS_PORTION": "score 0-15",
  "S3_PTS_INV": "score 0-10",
  "S3_PTS_WASTE": "score 0-5",
  "S3_SCORE": "SUM of S3 pts — MUST NOT BE 0",
  "S4_TIER": 1,
  "S4_BEV_INVOICE_COUNT": "from invoices uploaded or ${vendor.length > 0 ? vendor.length + ' vendor entries in app' : 0}",
  "S4_FOOD_INVOICE_COUNT": "from invoices uploaded or 0",
  "S4_AUDIT_PERIOD_DESC": "4 weeks",
  "S4_VENDOR_SPEND_MONTHLY": "estimate from COGS if not in invoices",
  "S4_BEV_INVOICE_SPEND": "from invoices or estimate",
  "S4_FOOD_INVOICE_SPEND": "from invoices or estimate",
  "S4_INVOICE_VS_PO": "from files or 'Not submitted'",
  "S4_PRICE_VERIFY": "${vendor.length > 0 ? 'Vendor price tracking active — ' + vendor.length + ' changes logged' : 'Not documented'}",
  "S4_DELIVERY_COUNT": "from invoices or 'Not submitted'",
  "S4_CREDIT_MEMOS": "from invoices or 'Not documented'",
  "S4_ANNUAL_BIDS": "from files or 'No evidence'",
  "S4_BACKUP_VENDORS": "from files or 'Not documented'",
  "S4_PAYMENT_POLICY": "from files or 'Not documented'",
  "S4_EXPOSURE_PCT": 3.0,
  "S4_EXPOSURE_MONTHLY": "calculate: 3% of total monthly COGS",
  "S4_EXPOSURE_ANNUAL": "S4_EXPOSURE_MONTHLY x 12",
  "S4_PTS_INVOICE_PO": "score 0-20",
  "S4_PTS_PRICE_VERIFY": "${vendor.length > 0 ? 15 : 0}",
  "S4_PTS_DELIVERY": "score 0-15",
  "S4_PTS_CREDIT": "score 0-15",
  "S4_PTS_BIDS": "score 0-20",
  "S4_PTS_PAYMENT": "score 0-15",
  "S4_SCORE": "SUM of S4 pts — MUST NOT BE 0",
  "S5_TIER": 1,
  "S5_BEV_REV_PERIOD": "USE APP DATA: ${avgBarRev ? Math.round(avgBarRev*4) : 0}",
  "S5_FOOD_REV_PERIOD": "USE APP DATA: ${avgFoodRev ? Math.round(avgFoodRev*4) : 0}",
  "S5_TOTAL_REV_PERIOD": "sum of above",
  "S5_BEV_COGS_PERIOD": "calculate from bar cost pct",
  "S5_FOOD_COGS_PERIOD": "calculate from food cost pct",
  "S5_TOTAL_COGS_PERIOD": "sum of COGS",
  "S5_LABOR_PERIOD": "from payroll file or estimate at 28% of revenue",
  "S5_LABOR_PCT": "from payroll or estimate 28%",
  "S5_LABOR_SOURCE": "from payroll file or 'Estimated at 28%'",
  "S5_PRIME_COST_AMT": "COGS + Labor",
  "S5_PRIME_COST_PCT": "prime_cost_amt / total_rev x 100",
  "S5_TARGET_PCT": ${settings.targets && settings.targets.prime_cost_pct || 60},
  "S5_BAR_COST_PCT": "USE APP DATA: ${avgBarCost ? avgBarCost.toFixed(1) : 'estimate'}",
  "S5_FOOD_COST_PCT": "USE APP DATA: ${avgFoodCost ? avgFoodCost.toFixed(1) : 'estimate'}",
  "S5_BLENDED_COGS_PCT": "bar_cost_pct weighted + food_cost_pct weighted",
  "S5_PRIME_WEEKLY": "prime cost tracking: ${weeks.length > 0 ? 'Yes — ' + weeks.length + ' weeks tracked' : 'Not tracked'}",
  "S5_LABOR_BY_DEPT": "from payroll or 'Not broken out'",
  "S5_SCHEDULE_FORECAST": "from files or 'Not submitted'",
  "S5_RPLH_TRACKED": "from files or 'Not tracked'",
  "S5_BAR_COST_GAP_MONTHLY": "calculate: bar_gap_pts/100 x monthly_bar_revenue",
  "S5_FOOD_COST_GAP_MONTHLY": "calculate: food_gap_pts/100 x monthly_food_revenue",
  "S5_COMBINED_COGS_GAP": "S5_BAR_COST_GAP_MONTHLY + S5_FOOD_COST_GAP_MONTHLY",
  "S5_TOTAL_REV_MONTHLY": "USE APP DATA: ${avgBarRev && avgFoodRev ? Math.round((avgBarRev+avgFoodRev)*4.33) : 0}",
  "S5_LABOR_MONTHLY": "estimate or from payroll",
  "S5_PTS_PRIME_PCT": "score 0-40 per rubric",
  "S5_PTS_PRIME_WEEKLY": "${weeks.length > 4 ? 15 : weeks.length > 0 ? 8 : 0}",
  "S5_PTS_LABOR_DEPT": "score 0-15",
  "S5_PTS_SCHEDULE": "score 0-15",
  "S5_PTS_RPLH": "score 0-15",
  "S5_SCORE": "SUM of S5 pts — MUST NOT BE 0",
  "S6_SIG1_SCORE": "HIGH, MEDIUM, or LOW based on actual data",
  "S6_SIG1_LABEL": "specific risk title based on actual data pattern",
  "S6_SIG1_EVIDENCE": "specific evidence from the data — quote actual numbers",
  "S6_SIG1_GAP": "specific dollar or percentage gap this risk represents",
  "S6_SIG1_TOOL": "specific action this operator should take",
  "S6_SIG2_SCORE": "HIGH, MEDIUM, or LOW",
  "S6_SIG2_LABEL": "specific risk title",
  "S6_SIG2_EVIDENCE": "specific evidence with numbers",
  "S6_SIG2_GAP": "specific gap",
  "S6_SIG2_TOOL": "specific action",
  "S6_SIG3_SCORE": "HIGH, MEDIUM, or LOW",
  "S6_SIG3_LABEL": "specific risk title",
  "S6_SIG3_EVIDENCE": "specific evidence with numbers",
  "S6_SIG3_GAP": "specific gap",
  "S6_SIG3_TOOL": "specific action",
  "S6_SIG4_SCORE": "HIGH, MEDIUM, or LOW",
  "S6_SIG4_LABEL": "specific risk title",
  "S6_SIG4_EVIDENCE": "specific evidence with numbers",
  "S6_SIG4_GAP": "specific gap",
  "S6_SIG4_TOOL": "specific action"
}`;
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

  return `You are a bar and restaurant revenue consultant generating a scored Bar Cop Revenue Audit. You have the operator's live app data below AND any uploaded documents. Your job is to produce a complete scored audit — every section must have a real score, not zero.

CRITICAL RULES:
1. NEVER output 0 for a section score. Score every section using app data + benchmarks even without uploaded files.
2. S1 (Check Average): use app data check_avg directly. Compare to target and score.
3. S2 (Labor): use app data labor_pct. Score vs target.
4. S3 (Menu Performance): if no menu file uploaded, score at 50 and note app data menu items count.
5. S4 (Server Performance): use server count from app. If server sales report not uploaded, score at 45.
6. S5 (Events): score at 50 if no event data. Do not leave null scores — use 50 as the N/A baseline.
7. OVERALL_SCORE: weighted avg of S1-S5. MUST NOT BE 0.
8. All monthly gap fields: calculate from (actual - target) x covers or revenue.

SCORING RUBRICS:
S1 Check Average (100 pts): within $1 of target=85, within $3=70, within $5=55, >$5 below=35. Add pts for revenue data quality.
S2 Labor Efficiency (100 pts): labor % vs target — within 1pt=85, within 3pts=65, >5pts over=35. RPLH tracked adds 15 pts.
S3 Menu Performance (100 pts): menu items in system: >20=base 60, 10-20=base 50, <10=base 40. POS mix data adds up to 30. Pricing data adds 10.
S4 Server Performance (100 pts): server report not submitted=45 base. With report: score spread, attach rates. Servers on roster >0 adds 5 pts.
S5 Events (100 pts): no data submitted=50. With data score frequency, average revenue, minimum compliance.

APP DATA (pre-seeded — use directly in output):
Bar Name: ${settings.bar_name || 'Not provided'}
City/State: ${settings.city_state || 'Not provided'}
Annual Bar Revenue: ${settings.annual_bar_revenue ? '$'+settings.annual_bar_revenue.toLocaleString() : 'Not provided'}
Annual Food Revenue: ${settings.annual_food_revenue ? '$'+settings.annual_food_revenue.toLocaleString() : 'Not provided'}
Check Average Target: $${targets.check_avg || 35}
Bar Labor Target: ${targets.bar_labor_pct || 28}%  Floor Labor Target: ${targets.floor_labor_pct || 32}%
RPLH Targets: Lunch $${targets.rplh_lunch || 50}  Dinner $${targets.rplh_dinner || 75}  Bar $${targets.rplh_bar || 65}
Servers on roster: ${servers.length}
Menu items in system: ${menuItems.length}
Weeks of revenue data: ${weeks.length}
4-week avg check average: ${avgCheckAvg ? '$'+avgCheckAvg.toFixed(2) : 'Not tracked — use $0 and apply S1 penalty'}
4-week avg labor %: ${avgLaborPct ? avgLaborPct.toFixed(1)+'%' : 'Not tracked — estimate 30%'}
4-week avg RPLH: ${avgRPLH ? '$'+avgRPLH.toFixed(2) : 'Not tracked'}
4-week avg covers/week: ${avgCovers ? Math.round(avgCovers) : 'Not tracked'}
4-week avg bar revenue/week: ${avgBarRev ? '$'+Math.round(avgBarRev) : 'Not tracked'}
4-week avg floor revenue/week: ${avgFloorRev ? '$'+Math.round(avgFloorRev) : 'Not tracked'}
Monthly cover count estimate: ${avgCovers ? Math.round(avgCovers*4.33) : 'Not tracked'}
Monthly revenue estimate: ${avgBarRev && avgFloorRev ? '$'+Math.round((avgBarRev+avgFloorRev)*4.33) : 'Not tracked'}

WEEKLY DATA (last 4 weeks):
${weeklySummary}

SERVER ROSTER:
${serverRoster}

MENU ITEMS:
${menuSummary}

Return ONLY valid JSON. No markdown, no explanation. Replace EVERY placeholder with a calculated value. String fields must contain real operator-specific observations.

{
  "BAR_NAME": "${settings.bar_name || 'Customer Bar'}",
  "BAR_CITY_STATE": "${settings.city_state || 'Unknown'}",
  "REVENUE_TIER": "calculate from annual revenue",
  "AUDIT_DATE": "current month and year",
  "AUDIT_ID": "RFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}",
  "AUDIT_PERIOD": "period covered",
  "DATA_TIER_LABEL": "Tier 1, 2, or 3",
  "WEEKLY_GAP_AMT": "calculate weekly revenue gap",
  "GAP_SOURCES": "top 2-3 specific revenue gap sources",
  "INDUSTRY_AVG": 61,
  "TARGET_SCORE": 65,
  "OVERALL_SCORE": "weighted avg of S1-S5 — MUST NOT BE 0",
  "SECTIONS_WITH_DATA": "count",
  "SECTIONS_PARTIAL": "count",
  "SECTIONS_NA": "count",
  "SECTION_DATA": [],
  "S1_SCORE": "score per rubric — MUST NOT BE 0",
  "S1_CHECK_AVG": "USE APP DATA: ${avgCheckAvg ? avgCheckAvg.toFixed(2) : 0}",
  "S1_CHECK_AVG_TARGET": ${targets.check_avg || 35},
  "S1_BAR_CHECK_AVG": "from server report or estimate",
  "S1_FOOD_CHECK_AVG": "from server report or estimate",
  "S1_COVER_COUNT": "USE APP DATA: ${avgCovers ? Math.round(avgCovers*4.33) : 0}",
  "S1_MONTHLY_REVENUE": "USE APP DATA: ${avgBarRev && avgFloorRev ? Math.round((avgBarRev+avgFloorRev)*4.33) : 0}",
  "S1_MONTHLY_GAP": "calculate: (check_avg_target - check_avg) x cover_count",
  "S1_ANNUAL_GAP": "S1_MONTHLY_GAP x 12",
  "S2_SCORE": "score per rubric — MUST NOT BE 0",
  "S2_LABOR_PCT": "USE APP DATA: ${avgLaborPct ? avgLaborPct.toFixed(1) : 30}",
  "S2_LABOR_TARGET_PCT": ${targets.floor_labor_pct || 32},
  "S2_RPLH": "USE APP DATA: ${avgRPLH ? avgRPLH.toFixed(2) : 0}",
  "S2_RPLH_TARGET": ${targets.rplh_dinner || 75},
  "S2_LABOR_PERIOD": "from payroll or estimate",
  "S2_SCHED_VS_ACTUAL": "from files or 'Not submitted'",
  "S2_OVERTIME_HRS": "from files or null",
  "S2_MONTHLY_GAP": "calculate: labor_gap_pct/100 x monthly_revenue",
  "S2_ANNUAL_GAP": "S2_MONTHLY_GAP x 12",
  "S3_SCORE": "score per rubric — MUST NOT BE 0",
  "S3_STARS_COUNT": "from POS mix or 0",
  "S3_PLOWHORSES_COUNT": "from POS mix or 0",
  "S3_DOGS_COUNT": "from POS mix or 0",
  "S3_PUZZLES_COUNT": "from POS mix or 0",
  "S3_TOP_CATEGORY": "from POS data or 'Not submitted'",
  "S3_MONTHLY_GAP": "from menu engineering or 0",
  "S3_PRICING_OPPORTUNITY": "estimate from menu items or 0",
  "S4_SCORE": "score per rubric — MUST NOT BE 0",
  "S4_SERVER_COUNT": ${servers.length || 0},
  "S4_TOP_CHECK_AVG": "from server report or 0",
  "S4_BOTTOM_CHECK_AVG": "from server report or 0",
  "S4_PERFORMANCE_SPREAD": "top minus bottom",
  "S4_APP_ATTACH_RATE": "from upsell report or null",
  "S4_DESSERT_ATTACH_RATE": "from upsell report or null",
  "S4_PRESHIFT_BRIEFING": "from files or 'Not documented'",
  "S4_MONTHLY_GAP": "from server spread analysis or 0",
  "S4_ANNUAL_GAP": "S4_MONTHLY_GAP x 12",
  "S5_SCORE": 50,
  "S5_EVENT_REV_PERIOD": "from event records or null",
  "S5_EVENTS_PER_MONTH": "from event records or null",
  "S5_AVG_EVENT_REVENUE": "from event records or null",
  "S5_MINIMUM_MET": "from event records or null",
  "S5_CATERING_REV_PERIOD": "from catering records or null",
  "S5_ANNUAL_EVENT_GAP": "from event records or null",
  "S5_MONTHLY_GAP": "from event records or null"
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

  return `You are a restaurant digital marketing consultant generating a scored Bar Cop Traffic Audit. You have the operator's live app data AND any uploaded screenshots. Score every section — never leave a score at 0.

CRITICAL RULES:
1. NEVER output 0 for a section score. Score all 7 sections using screenshots + app data + benchmarks.
2. If a screenshot was not uploaded for a section, score it at 40 and note what's missing.
3. S1 (GBP): if GBP screenshot uploaded, score completeness and photo count. If not, score at 35.
4. S3 (Reviews): use app data google_rating directly. Score vs benchmark.
5. OVERALL_SCORE: weighted avg of S1-S7. MUST NOT BE 0.
6. All monthly gap fields: estimate revenue impact based on industry benchmarks if not calculable.
7. String fields must be specific observations — not "Not submitted" unless truly nothing is available.

SCORING RUBRICS:
S1 GBP (100 pts): listing claimed+verified=20, hours+phone+website=15, menu linked=10, photos>50=15, posts>4/mo=15, response rate>75%=15, Q&A populated=10.
S2 Website (100 pts): exists+mobile=25, sessions vs benchmark scored, bounce rate scored, menu in top 3=15, online ordering=20.
S3 Reviews (100 pts): rating vs benchmark scored (4.5+=30, 4.3-4.5=20, 4.0-4.3=10, <4.0=0), response rate scored, review velocity scored, recency scored.
S4 Search (100 pts): maps pack confirmed=40, NAP consistent=30, primary keyword present=20, citation count=10.
S5 Social (100 pts): IG profile present=20, followers vs benchmark, post frequency vs 12/mo target, engagement rate if available.
S6 Delivery (100 pts): active on 1+ platform=20 per platform (max 3), ratings scored, photos>10=15, menu complete=15, promo active=10.
S7 Email/Loyalty (100 pts): list exists=20, size vs benchmark, frequency scored, open rate if available, loyalty program=15.

APP DATA (pre-seeded — use directly):
Bar Name: ${settings.bar_name || 'Not provided'}
City/State: ${settings.city_state || 'Not provided'}
Google Rating Target: ${targets.google_rating || 4.3}
Review Velocity Target: ${targets.review_velocity || 8}/month
Response Rate Target: ${targets.response_rate || 75}%
Monthly Sessions Target: ${targets.monthly_sessions || 2000}
Social Posts/Month Target: ${targets.social_posts_month || 12}
Weeks of tracking data: ${weeks.length}
4-week avg Google Rating: ${avgGR ? avgGR.toFixed(2) : 'Not tracked'}
4-week avg New Reviews/Mo: ${avgRV ? avgRV.toFixed(1) : 'Not tracked'}
4-week avg Response Rate: ${avgRR ? avgRR.toFixed(1)+'%' : 'Not tracked'}
4-week avg Monthly Sessions: ${avgSS ? Math.round(avgSS) : 'Not tracked'}
4-week avg Bounce Rate: ${avgBR ? avgBR.toFixed(1)+'%' : 'Not tracked'}
4-week avg Instagram Followers: ${avgIGF ? Math.round(avgIGF) : 'Not tracked'}
4-week avg IG Posts/Month: ${avgIGP ? avgIGP.toFixed(1) : 'Not tracked'}

WEEKLY DATA (last 4 weeks):
${weeklySummary}

Return ONLY valid JSON. No markdown, no explanation. All scores must be real calculated numbers, never 0.

{
  "BAR_NAME": "${settings.bar_name || 'Customer Bar'}",
  "BAR_CITY_STATE": "${settings.city_state || ''}",
  "REVENUE_TIER": "estimate from context",
  "AUDIT_DATE": "current month year",
  "AUDIT_ID": "TFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}",
  "AUDIT_PERIOD": "period covered",
  "DATA_TIER_LABEL": "Tier based on screenshots submitted",
  "WEEKLY_GAP_AMT": "estimated weekly traffic gap dollar value",
  "GAP_SOURCES": "top 2-3 traffic gap sources",
  "INDUSTRY_AVG": 58,
  "TARGET_SCORE": 65,
  "OVERALL_SCORE": "weighted avg of S1-S7 — MUST NOT BE 0",
  "SECTIONS_WITH_DATA": "count",
  "SECTIONS_PARTIAL": "count",
  "SECTIONS_NA": "count",
  "SECTION_DATA": [],
  "S1_TIER": 1,
  "S1_LISTING_CLAIMED": "from GBP screenshot or false",
  "S1_LISTING_VERIFIED": "from GBP screenshot or false",
  "S1_HOURS_COMPLETE": "from GBP screenshot or false",
  "S1_PHONE_PRESENT": "from GBP screenshot or false",
  "S1_WEBSITE_LINKED": "from GBP screenshot or false",
  "S1_MENU_LINK_ACTIVE": "from GBP screenshot or false",
  "S1_CATEGORY_SET": "from GBP screenshot or false",
  "S1_ATTRIBUTES_COMPLETE": "from GBP screenshot or false",
  "S1_PHOTO_COUNT": "from GBP screenshot or 0",
  "S1_PHOTO_BENCHMARK": 100,
  "S1_POSTS_LAST_30_DAYS": "from GBP screenshot or 0",
  "S1_POSTS_BENCHMARK": 8,
  "S1_REVIEW_COUNT_GOOGLE": "USE APP DATA: ${avgRV ? Math.round(avgRV*12) : 0} estimated annual",
  "S1_RATING_GOOGLE": "USE APP DATA: ${avgGR ? avgGR.toFixed(2) : 0}",
  "S1_REVIEW_RESPONSE_RATE": "USE APP DATA: ${avgRR ? Math.round(avgRR) : 0}",
  "S1_RESPONSE_BENCHMARK": 75,
  "S1_QA_POPULATED": "from GBP screenshot or false",
  "S1_PROFILE_COMPLETENESS_PCT": "calculate from checklist above",
  "S1_MONTHLY_GAP": "estimate revenue impact",
  "S1_ANNUAL_GAP": "S1_MONTHLY_GAP x 12",
  "S1_SCORE": "score per rubric — MUST NOT BE 0",
  "S2_TIER": 1,
  "S2_WEBSITE_EXISTS": "from screenshot or false",
  "S2_MOBILE_OPTIMIZED": "from mobile screenshot or false",
  "S2_MONTHLY_SESSIONS": "USE APP DATA: ${avgSS ? Math.round(avgSS) : 0}",
  "S2_SESSIONS_BENCHMARK": 2000,
  "S2_BOUNCE_RATE": "USE APP DATA: ${avgBR ? avgBR.toFixed(1) : 0}",
  "S2_BOUNCE_BENCHMARK": 60,
  "S2_MENU_PAGE_IN_TOP_3": "from analytics or false",
  "S2_MENU_PAGE_SESSIONS": "from analytics or 0",
  "S2_TOP_PAGES": [],
  "S2_ONLINE_ORDERING_PRESENT": "from website screenshot or false",
  "S2_RESERVATION_SYSTEM": "from website screenshot or false",
  "S2_AVG_SESSION_DURATION_SEC": "from analytics or 0",
  "S2_PAGE_LOAD_SCORE": null,
  "S2_SOURCE_BREAKDOWN": null,
  "S2_MONTHLY_GAP": "estimate",
  "S2_ANNUAL_GAP": "S2_MONTHLY_GAP x 12",
  "S2_SCORE": "score per rubric — MUST NOT BE 0",
  "S3_TIER": 1,
  "S3_GOOGLE_RATING": "USE APP DATA: ${avgGR ? avgGR.toFixed(2) : 0}",
  "S3_GOOGLE_RATING_BENCHMARK": 4.3,
  "S3_GOOGLE_REVIEW_COUNT": "from reviews screenshot or estimate",
  "S3_GOOGLE_COUNT_BENCHMARK": 200,
  "S3_RESPONSE_RATE": "USE APP DATA: ${avgRR ? Math.round(avgRR) : 0}",
  "S3_RESPONSE_BENCHMARK": 75,
  "S3_YELP_RATING": "from Yelp screenshot or 0",
  "S3_YELP_RATING_BENCHMARK": 4.0,
  "S3_YELP_REVIEW_COUNT": "from Yelp screenshot or 0",
  "S3_TRIPADVISOR_PRESENT": false,
  "S3_MOST_RECENT_REVIEW_DAYS": "from reviews screenshot or 0",
  "S3_RECENCY_BENCHMARK": 7,
  "S3_NEGATIVE_PATTERN": "identify from reviews or 'None identified'",
  "S3_MONTHLY_GAP": "estimate revenue impact of review score",
  "S3_ANNUAL_GAP": "S3_MONTHLY_GAP x 12",
  "S3_UNANSWERED": "from reviews screenshot or 0",
  "S3_SCORE": "score per rubric — MUST NOT BE 0",
  "S4_TIER": 1,
  "S4_MAPS_PACK_CONFIRMED": "from search screenshot or false",
  "S4_RANKING_REPORT_SUBMITTED": false,
  "S4_NAP_CONSISTENT": "from screenshots or false",
  "S4_NAP_BUSINESS_NAME": "${settings.bar_name || ''}",
  "S4_NAP_ADDRESS": "from screenshots or 'Not verified'",
  "S4_NAP_PHONE": "from screenshots or 'Not verified'",
  "S4_WEBSITE_TITLES_ASSESSED": false,
  "S4_CITATION_COUNT": null,
  "S4_PRIMARY_KEYWORD": "${settings.bar_name ? settings.bar_name.split(' ')[0].toLowerCase() + ' bar ' + (settings.city_state||'').split(',')[0] : 'bar [city]'}",
  "S4_SECONDARY_KEYWORDS": [],
  "S4_MONTHLY_GAP": null,
  "S4_SCORE": "score per rubric — MUST NOT BE 0",
  "S5_TIER": 1,
  "S5_IG_PROFILE_SUBMITTED": "true if IG screenshot uploaded",
  "S5_IG_FOLLOWERS": "USE APP DATA: ${avgIGF ? Math.round(avgIGF) : 0}",
  "S5_IG_POSTS_LAST_30": "USE APP DATA: ${avgIGP ? Math.round(avgIGP) : 0}",
  "S5_IG_POSTS_BENCHMARK": 12,
  "S5_IG_ENGAGEMENT_RATE": "from analytics screenshot or null",
  "S5_FB_FOLLOWERS": "from Facebook screenshot or 0",
  "S5_FB_POSTS_LAST_30": "from Facebook screenshot or 0",
  "S5_CONTENT_TYPE": "from IG screenshot or 'Not assessed'",
  "S5_FOOD_PHOTO_RATIO": "from IG screenshot or 0",
  "S5_MONTHLY_GAP": "estimate",
  "S5_ANNUAL_GAP": "S5_MONTHLY_GAP x 12",
  "S5_SCORE": "score per rubric — MUST NOT BE 0",
  "S6_TIER": 1,
  "S6_DOORDASH_ACTIVE": "from delivery screenshot or false",
  "S6_UBEREATS_ACTIVE": "from delivery screenshot or false",
  "S6_GRUBHUB_ACTIVE": "from delivery screenshot or false",
  "S6_PLATFORM_COUNT": "count of active platforms",
  "S6_DOORDASH_RATING": "from screenshot or null",
  "S6_UBEREATS_RATING": "from screenshot or null",
  "S6_PHOTO_COUNT_DELIVERY": "from delivery screenshot or 0",
  "S6_MENU_COMPLETE": "from delivery screenshot or false",
  "S6_PROMO_ACTIVE": "from delivery screenshot or false",
  "S6_MONTHLY_GAP": "estimate delivery revenue gap",
  "S6_ANNUAL_GAP": "S6_MONTHLY_GAP x 12",
  "S6_SCORE": "score per rubric — MUST NOT BE 0",
  "S7_TIER": 1,
  "S7_EMAIL_LIST_EXISTS": "from email screenshot or false",
  "S7_LIST_SIZE": "from email screenshot or 0",
  "S7_LIST_BENCHMARK": 500,
  "S7_LAST_SEND_DAYS_AGO": "from email screenshot or null",
  "S7_SEND_FREQUENCY": "from email screenshot or 'Never'",
  "S7_OPEN_RATE": "from analytics or null",
  "S7_OPEN_BENCHMARK": 35,
  "S7_GROWTH_MECHANISM": "from screenshots or 'None identified'",
  "S7_LOYALTY_PROGRAM": "from screenshots or false",
  "S7_MONTHLY_GAP": "estimate",
  "S7_ANNUAL_GAP": "S7_MONTHLY_GAP x 12",
  "S7_SCORE": "score per rubric — MUST NOT BE 0"
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

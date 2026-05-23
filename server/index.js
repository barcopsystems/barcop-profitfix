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

    let controlData = null;
    try { controlData = JSON.parse(fields.controlData?.[0] || 'null'); } catch(e) {}

    try {
      const auditData = await extractAuditData(apiKey, 'profit', uploadedFiles, appData, notes, controlData);
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

    let controlData = null;
    try { controlData = JSON.parse(fields.controlData?.[0] || 'null'); } catch(e) {}

    try {
      const auditData = await extractAuditData(apiKey, 'revenue', uploadedFiles, appData, notes, controlData);
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
async function extractAuditData(apiKey, auditType, files, appData, notes='', controlData=null) {
  const prompts = {
    profit:  getExtractionPrompt_Profit(appData, controlData),
    revenue: getExtractionPrompt_Revenue(appData, controlData),
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
Return this exact JSON structure with all values calculated (not 0):
"BAR_NAME","BAR_CITY_STATE","REVENUE_TIER","AUDIT_DATE","AUDIT_ID":"PFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}","AUDIT_PERIOD","DATA_TIER_LABEL","WEEKLY_GAP_AMT","GAP_SOURCES","INDUSTRY_AVG":63,"TARGET_SCORE":65,
"OVERALL_SCORE":[calculated],
"S1_SCORE":[calc],"S1_BAR_COST_PCT":[from app:${avgBarCost?avgBarCost.toFixed(1):0}],"S1_BAR_REV_MONTHLY":[calc],"S1_BEV_COGS_PERIOD":[calc],"S1_BAR_REV_PERIOD":[calc],"S1_INV_VARIANCE_PCT":[from file or 0],"S1_INV_VARIANCE_AMT":[calc],"S1_POUR_METHOD":[from file],"S1_RECIPE_COVERAGE":"${recipes.length} recipes","S1_VARIANCE_FREQ":[obs],"S1_VARIANCE_SKU":[obs],"S1_TARGET_PCT":${(settings.targets&&settings.targets.bar_pour_cost_pct)||22},"S1_GAP_PTS":[calc],"S1_MONTHLY_GAP":[calc],"S1_ANNUAL_GAP":[calc],"S1_PTS_BAR_COST":[pts],"S1_PTS_RECIPE":[pts],"S1_PTS_POUR":[pts],"S1_PTS_VAR_FREQ":[pts],"S1_PTS_VAR_SKU":[pts],
"S2_SCORE":[calc],"S2_BEV_REV_MONTHLY":[calc],"S2_VOIDS_AMT":[file or 0],"S2_COMPS_AMT":[file or 0],"S2_VOID_COMP_PCT":[file or 1.5],"S2_VOID_COMP_AMT":[calc],"S2_VOIDS_NO_APPROVAL_PCT":[file or 0],"S2_VOIDS_NO_APPROVAL_AMT":[calc],"S2_CASH_POLICY":"${recons.length>0?'Reconciliation performed':'Not documented'}","S2_VOID_APPROVAL":[obs],"S2_DRAWER_RECON":"${recons.length>0?'Yes — '+recons.length+' entries':'No'}","S2_OVERSHORT_POLICY":[obs],"S2_BOTTLE_SECURITY":[obs],"S2_NOSALE_POLICY":[obs],"S2_SPILLAGE_LOG":"${shifts.length>0?'Yes — '+shifts.length+' shift checks':'Not documented'}","S2_BENCHMARK_PCT":2.0,"S2_GAP_PCT":[calc],"S2_MONTHLY_GAP":[calc],"S2_ANNUAL_GAP":[calc],"S2_PTS_VOID_COMP":[pts],"S2_PTS_VOID_APPROVAL":[pts],"S2_PTS_DRAWER":${recons.length>0?15:0},"S2_PTS_CASH_POLICY":[pts],"S2_PTS_BOTTLE":[pts],"S2_PTS_SPILLAGE":${shifts.length>0?10:0},
"S3_SCORE":[calc],"S3_FOOD_COST_PCT":[from app:${avgFoodCost?avgFoodCost.toFixed(1):0}],"S3_FOOD_REV_MONTHLY":[calc],"S3_FOOD_COGS_PERIOD":[calc],"S3_FOOD_VAR_PCT":[file or 0],"S3_FOOD_VAR_AMT":[calc],"S3_RECIPE_COVERAGE":"${kitchen.length} kitchen products","S3_PORTION_STANDARDS":[obs],"S3_INV_FREQ":[obs],"S3_THEO_ACTUAL":[obs],"S3_WASTE_LOG":[obs],"S3_TARGET_PCT":${(settings.targets&&settings.targets.food_cost_pct)||32},"S3_GAP_PTS":[calc],"S3_MONTHLY_GAP":[calc],"S3_ANNUAL_GAP":[calc],"S3_PTS_FOOD_COST":[pts],"S3_PTS_RECIPE":[pts],"S3_PTS_PORTION":[pts],"S3_PTS_INV":[pts],"S3_PTS_WASTE":[pts],
"S4_SCORE":[calc],"S4_BEV_INVOICE_COUNT":[file or ${vendor.length}],"S4_FOOD_INVOICE_COUNT":[file or 0],"S4_AUDIT_PERIOD_DESC":"4 weeks","S4_VENDOR_SPEND_MONTHLY":[calc],"S4_BEV_INVOICE_SPEND":[file or calc],"S4_FOOD_INVOICE_SPEND":[file or calc],"S4_INVOICE_VS_PO":[obs],"S4_PRICE_VERIFY":"${vendor.length>0?'Active — '+vendor.length+' changes logged':'Not documented'}","S4_DELIVERY_COUNT":[obs],"S4_CREDIT_MEMOS":[obs],"S4_ANNUAL_BIDS":[obs],"S4_BACKUP_VENDORS":[obs],"S4_PAYMENT_POLICY":[obs],"S4_EXPOSURE_PCT":3.0,"S4_EXPOSURE_MONTHLY":[calc 3% of COGS],"S4_EXPOSURE_ANNUAL":[calc],"S4_PTS_INVOICE_PO":[pts],"S4_PTS_PRICE_VERIFY":${vendor.length>0?15:0},"S4_PTS_DELIVERY":[pts],"S4_PTS_CREDIT":[pts],"S4_PTS_BIDS":[pts],"S4_PTS_PAYMENT":[pts],
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
check_avg_target=$${targets.check_avg||35} | labor_target=${targets.floor_labor_pct||32}%
rplh_targets: lunch=$${targets.rplh_lunch||50} dinner=$${targets.rplh_dinner||75} bar=$${targets.rplh_bar||65}
servers_on_roster=${servers.length} | menu_items=${menuItems.length} | weeks_data=${weeks.length}
avg_check_avg=$${avgCheckAvg?avgCheckAvg.toFixed(2):0} | avg_labor_pct=${avgLaborPct?avgLaborPct.toFixed(1):0}%
avg_rplh=$${avgRPLH?avgRPLH.toFixed(2):0} | avg_covers_week=${avgCovers?Math.round(avgCovers):0}
avg_bar_rev_week=$${avgBarRev?Math.round(avgBarRev):0} | avg_floor_rev_week=$${avgFloorRev?Math.round(avgFloorRev):0}
monthly_covers_est=${avgCovers?Math.round(avgCovers*4.33):0} | monthly_rev_est=$${avgBarRev&&avgFloorRev?Math.round((avgBarRev+avgFloorRev)*4.33):0}
${weeklySummary?'WEEKLY:\n'+weeklySummary:''}
${serverRoster?'SERVERS:\n'+serverRoster:''}
${controlBlock}
Return this exact JSON (all values calculated):
"BAR_NAME","BAR_CITY_STATE","REVENUE_TIER","AUDIT_DATE","AUDIT_ID":"RFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}","AUDIT_PERIOD","DATA_TIER_LABEL","WEEKLY_GAP_AMT","GAP_SOURCES","INDUSTRY_AVG":61,"TARGET_SCORE":65,
"OVERALL_SCORE":[calc weighted avg],
"S1_SCORE":[calc],"S1_CHECK_AVG":[from app:${avgCheckAvg?avgCheckAvg.toFixed(2):0}],"S1_CHECK_AVG_TARGET":${targets.check_avg||35},"S1_BAR_CHECK_AVG":[from report or est],"S1_FOOD_CHECK_AVG":[from report or est],"S1_COVER_COUNT":${avgCovers?Math.round(avgCovers*4.33):0},"S1_MONTHLY_REVENUE":${avgBarRev&&avgFloorRev?Math.round((avgBarRev+avgFloorRev)*4.33):0},"S1_MONTHLY_GAP":[calc: (target-actual)*covers],"S1_ANNUAL_GAP":[calc],
"S2_SCORE":[calc],"S2_LABOR_PCT":[from app:${avgLaborPct?avgLaborPct.toFixed(1):30}],"S2_LABOR_TARGET_PCT":${targets.floor_labor_pct||32},"S2_RPLH":[from app:${avgRPLH?avgRPLH.toFixed(2):0}],"S2_RPLH_TARGET":${targets.rplh_dinner||75},"S2_LABOR_PERIOD":[calc],"S2_SCHED_VS_ACTUAL":[obs],"S2_OVERTIME_HRS":[file or null],"S2_MONTHLY_GAP":[calc],"S2_ANNUAL_GAP":[calc],
"S3_SCORE":[calc],"S3_STARS_COUNT":[file or 0],"S3_PLOWHORSES_COUNT":[file or 0],"S3_DOGS_COUNT":[file or 0],"S3_PUZZLES_COUNT":[file or 0],"S3_TOP_CATEGORY":[file or est],"S3_MONTHLY_GAP":[calc or 0],"S3_PRICING_OPPORTUNITY":[calc or 0],
"S4_SCORE":[calc],"S4_SERVER_COUNT":${servers.length||0},"S4_TOP_CHECK_AVG":[file or 0],"S4_BOTTOM_CHECK_AVG":[file or 0],"S4_PERFORMANCE_SPREAD":[calc],"S4_APP_ATTACH_RATE":[file or null],"S4_DESSERT_ATTACH_RATE":[file or null],"S4_PRESHIFT_BRIEFING":[obs],"S4_MONTHLY_GAP":[calc or 0],"S4_ANNUAL_GAP":[calc],
"S5_SCORE":50,"S5_EVENT_REV_PERIOD":[file or null],"S5_EVENTS_PER_MONTH":[file or null],"S5_AVG_EVENT_REVENUE":[file or null],"S5_MINIMUM_MET":[file or null],"S5_CATERING_REV_PERIOD":[file or null],"S5_ANNUAL_EVENT_GAP":[file or null],"S5_MONTHLY_GAP":[file or null],
"S6_SIG1_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG1_LABEL":[specific title],"S6_SIG1_EVIDENCE":[specific with numbers],"S6_SIG1_GAP":[specific gap],"S6_SIG1_TOOL":[action],
"S6_SIG2_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG2_LABEL":[specific],"S6_SIG2_EVIDENCE":[specific],"S6_SIG2_GAP":[specific],"S6_SIG2_TOOL":[action],
"S6_SIG3_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG3_LABEL":[specific],"S6_SIG3_EVIDENCE":[specific],"S6_SIG3_GAP":[specific],"S6_SIG3_TOOL":[action],
"S6_SIG4_SCORE":[HIGH/MEDIUM/LOW],"S6_SIG4_LABEL":[specific],"S6_SIG4_EVIDENCE":[specific],"S6_SIG4_GAP":[specific],"S6_SIG4_TOOL":[action]`
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

  return `TRAFFIC AUDIT — respond with a single JSON object, no other text. Use app data + screenshots. Never output 0 for a score.

SCORING (out of 100 each):
S1 GBP: claimed+verified=20, hours+phone+website=15, menu linked=10, photos>50=15, posts>4/mo=15, response>75%=15, Q&A=10.
S2 Website: exists+mobile=25, sessions vs 2000/mo benchmark scored, bounce<60%=15, menu in top3=15, online ordering=20.
S3 Reviews: rating≥4.5=30, 4.3-4.5=20, 4.0-4.3=10, <4.0=0. Response rate scored. Review velocity scored. Recency scored.
S4 Search: maps pack=40, NAP consistent=30, primary keyword=20, citations=10.
S5 Social: IG profile=20, followers scored, post freq vs 12/mo scored, engagement if available.
S6 Delivery: active platforms 20pts each (max 3), ratings scored, photos>10=15, menu complete=15, promo=10.
S7 Email: list exists=20, size vs 500 benchmark, frequency scored, open rate if available, loyalty=15.
S8: 4 specific traffic-side risk signals with HIGH/MEDIUM/LOW ratings (review velocity drops, unanswered review backlog, GBP staleness, platform-specific issues, posting cadence gaps, email channel dormancy, anything an experienced operator would flag on a walkthrough). Not scored, surfaced as signals only.
OVERALL: weighted avg S1-S7.

APP DATA:
bar_name=${settings.bar_name||''} | city=${settings.city_state||''}
google_rating_target=${targets.google_rating||4.3} | review_velocity_target=${targets.review_velocity||8}/mo
response_rate_target=${targets.response_rate||75}% | sessions_target=${targets.monthly_sessions||2000}/mo
social_posts_target=${targets.social_posts_month||12}/mo | weeks_tracked=${weeks.length}
avg_google_rating=${avgGR?avgGR.toFixed(2):'not tracked'} | avg_new_reviews_mo=${avgRV?avgRV.toFixed(1):'not tracked'}
avg_response_rate=${avgRR?avgRR.toFixed(1)+'%':'not tracked'} | avg_monthly_sessions=${avgSS?Math.round(avgSS):'not tracked'}
avg_bounce_rate=${avgBR?avgBR.toFixed(1)+'%':'not tracked'} | avg_ig_followers=${avgIGF?Math.round(avgIGF):'not tracked'}
avg_ig_posts_mo=${avgIGP?avgIGP.toFixed(1):'not tracked'}
${weeklySummary?'WEEKLY:\n'+weeklySummary:''}

Return this exact JSON (all values calculated):
"BAR_NAME","BAR_CITY_STATE","REVENUE_TIER","AUDIT_DATE","AUDIT_ID":"TFA-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}","AUDIT_PERIOD","DATA_TIER_LABEL","WEEKLY_GAP_AMT","GAP_SOURCES","INDUSTRY_AVG":58,"TARGET_SCORE":65,
"OVERALL_SCORE":[calc],
"S1_SCORE":[calc],"S1_LISTING_CLAIMED":[screenshot],"S1_LISTING_VERIFIED":[screenshot],"S1_HOURS_COMPLETE":[screenshot],"S1_PHONE_PRESENT":[screenshot],"S1_WEBSITE_LINKED":[screenshot],"S1_MENU_LINK_ACTIVE":[screenshot],"S1_CATEGORY_SET":[screenshot],"S1_ATTRIBUTES_COMPLETE":[screenshot],"S1_PHOTO_COUNT":[screenshot or 0],"S1_PHOTO_BENCHMARK":100,"S1_POSTS_LAST_30_DAYS":[screenshot or 0],"S1_POSTS_BENCHMARK":8,"S1_REVIEW_COUNT_GOOGLE":[screenshot],"S1_RATING_GOOGLE":[app:${avgGR?avgGR.toFixed(2):0}],"S1_REVIEW_RESPONSE_RATE":[app:${avgRR?Math.round(avgRR):0}],"S1_RESPONSE_BENCHMARK":75,"S1_QA_POPULATED":[screenshot],"S1_PROFILE_COMPLETENESS_PCT":[calc],"S1_MONTHLY_GAP":[est],"S1_ANNUAL_GAP":[calc],
"S2_SCORE":[calc],"S2_WEBSITE_EXISTS":[screenshot],"S2_MOBILE_OPTIMIZED":[screenshot],"S2_MONTHLY_SESSIONS":[app:${avgSS?Math.round(avgSS):0}],"S2_SESSIONS_BENCHMARK":2000,"S2_BOUNCE_RATE":[app:${avgBR?avgBR.toFixed(1):0}],"S2_BOUNCE_BENCHMARK":60,"S2_MENU_PAGE_IN_TOP_3":[analytics],"S2_MENU_PAGE_SESSIONS":[analytics or 0],"S2_TOP_PAGES":[],"S2_ONLINE_ORDERING_PRESENT":[screenshot],"S2_RESERVATION_SYSTEM":[screenshot],"S2_AVG_SESSION_DURATION_SEC":[analytics or 0],"S2_PAGE_LOAD_SCORE":null,"S2_SOURCE_BREAKDOWN":null,"S2_MONTHLY_GAP":[est],"S2_ANNUAL_GAP":[calc],
"S3_SCORE":[calc],"S3_GOOGLE_RATING":[app:${avgGR?avgGR.toFixed(2):0}],"S3_GOOGLE_RATING_BENCHMARK":4.3,"S3_GOOGLE_REVIEW_COUNT":[screenshot],"S3_GOOGLE_COUNT_BENCHMARK":200,"S3_RESPONSE_RATE":[app:${avgRR?Math.round(avgRR):0}],"S3_RESPONSE_BENCHMARK":75,"S3_YELP_RATING":[screenshot or 0],"S3_YELP_RATING_BENCHMARK":4.0,"S3_YELP_REVIEW_COUNT":[screenshot or 0],"S3_TRIPADVISOR_PRESENT":false,"S3_MOST_RECENT_REVIEW_DAYS":[screenshot],"S3_RECENCY_BENCHMARK":7,"S3_NEGATIVE_PATTERN":[obs],"S3_MONTHLY_GAP":[est],"S3_ANNUAL_GAP":[calc],"S3_UNANSWERED":[screenshot or 0],
"S4_SCORE":[calc],"S4_MAPS_PACK_CONFIRMED":[screenshot],"S4_RANKING_REPORT_SUBMITTED":false,"S4_NAP_CONSISTENT":[screenshots],"S4_NAP_BUSINESS_NAME":"${settings.bar_name||''}","S4_NAP_ADDRESS":[screenshot],"S4_NAP_PHONE":[screenshot],"S4_WEBSITE_TITLES_ASSESSED":false,"S4_CITATION_COUNT":null,"S4_PRIMARY_KEYWORD":"${settings.bar_name?(settings.bar_name.split(' ')[0]||'').toLowerCase()+' bar':'bar [city]'}","S4_SECONDARY_KEYWORDS":[],"S4_MONTHLY_GAP":null,
"S5_SCORE":[calc],"S5_IG_PROFILE_SUBMITTED":[true if uploaded],"S5_IG_FOLLOWERS":[app:${avgIGF?Math.round(avgIGF):0}],"S5_IG_POSTS_LAST_30":[app:${avgIGP?Math.round(avgIGP):0}],"S5_IG_POSTS_BENCHMARK":12,"S5_IG_ENGAGEMENT_RATE":[analytics or null],"S5_FB_FOLLOWERS":[screenshot or 0],"S5_FB_POSTS_LAST_30":[screenshot or 0],"S5_CONTENT_TYPE":[screenshot obs],"S5_FOOD_PHOTO_RATIO":[screenshot or 0],"S5_MONTHLY_GAP":[est],"S5_ANNUAL_GAP":[calc],
"S6_SCORE":[calc],"S6_DOORDASH_ACTIVE":[screenshot],"S6_UBEREATS_ACTIVE":[screenshot],"S6_GRUBHUB_ACTIVE":[screenshot],"S6_PLATFORM_COUNT":[count],"S6_DOORDASH_RATING":[screenshot or null],"S6_UBEREATS_RATING":[screenshot or null],"S6_PHOTO_COUNT_DELIVERY":[screenshot or 0],"S6_MENU_COMPLETE":[screenshot],"S6_PROMO_ACTIVE":[screenshot],"S6_MONTHLY_GAP":[est],"S6_ANNUAL_GAP":[calc],
"S7_SCORE":[calc],"S7_EMAIL_LIST_EXISTS":[screenshot],"S7_LIST_SIZE":[screenshot or 0],"S7_LIST_BENCHMARK":500,"S7_LAST_SEND_DAYS_AGO":[screenshot or null],"S7_SEND_FREQUENCY":[screenshot],"S7_OPEN_RATE":[analytics or null],"S7_OPEN_BENCHMARK":35,"S7_GROWTH_MECHANISM":[obs],"S7_LOYALTY_PROGRAM":[screenshot],"S7_MONTHLY_GAP":[est],"S7_ANNUAL_GAP":[calc],
"S8_SIG1_SCORE":[HIGH/MEDIUM/LOW],"S8_SIG1_LABEL":[specific title],"S8_SIG1_EVIDENCE":[specific with numbers],"S8_SIG1_GAP":[specific gap],"S8_SIG1_TOOL":[action],
"S8_SIG2_SCORE":[HIGH/MEDIUM/LOW],"S8_SIG2_LABEL":[specific],"S8_SIG2_EVIDENCE":[specific],"S8_SIG2_GAP":[specific],"S8_SIG2_TOOL":[action],
"S8_SIG3_SCORE":[HIGH/MEDIUM/LOW],"S8_SIG3_LABEL":[specific],"S8_SIG3_EVIDENCE":[specific],"S8_SIG3_GAP":[specific],"S8_SIG3_TOOL":[action],
"S8_SIG4_SCORE":[HIGH/MEDIUM/LOW],"S8_SIG4_LABEL":[specific],"S8_SIG4_EVIDENCE":[specific],"S8_SIG4_GAP":[specific],"S8_SIG4_TOOL":[action]`
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

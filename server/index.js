'use strict';
const express  = require('express');
const path     = require('path');
const https    = require('https');
const http     = require('http');
const fs       = require('fs');
const os       = require('os');
const { execSync, spawn } = require('child_process');
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

// ── Ensure logo exists ────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, 'audits', 'logo.png');
function ensureLogo() {
  if (fs.existsSync(LOGO_PATH)) return Promise.resolve();
  return new Promise((resolve) => {
    const url = 'https://cdn.shopify.com/s/files/1/1507/5436/files/AUDIT_LOGO_KEEP.png?v=1779028817';
    const file = fs.createWriteStream(LOGO_PATH);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', () => { fs.unlink(LOGO_PATH, () => {}); resolve(); });
  });
}
ensureLogo();

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

// ── Audit generation endpoint ─────────────────────────────────────────────────
// POST /api/generate-audit
// Accepts multipart form: auditType, appData (JSON string), files...
// Returns: { pdfBase64, auditData }
app.post('/api/generate-audit', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const form = new multiparty.Form({ maxFilesSize: 50 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Form parse error: ' + err.message });

    const auditType = fields.auditType?.[0] || 'profit';
    const appDataStr = fields.appData?.[0] || '{}';
    let appData = {};
    try { appData = JSON.parse(appDataStr); } catch(e) {}

    const uploadedFiles = [];
    for (const [key, fileArr] of Object.entries(files)) {
      for (const f of fileArr) {
        if (f.size > 0) {
          uploadedFiles.push({ field: key, path: f.path, name: f.originalFilename, size: f.size });
        }
      }
    }

    try {
      // Step 1: Extract data from uploaded files via Claude
      const extractedData = await extractAuditData(apiKey, auditType, uploadedFiles, appData);

      // Step 2: Generate PDF
      const pdfBuffer = await generateAuditPDF(auditType, extractedData);

      // Step 3: Return PDF as base64
      const pdfBase64 = pdfBuffer.toString('base64');
      res.json({ ok: true, pdfBase64, auditData: extractedData });

    } catch(e) {
      console.error('Audit generation error:', e);
      res.status(500).json({ error: e.message || 'Audit generation failed' });
    } finally {
      // Clean up temp files
      for (const f of uploadedFiles) {
        fs.unlink(f.path, () => {});
      }
    }
  });
});

// ── Parse spreadsheet/CSV file into readable text for Claude ──────────────────
function parseSpreadsheetToText(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  try {
    if (ext === '.csv') {
      const raw = fs.readFileSync(filePath, 'utf8');
      const lines = raw.trim().split('\n').slice(0, 200); // cap at 200 rows
      return `FILE: ${fileName}\n${lines.join('\n')}`;
    }
    if (['.xlsx', '.xls'].includes(ext)) {
      if (!XLSX) return `FILE: ${fileName}\n[Excel parser not available — install xlsx package]`;
      const wb    = XLSX.readFile(filePath);
      const parts = [];
      for (const sheetName of wb.SheetNames.slice(0, 5)) { // max 5 sheets
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
      // Word docs — return filename only, Claude can't read binary Word
      return `FILE: ${fileName}\n[Word document submitted — operator should convert to PDF for best results]`;
    }
  } catch(e) {
    return `FILE: ${fileName}\n[Parse error: ${e.message}]`;
  }
  return null;
}

// ── Extract audit data from uploaded files ────────────────────────────────────
async function extractAuditData(apiKey, auditType, files, appData) {
  const prompts = {
    profit:  getExtractionPrompt_Profit(appData),
    revenue: getExtractionPrompt_Revenue(appData),
    traffic: getExtractionPrompt_Traffic(appData),
  };

  const prompt = prompts[auditType] || prompts.profit;

  // Build message content with all files
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

  // Add all spreadsheet/CSV data as a single text block before the prompt
  if (spreadsheetTexts.length > 0) {
    content.push({
      type: 'text',
      text: 'SUBMITTED DATA FILES — Read all data carefully and use it to score each section:\n\n'
        + spreadsheetTexts.join('\n\n---\n\n')
    });
  }

  content.push({ type: 'text', text: prompt });

  const body = JSON.stringify({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
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

// ── Generate PDF from data ─────────────────────────────────────────────────────
async function generateAuditPDF(auditType, data) {
  const scripts = {
    profit:  path.join(__dirname, 'audits', 'build_pf_audit.py'),
    revenue: path.join(__dirname, 'audits', 'build_rf_audit.py'),
    traffic: path.join(__dirname, 'audits', 'build_tf_audit.py'),
  };

  const scriptPath = scripts[auditType];
  if (!scriptPath || !fs.existsSync(scriptPath)) {
    throw new Error(`Audit build script not found for type: ${auditType}`);
  }

  // Write data to temp JSON file
  const tmpDir   = os.tmpdir();
  const dataPath = path.join(tmpDir, `audit_data_${Date.now()}.json`);
  const outPath  = path.join(tmpDir, `audit_${Date.now()}.pdf`);

  fs.writeFileSync(dataPath, JSON.stringify(data));

  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      AUDIT_DATA_JSON: dataPath,
      AUDIT_OUT_PATH:  outPath,
      AUDIT_LOGO_PATH: LOGO_PATH,
    };

    const py = spawn('python3', [scriptPath], { env });
    let stderr = '';
    py.stderr.on('data', d => { stderr += d.toString(); });
    py.on('close', code => {
      fs.unlink(dataPath, () => {});
      if (code !== 0) {
        reject(new Error('PDF generation failed: ' + stderr.slice(-500)));
        return;
      }
      if (!fs.existsSync(outPath)) {
        reject(new Error('PDF file not created'));
        return;
      }
      const buf = fs.readFileSync(outPath);
      fs.unlink(outPath, () => {});
      resolve(buf);
    });
  });
}

// ── Claude HTTP helper ─────────────────────────────────────────────────────────
function callClaude(apiKey, body) {
  return new Promise((resolve, reject) => {
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
    let raw = '';
    const req = https.request(options, res => {
      res.on('data', d => { raw += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch(e) { reject(new Error('Claude response parse error')); }
      });
    });
    req.on('error', reject);
    req.write(body);
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

  // Calculate averages from app data
  const recentWeeks = weeks.slice(-4);
  const avgBarCost  = recentWeeks.length ? recentWeeks.reduce((s,w) => s+(w.bar?.cost_pct||0),0)/recentWeeks.length : null;
  const avgFoodCost = recentWeeks.length ? recentWeeks.reduce((s,w) => s+(w.food?.cost_pct||0),0)/recentWeeks.length : null;
  const avgBarRev   = recentWeeks.length ? recentWeeks.reduce((s,w) => s+(w.bar?.revenue||0),0)/recentWeeks.length : null;
  const avgFoodRev  = recentWeeks.length ? recentWeeks.reduce((s,w) => s+(w.food?.revenue||0),0)/recentWeeks.length : null;

  return `You are generating a Bar Cop Profit Audit. Analyze all submitted documents AND the app data provided below. Extract the exact variables needed to generate a professional scored PDF audit report.

APP DATA (from customer's 30 days of usage):
- Bar Name: ${settings.bar_name || 'Not provided'}
- City/State: ${settings.city_state || 'Not provided'}
- Annual Bar Revenue: ${settings.annual_bar_revenue ? '$'+settings.annual_bar_revenue.toLocaleString() : 'Not provided'}
- Annual Food Revenue: ${settings.annual_food_revenue ? '$'+settings.annual_food_revenue.toLocaleString() : 'Not provided'}
- Bar Pour Cost Target: ${settings.targets?.bar_pour_cost_pct || 22}%
- Food Cost Target: ${settings.targets?.food_cost_pct || 32}%
- Prime Cost Target: ${settings.targets?.prime_cost_pct || 60}%
- Recent 4-week avg bar pour cost: ${avgBarCost ? avgBarCost.toFixed(1)+'%' : 'Not available'}
- Recent 4-week avg food cost: ${avgFoodCost ? avgFoodCost.toFixed(1)+'%' : 'Not available'}
- Recent 4-week avg bar revenue: ${avgBarRev ? '$'+Math.round(avgBarRev) : 'Not available'}
- Recent 4-week avg food revenue: ${avgFoodRev ? '$'+Math.round(avgFoodRev) : 'Not available'}
- Bar products set up: ${products.length}
- Kitchen products set up: ${kitchen.length}
- Recipes costed: ${recipes.length}
- Weeks of data: ${weeks.length}
- Shift check entries: ${shifts.length}
- Cash reconciliation entries: ${recons.length}
- Vendor price changes logged: ${vendor.length}
- Latest theft risk score: ${theft.length ? theft[theft.length-1]?.total : 'Not scored'}
- Weekly variance data: ${weeks.filter(w => w.bar_variance?.length > 0).length} weeks with variance

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

Fill every field with real values extracted from the documents or calculated from app data. Use industry benchmarks where data is missing. Make the narrative fields (EVIDENCE, GAP, TOOL) specific and actionable based on the actual data submitted.`;
}

function getExtractionPrompt_Revenue(appData) {
  const settings    = appData.settings || {};
  const revSettings = appData.revenue_settings || {};
  const targets     = revSettings.targets || {};
  const weeks       = appData.revenue_weeks || [];
  const servers     = revSettings.servers || [];
  const menuItems   = appData.revenue_menu_items || [];
  const serverChecks = appData.revenue_server_checks || [];

  // Calculate averages from app data
  const recentWeeks = weeks.slice(-4);
  const avgCheckAvg   = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.check_avg||0),0)/recentWeeks.length : null;
  const avgLaborPct   = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.labor_pct_blended||0),0)/recentWeeks.length : null;
  const avgRPLH       = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.rplh_blended||0),0)/recentWeeks.length : null;
  const avgCovers     = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.covers||0),0)/recentWeeks.length : null;
  const avgBarRev     = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.bar_revenue||0),0)/recentWeeks.length : null;
  const avgFloorRev   = recentWeeks.length ? recentWeeks.reduce((s,w)=>s+(w.floor_revenue||0),0)/recentWeeks.length : null;

  return `You are generating a Bar Cop Revenue Audit. Analyze all submitted documents AND the app data provided below. Extract the exact variables needed to generate a professional scored PDF audit report.

APP DATA (from customer's app usage):
- Bar Name: ${settings.bar_name || 'Not provided'}
- City/State: ${settings.city_state || 'Not provided'}
- Annual Bar Revenue: ${settings.annual_bar_revenue ? '$'+settings.annual_bar_revenue.toLocaleString() : 'Not provided'}
- Annual Food Revenue: ${settings.annual_food_revenue ? '$'+settings.annual_food_revenue.toLocaleString() : 'Not provided'}
- Check Average Target: $${targets.check_avg || 35}
- Bar Labor Target: ${targets.bar_labor_pct || 28}%
- Kitchen Labor Target: ${targets.kitchen_labor_pct || 30}%
- Floor Labor Target: ${targets.floor_labor_pct || 32}%
- Lunch RPLH Target: $${targets.rplh_lunch || 50}
- Dinner RPLH Target: $${targets.rplh_dinner || 75}
- Bar RPLH Target: $${targets.rplh_bar || 65}
- Event Close Rate Target: ${targets.event_close_rate || 40}%
- Servers on roster: ${servers.length}
- Menu items set up: ${menuItems.length}
- Weeks of revenue data: ${weeks.length}
- Server check entries: ${serverChecks.length}
- Recent 4-week avg check average: ${avgCheckAvg ? '$'+avgCheckAvg.toFixed(2) : 'Not available'}
- Recent 4-week avg labor %: ${avgLaborPct ? avgLaborPct.toFixed(1)+'%' : 'Not available'}
- Recent 4-week avg RPLH: ${avgRPLH ? '$'+avgRPLH.toFixed(2) : 'Not available'}
- Recent 4-week avg weekly covers: ${avgCovers ? Math.round(avgCovers) : 'Not available'}
- Recent 4-week avg bar revenue: ${avgBarRev ? '$'+Math.round(avgBarRev) : 'Not available'}
- Recent 4-week avg floor revenue: ${avgFloorRev ? '$'+Math.round(avgFloorRev) : 'Not available'}

Analyze all uploaded documents (POS revenue reports, labor schedules, server sales reports, menu sales mix, event records) and extract ALL of the following variables. Use uploaded file data where available, use app data to fill gaps, use industry benchmarks for anything not determinable.

SCORING GUIDE:
- S1 Menu Engineering and Pricing: max 100 pts. 25pts beverage%, 20pts category mix, 20pts price review, 20pts high-margin items, 15pts item data quality.
- S2 Labor Cost and Scheduling: max 100 pts. 25pts labor%, 20pts forecast-to-actual, 25pts RPLH, 15pts dept breakdown, 15pts timeclock.
- S3 Check Average and Upselling: max 100 pts. 25pts check avg vs target, 25pts server spread, 15pts servers above avg, 20pts app attach, 15pts dessert attach.
- S4 Events and Private Dining: N/A if no event data submitted.
- S5 Server Performance Management: max 100 pts. 20pts report submitted, 25pts spread width, 15pts majority above avg, 20pts coaching process, 20pts pre-shift.
- S6 Revenue Management Intelligence: scored 0-100 based on signals from all submitted data.

Return ONLY a valid JSON object with ALL these exact keys — no markdown, no explanation, just the JSON:

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

  "S1_TIER": 1,
  "S1_TOTAL_REV_PERIOD": 0,
  "S1_BEV_REV_PERIOD": 0,
  "S1_FOOD_REV_PERIOD": 0,
  "S1_BEV_REV_PCT": 0,
  "S1_FOOD_REV_PCT": 0,
  "S1_BEV_TARGET_PCT": 60,
  "S1_FOOD_TARGET_PCT": 40,
  "S1_CHECK_AVG_BLENDED": ${avgCheckAvg || 0},
  "S1_COVERS_PERIOD": 0,
  "S1_COVERS_MONTHLY": ${avgCovers ? Math.round(avgCovers * 4.33) : 0},
  "S1_ITEM_DATA_SUBMITTED": false,
  "S1_PRICE_LIST_SUBMITTED": false,
  "S1_CATEGORY_MIX_NOTE": "From submitted data",
  "S1_REVENUE_CONCENTRATION": "From submitted data",
  "S1_PTS_BEV_PCT": 0,
  "S1_PTS_CATEGORY_MIX": 0,
  "S1_PTS_PRICE_REVIEW": 0,
  "S1_PTS_HIGH_MARGIN": 0,
  "S1_PTS_ITEM_DATA": 0,
  "S1_SCORE": 0,
  "S1_MONTHLY_GAP": 0,
  "S1_ANNUAL_GAP": 0,
  "S1_BEV_OVER_TARGET": 0,
  "S1_CHECK_AVG_TARGET": ${targets.check_avg || 42},
  "S1_CHECK_AVG_GAP": 0,

  "S2_TIER": 1,
  "S2_TOTAL_REV_PERIOD": 0,
  "S2_LABOR_PERIOD": 0,
  "S2_LABOR_PCT": ${avgLaborPct || 0},
  "S2_LABOR_TARGET_LOW": ${targets.bar_labor_pct || 28},
  "S2_LABOR_TARGET_HIGH": ${targets.floor_labor_pct || 32},
  "S2_LABOR_GAP_PTS": 0,
  "S2_LABOR_GAP_MONTHLY": 0,
  "S2_LABOR_SOURCE": "From submitted data",
  "S2_AVG_HOURLY_WAGE": ${revSettings.avg_hourly_wage?.bar || 0},
  "S2_HOURS_SCHEDULED": 0,
  "S2_RPLH": ${avgRPLH || 0},
  "S2_RPLH_TARGET": ${targets.rplh_dinner || 65},
  "S2_RPLH_GAP": 0,
  "S2_SCHEDULE_SUBMITTED": false,
  "S2_DEPT_BREAKDOWN": false,
  "S2_TIMECLOCK_SUBMITTED": false,
  "S2_WEEKLY_VARIANCE_NOTE": "From submitted data",
  "S2_MONTHLY_GAP": 0,
  "S2_ANNUAL_GAP": 0,
  "S2_PTS_LABOR_PCT": 0,
  "S2_PTS_FORECAST": 0,
  "S2_PTS_RPLH": 0,
  "S2_PTS_DEPT": 0,
  "S2_PTS_TIMECLOCK": 0,
  "S2_SCORE": 0,

  "S3_TIER": 1,
  "S3_TOTAL_REV_PERIOD": 0,
  "S3_COVERS_PERIOD": 0,
  "S3_COVERS_MONTHLY": 0,
  "S3_CHECK_AVG_BLENDED": ${avgCheckAvg || 0},
  "S3_CHECK_AVG_TARGET": ${targets.check_avg || 42},
  "S3_CHECK_AVG_GAP": 0,
  "S3_NUM_SERVERS": ${servers.length || 0},
  "S3_SERVER_LABELS": [],
  "S3_SERVER_CHECK_AVGS": [],
  "S3_SERVER_COVERS": [],
  "S3_TOP_SERVER_LABEL": "Server A",
  "S3_TOP_CHECK_AVG": 0,
  "S3_BOTTOM_SERVER_LABEL": "Server Z",
  "S3_BOTTOM_CHECK_AVG": 0,
  "S3_HOUSE_AVG": ${avgCheckAvg || 0},
  "S3_SPREAD": 0,
  "S3_SPREAD_TARGET": 10,
  "S3_SERVERS_ABOVE": 0,
  "S3_SERVERS_AT_AVG": 0,
  "S3_SERVERS_BELOW": 0,
  "S3_APP_ATTACH_RATE": null,
  "S3_DESSERT_ATTACH_RATE": null,
  "S3_UPSELL_STANDARD_EXISTS": false,
  "S3_MONTHLY_GAP": 0,
  "S3_ANNUAL_GAP": 0,
  "S3_PTS_CHECK_AVG": 0,
  "S3_PTS_SPREAD": 0,
  "S3_PTS_SERVERS_ABOVE": 0,
  "S3_PTS_APP_ATTACH": 0,
  "S3_PTS_DESSERT_ATTACH": 0,
  "S3_SCORE": 0,

  "S4_TIER": 0,
  "S4_EVENT_COUNT_PERIOD": null,
  "S4_AVG_EVENT_REVENUE": null,
  "S4_TOTAL_EVENT_REVENUE": null,
  "S4_EVENT_REV_PCT_OF_TOTAL": null,
  "S4_MINIMUM_COMPLIANCE_RATE": null,
  "S4_EVENTS_PER_MONTH_BENCHMARK": "6-8",
  "S4_INDUSTRY_EVENT_REV_PCT_LOW": 10,
  "S4_INDUSTRY_EVENT_REV_PCT_HIGH": 20,
  "S4_ANNUAL_REV_ESTIMATE": ${(settings.annual_bar_revenue || 0) + (settings.annual_food_revenue || 0) || (avgBarRev && avgFloorRev ? Math.round((avgBarRev + avgFloorRev) * 52) : 0)},
  "S4_EVENT_REV_POTENTIAL_LOW": 0,
  "S4_EVENT_REV_POTENTIAL_HIGH": 0,
  "S4_SCORE": null,

  "S5_TIER": 1,
  "S5_SERVER_REPORT_SUBMITTED": false,
  "S5_NUM_SERVERS": ${servers.length || 0},
  "S5_SERVER_LABELS": [],
  "S5_SERVER_CHECK_AVGS": [],
  "S5_SERVER_COVERS": [],
  "S5_TOP_SERVER_LABEL": "Server A",
  "S5_TOP_CHECK_AVG": 0,
  "S5_BOTTOM_SERVER_LABEL": "Server Z",
  "S5_BOTTOM_CHECK_AVG": 0,
  "S5_HOUSE_AVG": ${avgCheckAvg || 0},
  "S5_SPREAD": 0,
  "S5_SPREAD_TARGET": 10,
  "S5_SERVERS_ABOVE": 0,
  "S5_SERVERS_AT_OR_NEAR": 0,
  "S5_SERVERS_BELOW": 0,
  "S5_COACHING_PROCESS_EVIDENT": false,
  "S5_PRESHIFT_CONSISTENT": false,
  "S5_DAYPART_DATA_SUBMITTED": false,
  "S5_GAP_BOTTOM_TO_AVG": 0,
  "S5_MONTHLY_GAP": 0,
  "S5_ANNUAL_GAP": 0,
  "S5_PTS_REPORT_SUBMITTED": 0,
  "S5_PTS_SPREAD": 0,
  "S5_PTS_MAJORITY_ABOVE": 0,
  "S5_PTS_COACHING": 0,
  "S5_PTS_PRESHIFT": 0,
  "S5_SCORE": 0,

  "S6_SCORE": 50
}

Fill every field with real values extracted from the documents or calculated from app data. Use industry benchmarks where data is missing. For S3 and S5 server arrays, extract actual server names and check averages from the Server Sales Report if submitted. Make all gap calculations specific dollar amounts based on actual covers and revenue data.`;
}

function getExtractionPrompt_Traffic(appData) {
  const settings = appData.settings || {};
  return `You are generating a Bar Cop Traffic Audit. Analyze all submitted screenshots, documents, and questionnaire answers to extract variables for a scored PDF audit report.

Bar: ${settings.bar_name || 'Customer'}, ${settings.city_state || ''}

Return ONLY valid JSON with these exact keys populated from submitted materials:
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
  "INDUSTRY_AVG": 58,
  "TARGET_SCORE": 65,
  "OVERALL_SCORE": 0,
  "SECTIONS_WITH_DATA": 0,
  "SECTIONS_PARTIAL": 0,
  "SECTIONS_NA": 0,
  "SECTION_DATA": [],
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
  "S3_PTS_YELP": 0, "S3_PTS_RECENCY": 0, "S3_SCORE": 0,
  "S3_UNANSWERED": 0,
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

// ── Add module — upgrades Stripe subscription + updates Supabase ──────────────
app.post('/api/add-module', async (req, res) => {
  const { userId, module } = req.body;
  if (!userId || !module) return res.status(400).json({ error: 'Missing userId or module' });

  const PRICE_BY_SLOTS = {
    1: 'price_1TY9KKGow04S066UBHLhPLNK',
    2: 'price_1TY9KgGow04S066Urrd6TwGP',
    3: 'price_1TY9L4Gow04S066UnAxs4K8Q',
  };
  const PLAN_BY_SLOTS = { 1: 'tier_1', 2: 'tier_2', 3: 'tier_3' };

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('active_modules, stripe_customer_id, subscription_plan')
      .eq('user_id', userId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Subscription not found' });

    const current = data.active_modules || [];
    if (current.includes(module)) return res.json({ ok: true, message: 'Already active' });

    const updated = [...current, module];
    const newSlots = updated.length;
    const newPriceId = PRICE_BY_SLOTS[newSlots];

    // Upgrade Stripe subscription if customer exists
    if (data.stripe_customer_id && newPriceId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: data.stripe_customer_id,
        status: 'active',
        limit: 1,
      });
      const sub = subscriptions.data[0];
      if (sub) {
        const item = sub.items.data[0];
        await stripe.subscriptions.update(sub.id, {
          items: [{ id: item.id, price: newPriceId }],
          proration_behavior: 'always_invoice',
        });
      }
    }

    // Update Supabase
    const { error: updateErr } = await supabaseAdmin
      .from('subscriptions')
      .update({
        active_modules: updated,
        subscription_plan: PLAN_BY_SLOTS[newSlots] || data.subscription_plan,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateErr) throw updateErr;
    res.json({ ok: true });
  } catch (e) {
    console.error('add-module error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Stripe checkout session ───────────────────────────────────────────────────
app.post('/api/create-checkout-session', async (req, res) => {
  const { priceId, userId, modules } = req.body;
  if (!priceId || !userId) return res.status(400).json({ error: 'Missing priceId or userId' });

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://app.barcop.com/?checkout=success',
      cancel_url:  'https://app.barcop.com/?checkout=cancelled',
      metadata: {
        user_id:  userId,
        price_id: priceId,
        modules:  (modules || []).join(',')
      }
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
// Must use express.raw() — Stripe signature verification requires the raw body
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseAdmin = createClient(
  'https://plpikfpintruksclkwyb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

const MODULE_SLOTS = {
  'price_1TY9KKGow04S066UBHLhPLNK': 1,  // legacy 1-module tier
  'price_1TY9KgGow04S066Urrd6TwGP': 2,  // 2-module tier (in-app upgrade)
  'price_1TY9L4Gow04S066UnAxs4K8Q': 3,  // 3-module tier (in-app upgrade)
  'price_1TYCjBGow04S066UcsAPBGQj': 1,  // Profit Recovery
  'price_1TYCjYGow04S066Uce9qofNi': 1,  // Revenue Recovery
  'price_1TYCjnGow04S066UXTK6d9C6': 1,  // Traffic Recovery
};

// Maps individual module price IDs to their module name
const PRICE_TO_MODULE = {
  'price_1TYCjBGow04S066UcsAPBGQj': 'profit',
  'price_1TYCjYGow04S066Uce9qofNi': 'revenue',
  'price_1TYCjnGow04S066UXTK6d9C6': 'traffic',
};

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

      // Resolve price ID from line items (Payment Links don't put it in metadata)
      const lineItems  = await require('stripe')(process.env.STRIPE_SECRET_KEY)
        .checkout.sessions.listLineItems(session.id, { limit: 5 });
      const priceId    = lineItems.data?.[0]?.price?.id || session.metadata?.price_id;

      // Determine which module this purchase is for
      const moduleFromPrice = PRICE_TO_MODULE[priceId] || null;
      const modulesFromMeta = (session.metadata?.modules || '').split(',').filter(Boolean);
      const newModule  = moduleFromPrice || modulesFromMeta[0] || 'profit';

      const slots = MODULE_SLOTS[priceId] || 1;

      // Create or find Supabase user
      let userId = session.metadata?.user_id || null;
      let existingModules = [];

      if (!userId && email) {
        const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
        const found = existing?.users?.find(u => u.email === email);
        if (found) {
          userId = found.id;
          // Get their existing modules so we don't overwrite them
          const { data: subData } = await supabaseAdmin
            .from('subscriptions')
            .select('active_modules')
            .eq('user_id', found.id)
            .single();
          existingModules = subData?.active_modules || [];
        } else {
          // Brand new subscriber — create account silently
          // Customer uses Forgot Password on the login screen to set their password
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
        // Merge new module with any existing modules
        const mergedModules = existingModules.includes(newModule)
          ? existingModules
          : [...existingModules, newModule];
        const totalSlots = mergedModules.length;
        const plan = totalSlots === 1 ? 'tier_1' : totalSlots === 2 ? 'tier_2' : 'tier_3';

        await supabaseAdmin.from('subscriptions').upsert({
          user_id:             userId,
          stripe_customer_id:  customerId,
          subscription_status: 'active',
          subscription_plan:   plan,
          active_modules:      mergedModules,
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

app.listen(PORT, () => {
  console.log('\n  Bar Cop Fix System\n  http://localhost:' + PORT + '\n');
});

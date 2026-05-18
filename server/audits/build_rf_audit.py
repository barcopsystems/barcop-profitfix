"""
BAR COP REVENUE FIX AUDIT - Build File
Cover page only - checkpoint 1
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak
)
from reportlab.platypus.flowables import Flowable
import math

import os
OUT = os.environ.get("AUDIT_OUT_PATH", "/tmp/BarCop_Revenue_Audit_EXAMPLE.pdf")

# ── COLORS ───────────────────────────────────────────────────────────────────
NAVY       = colors.HexColor("#0D1B2A")
STEEL      = colors.HexColor("#4888A8")
GOLD       = colors.HexColor("#C9A84C")
SAGE       = colors.HexColor("#4A7C6F")
SALMON     = colors.HexColor("#C03828")
AMBER      = colors.HexColor("#D08008")
WHITE      = colors.HexColor("#FFFFFF")
OFF_WHITE  = colors.HexColor("#F7F6F2")
LIGHT_GRAY = colors.HexColor("#E8E6E0")
MID_GRAY   = colors.HexColor("#8A9BB0")
DARK_TEXT  = colors.HexColor("#1A1A1A")
DEEP_NAVY  = colors.HexColor("#060E18")

PAGE_W, PAGE_H = letter
MARGIN    = 0.65 * inch
CONTENT_W = PAGE_W - 2 * MARGIN

FONT_BOLD   = "Helvetica-Bold"
FONT_REG    = "Helvetica"
FONT_ITALIC = "Helvetica-Oblique"
DOC_NAME    = "Revenue Audit"

# ── SAMPLE DATA (replaced per customer) ──────────────────────────────────────
OVERALL_SCORE   = 54
BAR_NAME        = "Rosewood Social"
BAR_CITY_STATE  = "Nashville, TN"
REVENUE_TIER    = "$750K\u2013$1M Annual Revenue"
AUDIT_DATE      = "May 2026"
AUDIT_ID        = "RFA-2026-0041"
AUDIT_PERIOD    = "4 weeks ending April 25, 2026"
DATA_TIER_LABEL = "Tier 2 Analysis \u2014 Standard Data Submitted"
WEEKLY_GAP_AMT  = "$4,620"
GAP_SOURCES     = "Labor cost. Check average. Menu mix. All recoverable."
INDUSTRY_AVG    = 61
TARGET_SCORE    = 65

# Score band helper — identical to Profit Fix Audit
def score_band(score):
    if score >= 80: return ("STRONG SYSTEMS",                  SAGE)
    if score >= 60: return ("SYSTEMS PRESENT, GAPS IDENTIFIED", AMBER)
    if score >= 40: return ("SIGNIFICANT GAPS",                 SALMON)
    return              ("CRITICAL",                            SALMON)


# ── HELPERS ───────────────────────────────────────────────────────────────────
class HRule(Flowable):
    def __init__(self, width, color=LIGHT_GRAY, thickness=0.5):
        super().__init__()
        self.width = width
        self._color = color
        self.thickness = thickness
        self.height = thickness
    def draw(self):
        c = self.canv
        c.saveState()
        c.setStrokeColor(self._color)
        c.setLineWidth(self.thickness)
        c.line(0, 0, self.width, 0)
        c.restoreState()

def sp(n):
    return Spacer(1, n)


# ── DRAW COVER ────────────────────────────────────────────────────────────────
def draw_cover(c, doc):
    w, h = letter
    score        = OVERALL_SCORE
    band_label, band_color = score_band(score)

    # ── BACKGROUND ──────────────────────────────────────────────────────────
    c.setFillColor(DEEP_NAVY)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # ── LOGO top left ────────────────────────────────────────────────────────
    logo_path = os.environ.get("AUDIT_LOGO_PATH", "/app/server/audits/logo.png")
    logo_h = 28
    logo_w = logo_h * (1844 / 316)
    c.drawImage(logo_path, MARGIN, h - 60,
                width=logo_w, height=logo_h,
                preserveAspectRatio=True, mask="auto")

    # ── AUDIT REPORT badge top right ─────────────────────────────────────────
    badge_w, badge_h = 88, 26
    bx = w - MARGIN - badge_w
    by = h - 60 + (28 - badge_h) / 2
    c.setFillColor(GOLD)
    c.roundRect(bx, by, badge_w, badge_h, 4, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 8)
    c.drawCentredString(bx + badge_w / 2, by + 9.5, "AUDIT REPORT")

    # ── THIN RULE below header ───────────────────────────────────────────────
    c.setStrokeColor(colors.HexColor("#1E3A52"))
    c.setLineWidth(0.5)
    c.line(0, h - 82, w, h - 82)

    # ── PRIMARY TITLE ────────────────────────────────────────────────────────
    # "REVENUE AUDIT" WHITE 64pt single line
    title_y = h - 188
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 64)
    c.drawString(MARGIN, title_y, "REVENUE AUDIT")

    # ── DESCRIPTION LINE ─────────────────────────────────────────────────────
    desc_y = h - 218
    c.setFillColor(colors.HexColor("#8AABB8"))
    c.setFont(FONT_REG, 11)
    c.drawString(MARGIN, desc_y,
        "A scored analysis of your operation\u2019s revenue capture, "
        "pricing discipline, and server performance.")

    # ── COMPANY BLOCK ─────────────────────────────────────────────────────────
    company_top = desc_y - 44

    # "PREPARED FOR" micro label
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN, company_top, "PREPARED FOR")

    # Bar name, large and prominent, WHITE bold
    name_y = company_top - 28
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 28)
    c.drawString(MARGIN, name_y, BAR_NAME)

    # City/state line, MID_GRAY regular
    addr_y = name_y - 20
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_REG, 10)
    c.drawString(MARGIN, addr_y, BAR_CITY_STATE)

    # Audit period line
    period_y = addr_y - 14
    c.setFont(FONT_REG, 10)
    c.drawString(MARGIN, period_y, f"Audit Period: {AUDIT_PERIOD}")

    sub_y = period_y - 8

    # ── HEALTH SCORE BLOCK ────────────────────────────────────────────────────
    pad = 0
    blk_x = MARGIN
    blk_w = w - 2 * MARGIN

    blk_top = sub_y - 24

    # "OPERATIONAL PERFORMANCE SCORE" micro label
    lbl_y = blk_top
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_BOLD, 8)
    c.drawString(blk_x, lbl_y, "OPERATIONAL PERFORMANCE SCORE")

    # Score number + "/ 100" on same line
    score_y = lbl_y - 52
    c.setFillColor(SALMON)
    c.setFont(FONT_BOLD, 60)
    score_str = str(score)
    score_num_w = c.stringWidth(score_str, FONT_BOLD, 60)
    c.drawString(blk_x, score_y, score_str)
    c.setFillColor(colors.HexColor("#8AABB8"))
    c.setFont(FONT_REG, 22)
    c.drawString(blk_x + score_num_w + 8, score_y + 8, "/ 100")

    # Progress bar
    bar_h      = 10
    bar_r      = bar_h / 2
    bar_y      = score_y - 22
    bar_w_full = blk_w * 0.48
    bar_x      = blk_x
    fill_pct   = score / 100.0
    fill_w     = bar_w_full * fill_pct
    ind_x      = bar_x + bar_w_full * (INDUSTRY_AVG / 100.0)

    # Track (dark steel)
    c.setFillColor(colors.HexColor("#1E3A52"))
    c.roundRect(bar_x, bar_y, bar_w_full, bar_h, bar_r, fill=1, stroke=0)

    # SALMON fill
    c.setFillColor(SALMON)
    if fill_w >= bar_h:
        c.roundRect(bar_x, bar_y, fill_w, bar_h, bar_r, fill=1, stroke=0)
        if fill_w > bar_h:
            c.rect(bar_x + bar_r, bar_y, fill_w - bar_r, bar_h, fill=1, stroke=0)

    # STEEL fill from fill point to industry avg marker
    if ind_x > bar_x + fill_w:
        c.setFillColor(STEEL)
        gap_x = bar_x + fill_w
        gap_w = ind_x - gap_x
        if gap_w > 2:
            c.rect(gap_x, bar_y, gap_w, bar_h, fill=1, stroke=0)

    # Industry avg tick mark
    c.setStrokeColor(WHITE)
    c.setLineWidth(1.5)
    c.line(ind_x, bar_y - 3, ind_x, bar_y + bar_h + 3)

    # Inline text to the right of the bar
    bar_text_x = bar_x + bar_w_full + 14
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_REG, 8)
    avg_str    = f"Industry avg: {INDUSTRY_AVG}"
    target_str = f"Your target: {TARGET_SCORE}+"
    c.drawString(bar_text_x, bar_y + 2, f"{avg_str}   |   {target_str}")

    # Bold red impact sentence
    impact_y = bar_y - 22
    c.setFillColor(SALMON)
    c.setFont(FONT_BOLD, 10.5)
    c.drawString(blk_x, impact_y,
        f"This operation is leaving an estimated {WEEKLY_GAP_AMT} per week on the table.")

    # Gap sources line
    sources_y = impact_y - 16
    c.setFillColor(colors.HexColor("#8AABB8"))
    c.setFont(FONT_REG, 9)
    c.drawString(blk_x, sources_y, GAP_SOURCES)

    # Bottom metadata line
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_ITALIC, 8)
    c.drawString(MARGIN, 88, f"Audit ID: {AUDIT_ID}   \u2022   {AUDIT_DATE}   \u2022   {DATA_TIER_LABEL}")

    # Footer bar
    c.setFillColor(NAVY)
    c.rect(0, 0, w, 42, fill=1, stroke=0)
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_BOLD, 7.5)
    c.drawString(MARGIN, 15, "REVENUE AUDIT  |  BARCOP.COM")
    c.setFillColor(GOLD)
    c.setFont(FONT_BOLD, 7.5)
    c.drawRightString(w - MARGIN, 15, f"Confidential  \u2022  {BAR_NAME}")


def draw_interior(c, doc):
    w, h = letter
    page_num = doc.page
    c.setFillColor(NAVY)
    c.rect(0, h - 38, w, 38, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 11)
    c.drawString(MARGIN, h - 24, "BAR COP")
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_REG, 8)
    c.drawRightString(w - MARGIN, h - 22, DOC_NAME)
    c.setFillColor(NAVY)
    c.rect(0, 0, w, 28, fill=1, stroke=0)
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_REG, 7)
    c.drawString(MARGIN, 10, "BARCOP.COM")
    c.drawRightString(w - MARGIN, 10, f"Page {page_num}")


def on_page(c, doc):
    if doc.page == 1:
        draw_cover(c, doc)
    else:
        draw_interior(c, doc)


# ── STYLE FACTORY ─────────────────────────────────────────────────────────────
def S(name, **kw):
    d = dict(fontName=FONT_REG, fontSize=10, leading=14, textColor=DARK_TEXT,
             spaceAfter=0, spaceBefore=0, leftIndent=0, firstLineIndent=0)
    d.update(kw)
    return ParagraphStyle(name, **d)

STYLES = {
    "section_label":     S("sl",  fontName=FONT_BOLD, fontSize=8, leading=10, textColor=GOLD),
    "section_title":     S("st",  fontName=FONT_BOLD, fontSize=18, leading=22, textColor=NAVY),
    "section_subtitle":  S("ss2", fontSize=9, leading=13, textColor=colors.HexColor("#555555")),
    "body":              S("bo",  fontSize=10, leading=15, textColor=DARK_TEXT),
    "body_small":        S("bs",  fontSize=9,  leading=13, textColor=DARK_TEXT),
    "table_header":      S("th",  fontName=FONT_BOLD, fontSize=8, leading=10,
                            textColor=WHITE, alignment=TA_CENTER),
    "table_header_left": S("thl", fontName=FONT_BOLD, fontSize=8, leading=10,
                            textColor=WHITE, alignment=TA_LEFT),
    "table_cell":        S("tc",  fontSize=8.5, leading=12, textColor=DARK_TEXT, alignment=TA_CENTER),
    "table_cell_left":   S("tcl", fontSize=8.5, leading=12, textColor=DARK_TEXT, alignment=TA_LEFT),
    "table_cell_bold":   S("tcb", fontName=FONT_BOLD, fontSize=8.5, leading=12,
                            textColor=DARK_TEXT, alignment=TA_LEFT),
}


# ── HELPERS ───────────────────────────────────────────────────────────────────

def section_header(label, title, subtitle=None):
    items = [sp(6), Paragraph(label.upper(), STYLES["section_label"]), sp(3),
             Paragraph(title, STYLES["section_title"])]
    if subtitle:
        items += [sp(2), Paragraph(subtitle, STYLES["section_subtitle"])]
    items += [sp(8), HRule(CONTENT_W, GOLD, 1.5), sp(8)]
    return items

def body(text):
    return Paragraph(text, STYLES["body"])

def callout_box(title, body_text, bg=STEEL):
    tp = Paragraph(title, ParagraphStyle("ct_rfa", fontName=FONT_BOLD, fontSize=10.5,
        leading=14, textColor=WHITE, leftIndent=0, firstLineIndent=0))
    bp = Paragraph(body_text, ParagraphStyle("cb_rfa", fontSize=9.5, leading=14,
        textColor=WHITE, leftIndent=0, firstLineIndent=0))
    inner = Table([[tp], [sp(4)], [bp]], colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),2),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return outer

def sub_header(text):
    items = [Paragraph(text, ParagraphStyle("sh_rfa", fontName=FONT_BOLD, fontSize=11,
        leading=14, textColor=NAVY, leftIndent=0, firstLineIndent=0)),
        sp(2), HRule(CONTENT_W, colors.HexColor("#E8E6E0"), 0.5), sp(10)]
    return items

def std_table(headers, rows, col_widths):
    hdr = [Paragraph(h, STYLES["table_header_left"] if i == 0 else STYLES["table_header"])
           for i, h in enumerate(headers)]
    data = [hdr] + rows
    style = [("BACKGROUND",(0,0),(-1,0),NAVY),
        ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#E8E6E0")),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE")]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND",(0,i),(-1,i),colors.HexColor("#F7F6F2")))
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle(style))
    return t

def phase_hdr(label, color):
    p = Paragraph(label, ParagraphStyle(f"ph_{label[:8]}", fontName=FONT_BOLD, fontSize=9,
        leading=12, textColor=WHITE, leftIndent=0, firstLineIndent=0))
    t = Table([[p]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),color),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),12),("RIGHTPADDING",(0,0),(-1,-1),12)]))
    return t

def formula_box(lines):
    items = []
    first = True
    for line in lines:
        if not line.strip():
            items.append(sp(4)); continue
        if first:
            items.append(Paragraph(line, ParagraphStyle("fbt_rfa", fontName=FONT_BOLD,
                fontSize=9, leading=13, textColor=GOLD, leftIndent=0, firstLineIndent=0)))
            first = False
        else:
            items.append(Paragraph(line, ParagraphStyle("fbl_rfa", fontName=FONT_REG,
                fontSize=8.5, leading=13, textColor=WHITE, leftIndent=0, firstLineIndent=0)))
        items.append(sp(1))
    inner = Table([[i] for i in items], colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),1),("BOTTOMPADDING",(0,0),(-1,-1),1),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return outer

def score_tile_large(score_val, label="OVERALL REVENUE HEALTH SCORE"):
    """Big NAVY tile: score and /100 inline centered Paragraph."""
    gold_hex = "#C9A84C"
    gray_hex = "#8A9BB0"
    lbl_p = Paragraph(label, ParagraphStyle("stl_lbl", fontName=FONT_BOLD,
        fontSize=8, leading=11, textColor=GOLD, alignment=TA_CENTER,
        leftIndent=0, firstLineIndent=0))
    band_label, band_color = score_band(score_val)
    score_p = Paragraph(
        f'<font name="{FONT_BOLD}" size="48" color="{gold_hex}">{score_val}</font>'
        f'<font name="{FONT_REG}" size="20" color="{gray_hex}"> / 100</font>',
        ParagraphStyle("stl_score", leading=56, alignment=TA_CENTER,
        leftIndent=0, firstLineIndent=0))
    band_p = Paragraph(band_label, ParagraphStyle("stl_band", fontName=FONT_BOLD,
        fontSize=9, leading=13, textColor=band_color, alignment=TA_CENTER,
        leftIndent=0, firstLineIndent=0))
    inner = Table([[lbl_p],[sp(6)],[score_p],[sp(8)],[band_p]],
        colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),18),("BOTTOMPADDING",(0,0),(-1,-1),18),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return outer

def priority_action_box(rank, area, desc, monthly, annual, time_to, tool):
    """SALMON priority action callout box."""
    rank_p = Paragraph(f"PRIORITY {rank}",
        ParagraphStyle(f"pa_rank{rank}", fontName=FONT_BOLD, fontSize=7,
        leading=9, textColor=colors.HexColor("#F5C8C0"),
        leftIndent=0, firstLineIndent=0))
    area_p = Paragraph(area,
        ParagraphStyle(f"pa_area{rank}", fontName=FONT_BOLD, fontSize=11,
        leading=14, textColor=WHITE, leftIndent=0, firstLineIndent=0))
    desc_p = Paragraph(desc,
        ParagraphStyle(f"pa_desc{rank}", fontSize=9.5, leading=14,
        textColor=WHITE, leftIndent=0, firstLineIndent=0))
    def metric(label, val):
        return Paragraph(f'<font color="#F5C8C0"><b>{label}</b></font>  {val}',
            ParagraphStyle(f"pa_met{rank}{label[:3]}", fontSize=8.5, leading=13,
            textColor=WHITE, leftIndent=0, firstLineIndent=0))
    m1 = metric("Monthly:", monthly)
    m2 = metric("Annual:", annual)
    m3 = metric("Time:", time_to)
    m4 = metric("Action:", tool)
    cw2 = [(CONTENT_W - 32) / 2, (CONTENT_W - 32) / 2]
    metrics = Table([[m1, m2],[m3, m4]], colWidths=cw2)
    metrics.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),2),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),8),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    inner = Table([[rank_p],[sp(3)],[area_p],[sp(5)],[desc_p],[sp(10)],[metrics]],
        colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),SALMON),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return outer


# ── REMAINING HELPERS ─────────────────────────────────────────────────────────

def action_item(priority, title, area, data_desc, instruction, tool, time_str, monthly, annual):
    """Standard action item block used in all sections."""
    priority_colors = {"HIGH": SALMON, "MEDIUM": AMBER, "LOW": SAGE}
    bg = priority_colors.get(priority.upper(), STEEL)
    badge_p = Paragraph(priority.upper(),
        ParagraphStyle(f"ai_badge_{title[:8]}", fontName=FONT_BOLD, fontSize=7,
        leading=9, textColor=WHITE, alignment=TA_CENTER,
        leftIndent=0, firstLineIndent=0))
    badge_t = Table([[badge_p]], colWidths=[52])
    badge_t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),bg),
        ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),
    ]))
    def lbl(t): return Paragraph(t, ParagraphStyle(f"ai_lbl_{t[:6]}",
        fontName=FONT_BOLD, fontSize=7.5, leading=10, textColor=GOLD,
        leftIndent=0, firstLineIndent=0))
    def val(t): return Paragraph(t, ParagraphStyle(f"ai_val_{t[:6]}",
        fontSize=9, leading=13, textColor=DARK_TEXT, leftIndent=0, firstLineIndent=0))
    cw_inner = CONTENT_W - 32
    items = [
        Table([[badge_t, Paragraph("", ParagraphStyle("ai_sp"))]], colWidths=[56, cw_inner-56]),
        sp(6),
        Paragraph(f"ACTION: <b>{title}</b>", ParagraphStyle(f"ai_title_{title[:8]}",
            fontName=FONT_BOLD, fontSize=11, leading=14, textColor=NAVY,
            leftIndent=0, firstLineIndent=0)),
        Paragraph(area, ParagraphStyle(f"ai_area_{area[:8]}",
            fontSize=8, leading=11, textColor=colors.HexColor("#777777"),
            leftIndent=0, firstLineIndent=0)),
        sp(10), lbl("WHAT THE DATA SHOWS"), sp(3), val(data_desc),
        sp(8), lbl("WHAT TO DO"), sp(3), val(instruction), sp(8),
    ]
    def metric_cell(label, value):
        return Paragraph(f'<b>{label}</b>  {value}',
            ParagraphStyle(f"ai_mc_{label[:4]}", fontSize=8.5, leading=13,
            textColor=DARK_TEXT, leftIndent=0, firstLineIndent=0))
    cw_met = [(cw_inner) / 4] * 4
    met_row = Table([[
        metric_cell("Action:", tool),
        metric_cell("Time:", time_str),
        metric_cell("Monthly:", monthly),
        metric_cell("Annual:", annual),
    ]], colWidths=cw_met)
    met_row.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#F7F6F2")),
        ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#E8E6E0")),
    ]))
    items.append(met_row)
    inner = Table([[i] for i in items], colWidths=[cw_inner])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),WHITE),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16),
        ("BOX",(0,0),(-1,-1),1,colors.HexColor("#E8E6E0")),
        ("LINEBEFORE",(0,0),(0,-1),4,bg),
    ]))
    return outer


def tier_placeholder(section_name, required_data, unlocks, teaser):
    """STEEL placeholder block for N/A sections."""
    lbl_p = Paragraph("SECTION REQUIRES ADDITIONAL DATA",
        ParagraphStyle("tp_lbl", fontName=FONT_BOLD, fontSize=7, leading=9,
        textColor=colors.HexColor("#C8D8E8"), leftIndent=0, firstLineIndent=0))
    req_p = Paragraph(f"<b>Required data:</b> {required_data}",
        ParagraphStyle("tp_req", fontSize=9, leading=14, textColor=WHITE,
        leftIndent=0, firstLineIndent=0))
    unl_p = Paragraph(f"<b>What submitting unlocks:</b> {unlocks}",
        ParagraphStyle("tp_unl", fontSize=9, leading=14, textColor=WHITE,
        leftIndent=0, firstLineIndent=0))
    tea_p = Paragraph(f"<b>What this section would show:</b> {teaser}",
        ParagraphStyle("tp_tea", fontSize=9, leading=14,
        textColor=colors.HexColor("#C8D8E8"), leftIndent=0, firstLineIndent=0))
    inner = Table([[lbl_p],[sp(6)],[req_p],[sp(4)],[unl_p],[sp(4)],[tea_p]],
        colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),STEEL),
        ("TOPPADDING",(0,0),(-1,-1),16),("BOTTOMPADDING",(0,0),(-1,-1),16),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return outer


def na_score_tile(section_num, section_name):
    """N/A score tile for sections with no data submitted."""
    lbl_p = Paragraph(f"SECTION {section_num}: {section_name.upper()}",
        ParagraphStyle("na_lbl", fontName=FONT_BOLD, fontSize=7.5, leading=10,
        textColor=MID_GRAY, alignment=TA_LEFT, leftIndent=0, firstLineIndent=0))
    score_p = Paragraph("N/A",
        ParagraphStyle("na_score", fontName=FONT_BOLD, fontSize=36, leading=42,
        textColor=MID_GRAY, alignment=TA_LEFT, leftIndent=0, firstLineIndent=0))
    sub_p = Paragraph("DATA NOT SUBMITTED",
        ParagraphStyle("na_sub", fontName=FONT_BOLD, fontSize=8, leading=11,
        textColor=MID_GRAY, alignment=TA_LEFT, leftIndent=0, firstLineIndent=0))
    inner = Table([[lbl_p],[sp(4)],[score_p],[sp(2)],[sub_p]], colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#1E2D3D")),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return outer


def section_score_tile(section_num, section_name, score_val, note=None):
    """Scored tile: score and /100 inline centered Paragraph."""
    band_label, band_color = score_band(score_val)
    gray_hex = "#8A9BB0"
    from reportlab.lib.colors import HexColor
    bc_hex = band_color.hexval() if hasattr(band_color, "hexval") else "#C03828"
    lbl_p = Paragraph(f"SECTION {section_num}: {section_name.upper()}",
        ParagraphStyle(f"ss_lbl_{section_num}", fontName=FONT_BOLD, fontSize=7.5,
        leading=10, textColor=MID_GRAY, alignment=TA_CENTER,
        leftIndent=0, firstLineIndent=0))
    score_p = Paragraph(
        f'<font name="{FONT_BOLD}" size="42" color="{bc_hex}">{score_val}</font>'
        f'<font name="{FONT_REG}" size="18" color="{gray_hex}"> / 100</font>',
        ParagraphStyle(f"ss_score_{section_num}", leading=50, alignment=TA_CENTER,
        leftIndent=0, firstLineIndent=0))
    band_p = Paragraph(band_label,
        ParagraphStyle(f"ss_band_{section_num}", fontName=FONT_BOLD, fontSize=8,
        leading=11, textColor=band_color, alignment=TA_CENTER,
        leftIndent=0, firstLineIndent=0))
    rows = [[lbl_p],[sp(4)],[score_p],[sp(5)],[band_p]]
    if note:
        rows += [[sp(4)], [Paragraph(note, ParagraphStyle(f"ss_note_{section_num}",
            fontName=FONT_ITALIC, fontSize=7.5, leading=11, textColor=MID_GRAY,
            alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))]]
    inner = Table(rows, colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return outer


def amber_note(text):
    """AMBER note block for partial data warnings."""
    p = Paragraph(text, ParagraphStyle("amber_note", fontSize=9, leading=14,
        textColor=colors.HexColor("#1A1A1A"), leftIndent=0, firstLineIndent=0))
    lbl = Paragraph("NOTE", ParagraphStyle("amber_lbl", fontName=FONT_BOLD, fontSize=7,
        leading=9, textColor=colors.HexColor("#7A4800"), leftIndent=0, firstLineIndent=0))
    inner = Table([[lbl],[sp(4)],[p]], colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#FFF3CD")),
        ("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16),
        ("LINEBEFORE",(0,0),(0,-1),4,AMBER)]))
    return outer


# ── SECTION 1 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S1_TIER                  = 2

S1_TOTAL_REV_PERIOD      = 65_385
S1_BEV_REV_PERIOD        = 42_500       # 65%
S1_FOOD_REV_PERIOD       = 22_885       # 35%
S1_BEV_REV_PCT           = 65.0
S1_FOOD_REV_PCT          = 35.0
S1_BEV_TARGET_PCT        = 60.0
S1_FOOD_TARGET_PCT       = 40.0
S1_CHECK_AVG_BLENDED     = 38.00
S1_COVERS_PERIOD         = 1_721        # $65,385 / $38
S1_COVERS_MONTHLY        = 1_860
S1_ITEM_DATA_SUBMITTED   = False
S1_PRICE_LIST_SUBMITTED  = False
S1_CATEGORY_MIX_NOTE     = "Beverage-dominant, within benchmark range"
S1_REVENUE_CONCENTRATION = "Spirits estimated at 38% of total revenue"

# Score elements
S1_PTS_BEV_PCT      = 25    # 65% >= 60% target: full 25
S1_PTS_CATEGORY_MIX = 10    # category-level only, partial 10/20
S1_PTS_PRICE_REVIEW = 0     # no price list: 0/20
S1_PTS_HIGH_MARGIN  = 0     # no item data: 0/20
S1_PTS_ITEM_DATA    = 7     # category submitted, item-level absent: 7/15
S1_SCORE            = (S1_PTS_BEV_PCT + S1_PTS_CATEGORY_MIX + S1_PTS_PRICE_REVIEW
                       + S1_PTS_HIGH_MARGIN + S1_PTS_ITEM_DATA)  # 42

S1_MONTHLY_GAP      = 1_840
S1_ANNUAL_GAP       = 22_080

# Derived
S1_BEV_OVER_TARGET  = round(S1_BEV_REV_PCT - S1_BEV_TARGET_PCT, 1)  # +5 pts above
S1_CHECK_AVG_TARGET = 42.00
S1_CHECK_AVG_GAP    = round(S1_CHECK_AVG_TARGET - S1_CHECK_AVG_BLENDED, 2)  # -$4.00


# ── SECTION 1: MENU ENGINEERING AND PRICING ──────────────────────────────────

def page_section1():
    s = [PageBreak()]
    tier = S1_TIER

    s += section_header(
        "SECTION 1",
        "Menu Engineering and Pricing",
        "Whether the menu is priced and positioned to capture the revenue "
        "the operation is capable of generating."
    )

    # ── TIER 0: No POS data at all ────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(1, "Menu Engineering and Pricing"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Menu Engineering and Pricing",
            "POS Sales Report: daily or weekly sales totals by category "
            "(food, beverage, total) for the audit period.",
            "Category revenue split, beverage-to-food ratio vs. industry benchmark, "
            "blended check average, and revenue concentration by category.",
            "With your POS daily summary, this section would show your food and beverage "
            "revenue split compared against the full-service benchmark, calculate your "
            "blended check average from total revenue and cover count, "
            "and identify whether your category mix is generating the revenue "
            "your operation is capable of producing."
        ))
        return s

    # ── TIER 1: POS daily summary only, no sales mix report ──────────────────
    if tier == 1:
        s.append(section_score_tile(1, "Menu Engineering and Pricing", 32,
            note="Partial score, category split only, max 35 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "A category sales mix report was not submitted with this audit. "
            "The analysis below uses POS daily totals only and can calculate "
            "your food and beverage revenue split and blended check average. "
            "Item-level and category-concentration analysis requires a sales mix report. "
            "Submit a category or item-level sales mix from your POS for the audit period "
            "to unlock the full Section 1 analysis."
        ))
        s.append(sp(16))
        s += sub_header("Revenue Split from POS Data")
        s.append(body(
            "The following metrics are calculated from POS daily totals. "
            "All figures are from the submitted audit period only."
        ))
        s.append(sp(12))
        t1_rows = [
            [Paragraph("Total revenue (period)", STYLES["table_cell_left"]),
             Paragraph(f"${S1_TOTAL_REV_PERIOD:,.0f}", STYLES["table_cell"]),
             Paragraph("From POS daily summary", STYLES["table_cell_left"])],
            [Paragraph("Beverage revenue", STYLES["table_cell_left"]),
             Paragraph(f"${S1_BEV_REV_PERIOD:,.0f}", STYLES["table_cell"]),
             Paragraph(f"{S1_BEV_REV_PCT}% of total", STYLES["table_cell_left"])],
            [Paragraph("Food revenue", STYLES["table_cell_left"]),
             Paragraph(f"${S1_FOOD_REV_PERIOD:,.0f}", STYLES["table_cell"]),
             Paragraph(f"{S1_FOOD_REV_PCT}% of total", STYLES["table_cell_left"])],
            [Paragraph("Blended check average", STYLES["table_cell_left"]),
             Paragraph(f"${S1_CHECK_AVG_BLENDED:.2f}", STYLES["table_cell"]),
             Paragraph(f"Target: ${S1_CHECK_AVG_TARGET:.0f}+", STYLES["table_cell_left"])],
        ]
        cw_t1 = [CONTENT_W*0.36, CONTENT_W*0.22, CONTENT_W*0.42]
        s.append(std_table(["Metric", "Value", "Notes"], t1_rows, cw_t1))
        return s

    # ── TIER 2+: Full analysis ────────────────────────────────────────────────
    s.append(section_score_tile(1, "Menu Engineering and Pricing", S1_SCORE))
    s.append(sp(20))

    # 1.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("POS Sales Report: Daily Totals", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S1_TOTAL_REV_PERIOD:,.0f}", STYLES["table_cell"])],
        [Paragraph("Category Sales Mix Report", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph("Category-level (no item detail)", STYLES["table_cell"])],
        [Paragraph("Item-Level Sales Mix", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
        [Paragraph("Vendor Price List", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.38, CONTENT_W*0.36, CONTENT_W*0.26]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 1.2 Category Revenue Split
    _h_crs = sub_header("Category Revenue Split")
    _f_crs = formula_box([
        "CATEGORY REVENUE SPLIT, EXPLICIT CALCULATION",
        "",
        f"  Total revenue (4-week period):  ${S1_TOTAL_REV_PERIOD:,.0f}",
        "",
        f"  Beverage revenue:  ${S1_BEV_REV_PERIOD:,.0f}  "
        f"({S1_BEV_REV_PCT}% of total)",
        f"  Full-service benchmark:         60%+ beverage",
        f"  Status:                         {S1_BEV_REV_PCT}% is "
        f"{S1_BEV_OVER_TARGET} pts above the 60% benchmark, within range",
        "",
        f"  Food revenue:      ${S1_FOOD_REV_PERIOD:,.0f}  "
        f"({S1_FOOD_REV_PCT}% of total)",
        f"  Full-service benchmark:         Under 40% food",
        f"  Status:                         {S1_FOOD_REV_PCT}% is within range",
        "",
        f"  Blended check average:  ${S1_TOTAL_REV_PERIOD:,.0f} / "
        f"{S1_COVERS_PERIOD:,} covers = ${S1_CHECK_AVG_BLENDED:.2f}",
        f"  Check average target:           ${S1_CHECK_AVG_TARGET:.0f}+",
        f"  Check average gap:              ${S1_CHECK_AVG_GAP:.2f} below target",
    ])
    s += _h_crs
    s.append(_f_crs)
    s.append(sp(20))

    # 1.3 Category Mix Assessment
    s += sub_header("Category Mix Assessment")

    def status_cell(label):
        color = SAGE if label == "ON TARGET" else (SALMON if label == "CRITICAL" else AMBER)
        return Paragraph(label, ParagraphStyle(f"s1_sc_{label[:4]}", fontName=FONT_BOLD,
            fontSize=8, leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    mix_rows = [
        [Paragraph("Beverage revenue %", STYLES["table_cell_left"]),
         Paragraph(f"{S1_BEV_REV_PCT}%", STYLES["table_cell"]),
         Paragraph("60%+ for full-service", STYLES["table_cell"]),
         status_cell("ON TARGET"),
         Paragraph("5 pts above benchmark. Beverage mix is healthy.",
             STYLES["table_cell_left"])],
        [Paragraph("Food revenue %", STYLES["table_cell_left"]),
         Paragraph(f"{S1_FOOD_REV_PCT}%", STYLES["table_cell"]),
         Paragraph("Under 40%", STYLES["table_cell"]),
         status_cell("ON TARGET"),
         Paragraph("Within range. Food does not dominate the mix.",
             STYLES["table_cell_left"])],
        [Paragraph("Blended check average", STYLES["table_cell_left"]),
         Paragraph(f"${S1_CHECK_AVG_BLENDED:.2f}", STYLES["table_cell"]),
         Paragraph(f"${S1_CHECK_AVG_TARGET:.0f}+", STYLES["table_cell"]),
         status_cell("ATTENTION"),
         Paragraph(f"${S1_CHECK_AVG_GAP:.2f} below target. "
                   "Captures only category data, not item performance.",
                   STYLES["table_cell_left"])],
        [Paragraph("Item-level data", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell"]),
         Paragraph("Item-level detail", STYLES["table_cell"]),
         status_cell("ATTENTION"),
         Paragraph("Cannot identify which items drive or drag revenue "
                   "without item-level data.",
                   STYLES["table_cell_left"])],
        [Paragraph("Price list on file", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell"]),
         Paragraph("Current price list", STYLES["table_cell"]),
         status_cell("ATTENTION"),
         Paragraph("Pricing gap vs. competitive set cannot be assessed.",
                   STYLES["table_cell_left"])],
    ]
    cw_mix = [CONTENT_W*0.22, CONTENT_W*0.12, CONTENT_W*0.16,
              CONTENT_W*0.14, CONTENT_W*0.36]
    s.append(std_table(
        ["Metric", "Your Bar", "Benchmark", "Status", "Notes"],
        mix_rows, cw_mix))
    s.append(sp(20))

    # 1.4 Check Average Analysis
    s += sub_header("Check Average Analysis")
    s.append(body(
        f"Blended check average of ${S1_CHECK_AVG_BLENDED:.2f} is "
        f"${S1_CHECK_AVG_GAP:.2f} below the ${S1_CHECK_AVG_TARGET:.0f} benchmark "
        "for full-service operations at this revenue tier. "
        f"At {S1_COVERS_PERIOD:,} covers over the audit period, "
        f"a ${S1_CHECK_AVG_GAP:.2f} gap represents "
        f"${round(S1_CHECK_AVG_GAP * S1_COVERS_PERIOD):,.0f} in revenue "
        "left on the table during this period alone. "
        "Category-level data confirms the food and beverage split is healthy. "
        "What it cannot show is which specific items are selling at what price point, "
        "whether high-margin items are positioned prominently, "
        "or whether any items are being consistently underordered. "
        "Those answers require item-level data."
    ))
    s.append(sp(14))
    avg_rows = [
        [Paragraph("Total revenue (period)", STYLES["table_cell_left"]),
         Paragraph(f"${S1_TOTAL_REV_PERIOD:,.0f}",
             ParagraphStyle("cav1", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=DARK_TEXT, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("From POS report", STYLES["table_cell_left"])],
        [Paragraph("Covers (period)", STYLES["table_cell_left"]),
         Paragraph(f"{S1_COVERS_PERIOD:,}",
             ParagraphStyle("cav2", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=DARK_TEXT, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("Total revenue / check average", STYLES["table_cell_left"])],
        [Paragraph("Blended check average", STYLES["table_cell_left"]),
         Paragraph(f"${S1_CHECK_AVG_BLENDED:.2f}",
             ParagraphStyle("cav3", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"Target: ${S1_CHECK_AVG_TARGET:.0f}+", STYLES["table_cell_left"])],
        [Paragraph("Gap to target", STYLES["table_cell_left"]),
         Paragraph(f"-${S1_CHECK_AVG_GAP:.2f}/cover",
             ParagraphStyle("cav4", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"${round(S1_CHECK_AVG_GAP * S1_COVERS_PERIOD):,.0f} per period at "
                   f"{S1_COVERS_PERIOD:,} covers", STYLES["table_cell_left"])],
    ]
    cw_avg = [CONTENT_W*0.36, CONTENT_W*0.24, CONTENT_W*0.40]
    s.append(std_table(["Metric", "Value", "Notes"], avg_rows, cw_avg))
    s.append(sp(12))
    s.append(amber_note(
        "Submitting an item-level sales mix report with your next audit unlocks "
        "item-level revenue ranking, identification of your top 10 revenue items, "
        "and a full menu engineering matrix classifying each item as a Star, "
        "Plowhorse, Puzzle, or Dog based on sales frequency and margin contribution. "
        "Category data confirms the mix is right. "
        "Item data identifies which specific items are generating revenue "
        "and which are occupying menu space without earning it."
    ))
    s.append(sp(20))

    # 1.5 Score Calculation
    _h_sc = sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Beverage revenue at or above 60%", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_BEV_PCT), STYLES["table_cell"]),
         Paragraph(f"{S1_BEV_REV_PCT}% exceeds the 60% benchmark. Full 25 pts.",
             STYLES["table_cell_left"])],
        [Paragraph("Category sales mix reviewed and balanced", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_CATEGORY_MIX), STYLES["table_cell"]),
         Paragraph("Category-level only, no item detail. Partial credit 10/20.",
             STYLES["table_cell_left"])],
        [Paragraph("Price review within last 12 months", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_PRICE_REVIEW), STYLES["table_cell"]),
         Paragraph("No price list submitted. Cannot confirm. 0/20.",
             STYLES["table_cell_left"])],
        [Paragraph("High-margin items in top 5 sellers", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_HIGH_MARGIN), STYLES["table_cell"]),
         Paragraph("Item-level data not submitted. Cannot assess. 0/20.",
             STYLES["table_cell_left"])],
        [Paragraph("Item-level data submitted", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_ITEM_DATA), STYLES["table_cell"]),
         Paragraph("Category submitted, item-level absent. Partial 7/15.",
             STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S1_SCORE}</b>",
             ParagraphStyle("s1_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S1_SCORE}/100, ATTENTION</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.36, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.42]
    _f_sc = std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2)
    s += _h_sc
    s.append(_f_sc)
    s.append(sp(20))

    # 1.6 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"Rosewood Social's category mix is healthy. "
        f"Beverage at {S1_BEV_REV_PCT}% of revenue is 5 points above the 60% full-service "
        "benchmark, which confirms the operation is not over-reliant on food to carry the revenue. "
        f"The problem is the check average. "
        f"At ${S1_CHECK_AVG_BLENDED:.2f} blended against a ${S1_CHECK_AVG_TARGET:.0f} target, "
        f"every cover is generating ${S1_CHECK_AVG_GAP:.2f} less than the benchmark. "
        f"Across {S1_COVERS_MONTHLY:,} covers per month, that is "
        f"${round(S1_CHECK_AVG_GAP * S1_COVERS_MONTHLY):,.0f} per month in revenue "
        "that is already sitting in the dining room and not being captured."
    ))
    s.append(sp(12))
    s.append(body(
        "The category split is as much information as the submitted data can provide. "
        "Whether the check average gap is driven by pricing, by menu positioning, "
        "by server upsell failure, or by a specific category dragging the average down "
        "cannot be answered from category totals alone. "
        "Item-level sales data answers that question directly. "
        "Without it, the gap is visible but its cause is not. "
        "The action items below address what can be corrected right now "
        "without waiting for additional data."
    ))
    s.append(sp(20))

    # 1.7 Action Items
    _h_ai = sub_header("Action Items")
    _f_ai = action_item(
        priority="HIGH",
        title="Review Every Menu Price Against Current Cost and Competitive Set",
        area="Menu Engineering and Pricing",
        data_desc=(
            f"Blended check average of ${S1_CHECK_AVG_BLENDED:.2f} is "
            f"${S1_CHECK_AVG_GAP:.2f} below the ${S1_CHECK_AVG_TARGET:.0f} full-service target. "
            "No price list was submitted so pricing cannot be verified against cost of goods. "
            "The last documented price review date is unknown."
        ),
        instruction=(
            "Pull your current menu. "
            "For every item, calculate the cost of ingredients at current invoice prices. "
            "Divide cost by menu price. "
            "Any item where cost exceeds 32% of the menu price warrants a price increase, "
            "a recipe adjustment, or a removal. "
            "Do this for your top 20 revenue items first, then work through the full menu. "
            "Target: no item above 32% food cost, no spirit cocktail above 22% beverage cost."
        ),
        tool="Pull your cost calculation from your most recent invoices.",
        time_str="2 weeks",
        monthly=f"${S1_MONTHLY_GAP:,.0f}",
        annual=f"${S1_ANNUAL_GAP:,.0f}",
    )
    s.append(PageBreak())
    s += _h_ai
    s.append(_f_ai)
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Submit Item-Level Sales Mix With Your Next Audit",
        area="Menu Engineering and Pricing",
        data_desc=(
            "Category data confirms the food and beverage split is within benchmark. "
            "It cannot identify which specific items are performing or underperforming. "
            f"The ${S1_CHECK_AVG_GAP:.2f} check average gap has no item-level cause "
            "identified yet because item data was not submitted."
        ),
        instruction=(
            "Run a sales mix or menu mix report from your POS system "
            "covering the next audit period. "
            "The report should show each item sold, the number of times it was ordered, "
            "and the revenue it generated. "
            "Most POS systems produce this as a standard report under a name like "
            "Sales by Item, Menu Mix, or Item Summary. "
            "Submit it alongside your daily summary for the next audit. "
            "This single report unlocks the full Tier 3 menu engineering analysis."
        ),
        tool="Pull the Sales by Item or Menu Mix report from your POS system.",
        time_str="Next audit cycle",
        monthly=f"${round(S1_MONTHLY_GAP * 0.5):,.0f} additional gap visibility",
        annual=f"${round(S1_ANNUAL_GAP * 0.5):,.0f} addressable once items identified",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Identify and Position the Three Highest-Margin Items on Every Menu Page",
        area="Menu Engineering and Pricing",
        data_desc=(
            "Item-level margin data is not available from the submitted data. "
            "However, category mix confirms beverage dominance at 65% of revenue. "
            "Operators at this revenue level consistently leave margin on the table "
            "by positioning high-cost low-margin items prominently "
            "while high-margin items are buried in the menu."
        ),
        instruction=(
            "Without waiting for item-level data, do this from memory this week: "
            "identify the three items in each category where you know the margin is strongest. "
            "These are typically mid-tier spirits, house cocktails, and wine-by-the-glass. "
            "Confirm they appear in a visually prominent position on the current menu. "
            "If they are buried or absent from server verbal recommendations, "
            "that is a contributing factor to the check average gap."
        ),
        tool="Review your current menu layout for margin item placement.",
        time_str="1 week",
        monthly=f"${round(S1_MONTHLY_GAP * 0.25):,.0f}",
        annual=f"${round(S1_ANNUAL_GAP * 0.25):,.0f}",
    ))

    return s


# ── SECTION 2 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S2_TIER                  = 2

S2_TOTAL_REV_PERIOD      = 65_385
S2_LABOR_PERIOD          = 22_231
S2_LABOR_PCT             = 34.0
S2_LABOR_TARGET_LOW      = 28.0
S2_LABOR_TARGET_HIGH     = 32.0
S2_LABOR_GAP_PTS         = 2.0
S2_LABOR_GAP_MONTHLY     = 3_060
S2_LABOR_SOURCE          = "Operator-reported, not verified from payroll"
S2_AVG_HOURLY_WAGE       = 21.33
S2_HOURS_SCHEDULED       = 1_042
S2_RPLH                  = 62.75
S2_RPLH_TARGET           = 65.00
S2_RPLH_GAP              = -2.25
S2_SCHEDULE_SUBMITTED    = True
S2_DEPT_BREAKDOWN        = False
S2_TIMECLOCK_SUBMITTED   = False
S2_WEEKLY_VARIANCE_NOTE  = "Less than 5% week-to-week, no forecast adjustment detected"
S2_MONTHLY_GAP           = 3_060
S2_ANNUAL_GAP            = 36_720

S2_PTS_LABOR_PCT         = 15
S2_PTS_FORECAST          = 0
S2_PTS_RPLH              = 13
S2_PTS_DEPT              = 0
S2_PTS_TIMECLOCK         = 0
S2_SCORE                 = 38


# ── SECTION 2: LABOR COST AND SCHEDULING ─────────────────────────────────────

def page_section2():
    s = [PageBreak()]
    tier = S2_TIER

    s += section_header(
        "SECTION 2",
        "Labor Cost and Scheduling",
        "Whether labor is scheduled from a revenue forecast, "
        "whether RPLH is being tracked, and whether the largest "
        "controllable cost in the operation is being actively managed."
    )

    # ── TIER 0 ────────────────────────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(2, "Labor Cost and Scheduling"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Labor Cost and Scheduling",
            "Labor Schedule with scheduled hours and estimated cost by department "
            "for the audit period, plus POS Sales Report for revenue baseline.",
            "Labor cost as a percentage of revenue, revenue per labor hour (RPLH), "
            "and week-to-week consistency analysis showing whether the schedule "
            "is responding to revenue changes or running on autopilot.",
            "With your labor schedule and POS data, this section would calculate your "
            "exact labor percentage against the 28-32% full-service target, "
            "identify how much above-target labor is costing per month in real dollars, "
            "and show whether your RPLH is above or below the $65 benchmark."
        ))
        return s

    # ── TIER 1: POS only, no schedule ────────────────────────────────────────
    if tier == 1:
        s.append(section_score_tile(2, "Labor Cost and Scheduling", 12,
            note="Partial score, revenue baseline only, max 20 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "A labor schedule was not submitted with this audit. "
            "Without a schedule, labor cost percentage and RPLH cannot be calculated. "
            "The revenue baseline from POS is available but there is nothing to compare it against. "
            "Submit a labor schedule covering the audit period, "
            "including hours by department and total estimated cost, "
            "to unlock the full Section 2 labor analysis."
        ))
        s.append(sp(16))
        s += sub_header("Revenue Baseline from POS")
        s.append(body(
            "The following revenue figures are available from the submitted POS data. "
            "Labor analysis requires a schedule submission before any cost metrics "
            "can be calculated."
        ))
        s.append(sp(12))
        t1_rows = [
            [Paragraph("Total revenue (period)", STYLES["table_cell_left"]),
             Paragraph(f"${S2_TOTAL_REV_PERIOD:,.0f}", STYLES["table_cell"]),
             Paragraph("Revenue baseline confirmed", STYLES["table_cell_left"])],
            [Paragraph("Labor cost %", STYLES["table_cell_left"]),
             Paragraph("Not calculable", STYLES["table_cell"]),
             Paragraph("Schedule required", STYLES["table_cell_left"])],
            [Paragraph("RPLH", STYLES["table_cell_left"]),
             Paragraph("Not calculable", STYLES["table_cell"]),
             Paragraph("Schedule required", STYLES["table_cell_left"])],
        ]
        cw_t1 = [CONTENT_W*0.34, CONTENT_W*0.26, CONTENT_W*0.40]
        s.append(std_table(["Metric", "Value", "Notes"], t1_rows, cw_t1))
        return s

    # ── TIER 2+: Full analysis ────────────────────────────────────────────────
    s.append(section_score_tile(2, "Labor Cost and Scheduling", S2_SCORE))
    s.append(sp(20))

    # 2.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("POS Sales Report: Daily Totals", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S2_TOTAL_REV_PERIOD:,.0f}", STYLES["table_cell"])],
        [Paragraph("Labor Schedule", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S2_LABOR_PERIOD:,.0f} estimated cost", STYLES["table_cell"])],
        [Paragraph("Labor Source", STYLES["table_cell_left"]),
         Paragraph("Operator-reported", STYLES["table_cell_left"]),
         Paragraph("Not verified from payroll",
             ParagraphStyle("s2_lab_src", fontSize=8.5, leading=12,
             textColor=AMBER, alignment=TA_CENTER,
             leftIndent=0, firstLineIndent=0))],
        [Paragraph("Time Clock Actuals", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.34, CONTENT_W*0.34, CONTENT_W*0.32]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 2.2 Labor Cost Calculation
    _h_lcc = sub_header("Labor Cost Calculation")
    _f_lcc = formula_box([
        "LABOR COST, EXPLICIT CALCULATION",
        "",
        f"  Total revenue (4-week period):   ${S2_TOTAL_REV_PERIOD:,.0f}",
        f"  Total labor cost (period):       ${S2_LABOR_PERIOD:,.0f}  "
        "(operator-reported estimate)",
        "",
        f"  Labor cost %:  ${S2_LABOR_PERIOD:,.0f} / ${S2_TOTAL_REV_PERIOD:,.0f} "
        f"= {S2_LABOR_PCT}%",
        f"  Full-service target range:       {S2_LABOR_TARGET_LOW}% to "
        f"{S2_LABOR_TARGET_HIGH}%",
        f"  Gap above ceiling:               {S2_LABOR_PCT}% - "
        f"{S2_LABOR_TARGET_HIGH}% = {S2_LABOR_GAP_PTS} percentage points",
        "",
        f"  Monthly cost of gap:             {S2_LABOR_GAP_PTS}% x "
        f"${S2_TOTAL_REV_PERIOD:,.0f} = ${S2_LABOR_GAP_MONTHLY:,.0f}/mo",
        f"  Annual cost of gap:              ${S2_LABOR_GAP_MONTHLY:,.0f} x 12 "
        f"= ${S2_ANNUAL_GAP:,.0f}/yr",
        "",
        "  Note: Labor figure is operator-reported. Payroll data was not submitted.",
        "  Submit payroll records to replace this estimate with a verified calculation.",
    ])
    s += _h_lcc
    s.append(_f_lcc)
    s.append(sp(20))

    # 2.3 RPLH Calculation
    _h_rplh = sub_header("Revenue Per Labor Hour (RPLH)")
    _f_rplh = formula_box([
        "RPLH, EXPLICIT CALCULATION",
        "",
        f"  Total revenue (period):          ${S2_TOTAL_REV_PERIOD:,.0f}",
        f"  Estimated hours scheduled:       {S2_HOURS_SCHEDULED:,} hrs",
        f"  (Derived: ${S2_LABOR_PERIOD:,.0f} cost / "
        f"${S2_AVG_HOURLY_WAGE:.2f} avg wage estimate)",
        "",
        f"  RPLH:  ${S2_TOTAL_REV_PERIOD:,.0f} / {S2_HOURS_SCHEDULED:,} hrs "
        f"= ${S2_RPLH:.2f} per hour",
        f"  RPLH target:                     ${S2_RPLH_TARGET:.2f}+",
        f"  RPLH gap:                        ${abs(S2_RPLH_GAP):.2f} below target",
        "",
        f"  Closing the gap to ${S2_RPLH_TARGET:.2f} RPLH adds "
        f"${abs(S2_RPLH_GAP):.2f} per labor hour",
        f"  across {S2_HOURS_SCHEDULED:,} hours = "
        f"${abs(round(S2_RPLH_GAP * S2_HOURS_SCHEDULED)):,} per period.",
    ])
    s += _h_rplh
    s.append(_f_rplh)
    s.append(sp(20))

    # 2.4 Labor Efficiency Assessment
    s += sub_header("Labor Efficiency Assessment")

    def sc(label):
        color = SAGE if label == "ON TARGET" else (SALMON if label == "CRITICAL" else AMBER)
        return Paragraph(label, ParagraphStyle(f"s2sc_{label[:5]}", fontName=FONT_BOLD,
            fontSize=8, leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    eff_rows = [
        [Paragraph("Labor cost % (operator-reported)",
             ParagraphStyle("s2_lab_lbl", fontSize=8.5, leading=12,
             textColor=AMBER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S2_LABOR_PCT}%",
             ParagraphStyle("s2_lv", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S2_LABOR_TARGET_LOW}-{S2_LABOR_TARGET_HIGH}%", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph(f"{S2_LABOR_GAP_PTS} pts above ceiling. "
                   f"${S2_LABOR_GAP_MONTHLY:,.0f}/mo gap. Estimate, not payroll-verified.",
                   STYLES["table_cell_left"])],
        [Paragraph("RPLH", STYLES["table_cell_left"]),
         Paragraph(f"${S2_RPLH:.2f}",
             ParagraphStyle("s2_rv", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"${S2_RPLH_TARGET:.2f}+", STYLES["table_cell"]),
         sc("ATTENTION"),
         Paragraph(f"${abs(S2_RPLH_GAP):.2f} below target. "
                   "Schedule generating slightly less revenue per hour than benchmark.",
                   STYLES["table_cell_left"])],
        [Paragraph("Schedule from revenue forecast", STYLES["table_cell_left"]),
         Paragraph("Not detected", STYLES["table_cell"]),
         Paragraph("Yes, weekly", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph("Flat week-to-week. No adjustment in response to revenue changes.",
                   STYLES["table_cell_left"])],
        [Paragraph("Labor tracked by department", STYLES["table_cell_left"]),
         Paragraph("No, blended", STYLES["table_cell"]),
         Paragraph("Bar, kitchen, floor", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph("Blended total hides which department is driving the overrun.",
                   STYLES["table_cell_left"])],
        [Paragraph("Time clock actuals submitted", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell"]),
         Paragraph("Yes, Tier 3", STYLES["table_cell"]),
         sc("ATTENTION"),
         Paragraph("Clock drift and unauthorized overtime undetectable without actuals.",
                   STYLES["table_cell_left"])],
    ]
    cw_eff = [CONTENT_W*0.24, CONTENT_W*0.12, CONTENT_W*0.14,
              CONTENT_W*0.14, CONTENT_W*0.36]
    s.append(std_table(
        ["Metric", "Your Bar", "Target", "Status", "Notes"],
        eff_rows, cw_eff))
    s.append(sp(12))
    s.append(amber_note(
        f"The labor cost of {S2_LABOR_PCT}% is an operator-reported estimate, "
        "not a figure extracted from payroll records. "
        "Submit payroll and time clock data with your next audit to replace this "
        "estimate with a verified labor percentage. "
        "If actual labor is higher than reported, the gap and score in this section "
        "will change materially."
    ))
    s.append(sp(20))

    # 2.5 SALMON callout
    s.append(callout_box(
        "LABOR IS THE LARGEST CONTROLLABLE COST IN THIS AUDIT",
        f"Labor running at {S2_LABOR_PCT}% of revenue is "
        f"{S2_LABOR_GAP_PTS} percentage points above the "
        f"{S2_LABOR_TARGET_HIGH}% full-service ceiling. "
        f"At ${S2_TOTAL_REV_PERIOD:,.0f} monthly revenue, every 1 point of labor "
        f"above the ceiling costs ${round(S2_TOTAL_REV_PERIOD * 0.01):,.0f} per month. "
        f"Two points above costs ${S2_LABOR_GAP_MONTHLY:,.0f} per month "
        f"and ${S2_ANNUAL_GAP:,.0f} per year. "
        "This is recoverable through revenue-based scheduling alone. "
        "The labor cost is not high because the operation is overstaffed in an absolute sense. "
        "It is high because the schedule is not being built from a revenue projection, "
        "which means slow nights run with the same headcount as busy nights. "
        "That is a scheduling process problem, not a staffing level problem.",
        bg=SALMON
    ))
    s.append(sp(20))

    # 2.6 Score Calculation
    _h_sc = sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Labor % within 28-32% target", STYLES["table_cell_left"]),
         Paragraph("30", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_LABOR_PCT), STYLES["table_cell"]),
         Paragraph(f"{S2_LABOR_PCT}% is {S2_LABOR_GAP_PTS} pts above the "
                   f"{S2_LABOR_TARGET_HIGH}% ceiling. Near range, partial 15/30.",
                   STYLES["table_cell_left"])],
        [Paragraph("Schedule built from revenue forecast", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_FORECAST), STYLES["table_cell"]),
         Paragraph("Flat week-to-week, no forecast adjustment detected. 0/25.",
                   STYLES["table_cell_left"])],
        [Paragraph("RPLH at or above $65", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_RPLH), STYLES["table_cell"]),
         Paragraph(f"${S2_RPLH:.2f} vs ${S2_RPLH_TARGET:.2f} target. "
                   "Close to target, partial 13/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("Labor tracked by department", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_DEPT), STYLES["table_cell"]),
         Paragraph("Blended only. 0/15.", STYLES["table_cell_left"])],
        [Paragraph("Time clock vs. schedule variance", STYLES["table_cell_left"]),
         Paragraph("10", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_TIMECLOCK), STYLES["table_cell"]),
         Paragraph("Not submitted. 0/10.", STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S2_SCORE}</b>",
             ParagraphStyle("s2_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S2_SCORE}/100, CRITICAL</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.34, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.44]
    _f_sc = std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2)
    s += _h_sc
    s.append(_f_sc)
    s.append(sp(20))

    # 2.7 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"Labor at {S2_LABOR_PCT}% of revenue is the single largest dollar gap in this audit. "
        f"At ${S2_TOTAL_REV_PERIOD:,.0f} monthly revenue, two points above the "
        f"{S2_LABOR_TARGET_HIGH}% ceiling costs ${S2_LABOR_GAP_MONTHLY:,.0f} per month. "
        "The underlying cause is visible in the schedule data: "
        "labor runs within a narrow band week-to-week with no detectable adjustment "
        "in response to revenue changes. "
        "That is the signature of a schedule built from habit, "
        "not from a projection of what the coming week will produce. "
        "A schedule built from last week's template runs the same headcount on a "
        "Tuesday that does $8,000 as on a Saturday that does $18,000."
    ))
    s.append(sp(12))
    s.append(body(
        "The fix is a weekly discipline, not a staffing reduction. "
        "Building each schedule from a daily revenue projection for the coming week "
        "and tracking RPLH at the end of each week produces labor percentage "
        "that responds to revenue instead of running independently of it. "
        f"At Rosewood Social's revenue level, closing the RPLH gap from "
        f"${S2_RPLH:.2f} to ${S2_RPLH_TARGET:.2f} and bringing labor within the "
        f"{S2_LABOR_TARGET_HIGH}% ceiling recovers ${S2_LABOR_GAP_MONTHLY:,.0f} per month. "
        "Neither change requires reducing the number of staff or shifts. "
        "Both require changing when and how the schedule is built."
    ))
    s.append(sp(20))

    # 2.8 Action Items
    _h_ai = sub_header("Action Items")
    _f_ai = action_item(
        priority="HIGH",
        title="Build Every Weekly Schedule from a Daily Revenue Projection",
        area="Labor Cost and Scheduling",
        data_desc=(
            f"Labor running at {S2_LABOR_PCT}% with flat week-to-week variance. "
            "No forecast adjustment detected in the submitted schedule. "
            f"At ${S2_TOTAL_REV_PERIOD:,.0f} monthly revenue, every point of unnecessary "
            f"labor above the {S2_LABOR_TARGET_HIGH}% ceiling costs "
            f"${round(S2_TOTAL_REV_PERIOD * 0.01):,.0f} per month."
        ),
        instruction=(
            "Before building each week's schedule, pull the prior two weeks of daily "
            "revenue from your POS by day of week. "
            "Project the coming week by day. "
            "Calculate target labor hours from that projection using your average hourly wage. "
            "Build to the target number, not last week's staffing pattern. "
            "Review actual vs. projected revenue at the end of the week "
            "and adjust the following week's target accordingly."
        ),
        tool="Use your POS daily revenue report and prior-week actuals as the projection baseline.",
        time_str="This week",
        monthly=f"${S2_LABOR_GAP_MONTHLY:,.0f}",
        annual=f"${S2_ANNUAL_GAP:,.0f}",
    )
    s.append(PageBreak())
    s += _h_ai
    s.append(_f_ai)
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Calculate and Post RPLH Every Monday Morning",
        area="Labor Cost and Scheduling",
        data_desc=(
            f"RPLH of ${S2_RPLH:.2f} is ${abs(S2_RPLH_GAP):.2f} below the "
            f"${S2_RPLH_TARGET:.2f} target. "
            "RPLH is not currently being tracked as a weekly management metric. "
            "Without a weekly RPLH number, there is no feedback signal to tell the "
            "manager whether the prior week's schedule was efficient."
        ),
        instruction=(
            "Every Monday morning, divide the prior week's total revenue by "
            "total hours worked. "
            "That is your RPLH for the week. "
            "Write it on a whiteboard or note in the manager area. "
            f"Target: ${S2_RPLH_TARGET:.2f} minimum. "
            "If RPLH is below target, the prior week's schedule ran too heavy "
            "for the revenue it produced. "
            "Use that information when building the current week's schedule."
        ),
        tool="Calculate from POS weekly revenue total divided by scheduled hours.",
        time_str="This Monday",
        monthly=f"${round(S2_TOTAL_REV_PERIOD * 0.008):,.0f}",
        annual=f"${round(S2_TOTAL_REV_PERIOD * 0.010 * 12):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Separate Labor Tracking Into Bar, Kitchen, and Floor",
        area="Labor Cost and Scheduling",
        data_desc=(
            f"Labor tracked as a blended {S2_LABOR_PCT}% total. "
            "A blended labor percentage confirms there is an overrun "
            "but cannot identify which department is driving it. "
            "The overrun could be concentrated in one department "
            "while another runs efficiently, and a blended number hides both."
        ),
        instruction=(
            "Tag every shift to a department in your time clock or scheduling system: "
            "bar, kitchen, and floor. "
            "Record each department's hours and cost separately each week. "
            "Review bar, kitchen, and floor labor percentages individually every Monday. "
            "Target: bar under 12% of bar revenue, "
            "kitchen under 18% of food revenue, "
            "floor under 10% of total revenue."
        ),
        tool="Tag shifts by department in your time clock or scheduling system.",
        time_str="2 weeks",
        monthly=f"${round(S2_LABOR_PERIOD * 0.03):,.0f}",
        annual=f"${round(S2_LABOR_PERIOD * 0.036 * 12):,.0f}",
    ))

    return s


# ── SECTION 3 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S3_TIER                   = 2

S3_TOTAL_REV_PERIOD       = 65_385
S3_COVERS_PERIOD          = 1_721        # $65,385 / $38
S3_COVERS_MONTHLY         = 1_860
S3_CHECK_AVG_BLENDED      = 38.00
S3_CHECK_AVG_TARGET       = 42.00
S3_CHECK_AVG_GAP          = 4.00         # below target
S3_NUM_SERVERS            = 8
S3_SERVER_LABELS          = ["A", "B", "C", "D", "E", "F", "G", "H"]
S3_SERVER_CHECK_AVGS      = [52, 48, 45, 42, 38, 33, 29, 24]
S3_SERVER_COVERS          = [82, 76, 79, 88, 91, 74, 68, 83]  # per period
S3_TOP_SERVER_LABEL       = "Server A"
S3_TOP_CHECK_AVG          = 52
S3_BOTTOM_SERVER_LABEL    = "Server H"
S3_BOTTOM_CHECK_AVG       = 24
S3_HOUSE_AVG              = 38
S3_SPREAD                 = 28
S3_SPREAD_TARGET          = 10
S3_SERVERS_ABOVE          = 3            # A, B, C: 52, 48, 45
S3_SERVERS_AT_AVG         = 1            # D: 42 (within $4)
S3_SERVERS_BELOW          = 4            # E, F, G, H: 38, 33, 29, 24
S3_APP_ATTACH_RATE        = None         # Tier 3 only
S3_DESSERT_ATTACH_RATE    = None         # Tier 3 only
S3_UPSELL_STANDARD_EXISTS = False        # inferred from spread width
S3_MONTHLY_GAP            = 2_890
S3_ANNUAL_GAP             = 34_680

# Score elements
S3_PTS_CHECK_AVG          = 15    # $38 vs $42 target, partial 15/25
S3_PTS_SPREAD             = 0     # $28 spread vs $10 target: 0/25
S3_PTS_SERVERS_ABOVE      = 5     # 3 of 8 above average: partial 5/15
S3_PTS_APP_ATTACH         = 0     # Tier 3 not submitted: 0/20
S3_PTS_DESSERT_ATTACH     = 0     # Tier 3 not submitted: 0/15
S3_SCORE                  = (S3_PTS_CHECK_AVG + S3_PTS_SPREAD + S3_PTS_SERVERS_ABOVE
                             + S3_PTS_APP_ATTACH + S3_PTS_DESSERT_ATTACH)  # 20
S3_SCORE                  = 35    # adjusted with partial credits for spread direction


# ── SECTION 3: UPSELLING AND CHECK AVERAGE ───────────────────────────────────

def page_section3():
    s = [PageBreak()]
    tier = S3_TIER

    s += section_header(
        "SECTION 3",
        "Upselling and Check Average",
        "Whether Rosewood Social is capturing available revenue per cover "
        "through check average discipline, server consistency, and upsell execution."
    )

    # ── TIER 0 ────────────────────────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(3, "Upselling and Check Average"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Upselling and Check Average",
            "POS Sales Report with cover counts, or daily sales total with a "
            "cover count log to calculate blended check average.",
            "Blended check average compared against the $42 full-service benchmark, "
            "monthly dollar cost of the check average gap, "
            "and identification of how much revenue is available per additional dollar "
            "of check average improvement.",
            "With your POS data and cover counts, this section would calculate your "
            "blended check average, show the monthly revenue impact of closing the gap "
            "to the $42 benchmark, and establish a baseline for server performance "
            "comparison once a server sales report is submitted."
        ))
        return s

    # ── TIER 1: POS only, no server report ───────────────────────────────────
    if tier == 1:
        s.append(section_score_tile(3, "Upselling and Check Average", 15,
            note="Partial score, blended check average only, max 25 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "A server sales report was not submitted with this audit. "
            "The check average below is a blended total from POS. "
            "Without server-level data, it is impossible to identify which servers "
            "are above or below the house average, or whether the check average gap "
            "is concentrated in a small number of underperforming servers "
            "or spread evenly across the floor. "
            "Submit a server sales report for the audit period to unlock "
            "the full Section 3 analysis including server performance ranking "
            "and spread analysis."
        ))
        s.append(sp(16))
        s += sub_header("Blended Check Average from POS")
        s.append(body(
            "The following check average is calculated from total POS revenue "
            "and cover count for the audit period. No server-level breakdown is available."
        ))
        s.append(sp(12))
        t1_rows = [
            [Paragraph("Total revenue (period)", STYLES["table_cell_left"]),
             Paragraph(f"${S3_TOTAL_REV_PERIOD:,.0f}", STYLES["table_cell"]),
             Paragraph("From POS report", STYLES["table_cell_left"])],
            [Paragraph("Total covers (period)", STYLES["table_cell_left"]),
             Paragraph(f"{S3_COVERS_PERIOD:,}", STYLES["table_cell"]),
             Paragraph("From cover count log", STYLES["table_cell_left"])],
            [Paragraph("Blended check average", STYLES["table_cell_left"]),
             Paragraph(f"${S3_CHECK_AVG_BLENDED:.2f}",
                 ParagraphStyle("s3t1_avg", fontName=FONT_BOLD, fontSize=9,
                 textColor=SALMON, alignment=TA_CENTER,
                 leftIndent=0, firstLineIndent=0)),
             Paragraph(f"Target: ${S3_CHECK_AVG_TARGET:.0f}+", STYLES["table_cell_left"])],
            [Paragraph("Gap to target", STYLES["table_cell_left"]),
             Paragraph(f"-${S3_CHECK_AVG_GAP:.2f}/cover",
                 ParagraphStyle("s3t1_gap", fontName=FONT_BOLD, fontSize=9,
                 textColor=SALMON, alignment=TA_CENTER,
                 leftIndent=0, firstLineIndent=0)),
             Paragraph(f"${round(S3_CHECK_AVG_GAP * S3_COVERS_PERIOD):,.0f} per period",
                 STYLES["table_cell_left"])],
        ]
        cw_t1 = [CONTENT_W*0.36, CONTENT_W*0.24, CONTENT_W*0.40]
        s.append(std_table(["Metric", "Value", "Notes"], t1_rows, cw_t1))
        return s

    # ── TIER 2+: Full analysis ────────────────────────────────────────────────
    s.append(section_score_tile(3, "Upselling and Check Average", S3_SCORE))
    s.append(sp(20))

    # 3.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("POS Sales Report: Daily Totals", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S3_TOTAL_REV_PERIOD:,.0f}", STYLES["table_cell"])],
        [Paragraph("Server Sales Report", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S3_NUM_SERVERS} servers, check avg by server",
             STYLES["table_cell"])],
        [Paragraph("Upsell Tracking Report", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.38, CONTENT_W*0.34, CONTENT_W*0.28]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 3.2 Check Average Calculation
    _h_cac = sub_header("Check Average Calculation")
    _f_cac = formula_box([
        "CHECK AVERAGE, EXPLICIT CALCULATION",
        "",
        f"  Total revenue (period):    ${S3_TOTAL_REV_PERIOD:,.0f}",
        f"  Total covers (period):     {S3_COVERS_PERIOD:,}",
        "",
        f"  Blended check average:     ${S3_TOTAL_REV_PERIOD:,.0f} / "
        f"{S3_COVERS_PERIOD:,} covers = ${S3_CHECK_AVG_BLENDED:.2f}",
        f"  Full-service target:       ${S3_CHECK_AVG_TARGET:.0f}+",
        f"  Gap below target:          ${S3_CHECK_AVG_GAP:.2f} per cover",
        "",
        f"  Monthly covers (est.):     {S3_COVERS_MONTHLY:,}",
        f"  Monthly revenue gap:       ${S3_CHECK_AVG_GAP:.2f} x "
        f"{S3_COVERS_MONTHLY:,} covers = ${round(S3_CHECK_AVG_GAP * S3_COVERS_MONTHLY):,.0f}/mo",
        f"  Annual revenue gap:        ${round(S3_CHECK_AVG_GAP * S3_COVERS_MONTHLY):,.0f} x 12 "
        f"= ${round(S3_CHECK_AVG_GAP * S3_COVERS_MONTHLY * 12):,.0f}/yr",
        "",
        f"  Every $1.00 of check average improvement at {S3_COVERS_MONTHLY:,} covers/mo "
        f"= ${S3_COVERS_MONTHLY:,}/mo  |  ${S3_COVERS_MONTHLY * 12:,}/yr",
    ])
    s += _h_cac
    s.append(_f_cac)
    s.append(sp(20))

    # 3.3 Server Performance Ranking Table
    _h_srv = sub_header("Server Performance Ranking")
    _f_srv = body(
        f"All {S3_NUM_SERVERS} servers ranked by check average, highest to lowest. "
        f"House average: ${S3_HOUSE_AVG:.0f}. "
        f"Servers are anonymized as A through H."
    )
    s.append(PageBreak())
    s += _h_srv
    s.append(_f_srv)
    s.append(sp(12))

    def status_cell_s3(avg):
        if avg >= S3_HOUSE_AVG + 4:
            label, color = "ABOVE AVG", SAGE
        elif avg >= S3_HOUSE_AVG - 4:
            label, color = "AT AVG", AMBER
        else:
            label, color = "BELOW AVG", SALMON
        return Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s3st_{avg}", fontName=FONT_BOLD, fontSize=7.5,
            leading=10, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    server_rows = []
    for i, (label, avg, covers) in enumerate(
            zip(S3_SERVER_LABELS, S3_SERVER_CHECK_AVGS, S3_SERVER_COVERS)):
        total_sales = avg * covers
        vs_avg = avg - S3_HOUSE_AVG
        vs_str = f"+${vs_avg}" if vs_avg >= 0 else f"-${abs(vs_avg)}"
        vs_color = SAGE if vs_avg > 0 else (AMBER if vs_avg == 0 else SALMON)
        server_rows.append([
            Paragraph(f"Server {label}", STYLES["table_cell_left"]),
            Paragraph(f"${avg:.0f}",
                ParagraphStyle(f"s3avg_{label}", fontName=FONT_BOLD, fontSize=9,
                textColor=(SAGE if avg >= S3_HOUSE_AVG + 4 else
                           (AMBER if avg >= S3_HOUSE_AVG - 4 else SALMON)),
                alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
            Paragraph(f"{covers}", STYLES["table_cell"]),
            Paragraph(f"${total_sales:,.0f}", STYLES["table_cell"]),
            Paragraph(vs_str,
                ParagraphStyle(f"s3vs_{label}", fontName=FONT_BOLD, fontSize=8.5,
                leading=12, textColor=vs_color, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0)),
            status_cell_s3(avg),
        ])

    cw_srv = [CONTENT_W*0.14, CONTENT_W*0.12, CONTENT_W*0.12,
              CONTENT_W*0.16, CONTENT_W*0.16, CONTENT_W*0.30]
    s.append(std_table(
        ["Server", "Check Avg", "Covers", "Total Sales", "vs. House Avg", "Status"],
        server_rows, cw_srv))
    s.append(sp(10))
    s.append(Paragraph(
        f"<i>House average: ${S3_HOUSE_AVG:.0f}. "
        f"Servers within $4 of house average rated AT AVG. "
        f"All figures from submitted server sales report for {AUDIT_PERIOD}.</i>",
        ParagraphStyle("s3_note", fontName=FONT_ITALIC, fontSize=8.5, leading=13,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0)))
    s.append(sp(20))

    # 3.4 Performance Spread Analysis
    _h_psa = sub_header("Performance Spread Analysis")
    _f_psa = formula_box([
        "PERFORMANCE SPREAD, EXPLICIT CALCULATION",
        "",
        f"  Top server check average (Server A):      ${S3_TOP_CHECK_AVG}",
        f"  Bottom server check average (Server H):   ${S3_BOTTOM_CHECK_AVG}",
        f"  Spread:  ${S3_TOP_CHECK_AVG} - ${S3_BOTTOM_CHECK_AVG} "
        f"= ${S3_SPREAD}",
        f"  Industry standard for a managed floor:    Under ${S3_SPREAD_TARGET}",
        "",
        f"  Servers above house average ($38):        "
        f"{S3_SERVERS_ABOVE} of {S3_NUM_SERVERS}",
        f"  Servers at house average (within $4):     "
        f"{S3_SERVERS_AT_AVG} of {S3_NUM_SERVERS}",
        f"  Servers below house average:              "
        f"{S3_SERVERS_BELOW} of {S3_NUM_SERVERS}",
        "",
        f"  If bottom 4 servers moved to house average:",
        f"  ${S3_HOUSE_AVG - S3_BOTTOM_CHECK_AVG} avg improvement x "
        f"{sum(S3_SERVER_COVERS[4:]):,} covers = "
        f"${(S3_HOUSE_AVG - S3_BOTTOM_CHECK_AVG) * sum(S3_SERVER_COVERS[4:]):,.0f} "
        "per period in recoverable revenue.",
    ])
    s += _h_psa
    s.append(_f_psa)
    s.append(sp(20))

    # 3.5 SALMON callout
    s.append(callout_box(
        f"THE ${S3_SPREAD} SPREAD IS NOT A TALENT PROBLEM",
        f"Server A averages ${S3_TOP_CHECK_AVG} per cover. "
        f"Server H averages ${S3_BOTTOM_CHECK_AVG} per cover. "
        f"The ${S3_SPREAD} difference between them is not explained by experience, "
        "section assignment, or shift timing. "
        "It is explained by process. "
        "Server A has a table approach: a way of opening, a moment when they recommend, "
        "specific language they use. "
        f"Servers F, G, and H do not have that approach, or they have a different one. "
        "The top server's process is not a secret. "
        "It has never been documented, trained, or made into a standard. "
        "A $28 spread on a floor of eight servers is not a hiring problem. "
        "It is a training and standards problem, "
        "and it is one of the most straightforward revenue recoveries in this audit.",
        bg=SALMON
    ))
    s.append(sp(20))

    # 3.6 Score Calculation
    _h_sc = sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Blended check avg at or above $42", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_CHECK_AVG), STYLES["table_cell"]),
         Paragraph(f"${S3_CHECK_AVG_BLENDED:.2f} vs ${S3_CHECK_AVG_TARGET:.0f} target. "
                   "${S3_CHECK_AVG_GAP:.2f} below. Partial 15/25.",
                   STYLES["table_cell_left"])],
        [Paragraph("Server spread under $10", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_SPREAD), STYLES["table_cell"]),
         Paragraph(f"${S3_SPREAD} spread vs ${S3_SPREAD_TARGET} target. "
                   "Far above acceptable spread. 0/25.",
                   STYLES["table_cell_left"])],
        [Paragraph("Majority of servers above house avg", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_SERVERS_ABOVE), STYLES["table_cell"]),
         Paragraph(f"{S3_SERVERS_ABOVE} of {S3_NUM_SERVERS} above average. "
                   "Partial 5/15.",
                   STYLES["table_cell_left"])],
        [Paragraph("Appetizer attach rate above 35%", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_APP_ATTACH), STYLES["table_cell"]),
         Paragraph("Upsell tracking not submitted. Tier 3 required. 0/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("Dessert attach rate above 20%", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_DESSERT_ATTACH), STYLES["table_cell"]),
         Paragraph("Upsell tracking not submitted. Tier 3 required. 0/15.",
                   STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S3_SCORE}</b>",
             ParagraphStyle("s3_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S3_SCORE}/100, CRITICAL</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.34, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.44]
    _f_sc = std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2)
    s += _h_sc
    s.append(_f_sc)
    s.append(sp(12))
    s.append(amber_note(
        "Submitting a server upsell tracking report with your next audit unlocks "
        "Tier 3 analysis: appetizer attach rate, dessert attach rate, "
        "and add-on revenue per cover by server. "
        "These three metrics identify exactly where the upsell process is breaking down "
        "for each server, and they replace the spread analysis with actionable "
        "coaching targets for specific individuals."
    ))
    s.append(sp(20))

    # 3.7 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"The check average gap of ${S3_CHECK_AVG_GAP:.2f} per cover is confirmed by two "
        "independent signals from the submitted data. "
        f"First, the blended check average of ${S3_CHECK_AVG_BLENDED:.2f} is "
        f"${S3_CHECK_AVG_GAP:.2f} below the ${S3_CHECK_AVG_TARGET:.0f} full-service benchmark. "
        f"Second, five of eight servers are below the house average, "
        "and the spread between the highest and lowest server is $28, "
        "nearly three times the $10 standard for a managed floor. "
        "These two findings together confirm that the check average gap is not a "
        "pricing or menu issue. "
        "The revenue exists in the dining room. "
        "It is not being captured at the table level."
    ))
    s.append(sp(12))
    s.append(body(
        f"The recovery math is straightforward. "
        f"If the four servers currently below the house average moved their check "
        f"average to the house average of ${S3_HOUSE_AVG:.0f}, "
        f"that closes ${S3_HOUSE_AVG - S3_BOTTOM_CHECK_AVG} of gap across "
        f"{sum(S3_SERVER_COVERS[4:]):,} covers per period. "
        "That does not require hiring different servers. "
        "It requires identifying what the top two servers do differently, "
        "writing it down in one page, "
        "and training the bottom three servers on two specific behaviors, not ten."
    ))
    s.append(sp(20))

    # 3.8 Action Items
    _h_ai = sub_header("Action Items")
    _f_ai = action_item(
        priority="HIGH",
        title="Set and Train a Documented Table Standard for Every Server This Week",
        area="Upselling and Check Average",
        data_desc=(
            f"Server spread of ${S3_SPREAD} confirms no documented table standard exists. "
            f"{S3_SERVERS_BELOW} of {S3_NUM_SERVERS} servers are below the house average. "
            f"Server A averages ${S3_TOP_CHECK_AVG} per cover. "
            f"Server H averages ${S3_BOTTOM_CHECK_AVG}. "
            "The gap is a process gap, not a talent gap."
        ),
        instruction=(
            "This week: talk to your top two servers by check average. "
            "Ask them specifically: how do you open a table, "
            "when do you make your first recommendation, "
            "what words do you use, and what do you recommend most often. "
            "Write down what they say in one page. "
            "That is your table standard. "
            "Print it, go over it with the bottom three servers before their next shift, "
            "and focus on two specific behaviors: "
            "one appetizer recommendation per table before entree orders, "
            "and one beverage upgrade or second-round offer per cover."
        ),
        tool="Document the top server's approach in writing before the next service.",
        time_str="This week",
        monthly=f"${S3_MONTHLY_GAP:,.0f}",
        annual=f"${S3_ANNUAL_GAP:,.0f}",
    )
    s += _h_ai
    s.append(_f_ai)
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Pull Server Check Averages from POS Every Monday and Post the Ranking",
        area="Upselling and Check Average",
        data_desc=(
            f"Five of {S3_NUM_SERVERS} servers below house average. "
            f"Server spread of ${S3_SPREAD} between top and bottom. "
            "Server check averages are being calculated in this audit "
            "from a submitted report. "
            "They are not being reviewed as a weekly management metric."
        ),
        instruction=(
            "Every Monday, run the server sales report from your POS for the prior week. "
            "Rank every server by check average, highest to lowest. "
            "Post the ranking in the manager area or share it in a staff channel. "
            f"Any server more than ${int(S3_SPREAD_TARGET * 0.8)} below the house average "
            "that week gets a 10-minute check-in focused on one specific behavior change "
            "before their next shift. "
            "Not a performance review. One behavior. One shift."
        ),
        tool="Run the server sales or check average report from your POS weekly.",
        time_str="This Monday",
        monthly=f"${round(S3_MONTHLY_GAP * 0.5):,.0f}",
        annual=f"${round(S3_ANNUAL_GAP * 0.6):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Run a 15-Minute Pre-Shift Training on One Upsell Item Each Week",
        area="Upselling and Check Average",
        data_desc=(
            "No evidence of a consistent pre-shift training process in the submitted data. "
            "The $28 spread between top and bottom server is consistent with "
            "a floor that has not had a shared language for recommendations "
            "trained in regularly."
        ),
        instruction=(
            "Before the highest-volume service of the week, "
            "run a 15-minute pre-shift meeting. "
            "Pick one item: a cocktail, a wine-by-the-glass, or a shareable appetizer. "
            "Describe it, taste it if possible, and give every server the exact words "
            "to recommend it. "
            "At the end of that service, check the sales report to see whether that "
            "item appeared on more checks than the prior week. "
            "Do this every week without exception."
        ),
        tool="Use your POS end-of-shift item report to track whether the target item sold.",
        time_str="This week",
        monthly=f"${round(S3_MONTHLY_GAP * 0.2):,.0f}",
        annual=f"${round(S3_ANNUAL_GAP * 0.25):,.0f}",
    ))

    return s


SECTIONS_WITH_DATA = 4
SECTIONS_PARTIAL   = 1
SECTIONS_NA        = 1

SECTION_DATA = [
    # (name,                              score,  status,      gap_monthly)
    ("Menu Engineering and Pricing",      42,     "ATTENTION", "$1,840/mo"),
    ("Labor Cost and Scheduling",         38,     "CRITICAL",  "$3,060/mo"),
    ("Upselling and Check Average",       35,     "CRITICAL",  "$2,890/mo"),
    ("Private Dining and Events",         "N/A",  "N/A",       "Submit event records"),
    ("Server Performance and Standards",  48,     "ATTENTION", "$2,310/mo"),
    ("Implementation Status",            62,     "ATTENTION", "System gaps identified"),
]

TOP_ACTIONS = [
    {
        "rank":    1,
        "area":    "Labor Cost and Scheduling",
        "desc":    "Labor running at 34% of revenue against a 28-32% target. "
                   "At Rosewood Social's revenue level, every point above 32% "
                   "costs $654 per month. "
                   "Schedule is not built from a revenue forecast and RPLH is "
                   "below the $65 target at $62.75.",
        "monthly": "$3,060",
        "annual":  "$36,720",
        "time":    "This week",
        "tool":    "Build every schedule from a daily revenue projection for "
                   "the coming week.",
    },
    {
        "rank":    2,
        "area":    "Upselling and Check Average",
        "desc":    "Blended check average of $38 is $4 below the $42 target. "
                   "Server spread of $28 between top ($52) and bottom ($24) "
                   "server confirms no documented table standard is in place. "
                   "Five of eight servers are below the house average.",
        "monthly": "$2,890",
        "annual":  "$34,680",
        "time":    "This week",
        "tool":    "Set and train a documented table standard for every server. "
                   "Pull check averages from POS every Monday and post the ranking.",
    },
    {
        "rank":    3,
        "area":    "Server Performance and Standards",
        "desc":    "The $28 spread between top and bottom server is not "
                   "normal performance variance. "
                   "It is a coaching and standards gap. "
                   "No evidence of a weekly coaching process from the submitted data.",
        "monthly": "$2,310",
        "annual":  "$27,720",
        "time":    "This week",
        "tool":    "Identify what the top two servers do differently. "
                   "Document it. Train the bottom three servers on it specifically.",
    },
]

ANNUAL_IMPACT_LOW  = "$60,600"
ANNUAL_IMPACT_HIGH = "$103,020"


# ── EXECUTIVE SUMMARY PAGE ────────────────────────────────────────────────────

def page_executive_summary():
    s = []

    s += section_header(
        "EXECUTIVE SUMMARY",
        "Revenue Fix Audit: " + BAR_NAME,
        f"Audit period: {AUDIT_PERIOD}  |  {DATA_TIER_LABEL}"
    )

    # 1. Operator Context block (STEEL)
    ctx_lines = [
        f"<b>Bar:</b> {BAR_NAME}",
        f"<b>Location:</b> {BAR_CITY_STATE}",
        f"<b>Revenue tier:</b> {REVENUE_TIER}",
        f"<b>Audit period:</b> {AUDIT_PERIOD}",
        f"<b>Data submitted:</b> {DATA_TIER_LABEL}",
        f"<b>Sections with full analysis:</b> {SECTIONS_WITH_DATA} of 6  "
        f"  <b>Partial:</b> {SECTIONS_PARTIAL}  "
        f"  <b>N/A (data not submitted):</b> {SECTIONS_NA}",
        f"<b>Audit ID:</b> {AUDIT_ID}",
    ]
    ctx_body = "<br/>".join(ctx_lines)
    lbl_p = Paragraph("OPERATOR CONTEXT",
        ParagraphStyle("ctx_lbl", fontName=FONT_BOLD, fontSize=7, leading=9,
        textColor=colors.HexColor("#C8D8E8"), leftIndent=0, firstLineIndent=0))
    ctx_p = Paragraph(ctx_body,
        ParagraphStyle("ctx_body", fontSize=9, leading=15,
        textColor=WHITE, leftIndent=0, firstLineIndent=0))
    ctx_inner = Table([[lbl_p],[sp(6)],[ctx_p]], colWidths=[CONTENT_W - 32])
    ctx_inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    ctx_outer = Table([[ctx_inner]], colWidths=[CONTENT_W])
    ctx_outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),STEEL),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    s.append(ctx_outer)
    s.append(sp(20))

    # 2. Overall composite score
    s += sub_header("Overall Revenue Health Score")
    s.append(score_tile_large(OVERALL_SCORE))
    s.append(sp(10))
    s.append(Paragraph(
        "<i>Score is a weighted composite of all sections with submitted data. "
        f"Based on {SECTIONS_WITH_DATA} of 6 sections analyzed. "
        "Weights: Menu Engineering 20%, Labor 25%, Upselling 20%, "
        "Events 10%, Server Performance 20%, Implementation 5%.</i>",
        ParagraphStyle("score_note", fontName=FONT_ITALIC, fontSize=8.5, leading=13,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0)))
    s.append(sp(20))

    # 3. Six-area scorecard
    s += sub_header("Six-Area Scorecard")

    score_color_map = {
        "STRONG":    colors.HexColor("#4A7C6F"),
        "ATTENTION": colors.HexColor("#D08008"),
        "CRITICAL":  colors.HexColor("#C03828"),
        "N/A":       colors.HexColor("#8A9BB0"),
    }

    scorecard_rows = []
    for name, score_val, status, gap in SECTION_DATA:
        score_str    = str(score_val) if score_val != "N/A" else "N/A"
        status_color = score_color_map.get(status, colors.HexColor("#8A9BB0"))
        status_p = Paragraph(f"<b>{status}</b>",
            ParagraphStyle(f"sc_badge_{name[:6]}", fontName=FONT_BOLD, fontSize=8,
            leading=11, textColor=status_color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))
        scorecard_rows.append([
            Paragraph(f"<b>{name}</b>", STYLES["table_cell_left"]),
            Paragraph(score_str, ParagraphStyle(f"sc_score_{name[:6]}", fontName=FONT_BOLD,
                fontSize=10, leading=13, textColor=status_color, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0)),
            status_p,
            Paragraph(gap, STYLES["table_cell_left"]),
        ])

    cw_sc = [CONTENT_W*0.35, CONTENT_W*0.11, CONTENT_W*0.18, CONTENT_W*0.36]
    _sc_hdr = [Paragraph(h, STYLES["table_header_left"] if i == 0 else STYLES["table_header"])
               for i, h in enumerate(["Area", "Score", "Status", "Est. Monthly Gap"])]
    _sc_data  = [_sc_hdr] + scorecard_rows
    _sc_style = [("BACKGROUND",(0,0),(-1,0),NAVY),
        ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#E8E6E0")),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE")]
    for _i in range(1, len(_sc_data)):
        if _i % 2 == 0:
            _sc_style.append(("BACKGROUND",(0,_i),(-1,_i),colors.HexColor("#F7F6F2")))
    _sc_tbl = Table(_sc_data, colWidths=cw_sc, repeatRows=1)
    _sc_tbl.setStyle(TableStyle(_sc_style))
    _sc_note = Paragraph(
        "<i>N/A rows require event records. "
        "See Section 4 for exactly what submitting event records unlocks.</i>",
        ParagraphStyle("sc_note", fontName=FONT_ITALIC, fontSize=8, leading=12,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0))
    s.append(_sc_tbl)
    s.append(sp(6))
    s.append(_sc_note)
    s.append(sp(20))

    # 4. Top priority actions
    s += sub_header("Top Priority Actions")
    s.append(body(
        "These are the three highest-dollar gaps identified in this audit, "
        "ranked by estimated monthly revenue impact. "
        "Start with Priority 1 this week."
    ))
    s.append(sp(12))
    for action in TOP_ACTIONS:
        s.append(priority_action_box(
            action["rank"], action["area"], action["desc"],
            action["monthly"], action["annual"],
            action["time"], action["tool"]
        ))
        s.append(sp(10))
    s.append(sp(10))

    # 5. Annual impact summary
    s.append(formula_box([
        f"REVENUE FIX AUDIT: ANNUAL IMPACT SUMMARY, {BAR_NAME}",
        "",
        "  Menu Engineering and Pricing (Section 1):   Est. annual gap: $22,080",
        "  Labor Cost and Scheduling (Section 2):      Est. annual gap: $36,720",
        "  Upselling and Check Average (Section 3):    Est. annual gap: $34,680",
        "  Private Dining and Events (Section 4):      N/A - event records not submitted",
        "  Server Performance and Standards (Section 5): Est. annual gap: $27,720",
        "  Implementation Status (Section 6):          System gaps identified",
        "",
        f"  COMBINED ANNUAL IMPACT RANGE:   {ANNUAL_IMPACT_LOW} to {ANNUAL_IMPACT_HIGH}",
        "",
        f"  Based on {SECTIONS_WITH_DATA} of 6 sections analyzed.",
        "  Submit event records to unlock Section 4 and complete the full impact calculation.",
        "",
        f"  Bar Cop  |  barcop.com  |  Audit ID: {AUDIT_ID}",
    ]))

    return s


# ── SECTION 4 SAMPLE DATA ─────────────────────────────────────────────────────
# N/A for this sample -- no event records submitted.
# Tier 3 variables defined for when records are submitted in a real audit.

S4_TIER                       = 0     # 0 = no event records, 3 = full data

# Tier 3 variables (not rendered in this sample, ready for real audit)
S4_EVENT_COUNT_PERIOD         = None
S4_AVG_EVENT_REVENUE          = None
S4_TOTAL_EVENT_REVENUE        = None
S4_EVENT_REV_PCT_OF_TOTAL     = None
S4_MINIMUM_COMPLIANCE_RATE    = None  # % of events that met the minimum spend
S4_EVENTS_PER_MONTH_BENCHMARK = "6-8"
S4_INDUSTRY_EVENT_REV_PCT_LOW = 10
S4_INDUSTRY_EVENT_REV_PCT_HIGH = 20
S4_ANNUAL_REV_ESTIMATE        = 850_000
S4_EVENT_REV_POTENTIAL_LOW    = 85_000   # 10% of annual
S4_EVENT_REV_POTENTIAL_HIGH   = 170_000  # 20% of annual
S4_SCORE                      = None  # N/A


# ── SECTION 4: PRIVATE DINING, EVENTS, AND CATERING ──────────────────────────

def page_section4():
    s = [PageBreak()]

    s += section_header(
        "SECTION 4",
        "Private Dining, Events, and Catering",
        "Whether Rosewood Social is capturing private dining and event revenue, "
        "at what frequency, and whether minimums are being honored."
    )

    # ── ALL TIERS WITHOUT EVENT RECORDS: N/A ─────────────────────────────────
    # This section has no partial state. Either full event records are submitted
    # or the section is N/A. There is no meaningful analysis from partial data.
    if S4_TIER < 3:
        s.append(na_score_tile(4, "Private Dining, Events, and Catering"))
        s.append(sp(16))

        # STEEL placeholder explaining what to submit and what it unlocks
        s.append(tier_placeholder(
            "Private Dining, Events, and Catering",
            "Event records for each private dining or buyout event in the audit period: "
            "date, number of covers, minimum spend agreed, and actual revenue collected.",
            "Event count, average revenue per event, total event revenue as a percentage "
            "of total revenue, minimum compliance rate, event frequency vs. the 6-8 "
            "per month benchmark for operations at this revenue tier, "
            "and the estimated annual gap from underutilization.",
            "With event records, this section would show whether Rosewood Social "
            "is running private dining as a managed revenue channel or leaving it "
            "to chance, calculate whether minimums are being collected on every event, "
            "and identify the dollar gap between current event revenue and the "
            f"{S4_INDUSTRY_EVENT_REV_PCT_LOW}-{S4_INDUSTRY_EVENT_REV_PCT_HIGH}% of annual "
            "revenue that active private dining programs produce at this revenue tier."
        ))
        s.append(sp(20))

        # NAVY callout with revenue potential estimate
        s.append(callout_box(
            "WHAT EVENT RECORDS WOULD SHOW AT THIS REVENUE LEVEL",
            f"Operations at ${S4_ANNUAL_REV_ESTIMATE:,.0f} annual revenue that actively "
            f"market private dining typically generate "
            f"${S4_EVENT_REV_POTENTIAL_LOW:,.0f} to ${S4_EVENT_REV_POTENTIAL_HIGH:,.0f} "
            f"in event revenue annually, "
            f"{S4_INDUSTRY_EVENT_REV_PCT_LOW} to {S4_INDUSTRY_EVENT_REV_PCT_HIGH}% of total. "
            "Without event records this audit cannot determine whether Rosewood Social "
            "is capturing this revenue or leaving it on the table. "
            "That range represents a potential $7,000 to $14,000 per month in revenue "
            "that operates on a different margin structure than regular service, "
            "with guaranteed minimums and pre-sold covers.",
            bg=NAVY
        ))
        s.append(sp(20))

        # Single action item
        _h_s4ai = sub_header("Action Item")
        _f_s4ai = action_item(
            priority="HIGH",
            title="Collect and Submit Event Records for the Last 12 Months",
            area="Private Dining, Events, and Catering",
            data_desc=(
                "No event records were submitted with this audit. "
                "This section cannot be scored without event data. "
                f"Operations at ${S4_ANNUAL_REV_ESTIMATE:,.0f} annual revenue "
                "that run an active private dining program typically generate "
                f"{S4_INDUSTRY_EVENT_REV_PCT_LOW}-{S4_INDUSTRY_EVENT_REV_PCT_HIGH}% of "
                "total revenue from events. "
                "That revenue cannot be tracked, managed, or grown "
                "without a record of what has already happened."
            ),
            instruction=(
                "Pull your POS event records or reservation system data "
                "for every private dining, buyout, or catering event "
                "in the last 12 months. "
                "For each event record the date, number of covers, "
                "the minimum spend agreed in advance, and the actual revenue collected. "
                "Submit this data with your next audit to unlock the full Section 4 analysis. "
                "If no private dining events have occurred in the last 12 months, "
                "that is itself a significant finding: "
                "Rosewood Social has available private dining capacity "
                "that is not being converted into revenue."
            ),
            tool="Pull event history from your POS or reservation system.",
            time_str="Before next audit",
            monthly=f"${round(S4_EVENT_REV_POTENTIAL_LOW / 12):,.0f}-"
                    f"${round(S4_EVENT_REV_POTENTIAL_HIGH / 12):,.0f} potential",
            annual=f"${S4_EVENT_REV_POTENTIAL_LOW:,.0f}-"
                   f"${S4_EVENT_REV_POTENTIAL_HIGH:,.0f} potential",
        )
        s.append(PageBreak())
        s += _h_s4ai
        s.append(_f_s4ai)
        return s

    # ── TIER 3: Full analysis -- renders when event records are submitted ──────
    # Score: calculated from submitted event data
    s.append(section_score_tile(4, "Private Dining, Events, and Catering",
        S4_SCORE or 0))
    s.append(sp(20))

    # 4.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("Event Records", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S4_EVENT_COUNT_PERIOD or 0} events submitted",
             STYLES["table_cell"])],
        [Paragraph("POS Sales Report", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S4_TOTAL_EVENT_REVENUE or 0:,.0f} event revenue confirmed",
             STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.34, CONTENT_W*0.34, CONTENT_W*0.32]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 4.2 Event Revenue Summary (formula_box)
    _h_ers = sub_header("Event Revenue Summary")
    _f_ers = formula_box([
        "EVENT REVENUE, EXPLICIT CALCULATION",
        "",
        f"  Total events (period):             {S4_EVENT_COUNT_PERIOD or 0}",
        f"  Total event revenue (period):      ${S4_TOTAL_EVENT_REVENUE or 0:,.0f}",
        f"  Average revenue per event:         ${S4_AVG_EVENT_REVENUE or 0:,.0f}",
        "",
        f"  Event revenue as % of total:       {S4_EVENT_REV_PCT_OF_TOTAL or 0}%",
        f"  Industry benchmark:                "
        f"{S4_INDUSTRY_EVENT_REV_PCT_LOW}-{S4_INDUSTRY_EVENT_REV_PCT_HIGH}%",
        "",
        f"  Events per month (period rate):    "
        f"{round((S4_EVENT_COUNT_PERIOD or 0) / 1, 1)}",
        f"  Industry benchmark:                "
        f"{S4_EVENTS_PER_MONTH_BENCHMARK} per month",
        "",
        f"  Minimum compliance rate:           {S4_MINIMUM_COMPLIANCE_RATE or 0}%",
        f"  Industry standard:                 100%",
    ])
    s += _h_ers
    s.append(_f_ers)
    s.append(sp(20))

    # 4.3 Event Performance Assessment
    def sc(label):
        color = SAGE if label == "ON TARGET" else (SALMON if label == "CRITICAL" else AMBER)
        return Paragraph(label, ParagraphStyle(f"s4sc_{label[:5]}", fontName=FONT_BOLD,
            fontSize=8, leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    s += sub_header("Event Performance Assessment")
    evt_rows = [
        [Paragraph("Events per month", STYLES["table_cell_left"]),
         Paragraph(str(round((S4_EVENT_COUNT_PERIOD or 0) / 1, 1)),
             STYLES["table_cell"]),
         Paragraph(S4_EVENTS_PER_MONTH_BENCHMARK, STYLES["table_cell"]),
         sc("CRITICAL" if (S4_EVENT_COUNT_PERIOD or 0) < 4 else "ATTENTION")],
        [Paragraph("Average event revenue", STYLES["table_cell_left"]),
         Paragraph(f"${S4_AVG_EVENT_REVENUE or 0:,.0f}", STYLES["table_cell"]),
         Paragraph("Varies by operation", STYLES["table_cell"]),
         sc("ATTENTION")],
        [Paragraph("Event revenue % of total", STYLES["table_cell_left"]),
         Paragraph(f"{S4_EVENT_REV_PCT_OF_TOTAL or 0}%", STYLES["table_cell"]),
         Paragraph(f"{S4_INDUSTRY_EVENT_REV_PCT_LOW}-"
                   f"{S4_INDUSTRY_EVENT_REV_PCT_HIGH}%", STYLES["table_cell"]),
         sc("CRITICAL" if (S4_EVENT_REV_PCT_OF_TOTAL or 0) < 8 else "ATTENTION")],
        [Paragraph("Minimum compliance rate", STYLES["table_cell_left"]),
         Paragraph(f"{S4_MINIMUM_COMPLIANCE_RATE or 0}%", STYLES["table_cell"]),
         Paragraph("100%", STYLES["table_cell"]),
         sc("ON TARGET" if (S4_MINIMUM_COMPLIANCE_RATE or 100) == 100 else "CRITICAL")],
    ]
    cw_evt = [CONTENT_W*0.34, CONTENT_W*0.18, CONTENT_W*0.24, CONTENT_W*0.24]
    s.append(std_table(["Metric", "Your Bar", "Benchmark", "Status"], evt_rows, cw_evt))
    s.append(sp(20))

    # 4.4 Score Calculation (Tier 3)
    _h_sc = sub_header("Score Calculation")
    s += _h_sc
    s.append(sp(4))
    s.append(body("Score calculated from submitted event records. See table above."))
    s.append(sp(20))

    # 4.5 Action Items (Tier 3)
    _h_ai = sub_header("Action Items")
    _f_ai = action_item(
        priority="HIGH",
        title="Bring Every Event to Minimum Compliance Before the Event Date",
        area="Private Dining, Events, and Catering",
        data_desc=(
            "Minimum compliance is the most controllable metric in event revenue. "
            "Every event that closes below the agreed minimum is revenue already "
            "committed that was not collected."
        ),
        instruction=(
            "Send a confirmation to every event booker at 7 days and 48 hours before the event. "
            "Confirm the minimum, the agreed menu or package, and the cover count. "
            "If the event is tracking below minimum at 48 hours, "
            "offer an additional item or upgrade to close the gap before service."
        ),
        tool="Track minimums in your event booking log or reservation system.",
        time_str="Before next event",
        monthly="Varies by event count and minimum",
        annual="Varies by event count and minimum",
    )
    s.append(PageBreak())
    s += _h_ai
    s.append(_f_ai)

    return s


# ── SECTION 5 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S5_TIER                     = 2

S5_SERVER_REPORT_SUBMITTED  = True
S5_NUM_SERVERS              = 8
S5_SERVER_LABELS            = ["A", "B", "C", "D", "E", "F", "G", "H"]
S5_SERVER_CHECK_AVGS        = [52, 48, 45, 42, 38, 33, 29, 24]
S5_SERVER_COVERS            = [82, 76, 79, 88, 91, 74, 68, 83]
S5_TOP_SERVER_LABEL         = "Server A"
S5_TOP_CHECK_AVG            = 52
S5_BOTTOM_SERVER_LABEL      = "Server H"
S5_BOTTOM_CHECK_AVG         = 24
S5_HOUSE_AVG                = 38
S5_SPREAD                   = 28
S5_SPREAD_TARGET            = 10
S5_SERVERS_ABOVE            = 3     # A, B, C
S5_SERVERS_AT_OR_NEAR       = 1     # D (within $4)
S5_SERVERS_BELOW            = 4     # E, F, G, H
S5_COACHING_PROCESS_EVIDENT = False  # inferred: spread too wide for active coaching
S5_PRESHIFT_CONSISTENT      = False  # inferred: bottom cluster too large
S5_DAYPART_DATA_SUBMITTED   = False  # Tier 3 only
S5_GAP_BOTTOM_TO_AVG        = 14    # $38 - $24
S5_MONTHLY_GAP              = 2_310
S5_ANNUAL_GAP               = 27_720

# Score elements
S5_PTS_REPORT_SUBMITTED     = 20    # server report submitted: 20/20
S5_PTS_SPREAD               = 5     # $28 spread vs $10 target: minimal partial 5/25
S5_PTS_MAJORITY_ABOVE       = 5     # 3 of 8 above: partial 5/15
S5_PTS_COACHING             = 8     # no evidence of coaching: partial 8/20
S5_PTS_PRESHIFT             = 10    # some structure inferred: partial 10/20
S5_SCORE                    = (S5_PTS_REPORT_SUBMITTED + S5_PTS_SPREAD
                               + S5_PTS_MAJORITY_ABOVE + S5_PTS_COACHING
                               + S5_PTS_PRESHIFT)  # 48


# ── SECTION 5: SERVER PERFORMANCE AND STANDARDS ───────────────────────────────

def page_section5():
    s = [PageBreak()]
    tier = S5_TIER

    s += section_header(
        "SECTION 5",
        "Server Performance and Standards",
        "Whether server performance is being tracked, whether a performance "
        "standard exists, and whether underperformers are being coached "
        "or allowed to drift."
    )

    # ── TIER 0 and TIER 1: N/A -- server report required ─────────────────────
    if tier < 2:
        s.append(na_score_tile(5, "Server Performance and Standards"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Server Performance and Standards",
            "Server Sales Report: check average, cover count, and total sales "
            "by server for the audit period.",
            "Server check average ranking, spread between top and bottom performers, "
            "identification of servers above and below the house average, "
            "and coaching signal derived from the spread width.",
            "With a server sales report, this section would rank every server by check "
            "average, calculate the spread between your highest and lowest performers, "
            "and show whether the gap is consistent with an operation that has a "
            "written performance standard and active coaching, or one where each "
            "server has developed their own approach independently. "
            "Blended POS data confirms total revenue but cannot identify whether "
            "the check average gap is concentrated in one or two underperformers "
            "or spread evenly across the floor. "
            "That distinction determines whether the fix is individual coaching "
            "or a full floor retraining."
        ))
        return s

    # ── TIER 2: Full analysis ─────────────────────────────────────────────────
    s.append(section_score_tile(5, "Server Performance and Standards", S5_SCORE))
    s.append(sp(20))

    # 5.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("Server Sales Report", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S5_NUM_SERVERS} servers, check avg and covers by server",
             STYLES["table_cell"])],
        [Paragraph("POS Sales Report: Daily Totals", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph("House average confirmation", STYLES["table_cell"])],
        [Paragraph("Daypart Sales Split", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.36, CONTENT_W*0.34, CONTENT_W*0.30]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 5.2 Server Performance Ranking
    _h_srv = sub_header("Server Performance Ranking")
    _f_srv = body(
        f"All {S5_NUM_SERVERS} servers ranked by check average, highest to lowest. "
        f"House average: ${S5_HOUSE_AVG:.0f}. "
        "Servers are anonymized as A through H. "
        "Status reflects position relative to house average."
    )
    s += _h_srv
    s.append(_f_srv)
    s.append(sp(12))

    def status_s5(avg):
        if avg >= S5_HOUSE_AVG + 4:
            label, color = "ABOVE AVG", SAGE
        elif avg >= S5_HOUSE_AVG - 4:
            label, color = "AT AVG", AMBER
        else:
            label, color = "BELOW AVG", SALMON
        return Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s5st_{avg}", fontName=FONT_BOLD, fontSize=7.5,
            leading=10, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    server_rows = []
    for label, avg, covers in zip(
            S5_SERVER_LABELS, S5_SERVER_CHECK_AVGS, S5_SERVER_COVERS):
        total_sales = avg * covers
        vs_avg = avg - S5_HOUSE_AVG
        vs_str = f"+${vs_avg}" if vs_avg >= 0 else f"-${abs(vs_avg)}"
        vs_color = SAGE if vs_avg > 0 else (AMBER if abs(vs_avg) <= 4 else SALMON)
        server_rows.append([
            Paragraph(f"Server {label}", STYLES["table_cell_left"]),
            Paragraph(f"${avg:.0f}",
                ParagraphStyle(f"s5avg_{label}", fontName=FONT_BOLD, fontSize=9,
                textColor=(SAGE if avg >= S5_HOUSE_AVG + 4
                           else (AMBER if abs(avg - S5_HOUSE_AVG) <= 4 else SALMON)),
                alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
            Paragraph(f"{covers}", STYLES["table_cell"]),
            Paragraph(f"${total_sales:,.0f}", STYLES["table_cell"]),
            Paragraph(vs_str,
                ParagraphStyle(f"s5vs_{label}", fontName=FONT_BOLD, fontSize=8.5,
                leading=12, textColor=vs_color, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0)),
            status_s5(avg),
        ])

    cw_srv = [CONTENT_W*0.14, CONTENT_W*0.12, CONTENT_W*0.12,
              CONTENT_W*0.16, CONTENT_W*0.16, CONTENT_W*0.30]
    s.append(std_table(
        ["Server", "Check Avg", "Covers", "Total Sales", "vs. House Avg", "Status"],
        server_rows, cw_srv))
    s.append(sp(10))
    s.append(Paragraph(
        f"<i>House average: ${S5_HOUSE_AVG:.0f}. "
        "Servers within $4 of house average rated AT AVG. "
        f"All figures from submitted server sales report for {AUDIT_PERIOD}.</i>",
        ParagraphStyle("s5_tbl_note", fontName=FONT_ITALIC, fontSize=7.5, leading=11,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0)))
    s.append(sp(20))

    # 5.3 Performance Spread Analysis
    _h_psa = sub_header("Performance Spread Analysis")
    _f_psa = formula_box([
        "PERFORMANCE SPREAD, EXPLICIT CALCULATION",
        "",
        f"  Top server (Server A):             ${S5_TOP_CHECK_AVG} check average",
        f"  Bottom server (Server H):          ${S5_BOTTOM_CHECK_AVG} check average",
        f"  Spread:  ${S5_TOP_CHECK_AVG} - ${S5_BOTTOM_CHECK_AVG} = ${S5_SPREAD}",
        f"  Standard for a managed floor:      Under ${S5_SPREAD_TARGET}",
        "",
        f"  Servers above house average:       "
        f"{S5_SERVERS_ABOVE} of {S5_NUM_SERVERS}",
        f"  Servers at house average (within $4): "
        f"{S5_SERVERS_AT_OR_NEAR} of {S5_NUM_SERVERS}",
        f"  Servers below house average:       "
        f"{S5_SERVERS_BELOW} of {S5_NUM_SERVERS}",
        "",
        f"  Bottom server gap to house average: "
        f"${S5_BOTTOM_CHECK_AVG} vs ${S5_HOUSE_AVG} = ${S5_GAP_BOTTOM_TO_AVG} below",
        f"  If bottom 4 servers reached house average:",
        f"  ${S5_GAP_BOTTOM_TO_AVG} avg improvement x "
        f"{sum(S5_SERVER_COVERS[4:]):,} covers = "
        f"${S5_GAP_BOTTOM_TO_AVG * sum(S5_SERVER_COVERS[4:]):,.0f} per period recoverable",
    ])
    s += _h_psa
    s.append(_f_psa)
    s.append(sp(20))

    # 5.4 SALMON callout
    s.append(callout_box(
        f"FIVE OF {S5_NUM_SERVERS} SERVERS ARE BELOW THE HOUSE AVERAGE",
        f"A spread of ${S5_SPREAD} between your top and bottom server is not "
        "normal performance variance. "
        f"On a managed floor with a written standard and weekly coaching, "
        f"the spread between top and bottom server is typically under "
        f"${S5_SPREAD_TARGET}. "
        f"A ${S5_SPREAD} spread is the result of each server developing "
        "their own table approach independently, "
        "without a shared language for recommendations, "
        "without a consistent upsell process, "
        "and without a manager reviewing individual check averages weekly. "
        "Every dollar of gap between Server H and the house average "
        "is revenue that is already in the building and not being captured. "
        f"At ${S5_BOTTOM_CHECK_AVG} per cover, Server H is producing "
        f"${S5_GAP_BOTTOM_TO_AVG} less per cover than the house average "
        f"across {S5_SERVER_COVERS[7]} covers this period. "
        "That is not a hiring problem. "
        "It is a training and standards problem.",
        bg=SALMON
    ))
    s.append(sp(20))

    # 5.5 Score Calculation
    _h_sc = sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Server report submitted", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_REPORT_SUBMITTED), STYLES["table_cell"]),
         Paragraph("Server report submitted. Full 20/20.",
             STYLES["table_cell_left"])],
        [Paragraph("Check avg spread under $10", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_SPREAD), STYLES["table_cell"]),
         Paragraph(f"${S5_SPREAD} spread vs ${S5_SPREAD_TARGET} target. "
                   "Far above acceptable. Minimal partial 5/25.",
                   STYLES["table_cell_left"])],
        [Paragraph("Majority of servers above house avg", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_MAJORITY_ABOVE), STYLES["table_cell"]),
         Paragraph(f"{S5_SERVERS_ABOVE} of {S5_NUM_SERVERS} above average. "
                   "Partial 5/15.",
                   STYLES["table_cell_left"])],
        [Paragraph("Coaching process evident", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_COACHING), STYLES["table_cell"]),
         Paragraph(f"Spread of ${S5_SPREAD} is inconsistent with active coaching. "
                   "Partial 8/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("Pre-shift standard consistent", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_PRESHIFT), STYLES["table_cell"]),
         Paragraph(f"Bottom cluster of {S5_SERVERS_BELOW} servers suggests "
                   "inconsistent standard. Partial 10/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S5_SCORE}</b>",
             ParagraphStyle("s5_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S5_SCORE}/100, ATTENTION</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.34, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.44]
    _f_sc = std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2)
    s += _h_sc
    s.append(_f_sc)
    s.append(sp(10))
    s.append(amber_note(
        "Submitting daypart sales splits with your next audit unlocks Tier 3 analysis, "
        "which determines whether server underperformance is shift-specific "
        "(a scheduling or staffing issue) or server-specific (a coaching issue). "
        "A server who underperforms only on lunch shifts may be in the wrong section. "
        "A server who underperforms across all dayparts needs a different conversation."
    ))
    s.append(sp(20))

    # 5.6 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"The server data tells a clear story. "
        f"Three of eight servers are above the ${S5_HOUSE_AVG} house average. "
        f"Four are below it, including Server H at ${S5_BOTTOM_CHECK_AVG}, "
        f"${S5_GAP_BOTTOM_TO_AVG} below the house average. "
        f"The ${S5_SPREAD} spread between top and bottom is nearly three times "
        f"the ${S5_SPREAD_TARGET} standard for a floor with active coaching and "
        "a written performance standard. "
        "That spread is not explained by seniority, section assignment, or shift timing. "
        "It is explained by the absence of a shared process. "
        "Server A has a process. "
        "Servers F, G, and H have not been given one."
    ))
    s.append(sp(12))
    s.append(body(
        "The evidence of no active coaching process is in the data itself. "
        "A floor where a manager reviews check averages weekly and follows up with "
        "underperformers does not produce a $28 spread for an extended period. "
        "That spread compresses over time as coaching pulls the bottom cluster upward. "
        f"The fact that {S5_SERVERS_BELOW} of {S5_NUM_SERVERS} servers are below "
        "the house average after this audit period "
        "means the gap has been running without a correction applied to it. "
        "The correction is not difficult. "
        "It is specific, it is repeatable, and it starts with one conversation "
        "with one server before their next shift."
    ))
    s.append(sp(20))

    # ── TIER 3: Daypart split layer (code ready, not rendered in this sample) ─
    # When daypart data is submitted, add per-server performance by daypart here.
    # This distinguishes shift-specific underperformance (staffing issue)
    # from server-specific underperformance (coaching issue).
    # Implementation: for each server, show lunch vs. dinner check average.
    # A server at $28 lunch / $22 dinner underperforms both shifts -- coaching.
    # A server at $44 lunch / $22 dinner underperforms dinner only -- scheduling.

    # 5.7 Action Items
    _h_ai = sub_header("Action Items")
    _f_ai = action_item(
        priority="HIGH",
        title="Identify What the Top Two Servers Do Differently and Document It",
        area="Server Performance and Standards",
        data_desc=(
            f"Server A averages ${S5_TOP_CHECK_AVG} per cover. "
            f"Server H averages ${S5_BOTTOM_CHECK_AVG}. "
            f"The ${S5_SPREAD} spread confirms no shared table standard exists. "
            "The top server's process has never been documented or trained to the floor."
        ),
        instruction=(
            f"This week, sit down with Server A and Server "
            f"{S5_SERVER_LABELS[1]}. "
            "Ask them each: how do you open a table, "
            "when do you make your first recommendation, "
            "what do you recommend most often, "
            "and what do you say when a guest hesitates. "
            "Write down what they say. "
            "Consolidate it into one page: "
            "the table opening, the recommendation moment, "
            "and two or three specific language examples. "
            "That is your performance standard. "
            "Review it with the bottom three servers before their next shift, "
            "one behavior at a time."
        ),
        tool="Document the conversation in writing before distributing to the team.",
        time_str="This week",
        monthly=f"${S5_MONTHLY_GAP:,.0f}",
        annual=f"${S5_ANNUAL_GAP:,.0f}",
    )
    s.append(PageBreak())
    s += _h_ai
    s.append(_f_ai)
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Review Individual Server Check Averages Every Monday and Follow Up the Same Day",
        area="Server Performance and Standards",
        data_desc=(
            f"Four of {S5_NUM_SERVERS} servers are below the house average. "
            "Server check averages are being captured in the POS system "
            "but are not being reviewed as a weekly management metric. "
            "Without a weekly review, underperformance runs uncorrected "
            "for the full audit period before it surfaces."
        ),
        instruction=(
            "Every Monday, run the server check average report for the prior week. "
            "Rank all servers highest to lowest. "
            "Any server more than $8 below the house average gets a 10-minute "
            "check-in that day before their shift. "
            "The check-in is not a performance review. "
            "It covers one specific behavior: "
            "what recommendation did you make most often last week, "
            "and what will you lead with this week. "
            "That is the entire conversation. "
            "Do it every Monday without exception."
        ),
        tool="Run the server check average report from your POS every Monday.",
        time_str="This Monday",
        monthly=f"${round(S5_MONTHLY_GAP * 0.5):,.0f}",
        annual=f"${round(S5_ANNUAL_GAP * 0.6):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Run a Weekly Pre-Shift Meeting Before the Highest-Volume Service",
        area="Server Performance and Standards",
        data_desc=(
            f"Bottom cluster of {S5_SERVERS_BELOW} servers is consistent with "
            "a floor that has not had a shared performance language "
            "trained regularly. "
            "A consistent pre-shift meeting is the primary delivery mechanism "
            "for the table standard once it is written."
        ),
        instruction=(
            "Pick the highest-volume service of the week. "
            "Before that service, run a 15-minute floor meeting. "
            "Cover three things: the table standard for this shift, "
            "one featured item with the recommendation language, "
            "and last week's check average ranking with recognition for "
            "the top performer. "
            "Do not cancel this meeting for any reason. "
            "It takes 15 minutes and it is the only consistent mechanism "
            "for closing the $28 spread over time."
        ),
        tool="Schedule the meeting before the highest-volume service each week.",
        time_str="This week",
        monthly=f"${round(S5_MONTHLY_GAP * 0.25):,.0f}",
        annual=f"${round(S5_ANNUAL_GAP * 0.3):,.0f}",
    ))

    return s


# ── SECTION 6 DATA -- DERIVED FROM SUBMITTED DATA ─────────────────────────────
# No questionnaire. No self-reporting. Every signal inferred from what was submitted.

S6_SCORE = 62

S6_SIGNALS = [
    # (label, level, evidence, what_it_reveals, next_step)
    (
        "POS Data Completeness",
        "MEDIUM",
        (
            "POS daily sales totals submitted for the full 4-week audit period "
            "with no gaps. Revenue is confirmed at $65,385 for the period. "
            "Data submitted at category level: beverage and food split visible. "
            "Item-level sales detail was not included. "
            "Category data confirms the food and beverage ratio is healthy "
            "but cannot show which specific items are driving or dragging revenue."
        ),
        (
            "Category-level POS data is sufficient to calculate check average, "
            "revenue split, and labor percentage. "
            "It cannot identify item-level underperformance, "
            "pricing gaps by specific menu item, "
            "or which items are contributing most to the check average gap. "
            "The measurement infrastructure exists at the category level. "
            "It is not yet built at the item level."
        ),
        "Run an item-level sales mix report from your POS for the next audit period "
        "and submit it alongside the daily totals."
    ),
    (
        "Labor Data Submitted",
        "HIGH",
        (
            "Labor schedule submitted for the full audit period with total "
            "hours and estimated cost. "
            "This is sufficient to calculate labor cost percentage (34%) "
            "and RPLH ($62.75). "
            "Labor figure is operator-reported, not extracted from payroll records. "
            "Time clock actuals were not submitted."
        ),
        (
            "A schedule submission is the baseline labor measurement discipline. "
            "It confirms someone is tracking hours against revenue. "
            "The operator-reported figure introduces uncertainty: "
            "if actual labor is higher than reported, "
            "the 34% figure and the gap calculation in Section 2 will change. "
            "Time clock actuals would replace the estimate with a verified number."
        ),
        "Submit payroll records and time clock actuals with your next audit "
        "to verify the labor percentage and unlock clock drift analysis."
    ),
    (
        "Server-Level Tracking",
        "HIGH",
        (
            "Server sales report submitted for the full audit period. "
            "Check average, cover count, and total sales available by server "
            "for all 8 servers. "
            "This enabled the full Section 3 and Section 5 analysis: "
            "spread calculation, performance ranking, and coaching signal. "
            "Daypart splits by server were not included."
        ),
        (
            "Submitting a server report is the clearest signal of active "
            "floor management in this audit. "
            "It confirms someone is tracking individual server performance, "
            "not just total revenue. "
            "The absence of daypart splits means underperformance cannot be "
            "attributed to a specific shift, which limits the precision of "
            "the coaching conversation."
        ),
        "Submit server performance data with a daypart split for the next audit "
        "to determine whether underperformance is shift-specific or server-specific."
    ),
    (
        "Event Tracking",
        "LOW",
        (
            "No event records were submitted with this audit. "
            "Section 4 is N/A as a result. "
            "It cannot be determined from the submitted data whether Rosewood Social "
            "is running a private dining program, at what frequency, "
            "or at what average revenue per event. "
            "The absence of event data does not confirm events are not occurring. "
            "It confirms they are not being tracked in a way that produces "
            "a submittable record."
        ),
        (
            "Event revenue is the highest-margin revenue channel available "
            "to a full-service operation at this revenue tier. "
            "Operations at $850K annual revenue that actively market private dining "
            "typically generate $85,000 to $170,000 in event revenue annually. "
            "Without event records, this audit cannot determine whether that "
            "revenue channel is being captured or left unmanaged."
        ),
        "Pull event history from your POS or reservation system for the last 12 months "
        "and submit it with your next audit."
    ),
    (
        "Sales Mix Tracking",
        "MEDIUM",
        (
            "Category sales mix submitted: beverage at 65% and food at 35% of revenue. "
            "This confirms the food and beverage split is within benchmark range. "
            "Item-level sales data was not submitted. "
            "The top-selling items, the lowest-selling items, and the revenue "
            "concentration within each category are not visible from category totals."
        ),
        (
            "Category-level mix tracking confirms the broad revenue structure is healthy. "
            "It cannot identify which specific items are earning their menu position "
            "and which are not. "
            "The check average gap of $4.00 per cover has a cause at the item level "
            "that cannot be diagnosed without item data. "
            "Category tracking is the floor, not the ceiling, "
            "of menu measurement discipline."
        ),
        "Submit an item-level sales mix report with your next audit "
        "to unlock the full menu engineering analysis."
    ),
    (
        "Data Tier Submitted",
        "MEDIUM",
        (
            "Tier 2 data submitted: POS daily totals, category sales mix, "
            "labor schedule, and server sales report. "
            "Missing for Tier 3: item-level sales data, vendor price list, "
            "payroll and time clock records, upsell tracking report, "
            "daypart sales splits, and event records. "
            "Tier 2 submission reflects an operation with core financial "
            "tracking in place but without the complete measurement infrastructure "
            "that produces the deepest revenue analysis."
        ),
        (
            "The Tier 2 submission produced a full analysis of labor cost, "
            "check average, server performance, and category mix. "
            "Tier 3 submission would add item-level pricing analysis, "
            "verified labor by department, server upsell attach rates, "
            "shift-level performance attribution, and event revenue benchmarking. "
            "Each additional document submitted closes a diagnostic blind spot "
            "that the current data cannot address."
        ),
        "Submit item-level sales data, upsell tracking, daypart splits, "
        "payroll records, and event history with your next audit to unlock Tier 3."
    ),
]


# ── SECTION 6: IMPLEMENTATION STATUS ─────────────────────────────────────────

def page_section6():
    s = [PageBreak()]

    # Always fully rendered -- no tier logic
    s += section_header(
        "SECTION 6",
        "Implementation Status",
        "What the submitted data reveals about measurement discipline "
        "and revenue tracking system adoption."
    )

    s.append(section_score_tile(6, "Implementation Status", S6_SCORE))
    s.append(sp(20))

    # HOW THIS SECTION IS SCORED -- exactly four sentences
    s.append(callout_box(
        "HOW THIS SECTION IS SCORED",
        "This section is scored entirely from your submitted data. "
        "No additional data submission required for this section. "
        "What you submitted tells us whether measurement systems are in place. "
        "Each signal below reflects what your data shows, not what you report.",
        bg=STEEL
    ))
    s.append(sp(20))

    # Signal Summary Table
    _h_iss = sub_header("Implementation Signal Summary")
    s += _h_iss

    def sig_text(level):
        color_map = {"HIGH": SAGE, "MEDIUM": AMBER, "LOW": SALMON}
        c = color_map.get(level, MID_GRAY)
        return Paragraph(f"<b>{level}</b>",
            ParagraphStyle(f"s6sig_{level}", fontName=FONT_BOLD, fontSize=8.5,
            leading=11, textColor=c, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    sig_rows = []
    for label, level, _ev, _rev, next_step in S6_SIGNALS:
        sig_rows.append([
            Paragraph(f"<b>{label}</b>", STYLES["table_cell_left"]),
            sig_text(level),
            Paragraph(next_step, STYLES["table_cell_left"]),
        ])
    cw_sig = [CONTENT_W*0.28, CONTENT_W*0.12, CONTENT_W*0.60]
    s.append(std_table(["Signal", "Level", "Next Step"], sig_rows, cw_sig))
    s.append(sp(20))

    # Signal Detail blocks
    _h_sd = sub_header("Signal Detail")
    s.append(PageBreak())
    s += _h_sd

    sig_score_map = {"HIGH": 100, "MEDIUM": 60, "LOW": 20}
    level_color = {"HIGH": SAGE, "MEDIUM": AMBER, "LOW": SALMON}

    for i, (label, level, evidence, reveals, next_step) in enumerate(S6_SIGNALS, 1):
        lc = level_color[level]

        sig_lbl = Paragraph(f"SIGNAL {i}",
            ParagraphStyle(f"s6lbl{i}", fontName=FONT_BOLD, fontSize=7, leading=9,
            textColor=MID_GRAY, leftIndent=0, firstLineIndent=0))
        sig_name = Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s6name{i}", fontName=FONT_BOLD, fontSize=11, leading=14,
            textColor=NAVY, leftIndent=0, firstLineIndent=0))
        sig_badge = Paragraph(f"<b> {level} </b>",
            ParagraphStyle(f"s6badge{i}", fontName=FONT_BOLD, fontSize=8, leading=10,
            textColor=WHITE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))
        badge_t = Table([[sig_badge]], colWidths=[64])
        badge_t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),lc),
            ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
            ("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),
        ]))
        hdr_row = Table([[sig_name, badge_t]],
            colWidths=[CONTENT_W - 32 - 72, 72])
        hdr_row.setStyle(TableStyle([
            ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
            ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ]))

        def _lbl(t): return Paragraph(t,
            ParagraphStyle(f"s6dl{i}{t[:3]}", fontName=FONT_BOLD, fontSize=7.5,
            leading=10, textColor=GOLD, leftIndent=0, firstLineIndent=0))
        def _val(t): return Paragraph(t,
            ParagraphStyle(f"s6dv{i}{t[:3]}", fontSize=9, leading=13,
            textColor=DARK_TEXT, leftIndent=0, firstLineIndent=0))

        tool_p = Paragraph(f"<b>Next Step:</b>  {next_step}",
            ParagraphStyle(f"s6tool{i}", fontSize=8.5, leading=13,
            textColor=DARK_TEXT, leftIndent=0, firstLineIndent=0))
        tool_row = Table([[tool_p]], colWidths=[CONTENT_W - 32])
        tool_row.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#F7F6F2")),
            ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#E8E6E0")),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
        ]))

        cw_inner = CONTENT_W - 32
        items = [
            sig_lbl, sp(3), hdr_row, sp(10),
            _lbl("WHAT THE DATA SHOWS"), sp(3), _val(evidence),
            sp(8),
            _lbl("WHAT THIS REVEALS ABOUT THE SYSTEM"), sp(3), _val(reveals),
            sp(8), tool_row,
        ]
        inner = Table([[it] for it in items], colWidths=[cw_inner])
        inner.setStyle(TableStyle([
            ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
            ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
        ]))
        outer = Table([[inner]], colWidths=[CONTENT_W])
        outer.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),WHITE),
            ("BOX",(0,0),(-1,-1),0.8,colors.HexColor("#E8E6E0")),
            ("LINEBEFORE",(0,0),(0,-1),4,lc),
            ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
            ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16),
        ]))
        s.append(outer)
        s.append(sp(10))

    s.append(sp(10))

    # Score Calculation
    _h_sc = sub_header("Score Calculation")
    s.append(body(
        "Each signal is scored HIGH (100), MEDIUM (60), or LOW (20) "
        "based entirely on what the submitted data demonstrates. "
        "Section score is the simple average across all six signals."
    ))
    s.append(sp(12))
    sc_rows = []
    total_pts = 0
    for i, (label, level, _, _, _) in enumerate(S6_SIGNALS, 1):
        pts = sig_score_map[level]
        total_pts += pts
        sc_rows.append([
            Paragraph(f"Signal {i}: {label}", STYLES["table_cell_left"]),
            Paragraph(f"<b>{level}</b>",
                ParagraphStyle(f"s6sc_{level[:2]}{i}", fontName=FONT_BOLD, fontSize=8.5,
                textColor=level_color[level], alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0)),
            Paragraph(str(pts), STYLES["table_cell"]),
        ])
    section_avg = round(total_pts / len(S6_SIGNALS))
    band_label, band_color = score_band(section_avg)
    sc_rows.append([
        Paragraph("<b>Section Score (average)</b>", STYLES["table_cell_bold"]),
        Paragraph(f"<b>{band_label}</b>",
            ParagraphStyle("s6sc_band", fontName=FONT_BOLD, fontSize=8.5,
            textColor=band_color, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
        Paragraph(f"<b>{section_avg}/100</b>",
            ParagraphStyle("s6sc_tot", fontName=FONT_BOLD, fontSize=9,
            textColor=band_color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0)),
    ])
    cw_sc = [CONTENT_W*0.52, CONTENT_W*0.22, CONTENT_W*0.26]
    _f_sc = std_table(["Signal", "Level", "Points"], sc_rows, cw_sc)
    s += _h_sc
    s.append(_f_sc)
    s.append(sp(20))

    # Narrative
    s += sub_header("What the Data Says About This Operation")
    s.append(body(
        "This audit was submitted at Tier 2. "
        "The submission includes POS daily totals, a category sales mix, "
        "a labor schedule, and a server sales report. "
        "That combination is meaningful. "
        "It is enough to calculate labor cost, check average, server performance spread, "
        "and category revenue mix. "
        "None of those calculations existed before this submission. "
        "The data shows an operation that is tracking its core revenue flows "
        "at the category and personnel level."
    ))
    s.append(sp(12))
    s.append(body(
        "What the data cannot yet show is where the check average gap originates "
        "at the item level, whether labor overruns are driven by a single department, "
        "whether servers are capturing upsell opportunities, "
        "and whether event revenue is being managed or left untracked. "
        "Those answers require item-level sales data, "
        "time clock actuals, an upsell tracking report, and event records. "
        "The gap between what this audit shows and what a Tier 3 submission would show "
        "is exactly the gap between knowing the problem exists "
        "and knowing precisely what is causing it."
    ))
    s.append(sp(20))

    # HOW TO GET MORE callout
    s.append(callout_box(
        "HOW TO GET MORE FROM YOUR NEXT AUDIT",
        "Submit these documents with your next audit to unlock Tier 3 analysis: "
        "Item-Level Sales Mix Report, unlocks menu engineering matrix and item-level pricing gaps. "
        "Upsell Tracking Report, unlocks appetizer and dessert attach rates by server. "
        "Payroll and Time Clock Records, unlocks verified labor and clock drift analysis. "
        "Daypart Sales Splits, unlocks shift-level server performance attribution. "
        "Event Records (12 months), unlocks full Section 4 event revenue analysis.",
        bg=NAVY
    ))

    return s


# ── CONSOLIDATED ACTION PLAN DATA ─────────────────────────────────────────────
# All action items from Sections 1-5 ranked by monthly dollar impact descending.
# Format: (rank, area, action_title, monthly_str, annual_str, time_str, sort_val)
# sort_val is the leading dollar number for ranking verification only.

MASTER_ACTIONS = [
    (1,  "Labor",            "Build every schedule from a daily revenue projection",
     "$3,060",  "$36,720",  "This week",    3060),
    (2,  "Check Average",    "Set and train a documented table standard for every server",
     "$2,890",  "$34,680",  "This week",    2890),
    (3,  "Server Perf.",     "Document top server process and train bottom three servers",
     "$2,310",  "$27,720",  "This week",    2310),
    (4,  "Labor",            "Calculate and post RPLH every Monday",
     "$524",    "$6,288",   "This Monday",  524),
    (5,  "Check Average",    "Pull server check averages every Monday and post the ranking",
     "$1,445",  "$17,340",  "This Monday",  1445),
    (6,  "Menu Engineering", "Review every menu price against current cost and competitive set",
     "$1,840",  "$22,080",  "2 weeks",      1840),
    (7,  "Server Perf.",     "Review individual check averages weekly and follow up same day",
     "$1,155",  "$13,860",  "This Monday",  1155),
    (8,  "Menu Engineering", "Submit item-level sales mix with next audit",
     "$920",    "$11,040",  "Next audit",   920),
    (9,  "Labor",            "Separate labor tracking into bar, kitchen, and floor",
     "$667",    "$8,004",   "2 weeks",      667),
    (10, "Server Perf.",     "Run a weekly pre-shift meeting before highest-volume service",
     "$578",    "$6,936",   "This week",    578),
    (11, "Check Average",    "Run a 15-minute pre-shift training on one upsell item each week",
     "$578",    "$6,936",   "This week",    578),
    (12, "Menu Engineering", "Identify and position three highest-margin items on every menu page",
     "$460",    "$5,520",   "1 week",       460),
    (13, "Events",           "Collect and submit event records for the last 12 months",
     "$7,083",  "$85,000",  "Before next audit", 7083),
    (14, "Events",           "If no events have occurred, document private dining capacity and build a program",
     "$7,083",  "$85,000",  "30 days",      7083),
]

# Re-sort by sort_val descending
MASTER_ACTIONS = sorted(MASTER_ACTIONS, key=lambda x: x[6], reverse=True)
# Re-assign ranks after sort
MASTER_ACTIONS = [(i+1,) + row[1:] for i, row in enumerate(MASTER_ACTIONS)]

ANNUAL_IMPACT_LOW  = "$60,600"
ANNUAL_IMPACT_HIGH = "$103,020"


# ── CONSOLIDATED ACTION PLAN ──────────────────────────────────────────────────

def page_consolidated():
    s = [PageBreak()]

    s += section_header(
        "CONSOLIDATED ACTION PLAN",
        "All Action Items Ranked by Monthly Dollar Impact",
        "Every action item from every section. Start with Rank 1 this week."
    )

    # Master ranked table
    def pri_text(rank):
        return Paragraph(str(rank),
            ParagraphStyle(f"cap_rn{rank}", fontName=FONT_BOLD,
            fontSize=9, textColor=NAVY, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    cw_m = [CONTENT_W*0.06, CONTENT_W*0.14, CONTENT_W*0.42,
            CONTENT_W*0.13, CONTENT_W*0.13, CONTENT_W*0.12]

    master_rows = []
    for row in MASTER_ACTIONS:
        rank, area, title, mo, ann, time_val = row[:6]
        master_rows.append([
            pri_text(rank),
            Paragraph(area, STYLES["table_cell_left"]),
            Paragraph(title, STYLES["table_cell_left"]),
            Paragraph(mo, ParagraphStyle(f"cap_mo{rank}", fontSize=8, leading=11,
                textColor=DARK_TEXT, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0)),
            Paragraph(ann, ParagraphStyle(f"cap_an{rank}", fontSize=7.5, leading=11,
                textColor=DARK_TEXT, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0)),
            Paragraph(time_val, ParagraphStyle(f"cap_tm{rank}", fontSize=8, leading=11,
                textColor=DARK_TEXT, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0)),
        ])

    s.append(std_table(
        ["#", "Area", "Action", "Monthly", "Annual", "Time"],
        master_rows, cw_m))
    s.append(sp(10))
    s.append(Paragraph(
        "<i>Ranked by estimated monthly dollar impact descending. "
        "Event revenue items (Ranks 1 and 2) reflect potential from an untracked channel, "
        "not a verified gap. "
        "All other dollar estimates derive from submitted revenue and labor data.</i>",
        ParagraphStyle("cap_note", fontName=FONT_ITALIC, fontSize=8.5, leading=13,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0)))
    s.append(sp(24))

    # 30-Day Priority List
    _h_30d = sub_header("30-Day Priority List: Top Five Actions")
    _f_30d = body(
        "These five actions produce the largest combined dollar improvement "
        "in the shortest time. Complete all five before moving to anything else."
    )
    s.append(PageBreak())
    s += _h_30d
    s.append(_f_30d)
    s.append(sp(12))

    top5 = [
        dict(priority="HIGH",
             title="Build Every Weekly Schedule from a Daily Revenue Projection",
             area="Labor Cost and Scheduling",
             data_desc=(
                 "Labor running at 34% of revenue with flat week-to-week variance. "
                 "No forecast adjustment detected in the submitted schedule. "
                 "At $65,385 monthly revenue, every point of unnecessary labor "
                 "above the 32% ceiling costs $654 per month."
             ),
             instruction=(
                 "Before building each week's schedule, pull the prior two weeks "
                 "of daily revenue from your POS by day of week. "
                 "Project the coming week by day. "
                 "Calculate target labor hours from that projection using your "
                 "average hourly wage. "
                 "Build to the target number, not last week's staffing pattern."
             ),
             tool="Use your POS daily revenue report as the projection baseline.",
             time_str="This week",
             monthly="$3,060", annual="$36,720"),
        dict(priority="HIGH",
             title="Set and Train a Documented Table Standard for Every Server",
             area="Upselling and Check Average",
             data_desc=(
                 "Server spread of $28 confirms no documented table standard exists. "
                 "Five of eight servers are below the house average. "
                 "Check average of $38 is $4 below the $42 target. "
                 "The gap is a process gap, not a talent gap."
             ),
             instruction=(
                 "Talk to your top two servers by check average this week. "
                 "Ask: how do you open a table, when do you recommend, "
                 "what words do you use. "
                 "Write down what they say in one page. "
                 "That is your table standard. "
                 "Review it with the bottom three servers before their next shift. "
                 "Focus on two specific behaviors: one appetizer recommendation "
                 "per table, and one beverage upgrade per cover."
             ),
             tool="Document the standard in writing before distributing.",
             time_str="This week",
             monthly="$2,890", annual="$34,680"),
        dict(priority="HIGH",
             title="Document Top Server Process and Train Bottom Three Servers on It",
             area="Server Performance and Standards",
             data_desc=(
                 "Server A averages $52 per cover. Server H averages $24. "
                 "The $28 spread is the result of each server developing "
                 "their own table approach independently. "
                 "The top server's process has never been documented or trained to the floor."
             ),
             instruction=(
                 "Sit down with Server A and Server B this week. "
                 "Ask each: how do you open, when do you recommend, "
                 "what do you say when a guest hesitates. "
                 "Consolidate into one page: the opening, the recommendation moment, "
                 "and two or three specific language examples. "
                 "Review with Servers F, G, and H before their next shift. "
                 "One behavior at a time."
             ),
             tool="Document the conversation before distributing to the team.",
             time_str="This week",
             monthly="$2,310", annual="$27,720"),
        dict(priority="HIGH",
             title="Review Every Menu Price Against Current Cost and Competitive Set",
             area="Menu Engineering and Pricing",
             data_desc=(
                 "Check average of $38 is $4 below the $42 target. "
                 "No price list was submitted so pricing cannot be verified "
                 "against cost of goods. "
                 "Last documented price review date is unknown."
             ),
             instruction=(
                 "For every menu item, calculate the cost of ingredients "
                 "at current invoice prices. "
                 "Divide cost by menu price. "
                 "Any item where cost exceeds 32% of menu price for food "
                 "or 22% for spirits cocktails warrants a price increase, "
                 "a recipe adjustment, or a removal. "
                 "Start with your top 20 revenue items first."
             ),
             tool="Use your most recent invoices as the cost reference.",
             time_str="2 weeks",
             monthly="$1,840", annual="$22,080"),
        dict(priority="HIGH",
             title="Calculate and Post RPLH Every Monday Morning",
             area="Labor Cost and Scheduling",
             data_desc=(
                 "RPLH of $62.75 is $2.25 below the $65.00 target. "
                 "RPLH is not currently tracked as a weekly management metric. "
                 "Without a weekly RPLH number there is no feedback signal "
                 "to tell the manager whether the prior week's schedule was efficient."
             ),
             instruction=(
                 "Every Monday morning, divide the prior week's total revenue "
                 "by total hours worked. "
                 "That is your RPLH for the week. "
                 "Write it on a whiteboard or note in the manager area. "
                 "Target: $65.00 minimum. "
                 "If RPLH is below target, the schedule ran too heavy "
                 "for the revenue it produced. "
                 "Adjust the current week's target accordingly."
             ),
             tool="Calculate from POS weekly revenue divided by scheduled hours.",
             time_str="This Monday",
             monthly="$524", annual="$6,288"),
    ]

    for item in top5:
        s.append(action_item(
            priority=item["priority"],
            title=item["title"],
            area=item["area"],
            data_desc=item["data_desc"],
            instruction=item["instruction"],
            tool=item["tool"],
            time_str=item["time_str"],
            monthly=item["monthly"],
            annual=item["annual"],
        ))
        s.append(sp(10))
    s.append(sp(14))

    # 90-Day Roadmap -- starts on its own page
    s.append(PageBreak())
    s += sub_header("90-Day Implementation Roadmap")
    s.append(body(
        "Three phases. Each builds on the one before it. "
        "Do not start Phase 2 tasks until Phase 1 is complete. "
        "Assign an owner name before each phase begins."
    ))
    s.append(sp(12))

    # Phase 1
    s.append(phase_hdr(
        "DAYS 1-30: FOUNDATION. Revenue-based scheduling running, "
        "SERVER STANDARD DOCUMENTED, WEEKLY METRICS ESTABLISHED",
        STEEL))
    s.append(sp(10))
    ph1_rows = [
        [Paragraph("Days 1-3", STYLES["table_cell_left"]),
         Paragraph("Talk to top two servers. Document their table approach in one page. "
                   "That is the performance standard. Print it.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Day 1 (Monday)", STYLES["table_cell_left"]),
         Paragraph("Block 45 minutes every Monday before the first staff interaction. "
                   "Run the first weekly review: RPLH, server check averages, "
                   "open items from prior week.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 1-5", STYLES["table_cell_left"]),
         Paragraph("Build this week's schedule from a daily revenue projection. "
                   "Pull the prior two weeks of daily POS revenue. "
                   "Project each day. Calculate target hours. Build to the target.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 3-7", STYLES["table_cell_left"]),
         Paragraph("Review the documented table standard with the bottom three servers "
                   "before their next shift. One behavior at a time. "
                   "Run the first weekly pre-shift meeting before the highest-volume service.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Floor Mgr", STYLES["table_cell_left"])],
        [Paragraph("Day 7 onward", STYLES["table_cell_left"]),
         Paragraph("Pull server check averages every Monday. "
                   "Post the ranking. Any server more than $8 below house average "
                   "gets a 10-minute check-in that day.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Floor Mgr", STYLES["table_cell_left"])],
        [Paragraph("Days 14-21", STYLES["table_cell_left"]),
         Paragraph("Review every menu price against current invoice costs. "
                   "Start with top 20 revenue items. "
                   "Flag any item above 32% food cost or 22% beverage cost "
                   "for a price adjustment or recipe review.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
    ]
    cw_ph = [CONTENT_W*0.14, CONTENT_W*0.62, CONTENT_W*0.24]
    s.append(std_table(["When", "Task", "Owner"], ph1_rows, cw_ph))
    s.append(sp(16))

    # Phase 2
    s.append(phase_hdr(
        "DAYS 31-60: MEASUREMENT. RPLH trending upward, "
        "COACHING PROCESS ESTABLISHED, MENU REVIEW COMPLETE",
        SAGE))
    s.append(sp(10))
    ph2_rows = [
        [Paragraph("Day 30 review", STYLES["table_cell_left"]),
         Paragraph("Compare RPLH from 4 weeks of weekly tracking to the opening $62.75. "
                   "Review server check average trend from 4 weeks of weekly rankings. "
                   "Identify whether the bottom cluster is moving toward the house average.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 31-35", STYLES["table_cell_left"]),
         Paragraph("Tag every shift to a department in your time clock or scheduling system: "
                   "bar, kitchen, and floor. "
                   "Record each department's hours and cost separately from this week forward.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 35-45", STYLES["table_cell_left"]),
         Paragraph("Finalize price adjustments from the menu review. "
                   "Update menu materials. "
                   "Brief servers on any price changes before the first service "
                   "the updated menu runs.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 31-60", STYLES["table_cell_left"]),
         Paragraph("Continue weekly pre-shift meeting every week without exception. "
                   "Continue weekly server check average review and coaching check-ins. "
                   "Pull and retain a server sales report each week for the next audit submission.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Floor Mgr", STYLES["table_cell_left"])],
        [Paragraph("Days 45-60", STYLES["table_cell_left"]),
         Paragraph("Pull an item-level sales mix report from your POS "
                   "and confirm it covers the full prior 30 days. "
                   "Save it for next audit submission.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
    ]
    s.append(std_table(["When", "Task", "Owner"], ph2_rows, cw_ph))
    s.append(sp(16))

    # Phase 3
    s.append(phase_hdr(
        "DAYS 61-90: OPTIMIZATION. Upsell standard tracked, "
        "DEPARTMENT LABOR ESTABLISHED, EVENT STRATEGY DOCUMENTED",
        AMBER))
    s.append(sp(10))
    ph3_rows = [
        [Paragraph("Day 60 review", STYLES["table_cell_left"]),
         Paragraph("Review 8 weeks of RPLH data. "
                   "Compare server check average trend to the Day 1 baseline. "
                   "Confirm whether the bottom cluster has moved toward the house average.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 61-70", STYLES["table_cell_left"]),
         Paragraph("Formalize the upsell tracking process. "
                   "At end of each service, record appetizer and dessert counts "
                   "against cover count for each server. "
                   "Calculate attach rates weekly.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Floor Mgr", STYLES["table_cell_left"])],
        [Paragraph("Days 61-75", STYLES["table_cell_left"]),
         Paragraph("Document Rosewood Social's private dining capacity and process: "
                   "available spaces, maximum covers, minimum spend policy, "
                   "and booking lead time. "
                   "Pull any event history from the POS for the last 12 months "
                   "and prepare it for the next audit submission.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 75-85", STYLES["table_cell_left"]),
         Paragraph("Review department-level labor percentages from 6 weeks of tracking. "
                   "Compare bar, kitchen, and floor against their individual targets. "
                   "Identify which department is closest to target and which needs attention.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Day 90 review", STYLES["table_cell_left"]),
         Paragraph("Run a full self-assessment against every section in this audit. "
                   "Compare every metric to the baselines from this report. "
                   "Collect all Tier 3 documents for next audit submission: "
                   "item-level sales mix, server upsell report, payroll records, "
                   "daypart splits, and event records.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
    ]
    s.append(std_table(["When", "Task", "Owner"], ph3_rows, cw_ph))
    s.append(sp(24))

    # Annual Impact Summary
    s.append(formula_box([
        f"REVENUE FIX AUDIT: ANNUAL IMPACT SUMMARY, {BAR_NAME}",
        "",
        "  Menu Engineering and Pricing (Section 1):",
        f"    Check average gap ${S1_CHECK_AVG_GAP:.2f}/cover x {S1_COVERS_MONTHLY:,} covers/mo "
        f"= ${S1_MONTHLY_GAP:,.0f}/mo  |  ${S1_ANNUAL_GAP:,.0f}/yr",
        "",
        "  Labor Cost and Scheduling (Section 2):",
        f"    {S2_LABOR_GAP_PTS} pts above {S2_LABOR_TARGET_HIGH}% ceiling x "
        f"${S2_TOTAL_REV_PERIOD:,.0f}/mo revenue "
        f"= ${S2_MONTHLY_GAP:,.0f}/mo  |  ${S2_ANNUAL_GAP:,.0f}/yr",
        "",
        "  Upselling and Check Average (Section 3):",
        f"    ${S3_CHECK_AVG_GAP:.2f}/cover gap x {S3_COVERS_MONTHLY:,} covers/mo "
        f"x 50% capture rate = ${S3_MONTHLY_GAP:,.0f}/mo  |  ${S3_ANNUAL_GAP:,.0f}/yr",
        "",
        "  Private Dining and Events (Section 4):",
        "    N/A. Event records not submitted. Submit records to calculate actual gap.",
        "",
        "  Server Performance and Standards (Section 5):",
        f"    Bottom {S5_SERVERS_BELOW} servers to house average x "
        f"{sum(S5_SERVER_COVERS[4:]):,} covers/period "
        f"= ${S5_MONTHLY_GAP:,.0f}/mo  |  ${S5_ANNUAL_GAP:,.0f}/yr",
        "",
        f"  COMBINED ANNUAL GAP (4 scored sections):",
        f"    ${S1_ANNUAL_GAP:,.0f} + ${S2_ANNUAL_GAP:,.0f} + ${S3_ANNUAL_GAP:,.0f} "
        f"+ ${S5_ANNUAL_GAP:,.0f} = "
        f"${S1_ANNUAL_GAP + S2_ANNUAL_GAP + S3_ANNUAL_GAP + S5_ANNUAL_GAP:,.0f}/yr",
        "",
        f"  REALISTIC RECOVERY RANGE (50-85% of gap, based on full implementation):",
        f"    Low estimate:   {ANNUAL_IMPACT_LOW}/yr",
        f"    High estimate:  {ANNUAL_IMPACT_HIGH}/yr",
        "",
        f"  Bar Cop  |  barcop.com  |  Audit ID: {AUDIT_ID}",
    ]))

    return s


# ── CLOSE ─────────────────────────────────────────────────────────────────────

def page_close():
    s = [PageBreak()]

    # 1. "AUDIT COMPLETE" label, GOLD 8pt
    s.append(Paragraph("AUDIT COMPLETE",
        ParagraphStyle("close_lbl", fontName=FONT_BOLD, fontSize=8, leading=10,
        textColor=GOLD, leftIndent=0, firstLineIndent=0)))
    s.append(sp(4))

    # 2. Headline, DARK_TEXT bold 18pt
    s.append(Paragraph(f"{BAR_NAME}: Here Is What Happens Next",
        ParagraphStyle("close_hl", fontName=FONT_BOLD, fontSize=18, leading=22,
        textColor=DARK_TEXT, leftIndent=0, firstLineIndent=0)))
    s.append(sp(5))

    # 3. Subtitle, MID_GRAY 9pt
    s.append(Paragraph(
        "Your revenue systems are partially in place. "
        "The gaps identified in this report are specific, measurable, "
        "and fixable within 90 days.",
        ParagraphStyle("close_sub", fontName=FONT_REG, fontSize=9, leading=13,
        textColor=MID_GRAY, leftIndent=0, firstLineIndent=0)))
    s.append(sp(6))
    s.append(HRule(CONTENT_W, GOLD, 1.5))
    s.append(sp(14))

    # 4. Body paragraph, operator voice, specific to Rosewood Social
    s.append(Paragraph(
        f"This audit scored {BAR_NAME} at {OVERALL_SCORE}/100 overall. "
        f"The largest single controllable gap is labor at {S2_LABOR_PCT}% of revenue "
        f"against a {S2_LABOR_TARGET_HIGH}% ceiling, "
        f"costing ${S2_LABOR_GAP_MONTHLY:,.0f} per month in unnecessary overhead. "
        "The gap is not caused by overstaffing. "
        "It is caused by building the schedule from habit rather than from a revenue projection. "
        "Every week the schedule runs without a forecast, "
        "slow nights are staffed the same as busy nights "
        "and the labor percentage stays above target for reasons that are "
        "entirely within management's control to change. "
        f"Building the schedule from a daily revenue projection this week "
        "is the single action with the largest immediate impact in this audit. "
        "The rest of the 90-day roadmap follows from that one discipline.",
        ParagraphStyle("close_body", fontSize=10, leading=15, textColor=DARK_TEXT,
        leftIndent=0, firstLineIndent=0)))
    s.append(sp(18))

    # 5. SALMON callout, "YOUR SINGLE MOST IMPORTANT NEXT ACTION"
    # Rank 1 from Consolidated Plan: Build every schedule from a daily revenue projection
    _act_t = Paragraph("YOUR SINGLE MOST IMPORTANT NEXT ACTION",
        ParagraphStyle("close_act_t", fontName=FONT_BOLD, fontSize=9, leading=12,
        textColor=colors.HexColor("#F5C8C0"), leftIndent=0, firstLineIndent=0))
    _act_title = Paragraph(
        "Build Every Weekly Schedule from a Daily Revenue Projection",
        ParagraphStyle("close_act_title", fontName=FONT_BOLD, fontSize=12, leading=15,
        textColor=WHITE, leftIndent=0, firstLineIndent=0))
    _act_area = Paragraph("Labor Cost and Scheduling",
        ParagraphStyle("close_act_area", fontSize=8, leading=11,
        textColor=colors.HexColor("#F5C8C0"), leftIndent=0, firstLineIndent=0))

    def _lbl(t): return Paragraph(t,
        ParagraphStyle(f"cl_lbl_{t[:4]}", fontName=FONT_BOLD, fontSize=7.5,
        leading=10, textColor=colors.HexColor("#F5C8C0"),
        leftIndent=0, firstLineIndent=0))
    def _val(t): return Paragraph(t,
        ParagraphStyle(f"cl_val_{t[:4]}", fontSize=9, leading=13,
        textColor=WHITE, leftIndent=0, firstLineIndent=0))

    _act_data = _val(
        f"Labor running at {S2_LABOR_PCT}% of revenue with flat week-to-week variance. "
        "No forecast adjustment detected in the submitted schedule. "
        f"At ${S2_TOTAL_REV_PERIOD:,.0f} monthly revenue, "
        f"every point of unnecessary labor above the {S2_LABOR_TARGET_HIGH}% ceiling "
        f"costs ${round(S2_TOTAL_REV_PERIOD * 0.01):,.0f} per month."
    )
    _act_inst = _val(
        "Before building each week's schedule, pull the prior two weeks of daily "
        "revenue from your POS by day of week. "
        "Project the coming week by day. "
        "Calculate target labor hours from that projection. "
        "Build to the target number, not last week's staffing pattern."
    )

    def _met(label, val):
        return Paragraph(f'<font color="#F5C8C0"><b>{label}</b></font>  {val}',
            ParagraphStyle(f"cl_met_{label[:3]}", fontSize=8.5, leading=13,
            textColor=WHITE, leftIndent=0, firstLineIndent=0))

    cw_met = [(CONTENT_W - 32) / 4] * 4
    _met_row = Table([[
        _met("Next Step:", "Pull prior two weeks of daily POS revenue. Project by day."),
        _met("Time:", "This week"),
        _met("Monthly:", "$3,060"),
        _met("Annual:", "$36,720"),
    ]], colWidths=cw_met)
    _met_row.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),6),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))

    _act_inner = Table([
        [_act_t],[sp(3)],[_act_title],[_act_area],
        [sp(10)],
        [_lbl("WHAT THE DATA SHOWS")],[sp(3)],[_act_data],
        [sp(8)],
        [_lbl("WHAT TO DO")],[sp(3)],[_act_inst],
        [sp(10)],[_met_row],
    ], colWidths=[CONTENT_W - 32])
    _act_inner.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
    ]))
    _act_outer = Table([[_act_inner]], colWidths=[CONTENT_W])
    _act_outer.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),SALMON),
        ("TOPPADDING",(0,0),(-1,-1),16),("BOTTOMPADDING",(0,0),(-1,-1),16),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16),
    ]))
    s.append(_act_outer)
    s.append(sp(18))

    # 6. Audit Details table
    s += sub_header("Audit Details")
    detail_rows = [
        [Paragraph("Report Date", STYLES["table_cell_bold"]),
         Paragraph(AUDIT_DATE, STYLES["table_cell_left"])],
        [Paragraph("Audit ID", STYLES["table_cell_bold"]),
         Paragraph(AUDIT_ID, STYLES["table_cell_left"])],
        [Paragraph("Data Tier Submitted", STYLES["table_cell_bold"]),
         Paragraph(DATA_TIER_LABEL, STYLES["table_cell_left"])],
        [Paragraph("Period Covered", STYLES["table_cell_bold"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"])],
        [Paragraph("Sections with Full Analysis", STYLES["table_cell_bold"]),
         Paragraph(f"{SECTIONS_WITH_DATA} of 6", STYLES["table_cell_left"])],
        [Paragraph("Sections with Partial Analysis", STYLES["table_cell_bold"]),
         Paragraph(f"{SECTIONS_PARTIAL} of 6", STYLES["table_cell_left"])],
        [Paragraph("Sections N/A, Data Not Submitted", STYLES["table_cell_bold"]),
         Paragraph(f"{SECTIONS_NA} of 6", STYLES["table_cell_left"])],
    ]
    cw_det = [CONTENT_W * 0.38, CONTENT_W * 0.62]
    det_tbl = Table(detail_rows, colWidths=cw_det)
    det_tbl.setStyle(TableStyle([
        ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#E8E6E0")),
        ("BACKGROUND",(0,0),(0,-1),colors.HexColor("#F7F6F2")),
        ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]))
    s.append(det_tbl)
    s.append(sp(18))

    # 8. NAVY Fix System callout
    _fs_p = Paragraph(
        "The Revenue Fix system includes the operational tools and step-by-step processes "
        "to address every gap identified in this report. "
        "Learn more at barcop.com.",
        ParagraphStyle("fs_callout", fontName=FONT_REG, fontSize=10, leading=15,
        textColor=WHITE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))
    _fs_outer = Table([[_fs_p]], colWidths=[CONTENT_W])
    _fs_outer.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),16),("BOTTOMPADDING",(0,0),(-1,-1),16),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16),
    ]))
    s.append(_fs_outer)
    s.append(sp(12))

    # 9. Bar Cop footer line
    s.append(Paragraph(
        'Bar Cop  |  <a href="https://www.barcop.com">'
        '<font color="#4888A8">barcop.com</font></a>',
        ParagraphStyle("close_footer", fontName=FONT_BOLD, fontSize=9, leading=13,
        textColor=MID_GRAY, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)))

    return s


# ── POST PROCESS ──────────────────────────────────────────────────────────────
def post_process(story):
    return story


# ── BUILD ─────────────────────────────────────────────────────────────────────
def build():
    story = [PageBreak()]
    story += page_executive_summary()
    story += page_section1()
    story += page_section2()
    story += page_section3()
    story += page_section4()
    story += page_section5()
    story += page_section6()
    story += page_consolidated()
    story += page_close()
    story = post_process(story)

    doc = SimpleDocTemplate(OUT, pagesize=letter,
        leftMargin=MARGIN - 6,
        rightMargin=MARGIN - 6,
        topMargin=0.55*inch + 38 - 6,
        bottomMargin=0.45*inch + 28 - 6,
        title="Revenue Audit -- Bar Cop",
        author="Bar Cop")
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Built: {OUT}")


# ── REAL DATA INJECTION ───────────────────────────────────────────────────────
# If AUDIT_DATA_JSON env var is set, override all sample data with real values.
import os as _os, json as _json
_data_path = _os.environ.get("AUDIT_DATA_JSON")
if _data_path and _os.path.exists(_data_path):
    with open(_data_path) as _f:
        _d = _json.load(_f)
    _g = globals()
    for _k, _v in _d.items():
        if _k in _g or _k.isupper():
            _g[_k] = _v
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    build()

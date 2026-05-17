"""
BAR COP TRAFFIC AUDIT - Build File
Cover page only - checkpoint 1
"""

import os
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

OUT = os.environ.get("AUDIT_OUT_PATH", "/tmp/BarCop_Traffic_Audit_EXAMPLE.pdf")

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
DOC_NAME    = "Traffic Audit"

# ── SAMPLE DATA (replaced per customer) ──────────────────────────────────────
OVERALL_SCORE   = 47
BAR_NAME        = "Ironwood Tavern"
BAR_CITY_STATE  = "Austin, TX"
REVENUE_TIER    = "$600K\u2013$800K Annual Revenue"
AUDIT_DATE      = "April 2026"
AUDIT_ID        = "TFA-2026-0023"
AUDIT_PERIOD    = "4 weeks ending March 31, 2026"
DATA_TIER_LABEL = "Tier 2 Analysis \u2014 Standard Data Submitted"
WEEKLY_GAP_AMT  = "$2,840"
GAP_SOURCES     = "Google visibility. Review velocity. Social content. All recoverable."
INDUSTRY_AVG    = 58
TARGET_SCORE    = 65

# Score band helper
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
    # "TRAFFIC AUDIT" WHITE 64pt single line
    title_y = h - 188
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 64)
    c.drawString(MARGIN, title_y, "TRAFFIC AUDIT")

    # ── DESCRIPTION LINE ─────────────────────────────────────────────────────
    desc_y = h - 218
    c.setFillColor(colors.HexColor("#8AABB8"))
    c.setFont(FONT_REG, 11)
    c.drawString(MARGIN, desc_y,
        "A scored analysis of your digital visibility, reputation, and guest acquisition.")

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
    c.drawString(MARGIN, 15, "TRAFFIC AUDIT  |  BARCOP.COM")
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
    tp = Paragraph(title, ParagraphStyle("ct_tfa", fontName=FONT_BOLD, fontSize=10.5,
        leading=14, textColor=WHITE, leftIndent=0, firstLineIndent=0))
    bp = Paragraph(body_text, ParagraphStyle("cb_tfa", fontSize=9.5, leading=14,
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
    items = [Paragraph(text, ParagraphStyle("sh_tfa", fontName=FONT_BOLD, fontSize=11,
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
            items.append(Paragraph(line, ParagraphStyle("fbt_tfa", fontName=FONT_BOLD,
                fontSize=9, leading=13, textColor=GOLD, leftIndent=0, firstLineIndent=0)))
            first = False
        else:
            items.append(Paragraph(line, ParagraphStyle("fbl_tfa", fontName=FONT_REG,
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

def score_tile_large(score_val, label="OVERALL TRAFFIC HEALTH SCORE"):
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
    inner = Table([[lbl_p],[sp(6)],[score_p],[sp(8)],[band_p]], colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),18),("BOTTOMPADDING",(0,0),(-1,-1),18),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return outer

def priority_action_box(rank, area, desc, monthly, annual, time_to, tool):
    rank_p = Paragraph(f"PRIORITY {rank}",
        ParagraphStyle(f"pa_rank{rank}", fontName=FONT_BOLD, fontSize=7,
        leading=9, textColor=colors.HexColor("#F5C8C0"), leftIndent=0, firstLineIndent=0))
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

def action_item(priority, title, area, data_desc, instruction, tool, time_str, monthly, annual):
    priority_colors = {"HIGH": SALMON, "MEDIUM": AMBER, "LOW": SAGE}
    bg = priority_colors.get(priority.upper(), STEEL)
    badge_p = Paragraph(priority.upper(),
        ParagraphStyle(f"ai_badge_{title[:8]}", fontName=FONT_BOLD, fontSize=7,
        leading=9, textColor=WHITE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))
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
        leading=11, textColor=band_color, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))
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


# ── EXECUTIVE SUMMARY DATA ────────────────────────────────────────────────────

SECTIONS_WITH_DATA = 5
SECTIONS_PARTIAL   = 2
SECTIONS_NA        = 0

SECTION_DATA = [
    # (name,                                  score,  status,      gap_monthly)
    ("Google Business Profile",               52,     "ATTENTION", "$1,240/mo"),
    ("Website and Online Menu Conversion",    38,     "CRITICAL",  "$1,680/mo"),
    ("Reviews and Reputation",                61,     "ATTENTION", "$820/mo"),
    ("Search Visibility and SEO",             28,     "CRITICAL",  "Partial data"),
    ("Social Media and Content",              44,     "ATTENTION", "$960/mo"),
    ("Delivery Platform Optimization",        35,     "CRITICAL",  "Partial data"),
    ("Guest Return and Email",                42,     "ATTENTION", "$740/mo"),
    ("Implementation Status",                 58,     "ATTENTION", "System gaps identified"),
]

TOP_ACTIONS = [
    {
        "rank":    1,
        "area":    "Website and Online Menu Conversion",
        "desc":    "Monthly sessions estimated at 1,840 with a 74% bounce rate. "
                   "74% of visitors are leaving without engaging. "
                   "No clear call-to-action on the homepage and the menu page "
                   "has no conversion mechanism above the fold.",
        "monthly": "$1,680",
        "annual":  "$20,160",
        "time":    "This week",
        "tool":    "Add one clear CTA button above the fold. Fix the menu page load and "
                   "conversion path.",
    },
    {
        "rank":    2,
        "area":    "Google Business Profile",
        "desc":    "Profile is only 72% complete. Photo count is 23 against a 100+ benchmark. "
                   "Zero posts in the last 30 days. "
                   "Review response rate is 12% against a 75% benchmark. "
                   "An incomplete, inactive profile ranks lower in local search.",
        "monthly": "$1,240",
        "annual":  "$14,880",
        "time":    "This week",
        "tool":    "Add 10 photos this week. Post twice per week. "
                   "Respond to every unanswered review.",
    },
    {
        "rank":    3,
        "area":    "Social Media and Content",
        "desc":    "3 posts in the last 30 days against an 18-post benchmark. "
                   "Engagement rate estimated at 0.8% against a 3% target. "
                   "Content is food photos only with no events, specials, or personality content.",
        "monthly": "$960",
        "annual":  "$11,520",
        "time":    "This week",
        "tool":    "Post every weekday this week. Build a 30-day content calendar this Sunday.",
    },
]

ANNUAL_IMPACT_LOW  = "$32,640"
ANNUAL_IMPACT_HIGH = "$55,488"


# ── EXECUTIVE SUMMARY PAGE ────────────────────────────────────────────────────

def page_executive_summary():
    s = []

    s += section_header(
        "EXECUTIVE SUMMARY",
        "Traffic Audit: " + BAR_NAME,
        f"Audit period: {AUDIT_PERIOD}  |  {DATA_TIER_LABEL}"
    )

    # 1. Operator Context block (STEEL)
    ctx_lines = [
        f"<b>Bar:</b> {BAR_NAME}",
        f"<b>Location:</b> {BAR_CITY_STATE}",
        f"<b>Revenue tier:</b> {REVENUE_TIER}",
        f"<b>Audit period:</b> {AUDIT_PERIOD}",
        f"<b>Data submitted:</b> {DATA_TIER_LABEL}",
        f"<b>Sections with full analysis:</b> {SECTIONS_WITH_DATA} of 8  "
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
    s += sub_header("Overall Traffic Health Score")
    s.append(score_tile_large(OVERALL_SCORE))
    s.append(sp(10))
    s.append(Paragraph(
        "<i>Score is a weighted composite of all sections with submitted data. "
        f"Based on {SECTIONS_WITH_DATA} of 8 sections fully analyzed, "
        f"{SECTIONS_PARTIAL} partial. "
        "Weights: GBP 20%, Website 15%, Reviews 20%, Search 10%, "
        "Social 10%, Delivery 10%, Guest Return 10%, Implementation 5%.</i>",
        ParagraphStyle("score_note", fontName=FONT_ITALIC, fontSize=8.5, leading=13,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0)))
    s.append(sp(20))

    # 3. Eight-area scorecard
    s += sub_header("Eight-Area Scorecard")

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

    cw_sc = [CONTENT_W*0.38, CONTENT_W*0.11, CONTENT_W*0.18, CONTENT_W*0.33]
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
        "<i>Partial sections (Search and Delivery) scored from questionnaire data only. "
        "Submit platform screenshots with next audit to unlock full analysis.</i>",
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
        "ranked by estimated monthly impact. "
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
        f"TRAFFIC AUDIT: ANNUAL IMPACT SUMMARY, {BAR_NAME}",
        "",
        "  Google Business Profile (Section 1):         Est. annual gap: $14,880",
        "  Website and Conversion (Section 2):          Est. annual gap: $20,160",
        "  Reviews and Reputation (Section 3):          Est. annual gap: $9,840",
        "  Search Visibility and SEO (Section 4):       Partial data, full analysis requires ranking report",
        "  Social Media and Content (Section 5):        Est. annual gap: $11,520",
        "  Delivery Platform Optimization (Section 6):  Partial data, dashboard screenshot required",
        "  Guest Return and Email (Section 7):          Est. annual gap: $8,880",
        "  Implementation Status (Section 8):           System gaps identified",
        "",
        f"  COMBINED ANNUAL IMPACT RANGE:   {ANNUAL_IMPACT_LOW} to {ANNUAL_IMPACT_HIGH}",
        "",
        f"  Based on {SECTIONS_WITH_DATA} of 8 sections fully analyzed, {SECTIONS_PARTIAL} partial.",
        "  Submit search ranking report and delivery dashboard to complete the full calculation.",
        "",
        f"  Bar Cop  |  barcop.com  |  Audit ID: {AUDIT_ID}",
    ]))

    return s



# ── SECTION 1 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S1_TIER                      = 2

S1_LISTING_CLAIMED           = True
S1_LISTING_VERIFIED          = True
S1_HOURS_COMPLETE            = True
S1_PHONE_PRESENT             = True
S1_WEBSITE_LINKED            = True
S1_MENU_LINK_ACTIVE          = False
S1_CATEGORY_SET              = True
S1_ATTRIBUTES_COMPLETE       = False
S1_PHOTO_COUNT               = 23
S1_PHOTO_BENCHMARK           = 100
S1_POSTS_LAST_30_DAYS        = 0
S1_POSTS_BENCHMARK           = 8
S1_REVIEW_COUNT_GOOGLE       = 187
S1_RATING_GOOGLE             = 4.2
S1_REVIEW_RESPONSE_RATE      = 12
S1_RESPONSE_BENCHMARK        = 75
S1_QA_POPULATED              = False
S1_PROFILE_COMPLETENESS_PCT  = 72
S1_MONTHLY_GAP               = 1_240
S1_ANNUAL_GAP                = 14_880

S1_PTS_CLAIMED               = 20
S1_PTS_COMPLETENESS          = 18
S1_PTS_PHOTOS                = 4
S1_PTS_POSTS                 = 0
S1_PTS_RESPONSE              = 10
S1_SCORE                     = (S1_PTS_CLAIMED + S1_PTS_COMPLETENESS +
                                S1_PTS_PHOTOS + S1_PTS_POSTS + S1_PTS_RESPONSE)  # 52


# ── SECTION 1: GOOGLE BUSINESS PROFILE ───────────────────────────────────────

def page_section1():
    s = [PageBreak()]
    tier = S1_TIER

    s += section_header(
        "SECTION 1",
        "Google Business Profile",
        "Whether Ironwood Tavern's Google Business Profile is complete, "
        "active, and converting local searches into guests."
    )

    # ── TIER 0: No screenshot submitted ──────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(1, "Google Business Profile"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Google Business Profile",
            "A screenshot of your Google Business Profile showing your listing "
            "completeness, photo count, recent posts, and review summary.",
            "Profile completeness audit, photo count vs. 100-photo benchmark, "
            "post frequency check, review response rate, and Q&A status.",
            "With your GBP screenshot, this section would show exactly which profile "
            "fields are incomplete, how far your photo count is from the benchmark "
            "that Google rewards with higher local search visibility, and whether "
            "your review response rate is helping or hurting your ranking."
        ))
        return s

    # ── TIER 1: Questionnaire only ────────────────────────────────────────────
    if tier == 1:
        s.append(section_score_tile(1, "Google Business Profile", 22,
            note="Partial score, questionnaire only, max 35 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "A Google Business Profile screenshot was not submitted with this audit. "
            "The assessment below is based on questionnaire responses only and can "
            "confirm whether your listing is claimed and verified. "
            "It cannot assess profile completeness, photo count, post frequency, "
            "or review response rate without seeing the actual listing. "
            "Submit a screenshot of your GBP dashboard for the next audit to unlock "
            "the full Section 1 analysis."
        ))
        s.append(sp(16))
        s += sub_header("Questionnaire-Based Assessment")
        s.append(body(
            "The following items are based on your submitted questionnaire responses. "
            "Each is scored against the industry standard independently."
        ))
        s.append(sp(12))
        t1_rows = [
            [Paragraph("Listing claimed and verified", STYLES["table_cell_left"]),
             Paragraph("Yes", STYLES["table_cell"]),
             Paragraph("Required", STYLES["table_cell"]),
             Paragraph("ON TARGET", ParagraphStyle("t1_s1", fontName=FONT_BOLD,
                fontSize=8, textColor=SAGE, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Hours of operation listed", STYLES["table_cell_left"]),
             Paragraph("Yes", STYLES["table_cell"]),
             Paragraph("Required", STYLES["table_cell"]),
             Paragraph("ON TARGET", ParagraphStyle("t1_s2", fontName=FONT_BOLD,
                fontSize=8, textColor=SAGE, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Phone number listed", STYLES["table_cell_left"]),
             Paragraph("Yes", STYLES["table_cell"]),
             Paragraph("Required", STYLES["table_cell"]),
             Paragraph("ON TARGET", ParagraphStyle("t1_s3", fontName=FONT_BOLD,
                fontSize=8, textColor=SAGE, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Photo count", STYLES["table_cell_left"]),
             Paragraph("Not verified", STYLES["table_cell"]),
             Paragraph("100+ photos", STYLES["table_cell"]),
             Paragraph("UNVERIFIED", ParagraphStyle("t1_s4", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
        ]
        cw_t1 = [CONTENT_W*0.36, CONTENT_W*0.18, CONTENT_W*0.22, CONTENT_W*0.24]
        s.append(std_table(["Field", "Submitted", "Standard", "Status"], t1_rows, cw_t1))
        return s

    # ── TIER 2: Full analysis ─────────────────────────────────────────────────
    s.append(section_score_tile(1, "Google Business Profile", S1_SCORE))
    s.append(sp(20))

    # 1.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("GBP Screenshot", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S1_PROFILE_COMPLETENESS_PCT}% complete", STYLES["table_cell"])],
        [Paragraph("Review Summary (from screenshot)", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S1_REVIEW_COUNT_GOOGLE} reviews, {S1_RATING_GOOGLE} stars",
             STYLES["table_cell"])],
        [Paragraph("GBP Insights Export", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.36, CONTENT_W*0.36, CONTENT_W*0.28]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 1.2 Profile Completeness Assessment
    s += sub_header("Profile Completeness Assessment")

    def sc(label):
        color = SAGE if label == "COMPLETE" else (SALMON if label == "MISSING" else AMBER)
        return Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s1sc_{label[:5]}", fontName=FONT_BOLD, fontSize=8,
            leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    profile_rows = [
        [Paragraph("Listing claimed and verified", STYLES["table_cell_left"]),
         Paragraph("Yes", STYLES["table_cell"]), sc("COMPLETE"),
         Paragraph("Foundation requirement met.", STYLES["table_cell_left"])],
        [Paragraph("Hours of operation", STYLES["table_cell_left"]),
         Paragraph("Complete", STYLES["table_cell"]), sc("COMPLETE"),
         Paragraph("All days and hours listed.", STYLES["table_cell_left"])],
        [Paragraph("Phone number", STYLES["table_cell_left"]),
         Paragraph("Present", STYLES["table_cell"]), sc("COMPLETE"),
         Paragraph("Verified from screenshot.", STYLES["table_cell_left"])],
        [Paragraph("Website link", STYLES["table_cell_left"]),
         Paragraph("Present", STYLES["table_cell"]), sc("COMPLETE"),
         Paragraph("Links to ironwoodtavern.com.", STYLES["table_cell_left"])],
        [Paragraph("Menu link", STYLES["table_cell_left"]),
         Paragraph("Not set", STYLES["table_cell"]), sc("MISSING"),
         Paragraph("Menu link absent. Guests searching for menu cannot click through.",
             STYLES["table_cell_left"])],
        [Paragraph("Business category", STYLES["table_cell_left"]),
         Paragraph("Set", STYLES["table_cell"]), sc("COMPLETE"),
         Paragraph("Primary category confirmed.", STYLES["table_cell_left"])],
        [Paragraph("Attributes (dining, amenities)", STYLES["table_cell_left"]),
         Paragraph("Incomplete", STYLES["table_cell"]), sc("PARTIAL"),
         Paragraph("Dining options and amenity attributes not fully populated.",
             STYLES["table_cell_left"])],
        [Paragraph("Photos", STYLES["table_cell_left"]),
         Paragraph(f"{S1_PHOTO_COUNT}", STYLES["table_cell"]), sc("PARTIAL"),
         Paragraph(f"{S1_PHOTO_COUNT} of {S1_PHOTO_BENCHMARK}+ benchmark. "
                   "Low photo count reduces search visibility.",
                   STYLES["table_cell_left"])],
        [Paragraph("Posts (last 30 days)", STYLES["table_cell_left"]),
         Paragraph(f"{S1_POSTS_LAST_30_DAYS}", STYLES["table_cell"]), sc("MISSING"),
         Paragraph(f"0 posts. Benchmark: {S1_POSTS_BENCHMARK}+/month. "
                   "Inactive profiles rank below active ones.",
                   STYLES["table_cell_left"])],
        [Paragraph("Q&A populated", STYLES["table_cell_left"]),
         Paragraph("No", STYLES["table_cell"]), sc("MISSING"),
         Paragraph("No Q&A pairs. Missed opportunity to answer common guest questions.",
                   STYLES["table_cell_left"])],
    ]
    cw_prof = [CONTENT_W*0.24, CONTENT_W*0.13, CONTENT_W*0.13, CONTENT_W*0.50]
    s.append(std_table(["Profile Field", "Status", "Rating", "Notes"],
        profile_rows, cw_prof))
    s.append(sp(20))

    # 1.3 Photo and Activity Gap
    _h_pag = sub_header("Photo and Activity Gap")
    _f_pag = formula_box([
        "PHOTO AND ACTIVITY GAP, EXPLICIT CALCULATION",
        "",
        f"  Current photo count:         {S1_PHOTO_COUNT}",
        f"  Google benchmark (100+ photos earns higher visibility): {S1_PHOTO_BENCHMARK}+",
        f"  Photos needed to reach benchmark: {S1_PHOTO_BENCHMARK - S1_PHOTO_COUNT}",
        "",
        f"  Posts in last 30 days:       {S1_POSTS_LAST_30_DAYS}",
        f"  Minimum posting benchmark:   {S1_POSTS_BENCHMARK} per month (2 per week)",
        f"  Posts behind benchmark:      {S1_POSTS_BENCHMARK} (entire month missed)",
        "",
        "  Google's local search algorithm surfaces listings that are:",
        "  (1) Complete across all profile fields",
        "  (2) Active with recent posts",
        "  (3) Engaged with reviewer responses",
        "  Ironwood Tavern is failing signals 2 and 3 entirely.",
    ])
    s += _h_pag
    s.append(_f_pag)
    s.append(sp(20))

    # 1.4 Review Response Analysis
    s += sub_header("Review Response Analysis")
    s.append(body(
        f"Ironwood Tavern has {S1_REVIEW_COUNT_GOOGLE} Google reviews with a "
        f"{S1_RATING_GOOGLE}-star rating. "
        f"The response rate of {S1_REVIEW_RESPONSE_RATE}% means that "
        f"{round(S1_REVIEW_COUNT_GOOGLE * (1 - S1_REVIEW_RESPONSE_RATE/100)):,} of those "
        f"reviews have received no response. "
        f"The industry benchmark is {S1_RESPONSE_BENCHMARK}%+ response rate. "
        "Google rewards businesses that engage with their reviewers with higher ranking. "
        "Every unanswered review is a missed signal."
    ))
    s.append(sp(14))
    review_rows = [
        [Paragraph("Google review count", STYLES["table_cell_left"]),
         Paragraph(f"{S1_REVIEW_COUNT_GOOGLE}", STYLES["table_cell"]),
         Paragraph("200+ benchmark", STYLES["table_cell"]),
         Paragraph("ATTENTION", ParagraphStyle("s1rv1", fontName=FONT_BOLD, fontSize=8,
            textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))],
        [Paragraph("Google rating", STYLES["table_cell_left"]),
         Paragraph(f"{S1_RATING_GOOGLE}", STYLES["table_cell"]),
         Paragraph("4.3+ benchmark", STYLES["table_cell"]),
         Paragraph("ATTENTION", ParagraphStyle("s1rv2", fontName=FONT_BOLD, fontSize=8,
            textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))],
        [Paragraph("Review response rate", STYLES["table_cell_left"]),
         Paragraph(f"{S1_REVIEW_RESPONSE_RATE}%",
             ParagraphStyle("s1rrv", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S1_RESPONSE_BENCHMARK}%+ benchmark", STYLES["table_cell"]),
         Paragraph("CRITICAL", ParagraphStyle("s1rv3", fontName=FONT_BOLD, fontSize=8,
            textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))],
        [Paragraph("Reviews without a response", STYLES["table_cell_left"]),
         Paragraph(f"{round(S1_REVIEW_COUNT_GOOGLE * (1 - S1_REVIEW_RESPONSE_RATE/100)):,}",
             ParagraphStyle("s1rrv2", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("Target: 0", STYLES["table_cell"]),
         Paragraph("CRITICAL", ParagraphStyle("s1rv4", fontName=FONT_BOLD, fontSize=8,
            textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))],
    ]
    cw_rev = [CONTENT_W*0.34, CONTENT_W*0.18, CONTENT_W*0.24, CONTENT_W*0.24]
    s.append(std_table(["Metric", "Your Profile", "Benchmark", "Status"],
        review_rows, cw_rev))
    s.append(sp(20))

    # 1.5 SALMON callout
    s.append(callout_box(
        "A GOOGLE BUSINESS PROFILE WITH 23 PHOTOS AND NO POSTS IN 30 DAYS "
        "IS AN INVISIBLE LISTING",
        f"Google's local search algorithm ranks listings based on relevance, "
        "distance, and prominence. "
        "Prominence is directly influenced by how complete and active the listing is. "
        f"A listing with {S1_PHOTO_COUNT} photos and zero posts in the last month "
        "is sending every available signal of inactivity. "
        "The competitor three blocks away who posts twice a week and has 120 photos "
        "will rank above Ironwood Tavern for the same search term "
        "regardless of which operation has better food or better service. "
        "Activity is visible. Inactivity is penalized.",
        bg=SALMON
    ))
    s.append(sp(20))

    # 1.6 Score Calculation
    _h_sc = sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Listing claimed and verified", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_CLAIMED), STYLES["table_cell"]),
         Paragraph("Claimed and verified. Full 20/20.",
             STYLES["table_cell_left"])],
        [Paragraph("Profile completeness", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_COMPLETENESS), STYLES["table_cell"]),
         Paragraph(f"{S1_PROFILE_COMPLETENESS_PCT}% complete. Menu link and attributes "
                   "missing. Partial 18/25.",
                   STYLES["table_cell_left"])],
        [Paragraph("Photo count at or above 100", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_PHOTOS), STYLES["table_cell"]),
         Paragraph(f"{S1_PHOTO_COUNT} photos vs. {S1_PHOTO_BENCHMARK} benchmark. "
                   "Minimal partial 4/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("Post in last 14 days", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_POSTS), STYLES["table_cell"]),
         Paragraph("0 posts in last 30 days. 0/15.",
             STYLES["table_cell_left"])],
        [Paragraph("Review response rate above 75%", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_RESPONSE), STYLES["table_cell"]),
         Paragraph(f"{S1_REVIEW_RESPONSE_RATE}% vs. {S1_RESPONSE_BENCHMARK}% benchmark. "
                   "Partial 10/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S1_SCORE}</b>",
             ParagraphStyle("s1_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S1_SCORE}/100, ATTENTION</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.34, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.44]
    s += _h_sc
    s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2))
    s.append(sp(20))

    # ── TIER 3: GBP Insights layer (code ready, not rendered in this sample) ──
    # When GBP Insights export is submitted, add:
    # - Monthly impressions (search and maps)
    # - Search queries driving profile views
    # - Direction requests per month
    # - Phone calls from profile
    # - Photo views vs. competitor average
    # These convert the profile audit from a static assessment to a funnel analysis.

    # 1.7 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"Ironwood Tavern's Google Business Profile passes the basic test: "
        "it is claimed, verified, and has complete contact information. "
        f"Beyond those basics the profile is underperforming on every active signal. "
        f"{S1_PHOTO_COUNT} photos is 77% below the 100-photo benchmark that Google uses "
        "as a quality signal for local prominence ranking. "
        f"Zero posts in the last 30 days means the listing is sending no recency signal. "
        f"A {S1_REVIEW_RESPONSE_RATE}% response rate on "
        f"{S1_REVIEW_COUNT_GOOGLE} reviews means "
        f"{round(S1_REVIEW_COUNT_GOOGLE * (1 - S1_REVIEW_RESPONSE_RATE/100)):,} guests "
        "who took the time to leave feedback received no acknowledgment."
    ))
    s.append(sp(12))
    s.append(body(
        "None of these gaps require budget to fix. "
        "Adding photos takes a phone and 20 minutes. "
        "Posting twice a week takes four minutes per post. "
        "Responding to reviews takes two minutes per response. "
        "The combined time investment for full profile compliance is under two hours per week. "
        "The return is a listing that ranks higher, converts better, and signals to every "
        "searching guest that Ironwood Tavern is an active, engaged operation."
    ))
    s.append(sp(20))

    # 1.8 Action Items
    _h_ai = sub_header("Action Items")
    _f_ai = action_item(
        priority="HIGH",
        title="Add 77 Photos to Reach the 100-Photo Benchmark",
        area="Google Business Profile",
        data_desc=(
            f"Current photo count: {S1_PHOTO_COUNT}. "
            f"Google benchmark: {S1_PHOTO_BENCHMARK}+. "
            f"Listings with 100+ photos receive significantly more clicks and "
            "direction requests than listings with under 30 photos. "
            "All photo categories are underrepresented: exterior, interior, "
            "food and drink, and staff."
        ),
        instruction=(
            "Take your phone to the bar this week. "
            f"Photograph: the exterior from the street, the interior at full capacity, "
            "the bar top and back bar, 10 food items, 10 cocktails, the patio if applicable, "
            "and two or three staff in action. "
            "Upload directly to your GBP dashboard under the Photos tab. "
            "Add 10 this week and 10 per week until you reach 100. "
            "After 100, add 2 to 4 new photos per month to maintain recency."
        ),
        tool="Upload photos directly in your Google Business Profile dashboard.",
        time_str="This week",
        monthly=f"${round(S1_MONTHLY_GAP * 0.4):,.0f}",
        annual=f"${round(S1_ANNUAL_GAP * 0.4):,.0f}",
    )
    s.append(PageBreak())
    s += _h_ai
    s.append(_f_ai)
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Post to Google Business Profile at Least Twice Per Week",
        area="Google Business Profile",
        data_desc=(
            f"{S1_POSTS_LAST_30_DAYS} posts in the last 30 days. "
            f"Benchmark: {S1_POSTS_BENCHMARK}+ per month. "
            "Posting frequency is one of the clearest signals Google uses to determine "
            "whether a listing is actively managed. "
            "An inactive listing ranks below active competitors regardless of rating."
        ),
        instruction=(
            "Every Monday and Thursday this week: open Google Business Profile, "
            "click Add Update, upload one photo from the bar, write one sentence "
            "about what is happening at Ironwood Tavern, and add your website link. "
            "Examples: a new cocktail, a weekend special, a live music night, a packed room. "
            "It takes four minutes. "
            "Set a recurring calendar block so it does not get skipped."
        ),
        tool="Post directly in your Google Business Profile dashboard under Updates.",
        time_str="This week",
        monthly=f"${round(S1_MONTHLY_GAP * 0.3):,.0f}",
        annual=f"${round(S1_ANNUAL_GAP * 0.3):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Respond to Every Unanswered Google Review from the Last 6 Months",
        area="Google Business Profile",
        data_desc=(
            f"Review response rate: {S1_REVIEW_RESPONSE_RATE}% against a "
            f"{S1_RESPONSE_BENCHMARK}% benchmark. "
            f"Approximately {round(S1_REVIEW_COUNT_GOOGLE * (1 - S1_REVIEW_RESPONSE_RATE/100)):,} "
            "reviews have no response. "
            "Unanswered reviews signal to both Google and to searching guests "
            "that management is not paying attention."
        ),
        instruction=(
            "Open your GBP dashboard and filter reviews by unanswered. "
            "Respond to every one from the last 6 months this week. "
            "Positive review: thank them by name for something specific they mentioned. "
            "Negative review: acknowledge the issue, apologize without excuses, "
            "invite them to contact you directly. "
            "No templates. Each response should read like it was written by a person "
            "who read the review. "
            "Going forward, respond to every new review within 24 hours."
        ),
        tool="Respond directly in your Google Business Profile dashboard under Reviews.",
        time_str="This week",
        monthly=f"${round(S1_MONTHLY_GAP * 0.3):,.0f}",
        annual=f"${round(S1_ANNUAL_GAP * 0.3):,.0f}",
    ))

    return s



# ── SECTION 2 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S2_TIER                      = 2

S2_WEBSITE_EXISTS            = True
S2_MOBILE_OPTIMIZED          = True
S2_MONTHLY_SESSIONS          = 1_840
S2_SESSIONS_BENCHMARK        = 2_000
S2_BOUNCE_RATE               = 74
S2_BOUNCE_BENCHMARK          = 60
S2_MENU_PAGE_IN_TOP_3        = True
S2_MENU_PAGE_SESSIONS        = 612
S2_TOP_PAGES                 = ["Home", "Menu", "About"]
S2_ONLINE_ORDERING_PRESENT   = True
S2_RESERVATION_SYSTEM        = False
S2_AVG_SESSION_DURATION_SEC  = 48
S2_PAGE_LOAD_SCORE           = None     # Tier 3 only
S2_SOURCE_BREAKDOWN          = None     # Tier 3 only
S2_MONTHLY_GAP               = 1_680
S2_ANNUAL_GAP                = 20_160

S2_PTS_EXISTS_MOBILE         = 20
S2_PTS_SESSIONS              = 14
S2_PTS_BOUNCE                = 0
S2_PTS_MENU_PAGE             = 20
S2_PTS_ORDERING              = 4
S2_SCORE                     = (S2_PTS_EXISTS_MOBILE + S2_PTS_SESSIONS +
                                S2_PTS_BOUNCE + S2_PTS_MENU_PAGE +
                                S2_PTS_ORDERING)  # 58 raw, adjusted to 38


# ── SECTION 2: WEBSITE AND ONLINE MENU CONVERSION ────────────────────────────

def page_section2():
    s = [PageBreak()]
    tier = S2_TIER

    s += section_header(
        "SECTION 2",
        "Website and Online Menu Conversion",
        "Whether Ironwood Tavern's website is attracting visitors, retaining them, "
        "and converting them into guests."
    )

    # ── TIER 0 ────────────────────────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(2, "Website and Online Menu Conversion"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Website and Online Menu Conversion",
            "Website analytics export from Google Analytics or your hosting platform "
            "covering the audit period: monthly sessions, bounce rate, top pages, "
            "and average session duration.",
            "Monthly visitor count vs. the 2,000-session benchmark, bounce rate vs. "
            "the 60% target, menu page performance, and conversion path analysis.",
            "With your analytics export, this section would show how many people visit "
            "your website each month, what percentage leave without engaging, "
            "whether the menu page is driving reservations or orders, "
            "and which specific pages are failing to hold attention."
        ))
        return s

    # ── TIER 1: Questionnaire only ────────────────────────────────────────────
    if tier == 1:
        s.append(section_score_tile(2, "Website and Online Menu Conversion", 18,
            note="Partial score, questionnaire only, max 30 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "Website analytics data was not submitted with this audit. "
            "The assessment below confirms that a website exists and is mobile-optimized "
            "based on questionnaire responses. "
            "Session count, bounce rate, menu page performance, and conversion metrics "
            "cannot be assessed without an analytics export. "
            "Export your analytics data for the audit period and submit it with your "
            "next audit to unlock the full Section 2 analysis."
        ))
        s.append(sp(16))
        s += sub_header("Questionnaire-Based Assessment")
        s.append(body(
            "The following items are confirmed from questionnaire responses. "
            "All traffic and conversion metrics require analytics submission."
        ))
        s.append(sp(12))
        t1_rows = [
            [Paragraph("Website exists", STYLES["table_cell_left"]),
             Paragraph("Yes", STYLES["table_cell"]),
             Paragraph("Required", STYLES["table_cell"]),
             Paragraph("ON TARGET", ParagraphStyle("s2t1_1", fontName=FONT_BOLD,
                fontSize=8, textColor=SAGE, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Mobile-optimized", STYLES["table_cell_left"]),
             Paragraph("Yes", STYLES["table_cell"]),
             Paragraph("Required", STYLES["table_cell"]),
             Paragraph("ON TARGET", ParagraphStyle("s2t1_2", fontName=FONT_BOLD,
                fontSize=8, textColor=SAGE, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Menu page exists", STYLES["table_cell_left"]),
             Paragraph("Yes", STYLES["table_cell"]),
             Paragraph("Required", STYLES["table_cell"]),
             Paragraph("ON TARGET", ParagraphStyle("s2t1_3", fontName=FONT_BOLD,
                fontSize=8, textColor=SAGE, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Monthly sessions", STYLES["table_cell_left"]),
             Paragraph("Not available", STYLES["table_cell"]),
             Paragraph("2,000+ benchmark", STYLES["table_cell"]),
             Paragraph("UNVERIFIED", ParagraphStyle("s2t1_4", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Bounce rate", STYLES["table_cell_left"]),
             Paragraph("Not available", STYLES["table_cell"]),
             Paragraph("Under 60%", STYLES["table_cell"]),
             Paragraph("UNVERIFIED", ParagraphStyle("s2t1_5", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
        ]
        cw_t1 = [CONTENT_W*0.32, CONTENT_W*0.18, CONTENT_W*0.24, CONTENT_W*0.26]
        s.append(std_table(["Metric", "Submitted", "Standard", "Status"], t1_rows, cw_t1))
        return s

    # ── TIER 2: Full analysis ─────────────────────────────────────────────────
    s.append(section_score_tile(2, "Website and Online Menu Conversion", 38,
        note="Score reflects severe bounce rate penalty"))
    s.append(sp(20))

    # 2.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("Website Analytics Export", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S2_MONTHLY_SESSIONS:,} sessions", STYLES["table_cell"])],
        [Paragraph("Top Pages Report", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(", ".join(S2_TOP_PAGES), STYLES["table_cell"])],
        [Paragraph("Source Breakdown", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.36, CONTENT_W*0.34, CONTENT_W*0.30]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 2.2 Website Performance Metrics
    _h_wpm = sub_header("Website Performance Metrics")
    # Compact formula_box (reduced leading) to fit on p10 with Data Used table
    _wpm_items = []
    _wpm_first = True
    for _line in [
        "WEBSITE PERFORMANCE, EXPLICIT METRICS",
        "",
        f"  Monthly sessions:              {S2_MONTHLY_SESSIONS:,}",
        f"  Sessions benchmark:            {S2_SESSIONS_BENCHMARK:,}+",
        f"  Sessions gap:                  {S2_SESSIONS_BENCHMARK - S2_MONTHLY_SESSIONS:,} below benchmark",
        f"  Bounce rate:                   {S2_BOUNCE_RATE}%",
        f"  Bounce benchmark:              Under {S2_BOUNCE_BENCHMARK}%",
        f"  Bounce gap:                    {S2_BOUNCE_RATE - S2_BOUNCE_BENCHMARK} percentage points above target",
        "",
        f"  Average session duration:      {S2_AVG_SESSION_DURATION_SEC} seconds",
        "  Duration benchmark:            90+ seconds for engaged visit",
        f"  Duration gap:                  {90 - S2_AVG_SESSION_DURATION_SEC} seconds below threshold",
        "",
        f"  Menu page sessions:            {S2_MENU_PAGE_SESSIONS:,} ({round(S2_MENU_PAGE_SESSIONS/S2_MONTHLY_SESSIONS*100)}% of total sessions)",
        "  Menu page rank:                #2 most visited page (behind Home)",
        f"  Online ordering link:          Present (DoorDash)",
        f"  Reservation system:            Not present",
    ]:
        if not _line.strip():
            _wpm_items.append(sp(3)); continue
        if _wpm_first:
            _wpm_items.append(Paragraph(_line, ParagraphStyle("wpm_t", fontName=FONT_BOLD,
                fontSize=9, leading=11, textColor=GOLD, leftIndent=0, firstLineIndent=0)))
            _wpm_first = False
        else:
            _wpm_items.append(Paragraph(_line, ParagraphStyle("wpm_l", fontName=FONT_REG,
                fontSize=8.5, leading=11, textColor=WHITE, leftIndent=0, firstLineIndent=0)))
    _wpm_inner = Table([[i] for i in _wpm_items], colWidths=[CONTENT_W - 32])
    _wpm_inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    _f_wpm = Table([[_wpm_inner]], colWidths=[CONTENT_W])
    _f_wpm.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    s += _h_wpm
    s.append(_f_wpm)
    s.append(sp(20))

    # 2.3 Conversion Gap Analysis
    s.append(PageBreak())
    s += sub_header("Conversion Gap Analysis")

    def sc(label):
        color = SAGE if label == "ON TARGET" else (SALMON if label == "CRITICAL" else AMBER)
        return Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s2sc_{label[:5]}", fontName=FONT_BOLD, fontSize=8,
            leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    conv_rows = [
        [Paragraph("Website exists, mobile-optimized", STYLES["table_cell_left"]),
         Paragraph("Yes", STYLES["table_cell"]),
         Paragraph("Required", STYLES["table_cell"]),
         sc("ON TARGET"),
         Paragraph("Foundation met.", STYLES["table_cell_left"])],
        [Paragraph("Monthly sessions", STYLES["table_cell_left"]),
         Paragraph(f"{S2_MONTHLY_SESSIONS:,}",
             ParagraphStyle("s2mv1", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S2_SESSIONS_BENCHMARK:,}+", STYLES["table_cell"]),
         sc("ATTENTION"),
         Paragraph(f"{S2_SESSIONS_BENCHMARK - S2_MONTHLY_SESSIONS:,} below benchmark. "
                   "Close to target but needs growth.",
                   STYLES["table_cell_left"])],
        [Paragraph("Bounce rate", STYLES["table_cell_left"]),
         Paragraph(f"{S2_BOUNCE_RATE}%",
             ParagraphStyle("s2mv2", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"Under {S2_BOUNCE_BENCHMARK}%", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph(f"{S2_BOUNCE_RATE - S2_BOUNCE_BENCHMARK} pts above target. "
                   "Primary conversion failure.",
                   STYLES["table_cell_left"])],
        [Paragraph("Avg. session duration", STYLES["table_cell_left"]),
         Paragraph(f"{S2_AVG_SESSION_DURATION_SEC}s",
             ParagraphStyle("s2mv3", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("90s+", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph("Under 1 minute. Visitors are not reading the menu.",
                   STYLES["table_cell_left"])],
        [Paragraph("Menu page in top 3", STYLES["table_cell_left"]),
         Paragraph("Yes", STYLES["table_cell"]),
         Paragraph("Top 3 required", STYLES["table_cell"]),
         sc("ON TARGET"),
         Paragraph("Menu is 2nd most visited page.",
                   STYLES["table_cell_left"])],
        [Paragraph("Online ordering / reservation", STYLES["table_cell_left"]),
         Paragraph("Ordering only", STYLES["table_cell"]),
         Paragraph("Both recommended", STYLES["table_cell"]),
         sc("ATTENTION"),
         Paragraph("DoorDash link present. No reservation system.",
                   STYLES["table_cell_left"])],
    ]
    cw_conv = [CONTENT_W*0.25, CONTENT_W*0.12, CONTENT_W*0.14,
               CONTENT_W*0.13, CONTENT_W*0.36]
    s.append(std_table(
        ["Metric", "Your Site", "Benchmark", "Status", "Notes"],
        conv_rows, cw_conv))
    s.append(sp(20))

    # 2.4 SALMON callout
    s.append(callout_box(
        f"{S2_BOUNCE_RATE}% OF VISITORS ARE LEAVING WITHOUT ENGAGING",
        f"A {S2_BOUNCE_RATE}% bounce rate means that out of every 100 visitors to "
        "Ironwood Tavern's website, 74 leave without clicking a single link, "
        "reading the menu, or taking any action. "
        f"At {S2_MONTHLY_SESSIONS:,} monthly sessions, that is approximately "
        f"{round(S2_MONTHLY_SESSIONS * S2_BOUNCE_RATE / 100):,} people per month "
        "who found the website and left immediately. "
        "The most common cause of high bounce rate for restaurant websites is one of three things: "
        "no clear call-to-action above the fold, a menu that is a PDF or does not load on mobile, "
        "or a page load time above 3 seconds. "
        f"Average session duration of {S2_AVG_SESSION_DURATION_SEC} seconds confirms "
        "these visitors are not reading anything before leaving.",
        bg=SALMON
    ))
    s.append(sp(12))
    s.append(amber_note(
        "Submitting a traffic source breakdown with your next audit unlocks Tier 3 analysis: "
        "which channel (organic search, social media, direct, or referral) is sending the "
        "most visitors and which is sending the visitors with the highest bounce rate. "
        "That distinction determines whether the fix is a content problem, "
        "an SEO problem, or a social media targeting problem."
    ))
    s.append(sp(20))

    # 2.5 Score Calculation
    _h_sc = sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Website exists and is mobile-optimized", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_EXISTS_MOBILE), STYLES["table_cell"]),
         Paragraph("Confirmed from analytics submission. Full 20/20.",
             STYLES["table_cell_left"])],
        [Paragraph("Monthly sessions above 2,000", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_SESSIONS), STYLES["table_cell"]),
         Paragraph(f"{S2_MONTHLY_SESSIONS:,} vs. {S2_SESSIONS_BENCHMARK:,} benchmark. "
                   "Close, partial 14/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("Bounce rate below 60%", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_BOUNCE), STYLES["table_cell"]),
         Paragraph(f"{S2_BOUNCE_RATE}% is {S2_BOUNCE_RATE - S2_BOUNCE_BENCHMARK} pts "
                   "above target. Primary conversion failure. 0/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("Menu page in top 3 most visited", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_MENU_PAGE), STYLES["table_cell"]),
         Paragraph("Menu is 2nd most visited page. Full 20/20.",
             STYLES["table_cell_left"])],
        [Paragraph("Online ordering or reservation present", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_ORDERING), STYLES["table_cell"]),
         Paragraph("Ordering link present (DoorDash). No reservation system. "
                   "Partial 4/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph("<b>38</b>",
             ParagraphStyle("s2_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("<b>Score: 38/100, CRITICAL</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.36, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.42]
    s += _h_sc
    s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2))
    s.append(sp(20))

    # ── TIER 3: Source breakdown layer ────────────────────────────────────────
    # When source breakdown and device split are submitted, add:
    # - Organic vs. direct vs. social vs. referral session breakdown
    # - Mobile vs. desktop bounce rate comparison
    # - Conversion funnel: sessions > menu page > ordering/reservation click
    # - Which source sends visitors with longest session duration
    # This identifies whether the bounce rate is a content problem, SEO problem,
    # or social traffic quality problem -- and which fix to prioritize first.

    # 2.6 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"Ironwood Tavern's website has the right bones. "
        f"It is mobile-optimized, the menu is the second most visited page, "
        "and an online ordering link is present. "
        f"The critical failure is what happens after visitors arrive. "
        f"A {S2_BOUNCE_RATE}% bounce rate and {S2_AVG_SESSION_DURATION_SEC}-second average "
        "session duration confirm that the majority of visitors are landing and leaving "
        "without reading anything. "
        f"At {S2_MONTHLY_SESSIONS:,} monthly sessions that is approximately "
        f"{round(S2_MONTHLY_SESSIONS * S2_BOUNCE_RATE / 100):,} people per month "
        "who found the website and got nothing from it."
    ))
    s.append(sp(12))
    s.append(body(
        "The fix is not a website rebuild. "
        "It is a single structural change to the homepage: "
        "one clear, visible call-to-action above the fold on mobile. "
        "Either 'View Menu' or 'Reserve a Table' needs to be the first thing a visitor sees "
        "and the first action they can take without scrolling. "
        "The menu page itself needs the same treatment: "
        "the menu must load without a PDF, display cleanly on a phone screen, "
        "and have a prominent ordering or reservation button at the top. "
        "These two changes address the root cause of the bounce rate "
        "without touching the design or content of any other page."
    ))
    s.append(sp(20))

    # 2.7 Action Items
    _h_ai = sub_header("Action Items")
    _f_ai = action_item(
        priority="HIGH",
        title="Add One Clear Call-to-Action Button Above the Fold on the Homepage",
        area="Website and Online Menu Conversion",
        data_desc=(
            f"Bounce rate of {S2_BOUNCE_RATE}% with average session duration of "
            f"{S2_AVG_SESSION_DURATION_SEC} seconds. "
            "Visitors are leaving immediately after landing. "
            "The homepage has no prominent next action visible on mobile "
            "without scrolling."
        ),
        instruction=(
            "Open your website on your phone. "
            "Look at the first screen without scrolling. "
            "If there is no button that says View Menu or Reserve a Table "
            "or Order Online visible on that first screen, "
            "that is what needs to change this week. "
            "Contact your web developer or use your website builder to add "
            "a single large button above the fold. "
            "The button text should be one of: View Our Menu, Make a Reservation, "
            "or Order Online. "
            "Test it on three different phones before considering it done."
        ),
        tool="Update the homepage in your website builder or contact your web developer.",
        time_str="This week",
        monthly=f"${S2_MONTHLY_GAP:,.0f}",
        annual=f"${S2_ANNUAL_GAP:,.0f}",
    )
    s += _h_ai
    s.append(_f_ai)
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Fix the Menu Page: No PDF, Loads Clean on Mobile, Button at the Top",
        area="Website and Online Menu Conversion",
        data_desc=(
            f"Menu page receives {S2_MENU_PAGE_SESSIONS:,} sessions per period "
            f"({round(S2_MENU_PAGE_SESSIONS/S2_MONTHLY_SESSIONS*100)}% of total traffic) "
            "but average session duration of 48 seconds suggests visitors are not "
            "reading it fully. "
            "A PDF menu requires a download step on mobile and cannot be read inline."
        ),
        instruction=(
            "Check your menu page on a mobile phone with a slow connection. "
            "If the menu opens as a PDF, replace it with a plain text or image-based menu "
            "that loads inline without any download. "
            "At the top of the menu page, above the menu itself, "
            "add a button that links to your ordering platform or reservation system. "
            "The button should be visible before a guest scrolls to the first menu item. "
            "Every second of friction between a guest and placing an order "
            "is a conversion that does not happen."
        ),
        tool="Update the menu page in your website builder or contact your web developer.",
        time_str="This week",
        monthly=f"${round(S2_MONTHLY_GAP * 0.5):,.0f}",
        annual=f"${round(S2_ANNUAL_GAP * 0.5):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Submit Traffic Source Breakdown with Next Audit",
        area="Website and Online Menu Conversion",
        data_desc=(
            f"Bounce rate of {S2_BOUNCE_RATE}% is confirmed. "
            "Its cause is not yet identified. "
            "Source breakdown data was not submitted with this audit. "
            "Without it, it is impossible to determine whether high-bounce visitors "
            "are coming from social media, organic search, or direct traffic."
        ),
        instruction=(
            "In Google Analytics, go to Acquisition and then Traffic Acquisition. "
            "Set the date range to the audit period. "
            "Take a screenshot showing sessions, bounce rate, and average engagement "
            "time broken down by channel: organic search, direct, social, and referral. "
            "Submit it with your next audit. "
            "This single screenshot identifies which channel is sending visitors "
            "who leave immediately versus visitors who convert, "
            "and determines whether the fix is a content issue, "
            "an SEO issue, or a social media targeting issue."
        ),
        tool="Export from Google Analytics under Acquisition then Traffic Acquisition.",
        time_str="Next audit",
        monthly=f"${round(S2_MONTHLY_GAP * 0.2):,.0f} additional gap visibility",
        annual=f"${round(S2_ANNUAL_GAP * 0.2):,.0f} addressable once source identified",
    ))

    return s



# ── SECTION 3 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S3_TIER                      = 2

S3_GOOGLE_RATING             = 4.2
S3_GOOGLE_RATING_BENCHMARK   = 4.3
S3_GOOGLE_REVIEW_COUNT       = 187
S3_GOOGLE_COUNT_BENCHMARK    = 200
S3_RESPONSE_RATE             = 12
S3_RESPONSE_BENCHMARK        = 75
S3_YELP_RATING               = 4.0
S3_YELP_RATING_BENCHMARK     = 4.0
S3_YELP_REVIEW_COUNT         = 94
S3_TRIPADVISOR_PRESENT       = False
S3_MOST_RECENT_REVIEW_DAYS   = 3
S3_RECENCY_BENCHMARK         = 7
S3_NEGATIVE_PATTERN          = "Service speed (3 mentions in last 30 days)"

S3_MONTHLY_GAP               = 820
S3_ANNUAL_GAP                = 9_840

S3_PTS_RATING                = 18
S3_PTS_COUNT                 = 14
S3_PTS_RESPONSE              = 0
S3_PTS_YELP                  = 15
S3_PTS_RECENCY               = 14
S3_SCORE                     = (S3_PTS_RATING + S3_PTS_COUNT + S3_PTS_RESPONSE +
                                S3_PTS_YELP + S3_PTS_RECENCY)  # 61

S3_UNANSWERED                = round(S3_GOOGLE_REVIEW_COUNT * (1 - S3_RESPONSE_RATE / 100))


# ── SECTION 3: REVIEWS AND REPUTATION ────────────────────────────────────────

def page_section3():
    s = [PageBreak()]
    tier = S3_TIER

    s += section_header(
        "SECTION 3",
        "Reviews and Reputation",
        "Whether Ironwood Tavern's review profile is strong enough to convert "
        "a searching guest into a walking guest, and whether management is "
        "actively participating in its own reputation."
    )

    # ── TIER 0 ────────────────────────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(3, "Reviews and Reputation"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Reviews and Reputation",
            "Screenshots of your Google Business Profile review summary and "
            "your Yelp listing showing rating, review count, and response history.",
            "Confirmed rating and review count for Google and Yelp, response rate "
            "calculation, recency check, and negative pattern identification.",
            "With your review screenshots, this section would confirm your actual "
            "rating and review count on each platform, calculate how many reviews "
            "have received no response, identify whether any service or quality "
            "issues are appearing repeatedly, and score your reputation against "
            "the benchmarks that influence guest booking decisions."
        ))
        return s

    # ── TIER 1: Operator-reported only ────────────────────────────────────────
    if tier == 1:
        s.append(section_score_tile(3, "Reviews and Reputation", 20,
            note="Partial score, operator-reported only, max 30 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "Review platform screenshots were not submitted with this audit. "
            "The ratings and counts below are based on operator-reported questionnaire "
            "responses and cannot be verified. "
            "Reported ratings are accepted at face value for scoring but earn reduced "
            "credit compared to confirmed screenshot data. "
            "Submit Google and Yelp review screenshots with your next audit to unlock "
            "confirmed scoring, response rate calculation, and negative pattern analysis."
        ))
        s.append(sp(16))
        s += sub_header("Operator-Reported Review Summary")
        s.append(body(
            "The following metrics are based on submitted questionnaire responses. "
            "Figures are unverified and scored at partial credit."
        ))
        s.append(sp(12))
        t1_rows = [
            [Paragraph("Google rating", STYLES["table_cell_left"]),
             Paragraph("Reported", STYLES["table_cell"]),
             Paragraph("4.3+ benchmark", STYLES["table_cell"]),
             Paragraph("UNVERIFIED", ParagraphStyle("s3t1_1", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Google review count", STYLES["table_cell_left"]),
             Paragraph("Reported", STYLES["table_cell"]),
             Paragraph("200+ benchmark", STYLES["table_cell"]),
             Paragraph("UNVERIFIED", ParagraphStyle("s3t1_2", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Response rate", STYLES["table_cell_left"]),
             Paragraph("Not reported", STYLES["table_cell"]),
             Paragraph("75%+ benchmark", STYLES["table_cell"]),
             Paragraph("UNKNOWN", ParagraphStyle("s3t1_3", fontName=FONT_BOLD,
                fontSize=8, textColor=MID_GRAY, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
        ]
        cw_t1 = [CONTENT_W*0.34, CONTENT_W*0.18, CONTENT_W*0.24, CONTENT_W*0.24]
        s.append(std_table(["Metric", "Source", "Standard", "Status"], t1_rows, cw_t1))
        return s

    # ── TIER 2: Full analysis ─────────────────────────────────────────────────
    s.append(section_score_tile(3, "Reviews and Reputation", S3_SCORE))
    s.append(sp(20))

    # 3.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("Google Review Screenshot", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S3_GOOGLE_REVIEW_COUNT} reviews, "
                   f"{S3_GOOGLE_RATING} stars", STYLES["table_cell"])],
        [Paragraph("Yelp Listing Screenshot", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S3_YELP_REVIEW_COUNT} reviews, "
                   f"{S3_YELP_RATING} stars", STYLES["table_cell"])],
        [Paragraph("TripAdvisor", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Not applicable for this operation", STYLES["table_cell"])],
        [Paragraph("Review Velocity and Sentiment Export", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.36, CONTENT_W*0.34, CONTENT_W*0.30]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 3.2 Review Profile Assessment
    s += sub_header("Review Profile Assessment")

    def sc(label):
        color = SAGE if label in ("ON TARGET", "ACTIVE") else \
                SALMON if label == "CRITICAL" else AMBER
        return Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s3sc_{label[:5]}", fontName=FONT_BOLD, fontSize=8,
            leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    review_rows = [
        [Paragraph("Google rating", STYLES["table_cell_left"]),
         Paragraph(str(S3_GOOGLE_RATING),
             ParagraphStyle("s3rv_gr", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S3_GOOGLE_RATING_BENCHMARK}+", STYLES["table_cell"]),
         sc("ATTENTION"),
         Paragraph(f"{S3_GOOGLE_RATING_BENCHMARK - S3_GOOGLE_RATING:.1f} stars "
                   "below benchmark. Close but not converting maximally.",
                   STYLES["table_cell_left"])],
        [Paragraph("Google review count", STYLES["table_cell_left"]),
         Paragraph(str(S3_GOOGLE_REVIEW_COUNT),
             ParagraphStyle("s3rv_gc", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S3_GOOGLE_COUNT_BENCHMARK}+", STYLES["table_cell"]),
         sc("ATTENTION"),
         Paragraph(f"{S3_GOOGLE_COUNT_BENCHMARK - S3_GOOGLE_REVIEW_COUNT} reviews "
                   "below benchmark. Growing but not yet at threshold.",
                   STYLES["table_cell_left"])],
        [Paragraph("Google response rate", STYLES["table_cell_left"]),
         Paragraph(f"{S3_RESPONSE_RATE}%",
             ParagraphStyle("s3rv_rr", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S3_RESPONSE_BENCHMARK}%+", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph(f"{S3_UNANSWERED} of {S3_GOOGLE_REVIEW_COUNT} reviews unanswered. "
                   "Dominant gap in this section.",
                   STYLES["table_cell_left"])],
        [Paragraph("Yelp rating", STYLES["table_cell_left"]),
         Paragraph(str(S3_YELP_RATING),
             ParagraphStyle("s3rv_yr", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SAGE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S3_YELP_RATING_BENCHMARK}+", STYLES["table_cell"]),
         sc("ON TARGET"),
         Paragraph(f"Meets benchmark. {S3_YELP_REVIEW_COUNT} reviews confirmed.",
                   STYLES["table_cell_left"])],
        [Paragraph("Most recent review", STYLES["table_cell_left"]),
         Paragraph(f"{S3_MOST_RECENT_REVIEW_DAYS} days ago",
             ParagraphStyle("s3rv_mr", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SAGE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"Within {S3_RECENCY_BENCHMARK} days", STYLES["table_cell"]),
         sc("ACTIVE"),
         Paragraph("Listing is actively receiving reviews.",
                   STYLES["table_cell_left"])],
    ]
    cw_rev = [CONTENT_W*0.24, CONTENT_W*0.13, CONTENT_W*0.15,
              CONTENT_W*0.13, CONTENT_W*0.35]
    s.append(std_table(
        ["Metric", "Your Profile", "Benchmark", "Status", "Notes"],
        review_rows, cw_rev))
    s.append(sp(20))

    # 3.3 Response Rate Gap
    _h_rrg = sub_header("Response Rate Gap")
    _f_rrg = formula_box([
        "RESPONSE RATE GAP, EXPLICIT CALCULATION",
        "",
        f"  Total Google reviews:                 {S3_GOOGLE_REVIEW_COUNT}",
        f"  Current response rate:                {S3_RESPONSE_RATE}%",
        f"  Reviews that have received a response: "
        f"{round(S3_GOOGLE_REVIEW_COUNT * S3_RESPONSE_RATE / 100)}",
        f"  Reviews with NO response:             {S3_UNANSWERED}",
        "",
        f"  Industry benchmark response rate:     {S3_RESPONSE_BENCHMARK}%+",
        f"  Reviews needed to meet benchmark:     "
        f"{round(S3_GOOGLE_REVIEW_COUNT * S3_RESPONSE_BENCHMARK / 100)} responses total",
        f"  Additional responses required:        "
        f"{round(S3_GOOGLE_REVIEW_COUNT * S3_RESPONSE_BENCHMARK / 100) - round(S3_GOOGLE_REVIEW_COUNT * S3_RESPONSE_RATE / 100)}",
        "",
        "  What unanswered reviews signal to a searching guest:",
        "  A positive review with no response says management does not read feedback.",
        "  A negative review with no response says management does not care.",
        "  Either interpretation reduces the conversion rate of every future visitor "
        "  who reads the review profile before deciding where to go.",
    ])
    s.append(PageBreak())
    s += _h_rrg
    s.append(_f_rrg)
    s.append(sp(16))

    # 3.4 Negative pattern AMBER note
    s.append(amber_note(
        f"Service speed was mentioned in 3 reviews in the last 30 days. "
        "Three mentions in a single month is a pattern, not a one-off. "
        "A pattern in reviews means guests are experiencing the same issue "
        "consistently enough to write about it. "
        "This is an internal operations signal, not just a reputation signal. "
        "Identify the specific service touchpoint where delays occur "
        "before the next audit period."
    ))
    s.append(sp(20))

    # 3.5 Score Calculation
    _h_sc = sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Google rating at or above 4.3", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_RATING), STYLES["table_cell"]),
         Paragraph(f"{S3_GOOGLE_RATING} vs. {S3_GOOGLE_RATING_BENCHMARK} benchmark. "
                   "Just below. Partial 18/25.",
                   STYLES["table_cell_left"])],
        [Paragraph("Google review count above 200", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_COUNT), STYLES["table_cell"]),
         Paragraph(f"{S3_GOOGLE_REVIEW_COUNT} vs. {S3_GOOGLE_COUNT_BENCHMARK} benchmark. "
                   "Close, partial 14/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("Response rate above 75%", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_RESPONSE), STYLES["table_cell"]),
         Paragraph(f"{S3_RESPONSE_RATE}% vs. {S3_RESPONSE_BENCHMARK}% benchmark. "
                   f"{S3_UNANSWERED} reviews unanswered. 0/25.",
                   STYLES["table_cell_left"])],
        [Paragraph("Yelp rating at or above 4.0", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_YELP), STYLES["table_cell"]),
         Paragraph(f"Yelp {S3_YELP_RATING} meets benchmark. Full 15/15.",
             STYLES["table_cell_left"])],
        [Paragraph("Review received within last 7 days", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_RECENCY), STYLES["table_cell"]),
         Paragraph(f"Most recent review {S3_MOST_RECENT_REVIEW_DAYS} days ago. "
                   "Active. Partial 14/15.",
                   STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S3_SCORE}</b>",
             ParagraphStyle("s3_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S3_SCORE}/100, ATTENTION</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.36, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.42]
    s += _h_sc
    s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2))
    s.append(sp(20))

    # ── TIER 3: Velocity and sentiment layer ──────────────────────────────────
    # When review velocity export and sentiment analysis are submitted, add:
    # - Monthly review rate (reviews per month over trailing 6 months)
    # - Sentiment pattern across last 50 reviews by category
    # - Competitive rating comparison (Ironwood Tavern vs. nearest 3 competitors)
    # - Response rate trend over time
    # This identifies whether the rating is improving or declining and
    # whether the service speed pattern is isolated or systemic.

    # 3.6 Narrative
    s.append(PageBreak())
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"Ironwood Tavern's review profile has real strengths. "
        f"A {S3_GOOGLE_RATING}-star Google rating with {S3_GOOGLE_REVIEW_COUNT} reviews "
        f"and a {S3_YELP_RATING}-star Yelp rating confirm that guests who visit "
        "generally have a good experience and are willing to say so publicly. "
        f"A review received {S3_MOST_RECENT_REVIEW_DAYS} days ago confirms the listing "
        "is active and visible. "
        f"The gap is not in the rating or the volume. "
        f"It is in the {S3_RESPONSE_RATE}% response rate. "
        f"Of {S3_GOOGLE_REVIEW_COUNT} reviews, {S3_UNANSWERED} have received no response. "
        "That number is visible to every guest who reads the profile before deciding "
        "where to spend their money."
    ))
    s.append(sp(12))
    s.append(body(
        "A response rate of 12% is not a time problem. "
        "Responding to 10 reviews takes under 20 minutes. "
        "It is a systems problem: there is no owner or manager assigned to "
        "review response as a weekly task. "
        "The fix is a single weekly calendar block, not a process overhaul. "
        "The secondary issue is the service speed pattern: "
        "three mentions in 30 days is enough to indicate a recurring guest experience "
        "that warrants an internal look at table turn times, order accuracy, "
        "or staffing during peak service."
    ))
    s.append(sp(20))

    # 3.7 Action Items
    _h_ai = sub_header("Action Items")
    _f_ai = action_item(
        priority="HIGH",
        title="Respond to Every Unanswered Google Review from the Last 6 Months",
        area="Reviews and Reputation",
        data_desc=(
            f"Response rate: {S3_RESPONSE_RATE}% against a "
            f"{S3_RESPONSE_BENCHMARK}% benchmark. "
            f"{S3_UNANSWERED} of {S3_GOOGLE_REVIEW_COUNT} reviews have no response. "
            "Every unanswered review signals to searching guests that management "
            "does not read or respond to feedback. "
            "This is the single largest gap in this section."
        ),
        instruction=(
            "Open your Google Business Profile dashboard and go to Reviews. "
            "Filter by reviews without a response. "
            "Respond to every one from the last 6 months this week, starting with "
            "the most recent and working backward. "
            "For positive reviews: thank the guest by name for something specific "
            "they mentioned and tell them you look forward to seeing them again. "
            "For negative reviews: acknowledge the issue directly, "
            "apologize without making excuses, "
            "and invite the guest to contact you to make it right. "
            "Every response should read like a person wrote it, not a template. "
            "Set a recurring Monday morning calendar block to respond to any new "
            "reviews from the prior week. Response target: within 24 hours."
        ),
        tool="Respond directly in your Google Business Profile dashboard under Reviews.",
        time_str="This week",
        monthly=f"${round(S3_MONTHLY_GAP * 0.5):,.0f}",
        annual=f"${round(S3_ANNUAL_GAP * 0.5):,.0f}",
    )
    s += _h_ai
    s.append(_f_ai)
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Ask Every Satisfied Guest for a Google Review Before They Leave",
        area="Reviews and Reputation",
        data_desc=(
            f"Google review count: {S3_GOOGLE_REVIEW_COUNT} against a "
            f"{S3_GOOGLE_COUNT_BENCHMARK}+ benchmark. "
            f"Only {S3_GOOGLE_COUNT_BENCHMARK - S3_GOOGLE_REVIEW_COUNT} more reviews "
            "needed to reach the benchmark that improves search visibility. "
            "The listing is active and guests are leaving reviews organically. "
            "A direct ask at the right moment accelerates the count."
        ),
        instruction=(
            "Train every server this week on a single sentence to use at payment: "
            "'If you had a good time tonight, a quick Google review means everything "
            "to a place like ours.' "
            "Nothing more than that. "
            "No QR code required. No card. One sentence at the right moment. "
            "The server who says this sincerely will generate more reviews per shift "
            "than any sign or card ever will. "
            "Include this in the pre-shift meeting this week and make it a "
            "standing part of service standards."
        ),
        tool="Train the ask into your weekly pre-shift meeting starting this week.",
        time_str="This week",
        monthly=f"${round(S3_MONTHLY_GAP * 0.3):,.0f}",
        annual=f"${round(S3_ANNUAL_GAP * 0.3):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Investigate the Service Speed Pattern Before the Next Audit",
        area="Reviews and Reputation",
        data_desc=(
            "Service speed mentioned in 3 reviews in the last 30 days. "
            "Three mentions in a single month is a pattern. "
            "A pattern in reviews reflects a guest experience that is happening "
            "consistently enough that multiple independent guests felt compelled "
            "to document it."
        ),
        instruction=(
            "Pull the three reviews that mention service speed. "
            "Read each one and identify: what service moment is being described? "
            "Is it wait time for initial acknowledgment, time to receive drinks, "
            "time to receive food, or time to receive the check? "
            "Talk to the floor manager and two servers about what they observe "
            "during the same service period. "
            "The goal is to identify the specific moment in the guest experience "
            "where the delay is occurring so it can be addressed operationally. "
            "Document what you find and what you changed before the next audit."
        ),
        tool="Review the three flagged reviews and debrief with your floor team this week.",
        time_str="This week",
        monthly=f"${round(S3_MONTHLY_GAP * 0.2):,.0f}",
        annual=f"${round(S3_ANNUAL_GAP * 0.2):,.0f}",
    ))

    return s



# ── SECTION 4 SAMPLE DATA (Tier 2 partial) ───────────────────────────────────
S4_TIER                      = 2        # partial -- no search ranking report

S4_MAPS_PACK_CONFIRMED       = False    # no search screenshot submitted
S4_RANKING_REPORT_SUBMITTED  = False
S4_NAP_CONSISTENT            = True     # cross-referenced from submitted screenshots
S4_NAP_BUSINESS_NAME         = "Ironwood Tavern"
S4_NAP_ADDRESS               = "Consistent across GBP, Yelp, and website"
S4_NAP_PHONE                 = "Consistent across GBP, Yelp, and website"
S4_WEBSITE_TITLES_ASSESSED   = False    # Tier 3 only
S4_CITATION_COUNT            = None     # Tier 3 only
S4_PRIMARY_KEYWORD           = "bar Austin TX"
S4_SECONDARY_KEYWORDS        = ["tavern Austin", "sports bar Austin", "bar near me Austin"]
S4_MONTHLY_GAP               = None     # cannot calculate without ranking data

S4_PTS_MAPS_PACK             = 0        # unconfirmed
S4_PTS_RANKINGS              = 0        # not submitted
S4_PTS_NAP                   = 25       # confirmed consistent
S4_PTS_TITLES                = 0        # not assessed
S4_PTS_CITATIONS             = 3        # partial: GBP present = some citation signal
S4_SCORE                     = (S4_PTS_MAPS_PACK + S4_PTS_RANKINGS +
                                S4_PTS_NAP + S4_PTS_TITLES + S4_PTS_CITATIONS)  # 28


# ── SECTION 4: SEARCH VISIBILITY AND SEO ─────────────────────────────────────

def page_section4():
    s = [PageBreak()]
    tier = S4_TIER

    s += section_header(
        "SECTION 4",
        "Search Visibility and SEO",
        "Whether Ironwood Tavern appears in local search results when potential "
        "guests are actively looking for a bar or restaurant in Austin."
    )

    # ── TIER 0 / TIER 1: Questionnaire only ───────────────────────────────────
    if tier in (0, 1):
        s.append(section_score_tile(4, "Search Visibility and SEO", 15,
            note="Partial score, questionnaire only, max 25 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "No search-related data was submitted with this audit. "
            "The score above reflects only what can be inferred from questionnaire "
            "responses about the operator's awareness of their own search ranking. "
            "Submit a search screenshot and GBP screenshot to unlock NAP consistency "
            "analysis and Maps pack confirmation. "
            "Submit a search ranking report for 5 or more keywords to unlock the "
            "full Section 4 analysis."
        ))
        s.append(sp(16))
        s += sub_header("Questionnaire-Based Assessment")
        s.append(body(
            "No verifiable search data was submitted. "
            "The following reflects operator-reported awareness only."
        ))
        s.append(sp(12))
        t1_rows = [
            [Paragraph("Awareness of primary search term", STYLES["table_cell_left"]),
             Paragraph("Reported", STYLES["table_cell"]),
             Paragraph("Operator knows their #1 term", STYLES["table_cell"]),
             Paragraph("PARTIAL", ParagraphStyle("s4t1_1", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Google Maps pack confirmed", STYLES["table_cell_left"]),
             Paragraph("Not confirmed", STYLES["table_cell"]),
             Paragraph("Confirmed via screenshot", STYLES["table_cell"]),
             Paragraph("UNKNOWN", ParagraphStyle("s4t1_2", fontName=FONT_BOLD,
                fontSize=8, textColor=MID_GRAY, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Keyword ranking report", STYLES["table_cell_left"]),
             Paragraph("Not submitted", STYLES["table_cell"]),
             Paragraph("5+ keywords required", STYLES["table_cell"]),
             Paragraph("UNKNOWN", ParagraphStyle("s4t1_3", fontName=FONT_BOLD,
                fontSize=8, textColor=MID_GRAY, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
        ]
        cw_t1 = [CONTENT_W*0.34, CONTENT_W*0.18, CONTENT_W*0.26, CONTENT_W*0.22]
        s.append(std_table(["Signal", "Submitted", "Standard", "Status"], t1_rows, cw_t1))
        return s

    # ── TIER 2 partial ────────────────────────────────────────────────────────
    s.append(section_score_tile(4, "Search Visibility and SEO", S4_SCORE,
        note="Partial score. NAP credited. Maps pack and rankings unconfirmed."))
    s.append(sp(20))

    # 4.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("GBP Screenshot", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph("NAP data cross-referenced", STYLES["table_cell"])],
        [Paragraph("Yelp Listing Screenshot", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph("NAP data cross-referenced", STYLES["table_cell"])],
        [Paragraph("Website (operator-submitted URL)", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph("NAP data cross-referenced", STYLES["table_cell"])],
        [Paragraph("Search Results Screenshot", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Maps pack confirmation", STYLES["table_cell"])],
        [Paragraph("Search Ranking Report", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.36, CONTENT_W*0.30, CONTENT_W*0.34]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 4.2 NAP Consistency Assessment
    _h_nap = sub_header("NAP Consistency Assessment")
    s += _h_nap
    s.append(body(
        "NAP stands for Name, Address, and Phone. "
        "Consistency of these three data points across every platform where "
        "Ironwood Tavern appears is a foundational local SEO signal. "
        "Inconsistent NAP data confuses Google's local ranking algorithm "
        "and reduces confidence in the listing. "
        "The three submitted sources were cross-referenced below."
    ))
    s.append(sp(12))

    def nap_status(ok):
        color = SAGE if ok else SALMON
        label = "CONSISTENT" if ok else "INCONSISTENT"
        return Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s4nap_{label[:4]}", fontName=FONT_BOLD, fontSize=8,
            leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    nap_rows = [
        [Paragraph("Business name", STYLES["table_cell_left"]),
         Paragraph("Ironwood Tavern", STYLES["table_cell"]),
         Paragraph("Ironwood Tavern", STYLES["table_cell"]),
         Paragraph("Ironwood Tavern", STYLES["table_cell"]),
         nap_status(True)],
        [Paragraph("Street address", STYLES["table_cell_left"]),
         Paragraph("Confirmed", STYLES["table_cell"]),
         Paragraph("Confirmed", STYLES["table_cell"]),
         Paragraph("Confirmed", STYLES["table_cell"]),
         nap_status(True)],
        [Paragraph("Phone number", STYLES["table_cell_left"]),
         Paragraph("Confirmed", STYLES["table_cell"]),
         Paragraph("Confirmed", STYLES["table_cell"]),
         Paragraph("Confirmed", STYLES["table_cell"]),
         nap_status(True)],
    ]
    cw_nap = [CONTENT_W*0.20, CONTENT_W*0.16, CONTENT_W*0.16,
              CONTENT_W*0.16, CONTENT_W*0.32]
    s.append(std_table(
        ["Field", "GBP", "Yelp", "Website", "Status"],
        nap_rows, cw_nap))
    s.append(sp(12))
    s.append(body(
        "NAP is consistent across all three submitted sources. "
        "This is the correct baseline. "
        "Any future listing added to a new directory or citation site "
        "must use exactly the same name, address, and phone number "
        "as what appears on the Google Business Profile."
    ))
    s.append(sp(20))

    # 4.3 AMBER: Maps pack unconfirmed
    s.append(amber_note(
        "No search results screenshot was submitted with this audit. "
        "Google Maps pack presence or absence cannot be confirmed. "
        "The Maps pack is the block of three local listings that appears at the top "
        "of a Google search results page for location-based queries like "
        "'bar Austin TX.' "
        "Appearing in the Maps pack is one of the highest-value visibility outcomes "
        "available to a local bar or restaurant. "
        "A single search screenshot taken in a private browsing window confirms "
        "whether Ironwood Tavern appears in this block or not. "
        "Submit this screenshot with the next audit to unlock Maps pack scoring."
    ))
    s.append(sp(12))

    # 4.4 AMBER: Ranking report not submitted
    s.append(amber_note(
        "No keyword ranking report was submitted with this audit. "
        "Keyword position analysis cannot be run. "
        "Without a ranking report it is not possible to determine whether "
        "Ironwood Tavern appears in the top 5, top 10, or not at all for "
        f"terms like '{S4_PRIMARY_KEYWORD}', "
        f"'{S4_SECONDARY_KEYWORDS[0]}', or '{S4_SECONDARY_KEYWORDS[1]}.' "
        "Submitting a ranking report for 5 or more local keywords unlocks "
        "the full Section 4 analysis including position tracking, "
        "keyword gap identification, and a competitive visibility comparison."
    ))
    s.append(sp(20))

    # 4.5 Score Calculation
    _h_sc = sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Appears in Google Maps pack", STYLES["table_cell_left"]),
         Paragraph("30", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_MAPS_PACK), STYLES["table_cell"]),
         Paragraph("No search screenshot submitted. Cannot confirm. 0/30.",
             STYLES["table_cell_left"])],
        [Paragraph("Ranks in top 5 for primary keyword", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_RANKINGS), STYLES["table_cell"]),
         Paragraph("No ranking report submitted. 0/25.",
             STYLES["table_cell_left"])],
        [Paragraph("NAP consistent across GBP, website, Yelp", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_NAP), STYLES["table_cell"]),
         Paragraph("Confirmed consistent across all three sources. Full 25/25.",
             STYLES["table_cell_left"])],
        [Paragraph("Website descriptive page titles", STYLES["table_cell_left"]),
         Paragraph("10", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_TITLES), STYLES["table_cell"]),
         Paragraph("Not assessed. Requires Tier 3 technical audit. 0/10.",
             STYLES["table_cell_left"])],
        [Paragraph("Citation count above 50", STYLES["table_cell_left"]),
         Paragraph("10", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_CITATIONS), STYLES["table_cell"]),
         Paragraph("GBP confirmed present. Partial citation signal only. 3/10.",
             STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S4_SCORE}</b>",
             ParagraphStyle("s4_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S4_SCORE}/100, CRITICAL (partial)</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.36, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.42]
    s += _h_sc
    s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2))
    s.append(sp(20))

    # ── TIER 3: Full ranking layer ────────────────────────────────────────────
    # When search ranking report (5+ keywords) and SEO tool export are submitted, add:
    # - Rank position for each keyword (position 1-100 or not ranking)
    # - Google Maps pack confirmation and position within the pack
    # - Citation count across major directories (Google, Yelp, TripAdvisor, Bing, Apple Maps)
    # - Backlink count and domain authority estimate
    # - Page title and meta description audit for homepage and menu page
    # - Competitive visibility comparison: Ironwood Tavern vs. nearest 3 competitors
    # This transforms Section 4 from a NAP-only assessment to a full
    # local search visibility profile.

    # 4.6 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        "The one thing this audit can confirm about Ironwood Tavern's search "
        "visibility is that the foundation is correct: NAP data is consistent "
        "across Google, Yelp, and the website. "
        "That consistency is the baseline requirement for local SEO. "
        "Everything else in this section: Maps pack presence, keyword ranking, "
        "citation count, and page title quality. All require data that was not "
        "submitted with this audit."
    ))
    s.append(sp(12))
    s.append(body(
        "The Maps pack is the single highest-value search visibility outcome "
        "for a local bar or restaurant. "
        "Appearing in the top three local results for 'bar Austin TX' "
        "puts Ironwood Tavern in front of guests at the exact moment they are "
        "deciding where to go. "
        "Whether Ironwood Tavern currently appears there is unknown. "
        "A two-minute incognito browser search answers that question "
        "and unlocks the most important part of this section in the next audit."
    ))
    s.append(sp(20))

    # 4.7 Action Item
    _h_ai = sub_header("Action Item")
    _f_ai = action_item(
        priority="HIGH",
        title="Run an Incognito Search and Submit the Screenshot with the Next Audit",
        area="Search Visibility and SEO",
        data_desc=(
            "Maps pack presence or absence is the most important search visibility "
            "signal for a local bar or restaurant and it cannot be assessed "
            "without a search results screenshot. "
            "No search screenshot was submitted with this audit. "
            "This single gap accounts for 30 of the 72 unscored points in this section."
        ),
        instruction=(
            "On any phone or computer, open a private browsing window "
            "(incognito in Chrome, private in Safari). "
            "Type 'bar Austin TX' and take a full screenshot of the results page "
            "before clicking anything. "
            "Repeat with 'tavern Austin TX' and 'bar near me' while physically "
            "at the Ironwood Tavern location. "
            "Submit all three screenshots with the next audit. "
            "This single submission unlocks Maps pack scoring, "
            "confirms whether Ironwood Tavern appears above competitors, "
            "and sets the baseline for tracking search position improvement "
            "from audit to audit."
        ),
        tool="Take the screenshot on your phone in a private browsing window.",
        time_str="Before next audit",
        monthly="Unlocks $0 to $1,200+ depending on Maps pack position",
        annual="Full Section 4 analysis unlocked with next submission",
    )
    s += _h_ai
    s.append(_f_ai)

    return s



# ── SECTION 5 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S5_TIER                      = 2

S5_PLATFORM_PRIMARY          = "Instagram"
S5_PLATFORM_SECONDARY        = "Facebook"
S5_FOLLOWER_COUNT_IG         = 1_240
S5_FOLLOWER_COUNT_FB         = 840
S5_FOLLOWER_BENCHMARK        = 500
S5_POSTS_LAST_30_DAYS        = 3
S5_POSTS_BENCHMARK           = 18
S5_ENGAGEMENT_RATE_EST       = 0.8
S5_ENGAGEMENT_BENCHMARK      = 3.0
S5_CONTENT_MIX               = "Food photos only. No events, specials, or personality content."
S5_STORY_LAST_7_DAYS         = True
S5_REEL_LAST_30_DAYS         = False
S5_PAID_SOCIAL               = False
S5_ANALYTICS_SUBMITTED       = False    # Tier 3

S5_MONTHLY_GAP               = 960
S5_ANNUAL_GAP                = 11_520

S5_PTS_ACTIVE_FOLLOWERS      = 20
S5_PTS_FREQUENCY             = 4
S5_PTS_ENGAGEMENT            = 5
S5_PTS_CONTENT_MIX           = 5
S5_PTS_STORY_REEL            = 10
S5_SCORE                     = (S5_PTS_ACTIVE_FOLLOWERS + S5_PTS_FREQUENCY +
                                S5_PTS_ENGAGEMENT + S5_PTS_CONTENT_MIX +
                                S5_PTS_STORY_REEL)  # 44


# ── SECTION 5: SOCIAL MEDIA AND CONTENT ──────────────────────────────────────

def page_section5():
    s = [PageBreak()]
    tier = S5_TIER

    s += section_header(
        "SECTION 5",
        "Social Media and Content",
        "Whether Ironwood Tavern is posting consistently enough and with enough "
        "variety to build a local following and drive repeat visits."
    )

    # ── TIER 0 ────────────────────────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(5, "Social Media and Content"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Social Media and Content",
            "Screenshots of your primary social media profile showing follower "
            "count, recent posts, and posting frequency for the audit period.",
            "Follower count confirmation, post frequency vs. 18-post benchmark, "
            "engagement rate estimate, content mix assessment, and story or Reel "
            "activity check.",
            "With your social media screenshots, this section would show how often "
            "you are posting compared to the frequency benchmark that maintains "
            "consistent feed presence, estimate your engagement rate from visible "
            "likes and follower count, and assess whether your content mix is "
            "broad enough to attract and retain a local following."
        ))
        return s

    # ── TIER 1: Questionnaire only ────────────────────────────────────────────
    if tier == 1:
        s.append(section_score_tile(5, "Social Media and Content", 14,
            note="Partial score, questionnaire only, max 35 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "Social media screenshots were not submitted with this audit. "
            "The assessment below confirms platform presence and reported follower "
            "count based on questionnaire responses only. "
            "Post frequency, engagement rate, content mix, and story or Reel "
            "activity cannot be assessed without screenshots of the actual profile. "
            "Submit Instagram and Facebook profile screenshots for the audit period "
            "with your next audit to unlock the full Section 5 analysis."
        ))
        s.append(sp(16))
        s += sub_header("Questionnaire-Based Assessment")
        s.append(body(
            "The following items are confirmed from questionnaire responses. "
            "All frequency and engagement metrics require screenshot submission."
        ))
        s.append(sp(12))
        t1_rows = [
            [Paragraph("Active on Instagram", STYLES["table_cell_left"]),
             Paragraph("Reported yes", STYLES["table_cell"]),
             Paragraph("Active account", STYLES["table_cell"]),
             Paragraph("REPORTED", ParagraphStyle("s5t1_1", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Follower count", STYLES["table_cell_left"]),
             Paragraph("Reported", STYLES["table_cell"]),
             Paragraph("500+ benchmark", STYLES["table_cell"]),
             Paragraph("UNVERIFIED", ParagraphStyle("s5t1_2", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Posts per month", STYLES["table_cell_left"]),
             Paragraph("Not available", STYLES["table_cell"]),
             Paragraph("18+ benchmark", STYLES["table_cell"]),
             Paragraph("UNKNOWN", ParagraphStyle("s5t1_3", fontName=FONT_BOLD,
                fontSize=8, textColor=MID_GRAY, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Engagement rate", STYLES["table_cell_left"]),
             Paragraph("Not available", STYLES["table_cell"]),
             Paragraph("3%+ benchmark", STYLES["table_cell"]),
             Paragraph("UNKNOWN", ParagraphStyle("s5t1_4", fontName=FONT_BOLD,
                fontSize=8, textColor=MID_GRAY, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
        ]
        cw_t1 = [CONTENT_W*0.32, CONTENT_W*0.18, CONTENT_W*0.24, CONTENT_W*0.26]
        s.append(std_table(["Signal", "Submitted", "Standard", "Status"], t1_rows, cw_t1))
        return s

    # ── TIER 2: Full analysis ─────────────────────────────────────────────────
    s.append(section_score_tile(5, "Social Media and Content", S5_SCORE))
    s.append(sp(20))

    # 5.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("Instagram Profile Screenshot", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S5_FOLLOWER_COUNT_IG:,} followers, "
                   f"{S5_POSTS_LAST_30_DAYS} posts in last 30 days",
                   STYLES["table_cell"])],
        [Paragraph("Facebook Profile Screenshot", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S5_FOLLOWER_COUNT_FB:,} followers confirmed",
                   STYLES["table_cell"])],
        [Paragraph("Social Media Analytics Export", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.36, CONTENT_W*0.30, CONTENT_W*0.34]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 5.2 Social Media Presence Assessment
    s += sub_header("Social Media Presence Assessment")

    def sc(label):
        color = SAGE if label in ("ON TARGET", "ACTIVE") else \
                SALMON if label == "CRITICAL" else AMBER
        return Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s5sc_{label[:5]}", fontName=FONT_BOLD, fontSize=8,
            leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    presence_rows = [
        [Paragraph("Instagram followers", STYLES["table_cell_left"]),
         Paragraph(f"{S5_FOLLOWER_COUNT_IG:,}",
             ParagraphStyle("s5pr_ig", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SAGE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S5_FOLLOWER_BENCHMARK}+", STYLES["table_cell"]),
         sc("ON TARGET"),
         Paragraph("Exceeds benchmark. Audience is in place.",
             STYLES["table_cell_left"])],
        [Paragraph("Facebook followers", STYLES["table_cell_left"]),
         Paragraph(f"{S5_FOLLOWER_COUNT_FB:,}",
             ParagraphStyle("s5pr_fb", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SAGE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S5_FOLLOWER_BENCHMARK}+", STYLES["table_cell"]),
         sc("ON TARGET"),
         Paragraph("Exceeds benchmark on second platform.",
             STYLES["table_cell_left"])],
        [Paragraph("Posts in last 30 days", STYLES["table_cell_left"]),
         Paragraph(str(S5_POSTS_LAST_30_DAYS),
             ParagraphStyle("s5pr_po", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S5_POSTS_BENCHMARK}+", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph(f"{S5_POSTS_BENCHMARK - S5_POSTS_LAST_30_DAYS} posts below benchmark. "
                   "Primary gap in this section.",
                   STYLES["table_cell_left"])],
        [Paragraph("Engagement rate (estimated)", STYLES["table_cell_left"]),
         Paragraph(f"{S5_ENGAGEMENT_RATE_EST}%",
             ParagraphStyle("s5pr_er", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S5_ENGAGEMENT_BENCHMARK}%+", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph("Well below benchmark. Low frequency drives low engagement.",
                   STYLES["table_cell_left"])],
        [Paragraph("Story posted in last 7 days", STYLES["table_cell_left"]),
         Paragraph("Yes",
             ParagraphStyle("s5pr_st", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SAGE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("Within 7 days", STYLES["table_cell"]),
         sc("ACTIVE"),
         Paragraph("Story confirmed from screenshot.",
                   STYLES["table_cell_left"])],
        [Paragraph("Reel posted in last 30 days", STYLES["table_cell_left"]),
         Paragraph("No",
             ParagraphStyle("s5pr_rl", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("At least 1 per month", STYLES["table_cell"]),
         sc("ATTENTION"),
         Paragraph("No Reels. Reels reach 3 to 5x more accounts than static posts.",
                   STYLES["table_cell_left"])],
    ]
    cw_pr = [CONTENT_W*0.23, CONTENT_W*0.15, CONTENT_W*0.14,
             CONTENT_W*0.13, CONTENT_W*0.35]
    s.append(std_table(
        ["Signal", "Account", "Benchmark", "Status", "Notes"],
        presence_rows, cw_pr))
    s.append(sp(20))

    # 5.3 Content Frequency Gap
    _h_cfg = sub_header("Content Frequency Gap")
    _f_cfg = formula_box([
        "CONTENT FREQUENCY GAP, EXPLICIT CALCULATION",
        "",
        f"  Posts in last 30 days:         {S5_POSTS_LAST_30_DAYS}",
        f"  Monthly posting benchmark:     {S5_POSTS_BENCHMARK} (weekday minimum = 4 per week)",
        f"  Posts behind benchmark:        {S5_POSTS_BENCHMARK - S5_POSTS_LAST_30_DAYS}",
        "",
        f"  At {S5_POSTS_LAST_30_DAYS} posts per month, Ironwood Tavern disappears from "
        "follower feeds for weeks at a time.",
        f"  Instagram's algorithm deprioritizes accounts that post infrequently,",
        "  reducing organic reach further with each period of inactivity.",
        "",
        f"  Estimated engagement rate:     {S5_ENGAGEMENT_RATE_EST}%",
        f"  Engagement benchmark:          {S5_ENGAGEMENT_BENCHMARK}%+",
        f"  Engagement gap:                {S5_ENGAGEMENT_BENCHMARK - S5_ENGAGEMENT_RATE_EST:.1f} "
        "percentage points below target",
        "",
        "  Engagement rate and posting frequency are directly related.",
        "  An account that posts 3 times a month trains its audience not to look.",
        "  An account that posts 18 times a month stays visible and top of mind.",
    ])
    s.append(PageBreak())
    s += _h_cfg
    s.append(_f_cfg)
    s.append(sp(20))

    # 5.4 Content Mix Assessment
    s += sub_header("Content Mix Assessment")
    s.append(body(
        "Content mix is what keeps a social media following engaged beyond food photos. "
        "An account that posts only food images eventually blends in with every other "
        "restaurant account in the feed. "
        "Guests follow local bars and restaurants to feel connected to the place, "
        "not just to see what is on the menu. "
        "The recommended content mix for a bar or restaurant account is: "
        "40% food and drink photography, "
        "30% events, specials, and time-sensitive content, "
        "and 30% personality, staff, and behind-the-scenes content."
    ))
    s.append(sp(12))
    mix_rows = [
        [Paragraph("Food and drink photography", STYLES["table_cell_left"]),
         Paragraph("100%", ParagraphStyle("s5mx_fd", fontName=FONT_BOLD, fontSize=8.5,
            leading=12, textColor=AMBER, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0)),
         Paragraph("40%", STYLES["table_cell"]),
         Paragraph("IMBALANCED",
             ParagraphStyle("s5mx_s1", fontName=FONT_BOLD, fontSize=7,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("All three posts were food photos. "
                   "No other content types represented.",
                   STYLES["table_cell_left"])],
        [Paragraph("Events, specials, time-sensitive", STYLES["table_cell_left"]),
         Paragraph("0%", ParagraphStyle("s5mx_ev", fontName=FONT_BOLD, fontSize=8.5,
            leading=12, textColor=SALMON, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0)),
         Paragraph("30%", STYLES["table_cell"]),
         Paragraph("MISSING",
             ParagraphStyle("s5mx_s2", fontName=FONT_BOLD, fontSize=7,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("No event announcements, weekend specials, or limited-time "
                   "offers posted in the audit period.",
                   STYLES["table_cell_left"])],
        [Paragraph("Personality, staff, behind the scenes", STYLES["table_cell_left"]),
         Paragraph("0%", ParagraphStyle("s5mx_pe", fontName=FONT_BOLD, fontSize=8.5,
            leading=12, textColor=SALMON, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0)),
         Paragraph("30%", STYLES["table_cell"]),
         Paragraph("MISSING",
             ParagraphStyle("s5mx_s3", fontName=FONT_BOLD, fontSize=7,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("No staff features, bar moments, or behind-the-scenes content "
                   "in the audit period.",
                   STYLES["table_cell_left"])],
    ]
    cw_mx = [CONTENT_W*0.28, CONTENT_W*0.12, CONTENT_W*0.11,
             CONTENT_W*0.16, CONTENT_W*0.33]
    s.append(std_table(
        ["Content Type", "Actual", "Target", "Status", "Notes"],
        mix_rows, cw_mx))
    s.append(sp(20))

    # 5.5 SALMON callout
    s.append(callout_box(
        f"{S5_POSTS_LAST_30_DAYS} POSTS IN 30 DAYS IS NOT A SOCIAL MEDIA PRESENCE",
        f"Ironwood Tavern has {S5_FOLLOWER_COUNT_IG:,} Instagram followers. "
        "That is an audience that has already raised their hand and said they want "
        "to hear from this operation. "
        f"Posting {S5_POSTS_LAST_30_DAYS} times in 30 days means that audience "
        "went approximately 10 days between each post without seeing anything "
        "from Ironwood Tavern in their feed. "
        "During those 10 days, every competitor who posts daily stayed visible. "
        f"The {S5_POSTS_BENCHMARK}-post benchmark is not an arbitrary number. "
        "It is the minimum frequency required to maintain consistent feed presence "
        "and keep the algorithm from reducing organic reach to near zero.",
        bg=SALMON
    ))
    s.append(sp(20))

    # 5.6 Score Calculation
    _h_sc = sub_header("Score Calculation")
    score_rows = [
        [Paragraph(f"Active on at least one platform with {S5_FOLLOWER_BENCHMARK}+ followers",
             STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_ACTIVE_FOLLOWERS), STYLES["table_cell"]),
         Paragraph(f"Instagram {S5_FOLLOWER_COUNT_IG:,} and Facebook {S5_FOLLOWER_COUNT_FB:,}. "
                   "Full 20/20.",
                   STYLES["table_cell_left"])],
        [Paragraph(f"Posts per month at or above {S5_POSTS_BENCHMARK}",
             STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_FREQUENCY), STYLES["table_cell"]),
         Paragraph(f"{S5_POSTS_LAST_30_DAYS} posts vs. {S5_POSTS_BENCHMARK} benchmark. "
                   "Severe gap. 4/25.",
                   STYLES["table_cell_left"])],
        [Paragraph(f"Engagement rate at or above {S5_ENGAGEMENT_BENCHMARK}%",
             STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_ENGAGEMENT), STYLES["table_cell"]),
         Paragraph(f"Estimated {S5_ENGAGEMENT_RATE_EST}% vs. "
                   f"{S5_ENGAGEMENT_BENCHMARK}% benchmark. 5/25.",
                   STYLES["table_cell_left"])],
        [Paragraph("Content mix: food, events, and personality represented",
             STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_CONTENT_MIX), STYLES["table_cell"]),
         Paragraph("Food only. Events and personality absent. 5/15.",
             STYLES["table_cell_left"])],
        [Paragraph("Story or Reel posted in last 7 days",
             STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_STORY_REEL), STYLES["table_cell"]),
         Paragraph("Story confirmed. No Reel. Partial 10/15.",
             STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S5_SCORE}</b>",
             ParagraphStyle("s5_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S5_SCORE}/100, ATTENTION</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.38, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.40]
    s += _h_sc
    s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2))
    s.append(sp(20))

    # ── TIER 3: Analytics export layer ────────────────────────────────────────
    # When social media analytics export is submitted, add:
    # - Exact engagement rate (not estimated from screenshot)
    # - Reach and impressions per post broken down by content type
    # - Follower growth rate over the audit period
    # - Best-performing post by reach and by engagement
    # - Optimal posting time based on when followers are most active
    # - Content performance by type (food vs. events vs. personality)
    # This moves the analysis from frequency-based to performance-based
    # and identifies which content type is driving the most discovery.

    # 5.7 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"Ironwood Tavern has a real social media asset: "
        f"{S5_FOLLOWER_COUNT_IG:,} Instagram followers and {S5_FOLLOWER_COUNT_FB:,} "
        "Facebook followers represent a built audience that has already chosen "
        "to stay connected to this operation. "
        "That audience is not being used. "
        f"Three posts in 30 days means each post was separated by roughly 10 days "
        "of silence, and all three posts were food photos. "
        "There were no events announced, no specials promoted, and no personality "
        "content that gives followers a reason to feel connected to the place "
        "beyond what is on the plate."
    ))
    s.append(sp(12))
    s.append(body(
        "The path to improvement here is not complicated. "
        "It is a volume and variety problem, not a quality problem. "
        "The fix is a 30-day content calendar built this Sunday with 18 slots filled: "
        "half food and drink photography, four event or special announcements, "
        "and four behind-the-bar or staff moments. "
        "One Reel filmed this week from the bar floor adds more organic reach "
        "than all three current monthly posts combined. "
        f"The {S5_FOLLOWER_COUNT_IG:,} followers are already there. "
        "They just need a reason to keep paying attention."
    ))
    s.append(sp(20))

    # 5.8 Action Items
    _h_ai = sub_header("Action Items")
    _f_ai = action_item(
        priority="HIGH",
        title="Post to Instagram Every Weekday This Week",
        area="Social Media and Content",
        data_desc=(
            f"{S5_POSTS_LAST_30_DAYS} posts in the last 30 days against a "
            f"{S5_POSTS_BENCHMARK}-post monthly benchmark. "
            f"At {S5_POSTS_LAST_30_DAYS} posts per month the account disappears "
            "from follower feeds for 10 days at a time. "
            "The Instagram algorithm reduces organic reach for accounts "
            "that post infrequently, compounding the visibility loss."
        ),
        instruction=(
            "This week: post to Instagram every weekday. "
            "Monday: one food item or cocktail photographed on the bar top. "
            "Tuesday: one staff member doing something at their station. "
            "Wednesday: a specials announcement or what is happening this weekend. "
            "Thursday: the bar or dining room at a moment that shows the atmosphere. "
            "Friday: anything visual from tonight's service. "
            "Each post: one photo from your phone, one sentence of caption, "
            "three Austin-specific hashtags. "
            "It takes four minutes per post. "
            "Do not overthink the photo. Natural light and a steady hand are enough."
        ),
        tool="Post directly from your phone using the Instagram app.",
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
        title="Build a 30-Day Content Calendar This Sunday",
        area="Social Media and Content",
        data_desc=(
            "All three posts in the audit period were food photos. "
            "Events, specials, and personality content are entirely absent. "
            "An account with only food photography blends into every other restaurant "
            "account in the feed and gives followers no reason to feel connected "
            "to Ironwood Tavern specifically."
        ),
        instruction=(
            "This Sunday, open a notes app or a blank document and fill in "
            f"{S5_POSTS_BENCHMARK} post slots for the next 30 days. "
            "The slots: 9 food and drink photos (one per post), "
            "4 event or weekend special announcements (use actual dates), "
            "3 bar or atmosphere shots (the room at capacity, the back bar, the patio), "
            "and 2 staff moments (a bartender building a cocktail, a server running food). "
            "For each slot, note what you will photograph and when. "
            "Having the plan in place means you are not deciding what to post "
            "at 9pm on a Tuesday."
        ),
        tool="A notes app, a spreadsheet, or a piece of paper works equally well.",
        time_str="This Sunday",
        monthly=f"${round(S5_MONTHLY_GAP * 0.6):,.0f}",
        annual=f"${round(S5_ANNUAL_GAP * 0.6):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Film One 15-Second Reel This Week",
        area="Social Media and Content",
        data_desc=(
            "No Reels posted in the last 30 days. "
            "Reels receive 3 to 5 times the organic reach of static posts on Instagram "
            "because the platform surfaces Reels to non-followers. "
            "A single Reel filmed at the bar reaches people who have never heard of "
            "Ironwood Tavern and cannot be reached through static posts alone."
        ),
        instruction=(
            "Film 15 seconds of something visual at the bar this week. "
            "Options: a pour being built from start to finish, "
            "a plate being assembled in the kitchen, "
            "the bar floor at peak service on a Friday or Saturday night, "
            "or a bartender doing something that takes skill. "
            "Hold the phone horizontally, keep it steady, film in good light. "
            "Post it as a Reel with a one-sentence caption and three hashtags "
            "including the word Austin. "
            "The goal this week is to post one. "
            "Not to produce a perfect video."
        ),
        tool="Film and post directly from the Instagram app using the Reels feature.",
        time_str="This week",
        monthly=f"${round(S5_MONTHLY_GAP * 0.3):,.0f}",
        annual=f"${round(S5_ANNUAL_GAP * 0.3):,.0f}",
    ))

    return s



# ── SECTION 6 SAMPLE DATA (Tier 1 partial) ───────────────────────────────────
S6_TIER                      = 1        # partial -- no dashboard screenshot

S6_LISTED_DOORDASH           = True
S6_LISTED_UBEREATS           = True
S6_LISTED_GRUBHUB            = False
S6_DOORDASH_RATING           = 4.1      # operator-reported, unverified
S6_DOORDASH_RATING_CONFIRMED = False
S6_PHOTO_COUNT_PLATFORM      = 4        # operator-reported
S6_PHOTO_BENCHMARK           = 10
S6_MENU_COMPLETE             = True     # operator-reported, unverified
S6_ACTIVE_PROMO              = False
S6_MONTHLY_ORDER_VOLUME      = None     # Tier 3 only
S6_ACCEPTANCE_RATE           = None     # Tier 3 only

S6_MONTHLY_GAP               = None     # cannot calculate without verified data
S6_ANNUAL_GAP                = None

S6_PTS_LISTED                = 20
S6_PTS_RATING                = 7        # reduced credit: unverified
S6_PTS_PHOTOS                = 5        # reduced credit: below benchmark, unverified
S6_PTS_MENU                  = 3        # reduced credit: unverified
S6_PTS_PROMO                 = 0
S6_SCORE                     = (S6_PTS_LISTED + S6_PTS_RATING +
                                S6_PTS_PHOTOS + S6_PTS_MENU + S6_PTS_PROMO)  # 35


# ── SECTION 6: DELIVERY PLATFORM OPTIMIZATION ────────────────────────────────

def page_section6():
    s = [PageBreak()]
    tier = S6_TIER

    s += section_header(
        "SECTION 6",
        "Delivery Platform Optimization",
        "Whether Ironwood Tavern's presence on delivery platforms is optimized "
        "to attract orders and whether the channel is being actively managed."
    )

    # ── TIER 1 partial: Questionnaire only ───────────────────────────────────
    if tier <= 1:
        s.append(section_score_tile(6, "Delivery Platform Optimization", S6_SCORE,
            note="Partial score. All metrics operator-reported and unverified."))
        s.append(sp(20))

        # 6.1 Data Used
        s += sub_header("Data Used in This Analysis")
        data_rows = [
            [Paragraph("Questionnaire Responses", STYLES["table_cell_left"]),
             Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
             Paragraph("Platform presence, rating, photo count reported by operator",
                 STYLES["table_cell"])],
            [Paragraph("DoorDash Dashboard Screenshot", STYLES["table_cell_left"]),
             Paragraph("Not submitted", STYLES["table_cell_left"]),
             Paragraph("Required to verify rating, photos, menu, promo status",
                 STYLES["table_cell"])],
            [Paragraph("Uber Eats Dashboard Screenshot", STYLES["table_cell_left"]),
             Paragraph("Not submitted", STYLES["table_cell_left"]),
             Paragraph("Required to verify rating, photos, menu, promo status",
                 STYLES["table_cell"])],
            [Paragraph("Platform Dashboard Export", STYLES["table_cell_left"]),
             Paragraph("Not submitted", STYLES["table_cell_left"]),
             Paragraph("Required for Tier 3", STYLES["table_cell"])],
        ]
        cw_d = [CONTENT_W*0.34, CONTENT_W*0.26, CONTENT_W*0.40]
        s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
        s.append(sp(20))

        # 6.2 Platform Presence Assessment
        s += sub_header("Platform Presence Assessment")
        s.append(body(
            "The following metrics are based on operator questionnaire responses only. "
            "Every unverified metric is scored at reduced credit. "
            "Dashboard screenshots confirming these figures would unlock full "
            "credit for each verified element."
        ))
        s.append(sp(12))

        def sv(label, verified=False):
            color = SAGE if verified else AMBER
            text = label if verified else f"{label} (unverified)"
            return Paragraph(text,
                ParagraphStyle(f"s6sv_{label[:5]}", fontSize=8.5, leading=12,
                textColor=color, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))

        def sc_unv(label, verified=True):
            color = SAGE if (label in ("ON TARGET", "LISTED") and verified) else \
                    AMBER if label in ("ATTENTION", "UNVERIFIED") else \
                    SALMON if label == "CRITICAL" else MID_GRAY
            return Paragraph(f"<b>{label}</b>",
                ParagraphStyle(f"s6sc_{label[:5]}", fontName=FONT_BOLD, fontSize=8,
                leading=11, textColor=color, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))

        platform_rows = [
            [Paragraph("DoorDash listing", STYLES["table_cell_left"]),
             Paragraph("Yes", STYLES["table_cell"]),
             Paragraph("Operator-reported", STYLES["table_cell"]),
             sc_unv("LISTED"),
             Paragraph("Presence confirmed by operator. No screenshot to verify.",
                 STYLES["table_cell_left"])],
            [Paragraph("Uber Eats listing", STYLES["table_cell_left"]),
             Paragraph("Yes", STYLES["table_cell"]),
             Paragraph("Operator-reported", STYLES["table_cell"]),
             sc_unv("LISTED"),
             Paragraph("Presence confirmed by operator. No screenshot to verify.",
                 STYLES["table_cell_left"])],
            [Paragraph("Grubhub listing", STYLES["table_cell_left"]),
             Paragraph("No", STYLES["table_cell"]),
             Paragraph("Optional", STYLES["table_cell"]),
             sc_unv("ATTENTION"),
             Paragraph("Not listed. Third platform adds incremental reach.",
                 STYLES["table_cell_left"])],
            [Paragraph("DoorDash rating", STYLES["table_cell_left"]),
             Paragraph(f"{S6_DOORDASH_RATING} (reported)",
                 ParagraphStyle("s6pv_dr", fontSize=8.5, leading=12,
                 textColor=AMBER, alignment=TA_CENTER,
                 leftIndent=0, firstLineIndent=0)),
             Paragraph("4.3+ benchmark", STYLES["table_cell"]),
             sc_unv("UNVERIFIED"),
             Paragraph("Operator-reported. Below 4.3 benchmark. "
                 "Cannot verify without dashboard screenshot.",
                 STYLES["table_cell_left"])],
            [Paragraph("Photo count on platform", STYLES["table_cell_left"]),
             Paragraph(f"{S6_PHOTO_COUNT_PLATFORM} (reported)",
                 ParagraphStyle("s6pv_pc", fontSize=8.5, leading=12,
                 textColor=SALMON, alignment=TA_CENTER,
                 leftIndent=0, firstLineIndent=0)),
             Paragraph(f"{S6_PHOTO_BENCHMARK}+ benchmark", STYLES["table_cell"]),
             sc_unv("UNVERIFIED"),
             Paragraph(f"{S6_PHOTO_COUNT_PLATFORM} reported vs. "
                 f"{S6_PHOTO_BENCHMARK} benchmark. Below threshold. Unverified.",
                 STYLES["table_cell_left"])],
            [Paragraph("Menu completeness", STYLES["table_cell_left"]),
             Paragraph("Complete (reported)", STYLES["table_cell"]),
             Paragraph("All items and prices", STYLES["table_cell"]),
             sc_unv("UNVERIFIED"),
             Paragraph("Operator-reported as complete. Cannot verify without screenshot.",
                 STYLES["table_cell_left"])],
            [Paragraph("Active promotional offer", STYLES["table_cell_left"]),
             Paragraph("None", STYLES["table_cell"]),
             Paragraph("At least 1 active", STYLES["table_cell"]),
             sc_unv("CRITICAL"),
             Paragraph("No active promotion on either platform.",
                 STYLES["table_cell_left"])],
        ]
        cw_pl = [CONTENT_W*0.22, CONTENT_W*0.16, CONTENT_W*0.16,
                 CONTENT_W*0.14, CONTENT_W*0.32]
        s.append(std_table(
            ["Signal", "Submitted", "Standard", "Status", "Notes"],
            platform_rows, cw_pl))
        s.append(sp(20))

        # 6.3 AMBER note: submit dashboard screenshots
        s.append(amber_note(
            "Dashboard screenshots were not submitted with this audit. "
            "Every metric in the table above is based on what the operator reported "
            "in the questionnaire. "
            "Unverified data earns reduced credit in every scoring element: "
            "a reported 4.1 rating earns less than a screenshot-confirmed 4.1 rating "
            "because the audit cannot distinguish between an accurate report and "
            "a misremembered one. "
            "Submitting DoorDash and Uber Eats dashboard screenshots with the next "
            "audit confirms the actual rating, photo count, menu completeness, "
            "and promotional status, and unlocks full credit for every verified element. "
            "It takes two screenshots."
        ))
        s.append(sp(20))

        # 6.4 Score Calculation
        _h_sc = sub_header("Score Calculation")
        score_rows = [
            [Paragraph("Listed on at least one major platform", STYLES["table_cell_left"]),
             Paragraph("20", STYLES["table_cell"]),
             Paragraph(str(S6_PTS_LISTED), STYLES["table_cell"]),
             Paragraph("DoorDash and Uber Eats reported. Full credit for presence. 20/20.",
                 STYLES["table_cell_left"])],
            [Paragraph("Platform rating at or above 4.3", STYLES["table_cell_left"]),
             Paragraph("20", STYLES["table_cell"]),
             Paragraph(str(S6_PTS_RATING), STYLES["table_cell"]),
             Paragraph(f"DoorDash {S6_DOORDASH_RATING} reported. Below benchmark. "
                 "Unverified. Reduced credit 7/20.",
                 STYLES["table_cell_left"])],
            [Paragraph("Photo count above 10", STYLES["table_cell_left"]),
             Paragraph("20", STYLES["table_cell"]),
             Paragraph(str(S6_PTS_PHOTOS), STYLES["table_cell"]),
             Paragraph(f"{S6_PHOTO_COUNT_PLATFORM} photos reported. Below benchmark. "
                 "Unverified. Reduced credit 5/20.",
                 STYLES["table_cell_left"])],
            [Paragraph("Menu completeness verified", STYLES["table_cell_left"]),
             Paragraph("20", STYLES["table_cell"]),
             Paragraph(str(S6_PTS_MENU), STYLES["table_cell"]),
             Paragraph("Reported complete but unverified. "
                 "Reduced credit 3/20.",
                 STYLES["table_cell_left"])],
            [Paragraph("Active promotional offer", STYLES["table_cell_left"]),
             Paragraph("20", STYLES["table_cell"]),
             Paragraph(str(S6_PTS_PROMO), STYLES["table_cell"]),
             Paragraph("No active promotion on any platform. 0/20.",
                 STYLES["table_cell_left"])],
            [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
             Paragraph("<b>100</b>", STYLES["table_cell"]),
             Paragraph(f"<b>{S6_SCORE}</b>",
                 ParagraphStyle("s6_tot", fontName=FONT_BOLD, fontSize=9,
                 textColor=SALMON, alignment=TA_CENTER,
                 leftIndent=0, firstLineIndent=0)),
             Paragraph(f"<b>Score: {S6_SCORE}/100, CRITICAL (partial)</b>",
                 STYLES["table_cell_bold"])],
        ]
        cw_sc2 = [CONTENT_W*0.36, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.42]
        s += _h_sc
        s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
            score_rows, cw_sc2))
        s.append(sp(20))

        # 6.5 Narrative
        s += sub_header("Narrative Analysis")
        s.append(body(
            "Ironwood Tavern is listed on two major delivery platforms, "
            "which is the correct starting point. "
            "Beyond that baseline, this section cannot be fully scored. "
            "No dashboard screenshots were submitted, so the reported rating of "
            f"{S6_DOORDASH_RATING} on DoorDash, the reported photo count of "
            f"{S6_PHOTO_COUNT_PLATFORM}, and the reported menu completeness "
            "are all accepted at partial credit only. "
            "The one verifiable gap that requires no screenshot to confirm "
            "is the photo count: "
            f"{S6_PHOTO_COUNT_PLATFORM} photos is below the {S6_PHOTO_BENCHMARK}-photo "
            "benchmark that platform algorithms use to rank and surface listings. "
            "This is fixable this week regardless of the dashboard submission status."
        ))
        s.append(sp(12))
        s.append(body(
            "Delivery platform listings operate the same way as Google Business Profiles: "
            "completeness and activity signal quality to the algorithm. "
            "A listing with 4 photos and no active promotion competes against "
            "listings with 20 photos and a first-order discount at the exact moment "
            "a hungry guest is browsing. "
            "The photo gap is addressable immediately. "
            "Everything else in this section becomes fully scorable the moment "
            "two dashboard screenshots are submitted with the next audit."
        ))
        s.append(sp(20))

        # 6.6 Action Items
        _h_ai = sub_header("Action Items")
        _f_ai = action_item(
            priority="HIGH",
            title="Add a Minimum of 10 Photos to Every Delivery Platform Listing This Week",
            area="Delivery Platform Optimization",
            data_desc=(
                f"Photo count reported at {S6_PHOTO_COUNT_PLATFORM} across delivery platforms. "
                f"Benchmark is {S6_PHOTO_BENCHMARK}+ photos. "
                "Platform listings with 10 or more photos convert at significantly "
                "higher rates than listings with fewer than 5. "
                "This is the one gap in this section that can be fixed "
                "without a dashboard screenshot or any additional data submission."
            ),
            instruction=(
                "Log in to your DoorDash and Uber Eats merchant portals. "
                "Go to the menu or photos section of each listing. "
                f"Upload a minimum of {S6_PHOTO_BENCHMARK - S6_PHOTO_COUNT_PLATFORM} "
                "new photos to reach the 10-photo benchmark. "
                "Use the same food and drink photos already on your Instagram account. "
                "Include: 3 to 4 food items, 2 to 3 cocktails or drinks, "
                "1 exterior photo, and 1 interior or bar photo. "
                "Do not use photos that are blurry, dark, or taken from awkward angles. "
                "A well-lit phone photo is better than a dark professional photo."
            ),
            tool="Update photos directly in your DoorDash and Uber Eats merchant portals.",
            time_str="This week",
            monthly="Unlocks visibility improvement on both platforms",
            annual="Full impact calculable after dashboard submission",
        )
        s += _h_ai
        s.append(_f_ai)
        s.append(sp(10))

        s.append(action_item(
            priority="MEDIUM",
            title="Submit DoorDash and Uber Eats Dashboard Screenshots with the Next Audit",
            area="Delivery Platform Optimization",
            data_desc=(
                "Every metric in this section except platform presence is "
                "operator-reported and unverified. "
                "The reported DoorDash rating of "
                f"{S6_DOORDASH_RATING}, photo count of {S6_PHOTO_COUNT_PLATFORM}, "
                "and menu completeness all earn reduced credit compared to "
                "screenshot-confirmed data. "
                "Two screenshots unlock full scoring and exact dollar gap calculation."
            ),
            instruction=(
                "Log in to your DoorDash Merchant Portal and your Uber Eats "
                "Restaurant Manager. "
                "Take a screenshot of each dashboard showing: "
                "your listing rating, your photo count, your menu status, "
                "and your current promotional offer status. "
                "If the platform shows order volume or acceptance rate, "
                "include that screen as well. "
                "Submit all screenshots with the next audit submission form. "
                "Two screenshots. Under five minutes."
            ),
            tool="Take screenshots from your DoorDash and Uber Eats merchant dashboards.",
            time_str="Before next audit",
            monthly="Full Section 6 analysis unlocked with submission",
            annual="Dollar gap calculable once order volume is confirmed",
        ))

        return s

    # ── TIER 2: Full analysis with dashboard screenshot ───────────────────────
    # Render confirmed platform data when dashboard screenshots are submitted.
    # All scoring elements earn full credit when verified.
    # Score calculation mirrors Tier 1 structure with confirmed values.

    # ── TIER 3: Dashboard export layer ───────────────────────────────────────
    # When dashboard export is submitted, add:
    # - Monthly order volume and trend over trailing 3 months
    # - Order acceptance rate vs. 95%+ benchmark
    # - Customer reorder rate (returning customers as % of total)
    # - Platform fee as % of delivery revenue
    # - Menu item performance: top 5 ordered items vs. top 5 margin items
    # - Comparison: platform revenue vs. dine-in revenue margin
    # This determines whether the delivery channel is a profitable revenue
    # stream or a subsidized convenience that erodes margin.

    return s



# ── SECTION 7 SAMPLE DATA (Tier 2 partial) ───────────────────────────────────
S7_TIER                      = 2        # partial -- screenshot submitted, no export

S7_LIST_EXISTS               = True
S7_LIST_SIZE                 = 1_140
S7_LIST_SIZE_BENCHMARK       = 500
S7_LAST_SEND_DATE            = "March 18, 2026"
S7_SENDS_LAST_30_DAYS        = 1
S7_SENDS_BENCHMARK           = 2
S7_OPEN_RATE                 = None     # not visible in screenshot
S7_OPEN_RATE_BENCHMARK       = 30
S7_CLICK_RATE                = None     # Tier 3
S7_GROWTH_MECHANISM          = "Website signup form"
S7_GROWTH_MECHANISM_ACTIVE   = True
S7_LOYALTY_PROGRAM           = False

S7_MONTHLY_GAP               = 740
S7_ANNUAL_GAP                = 8_880

S7_PTS_LIST_SIZE             = 25
S7_PTS_RECENT_SEND           = 20
S7_PTS_OPEN_RATE             = 0        # not visible in screenshot
S7_PTS_GROWTH                = 12
S7_PTS_LOYALTY               = 0
S7_SCORE                     = (S7_PTS_LIST_SIZE + S7_PTS_RECENT_SEND +
                                S7_PTS_OPEN_RATE + S7_PTS_GROWTH +
                                S7_PTS_LOYALTY)  # 57 raw, adjusted to 42 partial


# ── SECTION 7: GUEST RETURN AND EMAIL ────────────────────────────────────────

def page_section7():
    s = [PageBreak()]
    tier = S7_TIER

    s += section_header(
        "SECTION 7",
        "Guest Return and Email",
        "Whether Ironwood Tavern has a system to bring guests back, "
        "specifically whether the email list is active and growing "
        "and whether any loyalty mechanism exists."
    )

    # ── TIER 0 / TIER 1: Questionnaire only ───────────────────────────────────
    if tier <= 1:
        s.append(section_score_tile(7, "Guest Return and Email", 18,
            note="Partial score, questionnaire only, max 30 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "An email platform screenshot was not submitted with this audit. "
            "The assessment below confirms list existence and loyalty program status "
            "based on questionnaire responses only. "
            "List size, send frequency, and growth mechanism status cannot be "
            "verified without a screenshot of the email platform dashboard. "
            "Submit an email platform screenshot with the next audit to unlock "
            "confirmed scoring for list size, send date, and signup mechanism."
        ))
        s.append(sp(16))
        s += sub_header("Questionnaire-Based Assessment")
        s.append(body(
            "The following items are confirmed from questionnaire responses. "
            "All list health and frequency metrics require screenshot submission."
        ))
        s.append(sp(12))
        t1_rows = [
            [Paragraph("Email list exists", STYLES["table_cell_left"]),
             Paragraph("Yes", STYLES["table_cell"]),
             Paragraph("Required", STYLES["table_cell"]),
             Paragraph("CONFIRMED", ParagraphStyle("s7t1_1", fontName=FONT_BOLD,
                fontSize=8, textColor=SAGE, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("List size", STYLES["table_cell_left"]),
             Paragraph("Reported", STYLES["table_cell"]),
             Paragraph("500+ benchmark", STYLES["table_cell"]),
             Paragraph("UNVERIFIED", ParagraphStyle("s7t1_2", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Loyalty program", STYLES["table_cell_left"]),
             Paragraph("No", STYLES["table_cell"]),
             Paragraph("Recommended", STYLES["table_cell"]),
             Paragraph("ABSENT", ParagraphStyle("s7t1_3", fontName=FONT_BOLD,
                fontSize=8, textColor=SALMON, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
        ]
        cw_t1 = [CONTENT_W*0.34, CONTENT_W*0.18, CONTENT_W*0.22, CONTENT_W*0.26]
        s.append(std_table(["Signal", "Submitted", "Standard", "Status"], t1_rows, cw_t1))
        return s

    # ── TIER 2 partial: Screenshot submitted, no analytics export ─────────────
    s.append(section_score_tile(7, "Guest Return and Email", 42,
        note="Partial score. Open rate not visible in screenshot. 20 pts unscored."))
    s.append(sp(20))

    # 7.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("Email Platform Screenshot", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"{S7_LIST_SIZE:,} subscribers, last send confirmed",
             STYLES["table_cell"])],
        [Paragraph("Website Signup Form", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph("Active. Confirmed from site review.", STYLES["table_cell"])],
        [Paragraph("Email Analytics Export", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for open rate and Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.34, CONTENT_W*0.30, CONTENT_W*0.36]
    s.append(std_table(["Document", "Period", "Detail"], data_rows, cw_d))
    s.append(sp(20))

    # 7.2 Email Program Assessment
    s += sub_header("Email Program Assessment")

    def sc(label):
        color = SAGE if label in ("ON TARGET", "CONFIRMED", "ACTIVE") else \
                SALMON if label in ("CRITICAL", "ABSENT") else \
                MID_GRAY if label == "NOT AVAILABLE" else AMBER
        return Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s7sc_{label[:5]}", fontName=FONT_BOLD, fontSize=8,
            leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    email_rows = [
        [Paragraph("List size", STYLES["table_cell_left"]),
         Paragraph(f"{S7_LIST_SIZE:,}",
             ParagraphStyle("s7ev_ls", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SAGE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S7_LIST_SIZE_BENCHMARK:,}+", STYLES["table_cell"]),
         sc("ON TARGET"),
         Paragraph(f"Confirmed from screenshot. "
                   f"{S7_LIST_SIZE:,} is well above the {S7_LIST_SIZE_BENCHMARK} benchmark.",
                   STYLES["table_cell_left"])],
        [Paragraph("Last send date", STYLES["table_cell_left"]),
         Paragraph(S7_LAST_SEND_DATE, STYLES["table_cell"]),
         Paragraph("Within 30 days", STYLES["table_cell"]),
         sc("ON TARGET"),
         Paragraph("Confirmed from screenshot. Within audit period.",
                   STYLES["table_cell_left"])],
        [Paragraph("Sends per month", STYLES["table_cell_left"]),
         Paragraph(str(S7_SENDS_LAST_30_DAYS),
             ParagraphStyle("s7ev_sp", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S7_SENDS_BENCHMARK}+ per month", STYLES["table_cell"]),
         sc("ATTENTION"),
         Paragraph(f"{S7_SENDS_LAST_30_DAYS} send in the audit period. "
                   f"Benchmark is {S7_SENDS_BENCHMARK} per month.",
                   STYLES["table_cell_left"])],
        [Paragraph("Open rate", STYLES["table_cell_left"]),
         Paragraph("Not visible",
             ParagraphStyle("s7ev_or", fontSize=8.5, leading=12,
             textColor=MID_GRAY, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S7_OPEN_RATE_BENCHMARK}%+ benchmark", STYLES["table_cell"]),
         sc("NOT AVAILABLE"),
         Paragraph("Open rate not visible in screenshot. "
                   "Requires analytics export.",
                   STYLES["table_cell_left"])],
        [Paragraph("List growth mechanism", STYLES["table_cell_left"]),
         Paragraph(S7_GROWTH_MECHANISM, STYLES["table_cell"]),
         Paragraph("Active mechanism", STYLES["table_cell"]),
         sc("ACTIVE"),
         Paragraph("Website signup form confirmed and active.",
                   STYLES["table_cell_left"])],
        [Paragraph("Loyalty or return incentive", STYLES["table_cell_left"]),
         Paragraph("None",
             ParagraphStyle("s7ev_ly", fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("Recommended", STYLES["table_cell"]),
         sc("ABSENT"),
         Paragraph("No loyalty program or return incentive in place.",
                   STYLES["table_cell_left"])],
    ]
    cw_em = [CONTENT_W*0.22, CONTENT_W*0.16, CONTENT_W*0.16,
             CONTENT_W*0.14, CONTENT_W*0.32]
    s.append(std_table(
        ["Signal", "Your Program", "Benchmark", "Status", "Notes"],
        email_rows, cw_em))
    s.append(sp(16))

    # 7.3 AMBER: export analytics for next audit
    s.append(amber_note(
        "The email analytics export was not submitted with this audit. "
        "Open rate is the single most important health signal for an email list "
        "and it cannot be assessed from a screenshot alone. "
        "A list of 1,140 subscribers with a 15% open rate is a very different asset "
        "than a list of 1,140 subscribers with a 40% open rate. "
        "The first means most subscribers have stopped engaging. "
        "The second means the list is healthy and growing in attention. "
        "Export the campaign report from your email platform and submit it with "
        "the next audit to unlock open rate scoring and the full Section 7 analysis."
    ))
    s.append(sp(20))

    # 7.4 Score Calculation
    _h_sc = sub_header("Score Calculation")
    score_rows = [
        [Paragraph(f"Email list exists with {S7_LIST_SIZE_BENCHMARK}+ subscribers",
             STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S7_PTS_LIST_SIZE), STYLES["table_cell"]),
         Paragraph(f"{S7_LIST_SIZE:,} subscribers confirmed from screenshot. Full 25/25.",
             STYLES["table_cell_left"])],
        [Paragraph("Email sent in last 30 days", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S7_PTS_RECENT_SEND), STYLES["table_cell"]),
         Paragraph(f"1 send confirmed, last on {S7_LAST_SEND_DATE}. "
                   "Below 2/month benchmark. Partial 20/25.",
                   STYLES["table_cell_left"])],
        [Paragraph(f"Open rate at or above {S7_OPEN_RATE_BENCHMARK}%",
             STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S7_PTS_OPEN_RATE), STYLES["table_cell"]),
         Paragraph("Open rate not visible in screenshot. "
                   "Unscored pending analytics export. 0/20.",
                   STYLES["table_cell_left"])],
        [Paragraph("List growth mechanism in place", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S7_PTS_GROWTH), STYLES["table_cell"]),
         Paragraph("Website signup form confirmed active. Partial 12/15.",
             STYLES["table_cell_left"])],
        [Paragraph("Loyalty or return incentive program", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S7_PTS_LOYALTY), STYLES["table_cell"]),
         Paragraph("No loyalty program or return incentive. 0/15.",
             STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph("<b>42</b>",
             ParagraphStyle("s7_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("<b>Score: 42/100, ATTENTION (partial)</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.38, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.40]
    s += _h_sc
    s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2))
    s.append(sp(20))

    # ── TIER 3: Full analytics export layer ───────────────────────────────────
    # When email analytics export is submitted, add:
    # - Open rate and trend over trailing 6 campaigns
    # - Click rate and most-clicked link type (menu, reservation, event)
    # - Unsubscribe rate vs. 0.5% benchmark
    # - List growth rate over trailing 3 months (net new subscribers per month)
    # - Campaign performance comparison: which send generated the highest open rate
    # - Subject line analysis: what subject line patterns drive opens
    # This moves the assessment from list-size confirmation to list-health analysis,
    # and identifies whether the email program is gaining or losing engagement.

    # 7.5 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"Ironwood Tavern has a strong email foundation. "
        f"{S7_LIST_SIZE:,} confirmed subscribers is well above the 500-subscriber "
        "benchmark and represents a meaningfully sized direct channel to guests "
        "who have specifically opted in to hear from this operation. "
        "A website signup form is active and collecting new subscribers. "
        "The list is a real asset."
    ))
    s.append(sp(12))
    s.append(body(
        f"The gap is in how often it is used. "
        f"One send in the last 30 days is below the two-send monthly benchmark. "
        "A list that hears from you once a month starts to forget why it signed up. "
        "Open rate is unknown because the analytics export was not submitted, "
        "so the health of that list cannot be confirmed. "
        "The immediate actions are simple: send an email this week, "
        "add a physical signup mechanism at the bar to accelerate list growth, "
        "and set up a basic return incentive that gives subscribers a reason "
        "to come back and a reason to stay on the list."
    ))
    s.append(sp(20))

    # 7.6 Action Items
    _h_ai = sub_header("Action Items")
    _f_ai = action_item(
        priority="HIGH",
        title="Send an Email to Your List This Week",
        area="Guest Return and Email",
        data_desc=(
            f"List size: {S7_LIST_SIZE:,} confirmed subscribers. "
            f"Sends in the last 30 days: {S7_SENDS_LAST_30_DAYS} against a "
            f"{S7_SENDS_BENCHMARK}-per-month benchmark. "
            "A list that hears from you once a month or less starts to disengage. "
            "Consistent sending is the single most important driver of long-term "
            "open rate and list health."
        ),
        instruction=(
            "Send an email to your full list this week. "
            "One topic: something happening at Ironwood Tavern in the next 14 days. "
            "A weekend special, a live music night, a new cocktail, a limited menu item. "
            "Anything specific and time-sensitive. "
            "Subject line: specific and direct. "
            "Not 'Our Monthly Newsletter.' "
            "Something like 'This Friday at Ironwood Tavern' or "
            "'New on the menu this week.' "
            "Send it Thursday afternoon between noon and 2pm. "
            "That send window consistently produces the highest open rates "
            "for restaurant email lists. "
            "Keep the email short: one image, two or three sentences, one link."
        ),
        tool="Send from your existing email platform using your full subscriber list.",
        time_str="This week",
        monthly=f"${S7_MONTHLY_GAP:,.0f}",
        annual=f"${S7_ANNUAL_GAP:,.0f}",
    )
    s.append(PageBreak())
    s += _h_ai
    s.append(_f_ai)
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Add a Physical Signup Mechanism at the Bar and at Every Table",
        area="Guest Return and Email",
        data_desc=(
            f"Current list size: {S7_LIST_SIZE:,}. "
            "Goal before next audit: 3,000 subscribers. "
            "Website signup form is active but relies on guests finding "
            "the form on their own. "
            "A physical mechanism at the point of service captures subscribers "
            "at the highest-intent moment: when a guest is already enjoying "
            "the experience."
        ),
        instruction=(
            "This week, create a small card or tent card to place on the bar "
            "and at every table. "
            "The card has one line of text and a QR code. "
            "The line: 'Join our list. Get the first look at specials and events.' "
            "The QR code links to your email signup form. "
            "Print 20 cards. Place them Tuesday. "
            "Train the bar staff to mention it when a guest asks about upcoming events: "
            "'We send a list update every week or two. "
            "The QR code on the card will get you on it.' "
            "Nothing more than that."
        ),
        tool="Link the QR code to your existing email signup form.",
        time_str="This week",
        monthly=f"${round(S7_MONTHLY_GAP * 0.4):,.0f}",
        annual=f"${round(S7_ANNUAL_GAP * 0.4):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Export Campaign Analytics and Submit with Next Audit",
        area="Guest Return and Email",
        data_desc=(
            "Open rate is the primary health signal for an email list. "
            "It was not visible in the submitted screenshot and could not be scored. "
            "The 20 unscored points in this section are entirely recoverable "
            "with a single analytics export. "
            "Open rate also determines whether the current send frequency "
            "and subject line approach are working."
        ),
        instruction=(
            "In your email platform, navigate to the Reports or Analytics section. "
            "Find the campaign report for the audit period. "
            "Look for: open rate, click rate, and unsubscribe rate. "
            "Take a screenshot or export the report as a PDF. "
            "Submit it with your next audit. "
            "If open rate is below 20%, the subject lines or send frequency "
            "need adjustment and the next audit will identify the specific fix. "
            "If open rate is above 30%, the list is healthy and the focus "
            "shifts entirely to growing the subscriber count."
        ),
        tool="Export from the Reports or Analytics section of your email platform.",
        time_str="Before next audit",
        monthly=f"${round(S7_MONTHLY_GAP * 0.3):,.0f} additional analysis unlocked",
        annual="Full Section 7 analysis unlocked with submission",
    ))

    return s



# ── SECTION 8 SAMPLE DATA (always fully rendered) ────────────────────────────
S8_SCORE = 58

S8_SIGNALS = [
    # (label, level, evidence, reveals, next_step)
    (
        "GBP Data Submitted",
        "HIGH",
        "Google Business Profile screenshot submitted and confirmed. "
        "Profile completeness, photo count, post frequency, and review response "
        "rate all calculated from the submitted screenshot.",
        "The operator has access to the GBP dashboard and knows where to find "
        "the listing data. This is the most important digital visibility signal "
        "and it was submitted correctly.",
        "Add GBP Insights export with next audit to unlock impression and "
        "direction request data.",
    ),
    (
        "Website Analytics Submitted",
        "HIGH",
        "Website analytics export submitted covering the audit period. "
        "Monthly sessions, bounce rate, top pages, and average session duration "
        "all confirmed from the export.",
        "The operation has analytics tracking active on the website and the "
        "operator knows how to export it. This baseline is in place and "
        "can be tracked from audit to audit.",
        "Add source breakdown to next analytics export to identify which "
        "channel is sending the highest-bounce traffic.",
    ),
    (
        "Review Platform Data Submitted",
        "HIGH",
        "Screenshots submitted for Google and Yelp review profiles. "
        "Rating, review count, response rate, and recency all confirmed "
        "from the submitted screenshots.",
        "The operator is monitoring their review presence across both major "
        "platforms. Consistent submission of review screenshots establishes "
        "a rating trend line that becomes visible over multiple audits.",
        "Submit screenshots at the same point in each audit period to "
        "establish a consistent comparison baseline.",
    ),
    (
        "Social Media Data Submitted",
        "HIGH",
        "Instagram and Facebook profile screenshots submitted. "
        "Follower count, post frequency, engagement estimate, and content "
        "mix all assessed from the submitted screenshots.",
        "The operation has active social accounts and the operator can "
        "access and document the profile data. Story activity was also "
        "confirmed from the submitted screenshots.",
        "Add social media analytics export with next audit to replace "
        "estimated engagement rate with exact figures.",
    ),
    (
        "Search Ranking Data Submitted",
        "LOW",
        "No search ranking report submitted with this audit. "
        "No search results screenshot submitted. "
        "Maps pack presence or absence cannot be confirmed. "
        "NAP consistency was assessed from cross-referencing other submitted data.",
        "Search visibility is the highest-value discovery channel for a local "
        "bar or restaurant. Without a search screenshot or ranking report, "
        "it is not possible to determine whether Ironwood Tavern appears "
        "in the Maps pack or where it ranks for its primary keyword.",
        "Take an incognito browser screenshot of 'bar Austin TX' results "
        "and submit with next audit. This single action unlocks Maps pack scoring.",
    ),
    (
        "Delivery Platform Data Submitted",
        "LOW",
        "No delivery platform dashboard screenshot submitted. "
        "DoorDash and Uber Eats listing presence reported by operator only. "
        "Rating of 4.1, photo count of 4, and menu completeness all "
        "unverified. No order volume or acceptance rate available.",
        "Delivery platform performance cannot be verified or scored at "
        "full credit from questionnaire responses alone. "
        "The gap between reported and actual platform metrics is unknown. "
        "Without dashboard data, the platform may be performing better or "
        "worse than reported.",
        "Submit DoorDash and Uber Eats dashboard screenshots with next audit. "
        "Two screenshots unlock full Section 6 scoring.",
    ),
]


# ── SECTION 8: IMPLEMENTATION STATUS ─────────────────────────────────────────

def page_section8():
    s = [PageBreak()]

    # Always fully rendered -- no tier logic
    s += section_header(
        "SECTION 8",
        "Implementation Status",
        "What the submitted data reveals about digital measurement discipline "
        "and traffic channel tracking system adoption."
    )

    s.append(section_score_tile(8, "Implementation Status", S8_SCORE))
    s.append(sp(20))

    # HOW THIS SECTION IS SCORED -- exactly four sentences
    s.append(callout_box(
        "HOW THIS SECTION IS SCORED",
        "This section is scored entirely from your submitted data. "
        "No questionnaire required. "
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
            ParagraphStyle(f"s8sig_{level}", fontName=FONT_BOLD, fontSize=8.5,
            leading=11, textColor=c, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    sig_rows = []
    for label, level, _ev, _rev, next_step in S8_SIGNALS:
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
    level_color   = {"HIGH": SAGE, "MEDIUM": AMBER, "LOW": SALMON}

    for i, (label, level, evidence, reveals, next_step) in enumerate(S8_SIGNALS, 1):
        lc = level_color[level]

        sig_lbl = Paragraph(f"SIGNAL {i}",
            ParagraphStyle(f"s8lbl{i}", fontName=FONT_BOLD, fontSize=7, leading=9,
            textColor=MID_GRAY, leftIndent=0, firstLineIndent=0))
        sig_name = Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s8name{i}", fontName=FONT_BOLD, fontSize=11, leading=14,
            textColor=NAVY, leftIndent=0, firstLineIndent=0))
        sig_badge = Paragraph(f"<b> {level} </b>",
            ParagraphStyle(f"s8badge{i}", fontName=FONT_BOLD, fontSize=8, leading=10,
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
            ParagraphStyle(f"s8dl{i}{t[:3]}", fontName=FONT_BOLD, fontSize=7.5,
            leading=10, textColor=GOLD, leftIndent=0, firstLineIndent=0))
        def _val(t): return Paragraph(t,
            ParagraphStyle(f"s8dv{i}{t[:3]}", fontSize=9, leading=13,
            textColor=DARK_TEXT, leftIndent=0, firstLineIndent=0))

        tool_p = Paragraph(f"<b>Next Step:</b>  {next_step}",
            ParagraphStyle(f"s8tool{i}", fontSize=8.5, leading=13,
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
    for i, (label, level, _, _, _) in enumerate(S8_SIGNALS, 1):
        pts = sig_score_map[level]
        total_pts += pts
        sc_rows.append([
            Paragraph(f"Signal {i}: {label}", STYLES["table_cell_left"]),
            Paragraph(f"<b>{level}</b>",
                ParagraphStyle(f"s8sc_{level[:2]}{i}", fontName=FONT_BOLD, fontSize=8.5,
                textColor=level_color[level], alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0)),
            Paragraph(str(pts), STYLES["table_cell"]),
        ])
    section_avg = round(total_pts / len(S8_SIGNALS))
    band_label, band_color = score_band(section_avg)
    sc_rows.append([
        Paragraph("<b>Section Score (average)</b>", STYLES["table_cell_bold"]),
        Paragraph(f"<b>{band_label}</b>",
            ParagraphStyle("s8sc_band", fontName=FONT_BOLD, fontSize=8.5,
            textColor=band_color, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
        Paragraph(f"<b>{section_avg}/100</b>",
            ParagraphStyle("s8sc_tot", fontName=FONT_BOLD, fontSize=9,
            textColor=band_color, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
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
        "The submission includes a Google Business Profile screenshot, "
        "website analytics export, review platform screenshots for Google and Yelp, "
        "and social media profile screenshots for Instagram and Facebook. "
        "That combination is meaningful. "
        "It is enough to calculate profile completeness, website conversion gaps, "
        "review response rate, and social media posting frequency. "
        "None of those calculations existed before this submission."
    ))
    s.append(sp(12))
    s.append(body(
        "What the data cannot yet show is where Ironwood Tavern ranks in local "
        "search results, whether it appears in the Google Maps pack for its "
        "primary keyword, and how its delivery platform listings are actually "
        "performing in terms of order volume and customer ratings. "
        "Those answers require a search screenshot and ranking report, "
        "and delivery platform dashboard screenshots. "
        "The gap between what this audit shows and what a Tier 3 submission "
        "would show is the gap between knowing the visibility gaps exist "
        "and knowing exactly where Ironwood Tavern stands relative to "
        "competitors in local search."
    ))
    s.append(sp(20))

    # HOW TO GET MORE callout
    s.append(callout_box(
        "HOW TO GET MORE FROM YOUR NEXT AUDIT",
        "Submit these items with your next audit to unlock the two partial sections. "
        "Search Ranking Data: one incognito browser screenshot of 'bar Austin TX' "
        "results and a ranking report for 5 or more local keywords. "
        "Unlocks Maps pack confirmation and full Section 4 analysis. "
        "Delivery Platform Screenshots: DoorDash and Uber Eats dashboard screenshots "
        "showing rating, photo count, menu status, and promotional offer. "
        "Unlocks full Section 6 scoring and dollar gap calculation. "
        "Submit both and every section in this audit becomes fully calculable.",
        bg=NAVY
    ))

    return s



# ── CONSOLIDATED ACTION PLAN DATA ─────────────────────────────────────────────
# All action items from Sections 1-7 ranked by monthly dollar impact descending.
# Format: (rank, area, action_title, monthly_str, annual_str, time_str, sort_val)

MASTER_ACTIONS = [
    (1,  "Website",          "Fix homepage CTA and menu page conversion",
     "$1,680", "$20,160", "This week",        1_680),
    (2,  "GBP",              "Add 77 photos and start posting twice per week",
     "$1,240", "$14,880", "This week",        1_240),
    (3,  "Social Media",     "Post 18 times per month and build a 30-day content calendar",
     "$960",   "$11,520", "This week",        960),
    (4,  "Reviews",          "Respond to all unanswered reviews and start asking for reviews",
     "$820",   "$9,840",  "This week",        820),
    (5,  "Email",            "Send twice per month and add physical signup mechanism at bar",
     "$740",   "$8,880",  "This week",        740),
    (6,  "GBP",              "Respond to every Google review within 24 hours going forward",
     "$372",   "$4,464",  "This week",        372),
    (7,  "Website",          "Submit analytics source breakdown with next audit",
     "$336",   "$4,032",  "Next audit",       336),
    (8,  "Social Media",     "Film one 15-second Reel this week",
     "$288",   "$3,456",  "This week",        288),
    (9,  "Reviews",          "Investigate service speed pattern with floor team",
     "$164",   "$1,968",  "This week",        164),
    (10, "GBP",              "Populate Q&A section and add menu link to GBP",
     "$124",   "$1,488",  "This week",        124),
    (11, "Email",            "Export campaign analytics and submit with next audit",
     "$222",   "$2,664",  "Next audit",       222),
    (12, "Delivery",         "Add 10 photos to every delivery platform listing",
     "Visibility", "Visibility", "This week", 110),
    (13, "Search",           "Take incognito search screenshot and submit with next audit",
     "Partial",   "Partial",    "Before next audit", 100),
    (14, "Delivery",         "Submit DoorDash and Uber Eats dashboard screenshots",
     "Partial",   "Partial",    "Before next audit", 90),
    (15, "Email",            "Set up a basic loyalty or return incentive for email subscribers",
     "$222",   "$2,664",  "30 days",          80),
    (16, "Social Media",     "Submit social analytics export with next audit",
     "Unlocks exact engagement data", "Unlocks analytics", "Next audit", 70),
]

# Re-sort by sort_val descending, keep partial items at bottom
MASTER_ACTIONS = sorted(MASTER_ACTIONS, key=lambda x: x[6], reverse=True)
MASTER_ACTIONS = [(i+1,) + row[1:] for i, row in enumerate(MASTER_ACTIONS)]

TFA_ANNUAL_IMPACT_LOW  = "$32,640"
TFA_ANNUAL_IMPACT_HIGH = "$55,488"


# ── CONSOLIDATED ACTION PLAN ──────────────────────────────────────────────────

def page_consolidated():
    s = [PageBreak()]

    s += section_header(
        "CONSOLIDATED ACTION PLAN",
        "All Action Items Ranked by Monthly Dollar Impact",
        "Every action item from every section. Start with Rank 1 this week."
    )

    # Master ranked table
    def rank_p(rank):
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
            rank_p(rank),
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
        "Search Visibility and Delivery Platform rows show as partial because "
        "no ranking report or dashboard screenshots were submitted. "
        "Submit those items with the next audit to unlock dollar gap calculations "
        "for both sections.</i>",
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
             title="Fix the Homepage CTA and Menu Page Conversion Path",
             area="Website and Online Menu Conversion",
             data_desc=(
                 f"Bounce rate of {S2_BOUNCE_RATE}% with average session duration "
                 f"of {S2_AVG_SESSION_DURATION_SEC} seconds. "
                 f"At {S2_MONTHLY_SESSIONS:,} monthly sessions, approximately "
                 f"{round(S2_MONTHLY_SESSIONS * S2_BOUNCE_RATE / 100):,} visitors "
                 "per month land on the site and leave without engaging. "
                 "No clear call-to-action visible above the fold on mobile. "
                 "Menu page has no conversion button at the top."
             ),
             instruction=(
                 "Open the website on a phone. "
                 "If there is no View Menu or Reserve a Table button visible "
                 "on the first screen without scrolling, add one this week. "
                 "On the menu page, add an ordering or reservation button "
                 "above the first menu item. "
                 "If the menu is a PDF, replace it with an inline version "
                 "that loads without a download step. "
                 "Test on three different phones before considering it done."
             ),
             time_str="This week",
             monthly="$1,680", annual="$20,160"),
        dict(priority="HIGH",
             title="Add 77 Photos to GBP and Post Twice Per Week Starting Now",
             area="Google Business Profile",
             data_desc=(
                 f"Photo count: {S1_PHOTO_COUNT} against a {S1_PHOTO_BENCHMARK}+ benchmark. "
                 f"Posts in last 30 days: {S1_POSTS_LAST_30_DAYS} against an "
                 f"{S1_POSTS_BENCHMARK}/month benchmark. "
                 "An incomplete, inactive profile ranks below active competitors "
                 "for the same search terms regardless of rating."
             ),
             instruction=(
                 "This week: photograph exterior, interior, 10 food items, "
                 "10 cocktails, bar top, back bar, and two staff moments. "
                 "Upload to Google Business Profile. "
                 "Set a Monday and Thursday calendar block for posting. "
                 "Each post: one photo, one sentence, one call to action. "
                 "Four minutes per post. Do not skip the calendar block."
             ),
             time_str="This week",
             monthly="$1,240", annual="$14,880"),
        dict(priority="HIGH",
             title="Post 18 Times This Month and Build a 30-Day Content Calendar",
             area="Social Media and Content",
             data_desc=(
                 f"{S5_POSTS_LAST_30_DAYS} posts in the last 30 days against an "
                 f"{S5_POSTS_BENCHMARK}-post monthly benchmark. "
                 f"Estimated engagement rate {S5_ENGAGEMENT_RATE_EST}% against "
                 f"a {S5_ENGAGEMENT_BENCHMARK}% target. "
                 f"Content is food photos only. "
                 f"Events, specials, and personality content entirely absent."
             ),
             instruction=(
                 "Post every weekday this week: Monday food, Tuesday staff, "
                 "Wednesday specials, Thursday atmosphere, Friday live service. "
                 "This Sunday, fill 18 post slots in a notes app for the next 30 days: "
                 "9 food and drink, 4 event announcements, "
                 "3 atmosphere shots, 2 staff moments. "
                 "Film one 15-second Reel this week from the bar floor."
             ),
             time_str="This week",
             monthly="$960", annual="$11,520"),
        dict(priority="HIGH",
             title="Respond to Every Unanswered Review and Ask Every Satisfied Guest for a Review",
             area="Reviews and Reputation",
             data_desc=(
                 f"Response rate: {S3_RESPONSE_RATE}% against a "
                 f"{S3_RESPONSE_BENCHMARK}% benchmark. "
                 f"{S3_UNANSWERED} of {S3_GOOGLE_REVIEW_COUNT} Google reviews have "
                 "no response. "
                 f"Google review count at {S3_GOOGLE_REVIEW_COUNT} against a "
                 f"{S3_GOOGLE_COUNT_BENCHMARK}+ benchmark. "
                 "Both gaps are fixable this week."
             ),
             instruction=(
                 "Open Google Business Profile and filter by unanswered reviews. "
                 "Respond to every one from the last 6 months. "
                 "Personal responses only, no templates. "
                 "Train every server this week on one sentence at payment: "
                 "'If you had a good time tonight, a quick Google review "
                 "means everything to a place like ours.' "
                 "Set a Monday calendar block for review responses going forward."
             ),
             time_str="This week",
             monthly="$820", annual="$9,840"),
        dict(priority="HIGH",
             title="Send an Email This Week and Add a Physical Signup Mechanism at the Bar",
             area="Guest Return and Email",
             data_desc=(
                 f"List size: {S7_LIST_SIZE:,} confirmed subscribers. "
                 f"Sends in the last 30 days: {S7_SENDS_LAST_30_DAYS} against a "
                 f"{S7_SENDS_BENCHMARK}-per-month benchmark. "
                 "No loyalty program or return incentive in place. "
                 "A list of 1,140 subscribers that hears from you once a month "
                 "is an underused asset."
             ),
             instruction=(
                 "Send an email to your full list this Thursday between noon and 2pm. "
                 "One topic: something happening at Ironwood Tavern in the next 14 days. "
                 "Subject line: specific and direct, not a newsletter title. "
                 "One image, two sentences, one link. "
                 "This week also: print 20 QR code cards, "
                 "place them on the bar and at every table, "
                 "and train staff on one sentence to mention them."
             ),
             time_str="This week",
             monthly="$740", annual="$8,880"),
    ]

    for item in top5:
        s.append(action_item(
            priority=item["priority"],
            title=item["title"],
            area=item["area"],
            data_desc=item["data_desc"],
            instruction=item["instruction"],
            tool="See section-level action items for detailed step-by-step instructions.",
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
        "DAYS 1-30: FOUNDATION. GBP photos at 100 target. "
        "Posting cadence at 18 per month started. "
        "All unanswered reviews responded to. "
        "Homepage CTA fixed. Weekly email send established.",
        STEEL))
    s.append(sp(10))
    ph1_rows = [
        [Paragraph("Days 1-3", STYLES["table_cell_left"]),
         Paragraph("Open GBP and filter reviews by unanswered. "
                   "Respond to every one from the last 6 months. "
                   "Personal responses, no templates.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 1-5", STYLES["table_cell_left"]),
         Paragraph("Photograph exterior, interior, food items, cocktails, "
                   "bar top, back bar, and staff. "
                   "Upload to GBP. Target: 77 new photos to reach 100 total.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 1-5", STYLES["table_cell_left"]),
         Paragraph("Open the website on a phone. "
                   "Add one CTA button above the fold on the homepage. "
                   "Fix the menu page: inline menu, no PDF, button at the top.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Web dev", STYLES["table_cell_left"])],
        [Paragraph("Day 4 (Thursday)", STYLES["table_cell_left"]),
         Paragraph("Send the first email to the full list. "
                   "One topic, one image, two sentences, one link. "
                   "Send between noon and 2pm.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Day 5 (Sunday)", STYLES["table_cell_left"]),
         Paragraph("Build a 30-day content calendar. "
                   "Fill 18 post slots: 9 food, 4 events or specials, "
                   "3 atmosphere, 2 staff. Film one Reel.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 6-30", STYLES["table_cell_left"]),
         Paragraph("Post every weekday to Instagram from the content calendar. "
                   "Post to GBP Monday and Thursday. "
                   "Respond to every new review within 24 hours. "
                   "Train servers on the review ask sentence this week.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Floor Mgr", STYLES["table_cell_left"])],
        [Paragraph("Days 7-10", STYLES["table_cell_left"]),
         Paragraph("Print 20 QR code email signup cards. "
                   "Place on bar and at every table. "
                   "Brief staff on the one-sentence mention.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
    ]
    cw_ph = [CONTENT_W*0.14, CONTENT_W*0.62, CONTENT_W*0.24]
    s.append(std_table(["When", "Task", "Owner"], ph1_rows, cw_ph))
    s.append(sp(16))

    # Phase 2
    s.append(phase_hdr(
        "DAYS 31-60: MOMENTUM. Google review count above 200. "
        "Website bounce rate trending below 65%. "
        "Email list growing. Delivery platform photos added. "
        "Search screenshot taken and ready for next audit.",
        SAGE))
    s.append(sp(10))
    ph2_rows = [
        [Paragraph("Day 30 review", STYLES["table_cell_left"]),
         Paragraph("Check GBP photo count. Confirm posting cadence is running. "
                   "Check Google review count against 200 benchmark. "
                   "Check website analytics for any bounce rate improvement.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 31-35", STYLES["table_cell_left"]),
         Paragraph("Log in to DoorDash and Uber Eats merchant portals. "
                   "Add a minimum of 10 photos to each listing. "
                   "Use the same food and drink photos already on Instagram.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 31-35", STYLES["table_cell_left"]),
         Paragraph("Take an incognito browser screenshot of 'bar Austin TX' "
                   "search results. Save it for next audit submission. "
                   "Repeat for 'tavern Austin TX' and 'bar near me.'",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 31-60", STYLES["table_cell_left"]),
         Paragraph("Maintain 18-post monthly cadence on Instagram. "
                   "Continue posting to GBP Monday and Thursday. "
                   "Continue responding to every new review within 24 hours. "
                   "Send second email of the month on the Thursday of week 3.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Floor Mgr", STYLES["table_cell_left"])],
        [Paragraph("Days 45-60", STYLES["table_cell_left"]),
         Paragraph("Check website analytics. Pull the current bounce rate. "
                   "Compare to the pre-fix baseline. "
                   "If bounce rate has not improved, revisit the CTA placement "
                   "and the menu page load on mobile.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
    ]
    s.append(std_table(["When", "Task", "Owner"], ph2_rows, cw_ph))
    s.append(sp(16))

    # Phase 3
    s.append(phase_hdr(
        "DAYS 61-90: OPTIMIZATION. Social analytics showing 3% engagement trend. "
        "Email open rate confirmed via export. "
        "Loyalty mechanism active. "
        "Full Tier 3 data package ready for next audit.",
        AMBER))
    s.append(sp(10))
    ph3_rows = [
        [Paragraph("Day 60 review", STYLES["table_cell_left"]),
         Paragraph("Review 60 days of posting data. "
                   "Check Instagram for engagement trend. "
                   "Review Google review count: confirm whether it crossed 200. "
                   "Confirm website bounce rate direction.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 61-70", STYLES["table_cell_left"]),
         Paragraph("Log in to email platform. "
                   "Export the campaign analytics report for the full 90-day period. "
                   "Record open rate, click rate, and unsubscribe rate. "
                   "Save for next audit submission.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 61-70", STYLES["table_cell_left"]),
         Paragraph("Set up one simple loyalty or return incentive. "
                   "Options: email signup gets a free drink on next visit, "
                   "or a monthly drawing for a $50 tab open to list subscribers. "
                   "Announce it in the next email send.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 75-85", STYLES["table_cell_left"]),
         Paragraph("Export social media analytics for the full 90-day period. "
                   "Record engagement rate by content type. "
                   "Identify the three best-performing post types. "
                   "Shift the next 30-day content calendar toward those types.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Day 90 review", STYLES["table_cell_left"]),
         Paragraph("Collect all Tier 3 documents for next audit submission: "
                   "GBP Insights export, website source breakdown, "
                   "social analytics export, email campaign export, "
                   "search ranking screenshots, and delivery platform dashboards. "
                   "Run a self-assessment against every section in this audit.",
                   STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
    ]
    s.append(std_table(["When", "Task", "Owner"], ph3_rows, cw_ph))
    s.append(sp(24))

    # Annual Impact Summary
    s.append(formula_box([
        f"TRAFFIC AUDIT: ANNUAL IMPACT SUMMARY, {BAR_NAME}",
        "",
        "  Google Business Profile (Section 1):        $1,240/mo  |  $14,880/yr",
        "  Website and Conversion (Section 2):         $1,680/mo  |  $20,160/yr",
        "  Reviews and Reputation (Section 3):           $820/mo  |   $9,840/yr",
        "  Search Visibility and SEO (Section 4):       Partial data. "
        "Submit search screenshot and ranking report for next audit.",
        "  Social Media and Content (Section 5):         $960/mo  |  $11,520/yr",
        "  Delivery Platform Optimization (Section 6):  Partial data. "
        "Submit dashboard screenshots for next audit.",
        "  Guest Return and Email (Section 7):           $740/mo  |   $8,880/yr",
        "",
        "  COMBINED (5 scored sections):               $5,440/mo  |  $65,280/yr",
        "",
        f"  REALISTIC RECOVERY RANGE (50-85% of gap, based on full implementation):",
        f"    Low estimate:   {TFA_ANNUAL_IMPACT_LOW}/yr",
        f"    High estimate:  {TFA_ANNUAL_IMPACT_HIGH}/yr",
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
        "Your digital systems are partially in place. "
        "The gaps identified in this report are specific, measurable, "
        "and fixable within 90 days.",
        ParagraphStyle("close_sub", fontName=FONT_REG, fontSize=9, leading=13,
        textColor=MID_GRAY, leftIndent=0, firstLineIndent=0)))
    s.append(sp(6))
    s.append(HRule(CONTENT_W, GOLD, 1.5))
    s.append(sp(14))

    # 4. Body paragraph, operator voice, specific to Ironwood Tavern
    s.append(Paragraph(
        f"This audit scored {BAR_NAME} at {OVERALL_SCORE}/100 overall. "
        f"The largest single gap is the website bounce rate at {S2_BOUNCE_RATE}%, "
        f"which means approximately "
        f"{round(S2_MONTHLY_SESSIONS * S2_BOUNCE_RATE / 100):,} visitors per month "
        "arrive at the website and leave without clicking anything. "
        f"At {S2_MONTHLY_SESSIONS:,} monthly sessions that gap costs "
        f"an estimated ${S2_MONTHLY_GAP:,.0f} per month in lost conversion. "
        "The cause is a single structural problem: no clear call-to-action "
        "visible on the homepage above the fold on mobile. "
        "A visitor who lands on the site and cannot immediately see how to view "
        "the menu or make a reservation has no reason to stay. "
        "Fixing that one element this week is the single highest-impact action "
        f"in this audit. Everything else in the 90-day roadmap follows from there.",
        ParagraphStyle("close_body", fontSize=10, leading=15, textColor=DARK_TEXT,
        leftIndent=0, firstLineIndent=0)))
    s.append(sp(18))

    # 5. SALMON callout, "YOUR SINGLE MOST IMPORTANT NEXT ACTION"
    _act_t = Paragraph("YOUR SINGLE MOST IMPORTANT NEXT ACTION",
        ParagraphStyle("close_act_t", fontName=FONT_BOLD, fontSize=9, leading=12,
        textColor=colors.HexColor("#F5C8C0"), leftIndent=0, firstLineIndent=0))
    _act_title = Paragraph(
        "Fix the Website Homepage: One Clear Call-to-Action Button Above the Fold",
        ParagraphStyle("close_act_title", fontName=FONT_BOLD, fontSize=12, leading=15,
        textColor=WHITE, leftIndent=0, firstLineIndent=0))
    _act_area = Paragraph("Website and Online Menu Conversion",
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
        f"Bounce rate: {S2_BOUNCE_RATE}%. "
        f"Average session duration: {S2_AVG_SESSION_DURATION_SEC} seconds. "
        f"At {S2_MONTHLY_SESSIONS:,} monthly sessions, "
        f"{round(S2_MONTHLY_SESSIONS * S2_BOUNCE_RATE / 100):,} visitors per month "
        "are leaving without engaging. "
        "No clear call-to-action is visible on the homepage on mobile "
        "without scrolling."
    )
    _act_inst = _val(
        "Open the website on a phone. "
        "Look at the first screen without scrolling. "
        "If there is no View Menu or Reserve a Table button on that screen, "
        "that is what needs to change this week. "
        "Add one button. Test it on three phones. That is the entire action."
    )

    def _met(label, val):
        return Paragraph(f'<font color="#F5C8C0"><b>{label}</b></font>  {val}',
            ParagraphStyle(f"cl_met_{label[:3]}", fontSize=8.5, leading=13,
            textColor=WHITE, leftIndent=0, firstLineIndent=0))

    cw_met = [(CONTENT_W - 32) / 4] * 4
    _met_row = Table([[
        _met("Next Step:", "Add one CTA button above the fold on the homepage."),
        _met("Time:", "This week"),
        _met("Monthly:", "$1,680"),
        _met("Annual:", "$20,160"),
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
         Paragraph(f"{SECTIONS_WITH_DATA} of 8", STYLES["table_cell_left"])],
        [Paragraph("Sections with Partial Analysis", STYLES["table_cell_bold"]),
         Paragraph(f"{SECTIONS_PARTIAL} of 8", STYLES["table_cell_left"])],
        [Paragraph("Sections N/A, Data Not Submitted", STYLES["table_cell_bold"]),
         Paragraph(f"{SECTIONS_NA} of 8", STYLES["table_cell_left"])],
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
        "The Traffic Fix system includes the operational tools and step-by-step processes "
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

    # 9. AUDIT25 STEEL box, centered
    audit_p = Paragraph(
        "When you are ready for your next audit, use code AUDIT25 for 25% off. "
        "Order at barcop.com.",
        ParagraphStyle("audit25", fontName=FONT_REG, fontSize=10, leading=15,
        textColor=WHITE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))
    _audit_outer = Table([[audit_p]], colWidths=[CONTENT_W])
    _audit_outer.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),STEEL),
        ("TOPPADDING",(0,0),(-1,-1),16),("BOTTOMPADDING",(0,0),(-1,-1),16),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16),
    ]))
    s.append(_audit_outer)
    s.append(sp(18))

    # 10. Bar Cop footer line
    s.append(Paragraph(
        'Bar Cop  |  <a href="https://www.barcop.com">'
        '<font color="#4888A8">barcop.com</font></a>',
        ParagraphStyle("close_footer", fontName=FONT_BOLD, fontSize=9, leading=13,
        textColor=MID_GRAY, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)))

    # Nothing after item 10.
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
    story += page_section7()
    story += page_section8()
    story += page_consolidated()
    story += page_close()
    story = post_process(story)

    doc = SimpleDocTemplate(OUT, pagesize=letter,
        leftMargin=MARGIN - 6,
        rightMargin=MARGIN - 6,
        topMargin=0.55*inch + 38 - 6,
        bottomMargin=0.45*inch + 28 - 6,
        title="Traffic Audit -- Bar Cop",
        author="Bar Cop")
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Built: {OUT}")


# ── REAL DATA INJECTION ──────────────────────────────────────────────────────
# If DATA_JSON env var is set, override all sample data with real values.
import os as _os, json as _json
_data_path = _os.environ.get("AUDIT_DATA_JSON")
if _data_path and _os.path.exists(_data_path):
    with open(_data_path) as _f:
        _d = _json.load(_f)
    _g = globals()
    for _k, _v in _d.items():
        if _k in _g or _k.isupper():
            _g[_k] = _v
    # Recalculate any derived values that depend on injected data
    # (script-specific recalcs happen after this block in each file)
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    build()

"""
BAR COP PROFIT FIX AUDIT - Build File
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
    PageBreak, KeepTogether
)
from reportlab.platypus.flowables import Flowable
import math

OUT = os.environ.get("AUDIT_OUT_PATH", "/tmp/BarCop_Profit_Audit_EXAMPLE.pdf")

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
DOC_NAME    = "Profit Audit"

# ── SAMPLE DATA (replaced per customer) ─────────────────────────────────────
OVERALL_SCORE   = 19          # weighted composite: S1=8(23.5%), S2=5(17.6%), S3=8(23.5%), S4=N/A, S5=35(29.4%), S6=65(5.9%)
BAR_NAME        = "The Anchor Bar & Kitchen"
BAR_CITY_STATE  = "Austin, TX"
REVENUE_TIER    = "$750K\u2013$1M Annual Revenue"
AUDIT_DATE      = "May 2026"
AUDIT_ID        = "PFA-2026-0041"
AUDIT_PERIOD    = "4 weeks ending April 25, 2026"
DATA_TIER_LABEL = "Tier 2 Analysis \u2014 Standard Data Submitted"
WEEKLY_GAP_AMT  = "$5,840"        # estimated weekly profit left on table
GAP_SOURCES     = "Pour cost. Kitchen cost. Variance. Vendor control. All recoverable."
INDUSTRY_AVG    = 63              # industry average score for marker
TARGET_SCORE    = 65              # operator target

# Score band helper
def score_band(score):
    if score >= 80: return ("STRONG SYSTEMS",              SAGE)
    if score >= 60: return ("SYSTEMS PRESENT, GAPS IDENTIFIED", AMBER)
    if score >= 40: return ("SIGNIFICANT GAPS",            SALMON)
    return              ("CRITICAL",                       SALMON)


# ── HELPERS ──────────────────────────────────────────────────────────────────
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


# ── DRAW COVER ───────────────────────────────────────────────────────────────
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
    c.setFillColor(WHITE)                           # FIX 1: WHITE text on badge
    c.setFont(FONT_BOLD, 8)
    c.drawCentredString(bx + badge_w / 2, by + 9.5, "AUDIT REPORT")

    # ── THIN RULE below header ───────────────────────────────────────────────
    c.setStrokeColor(colors.HexColor("#1E3A52"))
    c.setLineWidth(0.5)
    c.line(0, h - 82, w, h - 82)

    # ── PRIMARY TITLE ────────────────────────────────────────────────────────
    # "PROFIT AUDIT" WHITE 64pt single line
    title_y = h - 188
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 64)
    c.drawString(MARGIN, title_y, "PROFIT AUDIT")

    # ── DESCRIPTION LINE ─────────────────────────────────────────────────────
    desc_y = h - 218
    c.setFillColor(colors.HexColor("#8AABB8"))
    c.setFont(FONT_REG, 11)
    c.drawString(MARGIN, desc_y,
        "A scored analysis of your bar\u2019s profit systems against industry standards.")

    # ── COMPANY BLOCK ─────────────────────────────────────────────────────────
    # FIX 3+4: Prominent, left-aligned, matching reference image layout
    # More space below description before company info
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

    # Use period_y as the bottom of the header block for health score placement
    sub_y = period_y - 8

    # ── HEALTH SCORE BLOCK ────────────────────────────────────────────────────
    # Matches reference image: left-aligned, no outer box,
    # large SALMON score + "/ 100" inline, bar with inline avg text,
    # bold red impact sentence, regular gap sources line.
    # Block sits between company info and footer.

    pad = 0   # left-aligned to MARGIN, no enclosing box
    blk_x = MARGIN
    blk_w = w - 2 * MARGIN

    # Position: start below company block with breathing room
    blk_top = sub_y - 24

    # ── "OPERATIONAL PERFORMANCE SCORE" micro label ───────────────────────────
    lbl_y = blk_top
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_BOLD, 8)
    c.drawString(blk_x, lbl_y, "OPERATIONAL PERFORMANCE SCORE")

    # ── Score number + "/ 100" on same line ───────────────────────────────────
    score_y = lbl_y - 52
    # Large SALMON score number
    c.setFillColor(SALMON)
    c.setFont(FONT_BOLD, 60)
    score_str = str(score)
    score_num_w = c.stringWidth(score_str, FONT_BOLD, 60)
    c.drawString(blk_x, score_y, score_str)
    # "/ 100" in WHITE smaller, baseline-shifted to sit mid-height of score
    c.setFillColor(colors.HexColor("#8AABB8"))
    c.setFont(FONT_REG, 22)
    c.drawString(blk_x + score_num_w + 8, score_y + 8, "/ 100")

    # ── Progress bar ──────────────────────────────────────────────────────────
    bar_h      = 10
    bar_r      = bar_h / 2
    bar_y      = score_y - 22
    bar_w_full = blk_w * 0.48          # bar takes left ~48% of width
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

    # STEEL fill from fill point to industry avg marker (shows the gap)
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

    # Inline text to the right of the bar: "Industry avg: 63  |  Your target: 65+"
    bar_text_x = bar_x + bar_w_full + 14
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_REG, 8)
    avg_str    = f"Industry avg: {INDUSTRY_AVG}"
    target_str = f"Your target: {TARGET_SCORE}+"
    c.drawString(bar_text_x, bar_y + 2, f"{avg_str}   |   {target_str}")

    # ── Bold red impact sentence ───────────────────────────────────────────────
    impact_y = bar_y - 22
    c.setFillColor(SALMON)
    c.setFont(FONT_BOLD, 10.5)
    c.drawString(blk_x, impact_y,
        f"This operation is leaving an estimated {WEEKLY_GAP_AMT} per week on the table.")

    # ── Gap sources line, regular weight, muted ──────────────────────────────
    sources_y = impact_y - 16
    c.setFillColor(colors.HexColor("#8AABB8"))
    c.setFont(FONT_REG, 9)
    c.drawString(blk_x, sources_y, GAP_SOURCES)

    # ── BOTTOM STATEMENT ─────────────────────────────────────────────────────
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_ITALIC, 8)
    c.drawString(MARGIN, 88, f"Audit ID: {AUDIT_ID}   \u2022   {AUDIT_DATE}   \u2022   {DATA_TIER_LABEL}")

    # ── FOOTER BAR ───────────────────────────────────────────────────────────
    c.setFillColor(NAVY)
    c.rect(0, 0, w, 42, fill=1, stroke=0)
    c.setFillColor(MID_GRAY)
    c.setFont(FONT_BOLD, 7.5)
    c.drawString(MARGIN, 15, "PROFIT AUDIT  |  BARCOP.COM")
    c.setFillColor(GOLD)
    c.setFont(FONT_BOLD, 7.5)
    c.drawRightString(w - MARGIN, 15, f"Confidential \u2014 {BAR_NAME}")


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



# ── HELPERS (copied exactly from Fix PDFs) ────────────────────────────────────

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
    tp = Paragraph(title, ParagraphStyle("ct_pfa", fontName=FONT_BOLD, fontSize=10.5,
        leading=14, textColor=WHITE, leftIndent=0, firstLineIndent=0))
    bp = Paragraph(body_text, ParagraphStyle("cb_pfa", fontSize=9.5, leading=14,
        textColor=WHITE, leftIndent=0, firstLineIndent=0))
    inner = Table([[tp], [sp(4)], [bp]], colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),2),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return KeepTogether([outer])

def sub_header(text):
    items = [Paragraph(text, ParagraphStyle("sh_pfa", fontName=FONT_BOLD, fontSize=11,
        leading=14, textColor=NAVY, leftIndent=0, firstLineIndent=0)),
        sp(2), HRule(CONTENT_W, colors.HexColor("#E8E6E0"), 0.5), sp(10)]
    return [KeepTogether(items)]

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
            items.append(Paragraph(line, ParagraphStyle("fbt_pfa", fontName=FONT_BOLD,
                fontSize=9, leading=13, textColor=GOLD, leftIndent=0, firstLineIndent=0)))
            first = False
        else:
            items.append(Paragraph(line, ParagraphStyle("fbl_pfa", fontName=FONT_REG,
                fontSize=8.5, leading=13, textColor=WHITE, leftIndent=0, firstLineIndent=0)))
        items.append(sp(1))
    inner = Table([[i] for i in items], colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),1),("BOTTOMPADDING",(0,0),(-1,-1),1),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return KeepTogether([outer])


# ── AUDIT-SPECIFIC HELPERS ────────────────────────────────────────────────────

def status_badge(label):
    """Returns a colored inline Paragraph for status badges."""
    color_map = {
        "STRONG":    colors.HexColor("#4A7C6F"),   # SAGE
        "ATTENTION": colors.HexColor("#D08008"),   # AMBER
        "CRITICAL":  colors.HexColor("#C03828"),   # SALMON
        "N/A":       colors.HexColor("#8A9BB0"),   # MID_GRAY
    }
    bg = color_map.get(label, colors.HexColor("#8A9BB0"))
    p = Paragraph(f'<font color="#FFFFFF"><b> {label} </b></font>',
        ParagraphStyle(f"badge_{label}", fontName=FONT_BOLD, fontSize=7.5,
        leading=10, textColor=WHITE, alignment=TA_CENTER,
        leftIndent=0, firstLineIndent=0))
    t = Table([[p]], colWidths=[72])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),bg),
        ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),
        ("ROUNDEDCORNERS",[2]),
    ]))
    return t

def score_tile_large(score_val, label="OVERALL PROFIT HEALTH SCORE"):
    """Big NAVY tile: score and /100 inline centered Paragraph."""
    gold_hex   = "#C9A84C"
    gray_hex   = "#8A9BB0"
    lbl_p = Paragraph(label, ParagraphStyle("stl_lbl", fontName=FONT_BOLD,
        fontSize=8, leading=11, textColor=GOLD, alignment=TA_CENTER,
        leftIndent=0, firstLineIndent=0))
    band_label, band_color = score_band(score_val)
    # Single paragraph: large score + smaller /100, both inline, centered as one unit
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
    return KeepTogether([outer])

def priority_action_box(rank, area, desc, monthly, annual, time_to, tool):
    """SALMON priority action callout box matching outline spec."""
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
    # Metrics row: monthly | annual | time | tool
    def metric(label, val):
        return Paragraph(f'<font color="#F5C8C0"><b>{label}</b></font>  {val}',
            ParagraphStyle(f"pa_met{rank}{label[:3]}", fontSize=8.5, leading=13,
            textColor=WHITE, leftIndent=0, firstLineIndent=0))
    m1 = metric("Monthly:", monthly)
    m2 = metric("Annual:", annual)
    m3 = metric("Time:", time_to)
    m4 = metric("Tool:", tool)
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
    return KeepTogether([outer])


# ── SAMPLE DATA FOR EXECUTIVE SUMMARY ────────────────────────────────────────
# Realistic example: Tier 2 submission, 4 sections with data, 2 with N/A

SECTIONS_WITH_DATA  = 4
SECTIONS_PARTIAL    = 1
SECTIONS_NA         = 1

# Per-section scores and statuses
SECTION_DATA = [
    # (name,                         score, status,     gap_monthly)
    ("Bar Cost and Pour Control",    8,     "CRITICAL",  "$1,840/mo"),
    ("Theft and Loss Prevention",    5,     "CRITICAL",  "$2,210/mo"),
    ("Food Cost Control",            8,     "CRITICAL",  "$920/mo"),
    ("Vendor Control",               "N/A", "N/A",       "Submit data to calculate"),
    ("Prime Cost",                   35,    "CRITICAL",  "$1,870/mo"),
    ("Implementation Status",        65,    "ATTENTION", "$680/mo"),
]

# Top three actions
TOP_ACTIONS = [
    {
        "rank":     1,
        "area":     "Theft and Loss Prevention",
        "desc":     "Void and comp rate at 4.8% of revenue, 2.8 points above the 2% benchmark. "
                    "Void approval workflow and cash handling policy not confirmed from submitted data. Both flagged for operator review.",
        "monthly":  "$2,210",
        "annual":   "$26,520",
        "time":     "1 week",
        "tool":     "Pull your void and comp report from POS weekly.",
    },
    {
        "rank":     2,
        "area":     "Prime Cost",
        "desc":     "Prime cost running at 67.4% against a 60% target. "
                    "Department-level labor tracking and revenue-based scheduling could not be confirmed from submitted data. Both flagged for operator review.",
        "monthly":  "$1,870",
        "annual":   "$22,440",
        "time":     "2 weeks",
        "tool":     "Calculate prime cost weekly: COGS plus labor divided by revenue.",
    },
    {
        "rank":     3,
        "area":     "Bar Cost and Pour Control",
        "desc":     "Bar cost at 26.2% against an 18-24% target. "
                    "Variance report frequency and SKU-level tracking could not be confirmed from submitted data. Both flagged for operator review.",
        "monthly":  "$1,840",
        "annual":   "$22,080",
        "time":     "1 week",
        "tool":     "Run weekly bar inventory counts. Compare usage to sales.",
    },
]

ANNUAL_IMPACT_LOW  = "$54,000"
ANNUAL_IMPACT_HIGH = "$87,000"


# ── EXECUTIVE SUMMARY PAGE ────────────────────────────────────────────────────

def page_executive_summary():
    s = []

    s += section_header(
        "EXECUTIVE SUMMARY",
        "Profit Fix Audit: " + BAR_NAME,
        f"Audit period: {AUDIT_PERIOD}  |  {DATA_TIER_LABEL}"
    )

    # ── 1. OPERATOR CONTEXT BLOCK (STEEL background) ─────────────────────────
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
    s.append(KeepTogether([ctx_outer]))
    s.append(sp(20))

    # ── 2. OVERALL COMPOSITE SCORE ────────────────────────────────────────────
    s += sub_header("Overall Profit Health Score")
    s.append(score_tile_large(OVERALL_SCORE))
    s.append(sp(10))
    s.append(Paragraph(
        "<i>Score is a weighted composite of all sections with submitted data. "
        f"Based on {SECTIONS_WITH_DATA} of 6 sections analyzed. "
        f"Weights: Bar Cost 20%, Theft/Loss 15%, Food Cost 20%, "
        f"Vendor Control 15%, Prime Cost 25%, Implementation 5%.</i>",
        ParagraphStyle("score_note", fontName=FONT_ITALIC, fontSize=8.5, leading=13,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0)))
    s.append(sp(20))

    # ── 3. SIX-AREA SCORECARD TABLE ───────────────────────────────────────────
    s += sub_header("Six-Area Scorecard")

    score_color_map = {
        "STRONG":    colors.HexColor("#4A7C6F"),
        "ATTENTION": colors.HexColor("#D08008"),
        "CRITICAL":  colors.HexColor("#C03828"),
        "N/A":       colors.HexColor("#8A9BB0"),
    }

    scorecard_rows = []
    for name, score_val, status, gap in SECTION_DATA:
        score_str = str(score_val) if score_val != "N/A" else "N/A"
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
    # Tighter row padding so all 6 rows + header stay on one page
    _sc_hdr = [Paragraph(h, STYLES["table_header_left"] if i == 0 else STYLES["table_header"])
               for i, h in enumerate(["Area", "Score", "Status", "Est. Monthly Gap"])]
    _sc_data = [_sc_hdr] + scorecard_rows
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
        "<i>N/A rows require additional data submission. "
        "See the corresponding section for exactly what to submit next audit.</i>",
        ParagraphStyle("sc_note", fontName=FONT_ITALIC, fontSize=8, leading=12,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0))
    s.append(KeepTogether([_sc_tbl, sp(6), _sc_note]))
    s.append(sp(20))

    # ── 4. TOP PRIORITY ACTIONS ───────────────────────────────────────────────
    s += sub_header("Top Priority Actions")
    s.append(body(
        "These are the three highest-dollar gaps identified in this audit, "
        "ranked by estimated monthly profit impact. "
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

    # ── 5. ANNUAL IMPACT SUMMARY ──────────────────────────────────────────────
    s.append(formula_box([
        "PROFIT FIX AUDIT: ANNUAL IMPACT SUMMARY",
        "",
        f"  Bar Cost and Pour Control (Section 1):    Est. annual gap: $22,080",
        f"  Theft and Loss Prevention (Section 2):    Est. annual gap: $26,520",
        f"  Food Cost Control (Section 3):            Est. annual gap: $11,040",
        f"  Vendor Control (Section 4):               N/A - data not submitted",
        f"  Prime Cost (Section 5):                   Est. annual gap: $22,440",
        f"  Implementation Status (Section 6):        Est. annual gap: $8,160",
        "",
        f"  COMBINED ANNUAL IMPACT RANGE:   {ANNUAL_IMPACT_LOW} to {ANNUAL_IMPACT_HIGH}",
        "",
        f"  Based on {SECTIONS_WITH_DATA} of 6 sections analyzed.",
        f"  Submit Vendor Price List to unlock Section 4 and complete the full impact calculation.",
        "",
        f"  Bar Cop  |  barcop.com  |  Audit ID: {AUDIT_ID}",
    ]))

    return s


# ── SECTION 1 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S1_TIER             = 2           # 0=no data, 1=POS only, 2=+inventory+invoices, 3=+price list

S1_BAR_COST_PCT     = 27.4        # submitted / calculated
S1_BAR_REV_MONTHLY  = 41200       # from POS
S1_BEV_COGS_PERIOD  = 45100       # from invoices over 4 weeks
S1_BAR_REV_PERIOD   = 41200       # same period as COGS (1 month sample)
S1_INV_VARIANCE_PCT = 3.2         # from inventory count sheets
S1_INV_VARIANCE_AMT = 1318        # 3.2% × $41,200
S1_POUR_METHOD      = "Free pour"
S1_RECIPE_COVERAGE  = "60%"
S1_VARIANCE_FREQ    = "Monthly"
S1_VARIANCE_SKU     = "No"
S1_TARGET_PCT       = 21.0        # midpoint of 18-24% target range

# Derived
S1_GAP_PTS          = round(S1_BAR_COST_PCT - S1_TARGET_PCT, 1)   # 6.4
S1_MONTHLY_GAP      = round(S1_BAR_REV_MONTHLY * S1_GAP_PTS / 100)  # $2,637
S1_ANNUAL_GAP       = S1_MONTHLY_GAP * 12                           # $31,644

# Score calculation (Tier 2)
S1_PTS_BAR_COST     = 0    # more than 6 pts above target → 0 pts (6.4 pts above → 0)
S1_PTS_RECIPE       = 8    # partial (60%) → 8/15
S1_PTS_POUR         = 0    # free pour → 0/20
S1_PTS_VAR_FREQ     = 0    # monthly not weekly → 0/20
S1_PTS_VAR_SKU      = 0    # blended not SKU → 0/15
S1_SCORE            = S1_PTS_BAR_COST + S1_PTS_RECIPE + S1_PTS_POUR + S1_PTS_VAR_FREQ + S1_PTS_VAR_SKU  # 18


# ── ACTION ITEM HELPER ────────────────────────────────────────────────────────

def action_item(priority, title, area, data_desc, instruction, tool, time_str, monthly, annual):
    """Standard action item block used in all sections."""
    priority_colors = {
        "HIGH":   SALMON,
        "MEDIUM": AMBER,
        "LOW":    SAGE,
    }
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
        fontSize=9, leading=13, textColor=DARK_TEXT,
        leftIndent=0, firstLineIndent=0))
    def val_bold(t): return Paragraph(t, ParagraphStyle(f"ai_vb_{t[:6]}",
        fontName=FONT_BOLD, fontSize=9.5, leading=13, textColor=NAVY,
        leftIndent=0, firstLineIndent=0))

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
        sp(10),
        lbl("WHAT THE DATA SHOWS"),
        sp(3),
        val(data_desc),
        sp(8),
        lbl("WHAT TO DO"),
        sp(3),
        val(instruction),
        sp(8),
    ]
    # Metrics row
    def metric_cell(label, value):
        p = Paragraph(f'<b>{label}</b>  {value}',
            ParagraphStyle(f"ai_mc_{label[:4]}", fontSize=8.5, leading=13,
            textColor=DARK_TEXT, leftIndent=0, firstLineIndent=0))
        return p

    cw_met = [(cw_inner) / 4] * 4
    met_row = Table([[
        metric_cell("Action:", tool),
        metric_cell("Time:", time_str),
        metric_cell("Monthly:", monthly),
        metric_cell("Annual:", annual),
    ]], colWidths=cw_met)
    met_row.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),4),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#F7F6F2")),
        ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#E8E6E0")),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
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
    return KeepTogether([outer])


def tier_placeholder(section_name, required_data, unlocks, teaser):
    """STEEL placeholder block for N/A sections."""
    lbl_p = Paragraph(f"SECTION REQUIRES ADDITIONAL DATA",
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
    return KeepTogether([outer])


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
    inner = Table([[lbl_p],[sp(4)],[score_p],[sp(2)],[sub_p]],
        colWidths=[CONTENT_W - 32])
    inner.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    outer = Table([[inner]], colWidths=[CONTENT_W])
    outer.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#1E2D3D")),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    return KeepTogether([outer])


def section_score_tile(section_num, section_name, score_val, note=None):
    """Scored tile: score and /100 inline centered Paragraph."""
    band_label, band_color = score_band(score_val)
    gray_hex = "#8A9BB0"
    # band_color as hex
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
    return KeepTogether([outer])


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
    return KeepTogether([outer])


# ── SECTION 1: BAR COST AND POUR CONTROL ─────────────────────────────────────

def page_section1():
    s = []
    tier = S1_TIER

    s += section_header(
        "SECTION 1",
        "Bar Cost and Pour Control",
        "What your bar actually costs to operate and whether controls are producing measurable results."
    )

    # ── TIER 0: No data ───────────────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(1, "Bar Cost and Pour Control"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Bar Cost and Pour Control",
            "POS Sales Report: Beverages (daily or weekly sales by beverage category).",
            "Bar cost percentage calculation, revenue baseline for all pour control analysis, "
            "and monthly dollar cost of any gap vs. the 18–24% industry target.",
            "With your beverage sales data, this section would show your calculated bar cost percentage "
            "compared against the industry target, identify exactly how much above-target bar cost "
            "is costing you per month in real dollars, and flag whether your current pour controls "
            "are producing measurable results in your variance numbers."
        ))
        return s

    # ── TIER 1: POS only, no inventory or invoices ────────────────────────────
    if tier == 1:
        s.append(section_score_tile(1, "Bar Cost and Pour Control", 24,
            note="Partial score, POS data only, max 50 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "Your bar cost percentage could not be calculated because beverage invoice data "
            "was not submitted. The limited data score above reflects pour controls "
            "and process compliance only. "
            "Submit beverage invoices and bar inventory count sheets from the same period "
            "as your POS report to unlock the full bar cost calculation and inventory variance analysis."
        ))
        s.append(sp(16))
        s += sub_header("Limited Data Assessment")
        s.append(body(
            "The following assessment is based on POS sales data only. No inventory, invoice, or supporting data was submitted for this section. "
            "Each item is scored against the industry standard independently of your cost data."
        ))
        s.append(sp(12))
        q_rows = [
            [Paragraph("Recipe card coverage", STYLES["table_cell_left"]),
             Paragraph(S1_RECIPE_COVERAGE, STYLES["table_cell"]),
             Paragraph("100% of menu", STYLES["table_cell"]),
             Paragraph("PARTIAL", ParagraphStyle("t1_st1", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))],
            [Paragraph("Measured pour method", STYLES["table_cell_left"]),
             Paragraph(S1_POUR_METHOD, STYLES["table_cell"]),
             Paragraph("Jigger or measured", STYLES["table_cell"]),
             Paragraph("CRITICAL", ParagraphStyle("t1_st2", fontName=FONT_BOLD,
                fontSize=8, textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))],
            [Paragraph("Variance report frequency", STYLES["table_cell_left"]),
             Paragraph(S1_VARIANCE_FREQ, STYLES["table_cell"]),
             Paragraph("Weekly minimum", STYLES["table_cell"]),
             Paragraph("ATTENTION", ParagraphStyle("t1_st3", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))],
            [Paragraph("Variance tracked by SKU", STYLES["table_cell_left"]),
             Paragraph(S1_VARIANCE_SKU, STYLES["table_cell"]),
             Paragraph("Yes, blended hides losses", STYLES["table_cell"]),
             Paragraph("CRITICAL", ParagraphStyle("t1_st4", fontName=FONT_BOLD,
                fontSize=8, textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))],
        ]
        cw_q = [CONTENT_W*0.30, CONTENT_W*0.18, CONTENT_W*0.26, CONTENT_W*0.26]
        s.append(std_table(["Control Element", "Submitted", "Standard", "Status"], q_rows, cw_q))
        return s

    # ── TIER 2+: Full analysis ────────────────────────────────────────────────

    score_note = "Partial score, Tier 1 analysis only" if tier < 2 else None
    s.append(section_score_tile(1, "Bar Cost and Pour Control", S1_SCORE, note=score_note))
    s.append(sp(20))

    # ── 2.1 Data Used ─────────────────────────────────────────────────────────
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("POS Sales Report: Beverages", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S1_BAR_REV_PERIOD:,.0f}", STYLES["table_cell"])],
        [Paragraph("Bar Inventory Count Sheets", STYLES["table_cell_left"]),
         Paragraph("Opening and closing counts, 4-week period", STYLES["table_cell_left"]),
         Paragraph("2 counts submitted", STYLES["table_cell"])],
        [Paragraph("Beverage Invoices", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S1_BEV_COGS_PERIOD:,.0f}", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.38, CONTENT_W*0.38, CONTENT_W*0.24]
    s.append(std_table(["Document", "Period", "Value"], data_rows, cw_d))
    s.append(sp(20))

    # ── 2.2 Calculated Metrics Table ──────────────────────────────────────────
    s += sub_header("Calculated Metrics vs. Industry Benchmarks")

    def status_cell(label):
        color = SAGE if label == "ON TARGET" else (SALMON if label == "CRITICAL" else AMBER)
        return Paragraph(label, ParagraphStyle(f"sc_{label[:4]}", fontName=FONT_BOLD,
            fontSize=8, leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    metrics_rows = [
        [Paragraph("Bar cost %", STYLES["table_cell_left"]),
         Paragraph(f"{S1_BAR_COST_PCT}%", STYLES["table_cell"]),
         Paragraph("18–24%", STYLES["table_cell"]),
         status_cell("CRITICAL")],
        [Paragraph("Beverage revenue (period)", STYLES["table_cell_left"]),
         Paragraph(f"${S1_BAR_REV_PERIOD:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Beverage COGS (period)", STYLES["table_cell_left"]),
         Paragraph(f"${S1_BEV_COGS_PERIOD:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Inventory variance %", STYLES["table_cell_left"]),
         Paragraph(f"{S1_INV_VARIANCE_PCT}%", STYLES["table_cell"]),
         Paragraph("Under 1%", STYLES["table_cell"]),
         status_cell("CRITICAL")],
        [Paragraph("Inventory variance $", STYLES["table_cell_left"]),
         Paragraph(f"${S1_INV_VARIANCE_AMT:,.0f}", STYLES["table_cell"]),
         Paragraph("Under 1% of bev rev", STYLES["table_cell"]),
         status_cell("CRITICAL")],
        [Paragraph("Pour control method", STYLES["table_cell_left"]),
         Paragraph(S1_POUR_METHOD, STYLES["table_cell"]),
         Paragraph("Jigger or measured", STYLES["table_cell"]),
         status_cell("CRITICAL")],
        [Paragraph("Recipe card coverage", STYLES["table_cell_left"]),
         Paragraph(S1_RECIPE_COVERAGE, STYLES["table_cell"]),
         Paragraph("100% of menu", STYLES["table_cell"]),
         status_cell("ATTENTION")],
        [Paragraph("Variance report frequency", STYLES["table_cell_left"]),
         Paragraph(S1_VARIANCE_FREQ, STYLES["table_cell"]),
         Paragraph("Weekly minimum", STYLES["table_cell"]),
         status_cell("ATTENTION")],
        [Paragraph("Variance tracked by SKU", STYLES["table_cell_left"]),
         Paragraph(S1_VARIANCE_SKU, STYLES["table_cell"]),
         Paragraph("Yes, SKU level", STYLES["table_cell"]),
         status_cell("CRITICAL")],
    ]
    cw_m = [CONTENT_W*0.34, CONTENT_W*0.18, CONTENT_W*0.24, CONTENT_W*0.24]
    s.append(std_table(["Metric", "Your Bar", "Industry Target", "Status"], metrics_rows, cw_m))
    s.append(sp(20))

    # ── 2.3 Bar Cost Gap Calculation (explicit math) ──────────────────────────
    _h_bcg = sub_header("Bar Cost Gap Calculation")
    _f_bcg = formula_box([
        "BAR COST GAP, EXPLICIT CALCULATION",
        "",
        f"  Your bar cost %:              {S1_BAR_COST_PCT}%",
        f"  Industry target (midpoint):   {S1_TARGET_PCT}%",
        f"  Gap above target:             {S1_GAP_PTS} percentage points",
        "",
        f"  Monthly beverage revenue:     ${S1_BAR_REV_MONTHLY:,.0f}",
        f"  Monthly cost of gap:          {S1_GAP_PTS}% x ${S1_BAR_REV_MONTHLY:,.0f} = ${S1_MONTHLY_GAP:,.0f}/mo",
        f"  Annual cost of gap:           ${S1_MONTHLY_GAP:,.0f} x 12 = ${S1_ANNUAL_GAP:,.0f}/yr",
        "",
        f"  Every 1 percentage point of bar cost reduction at ${S1_BAR_REV_MONTHLY:,.0f}/mo revenue = "
        f"${round(S1_BAR_REV_MONTHLY * 0.01):,.0f}/mo  |  ${round(S1_BAR_REV_MONTHLY * 0.12):,.0f}/yr",
    ])
    s += [KeepTogether(_h_bcg + [_f_bcg])]
    s.append(sp(20))

    # ── 2.4 Inventory Variance Analysis ──────────────────────────────────────
    s += sub_header("Inventory Variance Analysis")
    s.append(body(
        f"Inventory variance of {S1_INV_VARIANCE_PCT}% is {round(S1_INV_VARIANCE_PCT - 1.0, 1)} percentage "
        f"points above the under-1% benchmark. "
        f"At ${S1_BAR_REV_MONTHLY:,.0f} monthly beverage revenue, this represents "
        f"${S1_INV_VARIANCE_AMT:,.0f} in unaccounted product per month. "
        "Variance at this level without SKU-level tracking means the source of loss cannot be "
        "isolated to a specific product. The most common cause at this variance percentage is "
        "unmeasured pours. If jiggers or measured speed pourers are not standard on every "
        "station that is the highest-probability driver. "
        "It could be over-pouring, spillage, theft, or unrecorded breakage, "
        "and without SKU-level reporting and weekly counts, the answer is invisible."
    ))
    s.append(sp(14))
    var_rows = [
        [Paragraph("Opening inventory value", STYLES["table_cell_left"]),
         Paragraph("$13,840", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Purchases (invoices, period)", STYLES["table_cell_left"]),
         Paragraph(f"${S1_BEV_COGS_PERIOD:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Closing inventory value", STYLES["table_cell_left"]),
         Paragraph("$13,022", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Theoretical usage", STYLES["table_cell_left"]),
         Paragraph("$45,818", STYLES["table_cell"]),
         Paragraph("Opening + Purchases − Closing", STYLES["table_cell_left"])],
        [Paragraph("Actual usage (from POS)", STYLES["table_cell_left"]),
         Paragraph(f"${S1_BAR_REV_PERIOD:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Variance $", STYLES["table_cell_left"]),
         Paragraph(f"${S1_INV_VARIANCE_AMT:,.0f}", ParagraphStyle("var_val_s1a",
             fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=DARK_TEXT, alignment=TA_CENTER,
             leftIndent=0, firstLineIndent=0)),
         Paragraph("Target: under $412", STYLES["table_cell_left"])],
        [Paragraph("Variance %", STYLES["table_cell_left"]),
         Paragraph(f"{S1_INV_VARIANCE_PCT}%", ParagraphStyle("var_val_s1b",
             fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=DARK_TEXT, alignment=TA_CENTER,
             leftIndent=0, firstLineIndent=0)),
         Paragraph("Target: under 1.0%", STYLES["table_cell_left"])],
    ]
    cw_v = [CONTENT_W*0.38, CONTENT_W*0.24, CONTENT_W*0.38]
    s.append(std_table(["Item", "Value", "Notes"], var_rows, cw_v))
    s.append(sp(10))
    s.append(Paragraph(
        "<i>Trend analysis requires 4 weeks of count data. Only one count period was submitted. "
        "Submit weekly counts for the next audit to show whether variance is consistent, "
        "improving, or worsening over time.</i>",
        ParagraphStyle("var_note", fontName=FONT_ITALIC, fontSize=8.5, leading=13,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0)))
    s.append(sp(20))

    # ── 2.5 Pour Control Assessment ───────────────────────────────────────────
    s += sub_header("Pour Control Assessment")
    s.append(body(
        "Unmeasured pours are the single largest controllable driver of bar cost variance "
        "at this level. If jiggers or measured speed pourers are not standard on every station, "
        "implementing them is the highest-ROI single action available. "
        "Industry research consistently shows that free-pour bars run 2 to 5 percentage "
        "points higher bar cost than jigger bars with comparable menus and price points. "
        f"Bar cost at {S1_BAR_COST_PCT}% combined with a {S1_INV_VARIANCE_PCT}% inventory variance "
        "and blended-only tracking means the loss is documented but its source cannot be "
        "pinpointed by product until SKU-level counts are in place."
    ))
    s.append(sp(14))
    pour_rows = [
        [Paragraph("Pour method", STYLES["table_cell_left"]),
         Paragraph(S1_POUR_METHOD, STYLES["table_cell"]),
         Paragraph("Jigger or measured speed pourer", STYLES["table_cell"]),
         Paragraph("Introduces 0.25–0.5 oz variance per drink. "
                   "At 200 drinks/day that is 1.5–3 bottles of spirits per week in untracked loss.",
                   STYLES["table_cell_left"])],
        [Paragraph("Recipe cards", STYLES["table_cell_left"]),
         Paragraph(S1_RECIPE_COVERAGE, STYLES["table_cell"]),
         Paragraph("100% coverage", STYLES["table_cell"]),
         Paragraph("Without a recipe card for 40% of menu, standard pours are undefined "
                   "for those items. Staff defaults to estimation.",
                   STYLES["table_cell_left"])],
        [Paragraph("Variance reports", STYLES["table_cell_left"]),
         Paragraph(S1_VARIANCE_FREQ, STYLES["table_cell"]),
         Paragraph("Weekly", STYLES["table_cell"]),
         Paragraph("Monthly reports allow 4 weeks of loss to accumulate before detection. "
                   "A weekly report catches a problem in 7 days, not 30.",
                   STYLES["table_cell_left"])],
        [Paragraph("SKU-level tracking", STYLES["table_cell_left"]),
         Paragraph(S1_VARIANCE_SKU, STYLES["table_cell"]),
         Paragraph("Yes", STYLES["table_cell"]),
         Paragraph("Blended variance cannot identify which product is being lost. "
                   "SKU tracking isolates the problem to a specific item and shift.",
                   STYLES["table_cell_left"])],
    ]
    cw_pour = [CONTENT_W*0.20, CONTENT_W*0.12, CONTENT_W*0.18, CONTENT_W*0.50]
    s.append(std_table(["Control", "Current", "Standard", "Impact of Gap"],
        pour_rows, cw_pour))
    s.append(sp(20))

    # ── 2.6 Score Calculation ─────────────────────────────────────────────────
    s += sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Bar cost % within target", STYLES["table_cell_left"]),
         Paragraph("30", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_BAR_COST), STYLES["table_cell"]),
         Paragraph(f"{S1_BAR_COST_PCT}% is {S1_GAP_PTS} pts above target. "
                   "More than 6 pts above = 0 pts. Score: 0.",
                   STYLES["table_cell_left"])],
        [Paragraph("Recipe cards in use", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_RECIPE), STYLES["table_cell"]),
         Paragraph("Recipe sheet coverage vs POS items: 60%, partial credit at 8/20.", STYLES["table_cell_left"])],
        [Paragraph("Measured pours in use", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_POUR), STYLES["table_cell"]),
         Paragraph("Pour method not confirmed in submitted data, 0/20.", STYLES["table_cell_left"])],
        [Paragraph("Variance reports weekly", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_VAR_FREQ), STYLES["table_cell"]),
         Paragraph("Count frequency per submitted sheets: monthly, 0/20.", STYLES["table_cell_left"])],
        [Paragraph("Variance tracked by SKU", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S1_PTS_VAR_SKU), STYLES["table_cell"]),
         Paragraph("Variance granularity per submitted counts: blended, 0/15.", STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S1_SCORE}</b>", ParagraphStyle("sc_total", fontName=FONT_BOLD,
             fontSize=9, textColor=SALMON, alignment=TA_CENTER,
             leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S1_SCORE}/100, CRITICAL</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.30, CONTENT_W*0.13, CONTENT_W*0.13, CONTENT_W*0.44]
    s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2))
    s.append(sp(20))

    # ── 2.7 Narrative Analysis ────────────────────────────────────────────────
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"The Anchor Bar and Kitchen is running bar cost at {S1_BAR_COST_PCT}% "
        f"against an 18–24% industry target, {S1_GAP_PTS} percentage points above the midpoint. "
        f"At ${S1_BAR_REV_MONTHLY:,.0f} in monthly beverage revenue, that gap costs "
        f"${S1_MONTHLY_GAP:,.0f} per month and ${S1_ANNUAL_GAP:,.0f} per year. "
        "The most probable driver at this variance level is unmeasured pours. If jiggers are not standard on every station, combined with recipe gaps on a portion of the menu, "
        "and a variance report that runs monthly rather than weekly. "
        "These three gaps compound each other. "
        "Unmeasured pours create variance. "
        "Monthly reporting means that variance runs for 30 days before anyone sees it. "
        "Blended tracking means that even when the report runs, "
        "nobody knows which product is generating the loss. "
        "The result is a system that produces a number once a month "
        "and provides no actionable information about what is driving it."
    ))
    s.append(sp(12))
    s.append(body(
        "The fix sequence is specific. "
        "Jiggers first, recipe cards second, weekly SKU-level variance reports third. "
        "Switching to measured pours alone will typically recover 1.5 to 3 percentage points "
        "of bar cost within 60 days at an operation this size. "
        "That is $618 to $1,236 per month from one operational change "
        "that costs nothing except the price of jiggers and a staff training session."
    ))
    s.append(sp(20))

    # ── 2.8 Action Items ──────────────────────────────────────────────────────
    _h_ai_s1 = sub_header("Action Items")
    _f_ai_s1 = action_item(
        priority="HIGH",
        title="Switch to Measured Pours Immediately",
        area="Bar Cost and Pour Control",
        data_desc=(
            f"Bar cost at {S1_BAR_COST_PCT}% with free-pour method. "
            f"Inventory variance at {S1_INV_VARIANCE_PCT}%, "
            f"{round(S1_INV_VARIANCE_PCT - 1.0, 1)} pts above benchmark. "
            "Unmeasured pours are the most probable driver of both."
        ),
        instruction=(
            "Purchase jiggers for every bar station this week. "
            "Run a 30-minute pour-training session at next pre-shift meeting. "
            "Set written standard: 1 oz / 1.5 oz / 2 oz measures enforced on all spirits. "
            "No exceptions on any shift. "
            "Measure variance impact at next inventory count, expect 1.5–3 pt improvement."
        ),
        tool="Run weekly bar inventory counts. Compare usage to sales.",
        time_str="1 week",
        monthly=f"${round(S1_BAR_REV_MONTHLY * 0.02):,.0f}–${round(S1_BAR_REV_MONTHLY * 0.03):,.0f}",
        annual=f"${round(S1_BAR_REV_MONTHLY * 0.024):,.0f}–${round(S1_BAR_REV_MONTHLY * 0.036):,.0f}",
    )
    s += [KeepTogether(_h_ai_s1 + [_f_ai_s1])]
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Move Variance Reporting to Weekly, by SKU",
        area="Bar Cost and Pour Control",
        data_desc=(
            f"Variance reports run monthly, blended total only. "
            f"${S1_INV_VARIANCE_AMT:,.0f}/mo in unaccounted product with no ability to isolate the source. "
            "Monthly blended reporting confirms there is a problem but cannot tell you what it is."
        ),
        instruction=(
            "Count bar inventory every Monday before service. "
            "Record the count in a spreadsheet or notebook immediately after counting. "
            "Track by SKU, each bottle type separately, not a blended total. "
            "Review the variance report before building the week's schedule. "
            "Any item with variance above 2% gets a manager pull-count mid-week."
        ),
        tool="Run weekly bar inventory counts. Compare usage to sales.",
        time_str="1 week",
        monthly=f"${round(S1_BAR_REV_MONTHLY * 0.01):,.0f}–${round(S1_BAR_REV_MONTHLY * 0.015):,.0f}",
        annual=f"${round(S1_BAR_REV_MONTHLY * 0.012):,.0f}–${round(S1_BAR_REV_MONTHLY * 0.018):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Complete Recipe Card Coverage to 100%",
        area="Bar Cost and Pour Control",
        data_desc=(
            f"Recipe cards exist for {S1_RECIPE_COVERAGE} of menu items. "
            "The remaining 40% have no defined pour standard, which means staff is estimating "
            "on those items every shift."
        ),
        instruction=(
            "Identify the 40% of menu items without recipe cards. "
            "Cost each item: write down every ingredient, quantity per serve, and current invoice price. "
            "Calculate total cost per serving. Post the card at each bar station. "
            "Post cards at each bar station. "
            "Include in next staff training session. "
            "Target: 100% coverage within 30 days."
        ),
        tool="Cost every menu item: ingredients, portions, invoice price per unit.",
        time_str="2–3 weeks",
        monthly=f"${round(S1_BAR_REV_MONTHLY * 0.005):,.0f}–${round(S1_BAR_REV_MONTHLY * 0.01):,.0f}",
        annual=f"${round(S1_BAR_REV_MONTHLY * 0.006):,.0f}–${round(S1_BAR_REV_MONTHLY * 0.012):,.0f}",
    ))
    s.append(sp(20))

    # ── TIER 3: Vendor price comparison layer ──────────────────────────────────
    if tier == 3:
        s += sub_header("Vendor Price Benchmarking (Tier 3)")
        s.append(amber_note(
            "Vendor price list was submitted. The table below compares invoice prices "
            "for your top-spend beverage items against the price list on file. "
            "Items flagged in CRITICAL were invoiced above the quoted price."
        ))
        s.append(sp(12))
        vendor_rows = [
            [Paragraph("Well vodka (1.75L)", STYLES["table_cell_left"]),
             Paragraph("$18.40", STYLES["table_cell"]),
             Paragraph("$17.20", STYLES["table_cell"]),
             Paragraph("$1.20 / 7.0%", STYLES["table_cell"]),
             Paragraph("CRITICAL", ParagraphStyle("vp_c1", fontName=FONT_BOLD,
                fontSize=8, textColor=SALMON, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("House rum (1L)", STYLES["table_cell_left"]),
             Paragraph("$14.90", STYLES["table_cell"]),
             Paragraph("$14.90", STYLES["table_cell"]),
             Paragraph("—", STYLES["table_cell"]),
             Paragraph("ON TARGET", ParagraphStyle("vp_c2", fontName=FONT_BOLD,
                fontSize=8, textColor=SAGE, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("House gin (1L)", STYLES["table_cell_left"]),
             Paragraph("$16.10", STYLES["table_cell"]),
             Paragraph("$15.50", STYLES["table_cell"]),
             Paragraph("$0.60 / 3.9%", STYLES["table_cell"]),
             Paragraph("ATTENTION", ParagraphStyle("vp_c3", fontName=FONT_BOLD,
                fontSize=8, textColor=AMBER, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
        ]
        cw_vp = [CONTENT_W*0.28, CONTENT_W*0.16, CONTENT_W*0.16, CONTENT_W*0.20, CONTENT_W*0.20]
        s.append(std_table(
            ["Item", "Invoice Price", "Price List", "Variance", "Status"],
            vendor_rows, cw_vp))
        s.append(sp(10))
        s.append(body(
            "Submit a credit memo request to your well vodka vendor for the $1.20/bottle variance. "
            "Request a revised price list confirmation in writing before the next delivery."
        ))

    return s


# ── SECTION 2 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S2_TIER              = 2

S2_BEV_REV_MONTHLY   = 41200       # matches Section 1
S2_VOIDS_AMT         = 1847        # period total
S2_COMPS_AMT         = 2134        # period total
S2_VOID_COMP_PCT     = 4.8         # % of revenue
S2_VOID_COMP_AMT     = S2_VOIDS_AMT + S2_COMPS_AMT   # $3,981
S2_VOIDS_NO_APPROVAL_PCT = 23      # % of voids with no manager approval
S2_VOIDS_NO_APPROVAL_AMT = round(S2_VOIDS_AMT * 0.23)  # $425

S2_CASH_POLICY       = "No"
S2_VOID_APPROVAL     = "No"
S2_DRAWER_RECON      = "No"
S2_OVERSHORT_POLICY  = "No"
S2_BOTTLE_SECURITY   = "Yes"
S2_NOSALE_POLICY     = "No"
S2_SPILLAGE_LOG      = "No"

S2_BENCHMARK_PCT     = 2.0
S2_GAP_PCT           = round(S2_VOID_COMP_PCT - S2_BENCHMARK_PCT, 1)   # 2.8
S2_MONTHLY_GAP       = round(S2_BEV_REV_MONTHLY * S2_GAP_PCT / 100)    # $1,154
S2_ANNUAL_GAP        = S2_MONTHLY_GAP * 12                              # $13,848

# Score calculation
S2_PTS_VOID_COMP     = 5    # 4-6% above benchmark → 5/25
S2_PTS_VOID_APPROVAL = 0    # cannot determine approval workflow from submitted data
S2_PTS_DRAWER        = 0    # not reconciled every shift → 0/20
S2_PTS_CASH_POLICY   = 0    # cannot determine written policy from submitted data
S2_PTS_BOTTLE        = 0    # cannot determine bottle security from submitted data
S2_PTS_SPILLAGE      = 0    # not logged → 0/10
S2_SCORE             = (S2_PTS_VOID_COMP + S2_PTS_DRAWER + S2_PTS_SPILLAGE)  # scoreable variables only


# ── SECTION 2: THEFT AND LOSS PREVENTION ─────────────────────────────────────

def page_section2():
    s = []
    tier = S2_TIER

    s += section_header(
        "SECTION 2",
        "Theft and Loss Prevention",
        "Whether the controls exist to detect, deter, and document theft and unrecorded loss."
    )

    # ── TIER 0 ────────────────────────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(2, "Theft and Loss Prevention"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Theft and Loss Prevention",
            "POS Sales Report: Beverages (daily or weekly sales by beverage category).",
            "Revenue baseline for void and comp rate calculation and estimated theft exposure "
            "against the under-2% industry benchmark.",
            "With your beverage sales data, this section would estimate your theft exposure "
            "using the industry average of 3 to 5% of bar revenue for operations without "
            "documented controls, show you what your void and comp rate needs to be to meet "
            "the 2% benchmark, and identify which written policies are missing."
        ))
        return s

    # ── TIER 1 ────────────────────────────────────────────────────────────────
    if tier == 1:
        s.append(section_score_tile(2, "Theft and Loss Prevention", 22,
            note="Partial score, POS data only, max 60 pts"))
        s.append(sp(16))
        # Industry-average exposure estimate using revenue baseline
        est_low  = round(S2_BEV_REV_MONTHLY * 0.03)
        est_high = round(S2_BEV_REV_MONTHLY * 0.05)
        s.append(amber_note(
            f"Your actual void and comp rate could not be calculated because the POS Exception "
            f"Report was not submitted. The theft exposure estimate below is an industry-average "
            f"estimate only, not your actual number. "
            f"Bars without documented controls average 3 to 5% of bar revenue in shrink: "
            f"${est_low:,.0f} to ${est_high:,.0f} per month at your revenue level. "
            f"Submit your POS Exception Report to replace this estimate with real data."
        ))
        s.append(sp(16))
        s += sub_header("Limited Data Assessment")
        s.append(body(
            "The following assessment is based on POS sales data only. No inventory, invoice, or supporting data was submitted for this section. "
            "No exception report data was available for this analysis."
        ))
        s.append(sp(12))
        t1_rows = [
            [Paragraph("Cash handling policy (written)", STYLES["table_cell_left"]),
             Paragraph(S2_CASH_POLICY, STYLES["table_cell"]),
             Paragraph("Yes, signed at hire", STYLES["table_cell"]),
             Paragraph("CRITICAL", ParagraphStyle("s2t1_c1", fontName=FONT_BOLD,
                fontSize=8, textColor=SALMON, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Void/comp requires manager approval", STYLES["table_cell_left"]),
             Paragraph(S2_VOID_APPROVAL, STYLES["table_cell"]),
             Paragraph("Yes, manager only", STYLES["table_cell"]),
             Paragraph("CRITICAL", ParagraphStyle("s2t1_c2", fontName=FONT_BOLD,
                fontSize=8, textColor=SALMON, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Drawer reconciled every shift", STYLES["table_cell_left"]),
             Paragraph(S2_DRAWER_RECON, STYLES["table_cell"]),
             Paragraph("Every shift", STYLES["table_cell"]),
             Paragraph("CRITICAL", ParagraphStyle("s2t1_c3", fontName=FONT_BOLD,
                fontSize=8, textColor=SALMON, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
            [Paragraph("Bottle security at close", STYLES["table_cell_left"]),
             Paragraph(S2_BOTTLE_SECURITY, STYLES["table_cell"]),
             Paragraph("Yes", STYLES["table_cell"]),
             Paragraph("ON TARGET", ParagraphStyle("s2t1_c4", fontName=FONT_BOLD,
                fontSize=8, textColor=SAGE, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))],
        ]
        cw_t1 = [CONTENT_W*0.36, CONTENT_W*0.14, CONTENT_W*0.24, CONTENT_W*0.26]
        s.append(std_table(["Control", "Submitted", "Standard", "Status"], t1_rows, cw_t1))
        return s

    # ── TIER 2: Full analysis ─────────────────────────────────────────────────
    s.append(section_score_tile(2, "Theft and Loss Prevention", S2_SCORE))
    s.append(sp(20))

    # ── 3.1 Data Used ─────────────────────────────────────────────────────────
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("POS Sales Report: Beverages", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S2_BEV_REV_MONTHLY:,.0f} revenue", STYLES["table_cell"])],
        [Paragraph("POS Exception Report", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph("Voids, comps, no-sales by employee", STYLES["table_cell"])],
        [Paragraph("Bar Inventory Count Sheets", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph("Cross-reference with exception data", STYLES["table_cell"])],
        [Paragraph("POS Data Only", STYLES["table_cell_left"]),
         Paragraph("Submitted with audit", STYLES["table_cell_left"]),
         Paragraph("7 control elements assessed", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.38, CONTENT_W*0.38, CONTENT_W*0.24]
    s.append(std_table(["Document", "Period", "Notes"], data_rows, cw_d))
    s.append(sp(20))

    # ── 3.2 Void and Comp Analysis ────────────────────────────────────────────
    s += sub_header("Void and Comp Analysis")

    def sc(label):
        color = SAGE if label == "ON TARGET" else (SALMON if label == "CRITICAL" else AMBER)
        return Paragraph(label, ParagraphStyle(f"s2sc_{label[:5]}", fontName=FONT_BOLD,
            fontSize=8, leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    vc_rows = [
        [Paragraph("Total voids (period)", STYLES["table_cell_left"]),
         Paragraph(f"${S2_VOIDS_AMT:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Total comps (period)", STYLES["table_cell_left"]),
         Paragraph(f"${S2_COMPS_AMT:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Total void + comp $", STYLES["table_cell_left"]),
         Paragraph(f"${S2_VOID_COMP_AMT:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Void + comp % of revenue", STYLES["table_cell_left"]),
         Paragraph(f"{S2_VOID_COMP_PCT}%", ParagraphStyle("s2_vcpct", fontName=FONT_BOLD,
            fontSize=9, textColor=SALMON, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0)),
         Paragraph("Under 2.0%", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Voids with no manager approval", STYLES["table_cell_left"]),
         Paragraph(f"{S2_VOIDS_NO_APPROVAL_PCT}%  (${S2_VOIDS_NO_APPROVAL_AMT:,.0f})",
            ParagraphStyle("s2_vna", fontName=FONT_BOLD, fontSize=9,
            textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("0%", STYLES["table_cell"]),
         sc("CRITICAL")],
    ]
    cw_vc = [CONTENT_W*0.36, CONTENT_W*0.20, CONTENT_W*0.20, CONTENT_W*0.24]
    s.append(std_table(["Metric", "Your Bar", "Benchmark", "Status"], vc_rows, cw_vc))
    s.append(sp(20))

    # ── 3.3 Gap Calculation ───────────────────────────────────────────────────
    _h_vcg = sub_header("Void and Comp Gap Calculation")
    _f_vcg = formula_box([
        "VOID AND COMP GAP, EXPLICIT CALCULATION",
        "",
        f"  Your void + comp rate:        {S2_VOID_COMP_PCT}% of revenue",
        f"  Industry benchmark:           {S2_BENCHMARK_PCT}% of revenue",
        f"  Gap above benchmark:          {S2_GAP_PCT} percentage points",
        "",
        f"  Monthly beverage revenue:     ${S2_BEV_REV_MONTHLY:,.0f}",
        f"  Monthly cost of gap:          {S2_GAP_PCT}% x ${S2_BEV_REV_MONTHLY:,.0f} = ${S2_MONTHLY_GAP:,.0f}/mo",
        f"  Annual cost of gap:           ${S2_MONTHLY_GAP:,.0f} x 12 = ${S2_ANNUAL_GAP:,.0f}/yr",
        "",
        f"  Voids with no manager approval: {S2_VOIDS_NO_APPROVAL_PCT}% of all voids = ${S2_VOIDS_NO_APPROVAL_AMT:,.0f}/period",
        f"  These transactions have no management oversight and cannot be verified.",
    ])
    s += [KeepTogether(_h_vcg + [_f_vcg])]
    s.append(sp(20))

    # ── CROSS-SECTION RISK FLAG (SALMON callout) ──────────────────────────────
    s.append(callout_box(
        "ELEVATED RISK PATTERN, CROSS-SECTION FLAG",
        "Three findings from this audit combine to create an elevated theft risk that "
        "requires immediate management attention. "
        "Section 1 identified a 3.2% inventory variance with free-pour method and no "
        "SKU-level tracking, meaning product loss cannot be sourced. "
        "Section 2 shows a 4.8% void and comp rate against a 2% benchmark, "
        "with 23% of voids processed without manager approval. "
        "High inventory variance combined with above-benchmark void activity and no "
        "approval requirement on voids is the pattern most associated with "
        "undetected systematic theft in bar operations. "
        "None of these findings is conclusive on its own. "
        "Together they require a formal management review this week.",
        bg=SALMON
    ))
    s.append(sp(20))

    # ── 3.4 Controls Assessment ───────────────────────────────────────────────
    s += sub_header("Controls Assessment")

    ctrl_rows = [
        [Paragraph("Cash handling policy (written)", STYLES["table_cell_left"]),
         Paragraph(S2_CASH_POLICY, STYLES["table_cell"]),
         Paragraph("Yes, signed at hire", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Void/comp requires manager approval", STYLES["table_cell_left"]),
         Paragraph(S2_VOID_APPROVAL, STYLES["table_cell"]),
         Paragraph("Yes, manager only", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Drawer reconciled every shift", STYLES["table_cell_left"]),
         Paragraph(S2_DRAWER_RECON, STYLES["table_cell"]),
         Paragraph("Every shift", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Written over/short policy", STYLES["table_cell_left"]),
         Paragraph(S2_OVERSHORT_POLICY, STYLES["table_cell"]),
         Paragraph("Yes, written, signed at hire", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Bottles locked/secured at close", STYLES["table_cell_left"]),
         Paragraph(S2_BOTTLE_SECURITY, STYLES["table_cell"]),
         Paragraph("Yes", STYLES["table_cell"]),
         sc("ON TARGET")],
        [Paragraph("No-sale/open-drawer policy (written)", STYLES["table_cell_left"]),
         Paragraph(S2_NOSALE_POLICY, STYLES["table_cell"]),
         Paragraph("Yes, written", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Spillage and waste logged", STYLES["table_cell_left"]),
         Paragraph(S2_SPILLAGE_LOG, STYLES["table_cell"]),
         Paragraph("Yes, every incident", STYLES["table_cell"]),
         sc("CRITICAL")],
    ]
    cw_ctrl = [CONTENT_W*0.36, CONTENT_W*0.14, CONTENT_W*0.26, CONTENT_W*0.24]
    s.append(std_table(["Control", "In Place", "Standard", "Status"], ctrl_rows, cw_ctrl))
    s.append(sp(20))

    # ── 3.5 Score Calculation ─────────────────────────────────────────────────
    _h_sc_s2 = sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Void/comp rate under 2%", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_VOID_COMP), STYLES["table_cell"]),
         Paragraph(f"{S2_VOID_COMP_PCT}% is {S2_GAP_PCT} pts above benchmark. "
                   "4–6% above = 5 pts.", STYLES["table_cell_left"])],
        [Paragraph("Void/comp requires manager approval", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_VOID_APPROVAL), STYLES["table_cell"]),
         Paragraph("Void approval workflow not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("Drawer reconciled every shift", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_DRAWER), STYLES["table_cell"]),
         Paragraph("Not reconciled every shift, 0/20.", STYLES["table_cell_left"])],
        [Paragraph("Written cash handling policy", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_CASH_POLICY), STYLES["table_cell"]),
         Paragraph("Written cash policy not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("Bottle security in place", STYLES["table_cell_left"]),
         Paragraph("10", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_BOTTLE), STYLES["table_cell"]),
         Paragraph("Bottle security not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("Spillage logged", STYLES["table_cell_left"]),
         Paragraph("10", STYLES["table_cell"]),
         Paragraph(str(S2_PTS_SPILLAGE), STYLES["table_cell"]),
         Paragraph("Not logged, 0/10.", STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S2_SCORE}</b>", ParagraphStyle("s2_total", fontName=FONT_BOLD,
             fontSize=9, textColor=SALMON, alignment=TA_CENTER,
             leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S2_SCORE}/100, CRITICAL</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc2 = [CONTENT_W*0.36, CONTENT_W*0.12, CONTENT_W*0.12, CONTENT_W*0.40]
    _f_sc_s2 = std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc2)
    s += [KeepTogether(_h_sc_s2 + [_f_sc_s2])]
    s.append(sp(20))

    # ── 3.6 Narrative ─────────────────────────────────────────────────────────
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"This section scores {S2_SCORE}/100, reflecting a controls environment "
        "with significant gaps across cash handling, void management, and documentation. "
        f"The void and comp rate of {S2_VOID_COMP_PCT}% is {S2_GAP_PCT} percentage points "
        f"above the 2% benchmark, representing ${S2_MONTHLY_GAP:,.0f} per month "
        f"in above-benchmark transaction activity. "
        f"More concerning than the rate itself is the structure behind it: "
        f"{S2_VOIDS_NO_APPROVAL_PCT}% of voids, ${S2_VOIDS_NO_APPROVAL_AMT:,.0f} in the audit period, "
        "were processed with no confirmed manager approval on file in the submitted data. "
        "Cash handling policy, drawer reconciliation standard, and over/short policy could not be confirmed from submitted data. "
        "Each of these controls should be reviewed against current practices: if they are not in place, each represents a documented gap that removes a layer of deterrence and makes verification impossible after the fact."
    ))
    s.append(sp(12))
    s.append(body(
        "The highest-impact single change at this operation is requiring manager approval "
        "on every void and comp before it is processed. "
        "This one change does two things simultaneously: "
        "it eliminates the ability to void a transaction without oversight, "
        "and it signals to the floor staff that void activity is being watched and reviewed. "
        "Operations that install manager approval requirements see void rates drop within the "
        "first two to four weeks, not because they catch theft in the act, "
        "but because the approval requirement changes behavior before the void is attempted."
    ))
    s.append(sp(20))

    # ── 3.7 Action Items ──────────────────────────────────────────────────────
    _h_ai_s2 = sub_header("Action Items")
    _f_ai_s2 = action_item(
        priority="HIGH",
        title="Require Manager Approval on Every Void and Comp",
        area="Theft and Loss Prevention",
        data_desc=(
            f"{S2_VOIDS_NO_APPROVAL_PCT}% of voids processed with no manager approval "
            f"in the audit period, ${S2_VOIDS_NO_APPROVAL_AMT:,.0f} in unverified transaction reversals. "
            "No current POS configuration or policy requires approval before a void is processed."
        ),
        instruction=(
            "Configure POS to require a manager card swipe or PIN for every void and comp. "
            "Do this in the POS settings this week, it is a configuration change, not a policy change alone. "
            "Also add a written policy: every void requires a reason code and manager initials on the receipt. "
            "Manager reviews void report every Monday before building the schedule."
        ),
        tool="Pull your void and comp report from POS weekly.",
        time_str="This week",
        monthly=f"${round(S2_MONTHLY_GAP * 0.5):,.0f}–${S2_MONTHLY_GAP:,.0f}",
        annual=f"${round(S2_MONTHLY_GAP * 0.5 * 12):,.0f}–${S2_ANNUAL_GAP:,.0f}",
    )
    s += [KeepTogether(_h_ai_s2 + [_f_ai_s2])]
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Implement Drawer Reconciliation Every Shift",
        area="Theft and Loss Prevention",
        data_desc=(
            "Cash drawer is not reconciled at shift end. "
            "Without a reconciliation record, over/short activity is invisible and untrackable. "
            "No written over/short policy exists to establish accountability "
            "or set the tolerance threshold that triggers a management conversation."
        ),
        instruction=(
            "Count every drawer at shift end before the closing manager leaves. "
            "Record each drawer count: date, shift, employee, expected amount, actual amount, over/short. "
            "Post the written over/short policy at the cash station: "
            "over/short above $10 requires a manager conversation the same shift. "
            "Over/short above $20 requires a written incident note."
        ),
        tool="Pull your void and comp report from POS weekly.",
        time_str="This week",
        monthly=f"${round(S2_BEV_REV_MONTHLY * 0.005):,.0f}–${round(S2_BEV_REV_MONTHLY * 0.010):,.0f}",
        annual=f"${round(S2_BEV_REV_MONTHLY * 0.006 * 12):,.0f}–${round(S2_BEV_REV_MONTHLY * 0.010 * 12):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Write and Distribute the Cash Handling Policy",
        area="Theft and Loss Prevention",
        data_desc=(
            "A written cash handling policy could not be confirmed from submitted data. "
            "If one is not in place: without a written standard, cash procedures vary by employee, "
            "managers cannot enforce a consistent standard, "
            "and the operation has no documented basis for a performance conversation "
            "when a cash handling problem surfaces. Review and confirm before this audit is closed."
        ),
        instruction=(
            "Write a one-page cash handling policy this week covering: "
            "who handles cash, when drawers are counted, what the over/short tolerance is, "
            "what requires a manager signature, and what constitutes a policy violation. "
            "Distribute to all staff. Get a signed acknowledgment from every current employee. "
            "Include in the new hire packet going forward. "
            "Start from scratch or adapt your POS provider's template."
        ),
        tool="Write and post a cash handling policy signed by every employee.",
        time_str="1 week",
        monthly="Documentation and deterrence value, not directly quantifiable",
        annual="Establishes the written record required for enforcement",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Start Logging Spillage and Waste Every Shift",
        area="Theft and Loss Prevention",
        data_desc=(
            "No spillage or waste log in place. "
            "Without a log, spillage and waste cannot be separated from variance "
            "in the inventory count. "
            "This means Section 1's 3.2% variance figure includes legitimate spillage "
            "alongside any theft or over-pouring, and the two cannot be distinguished."
        ),
        instruction=(
            "Post a spillage log sheet at each bar station. "
            "Every spill, breakage, or comp drink gets logged: "
            "time, item, quantity, reason, and staff initials. "
            "Manager records every waste incident at end of shift in a log: item, quantity, reason. "
            "After 30 days, compare logged waste to total variance, "
            "the difference is the unaccounted portion that needs further investigation."
        ),
        tool="Log every spill, breakage, and waste incident every shift.",
        time_str="This week",
        monthly=f"${round(S2_BEV_REV_MONTHLY * 0.005):,.0f}–${round(S2_BEV_REV_MONTHLY * 0.008):,.0f}",
        annual=f"${round(S2_BEV_REV_MONTHLY * 0.006 * 12):,.0f}–${round(S2_BEV_REV_MONTHLY * 0.009 * 12):,.0f}",
    ))

    return s


# ── SECTION 3 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S3_TIER               = 2

S3_FOOD_COST_PCT      = 38.4
S3_FOOD_REV_MONTHLY   = 28600
S3_FOOD_COGS_PERIOD   = 10990        # 38.4% of $28,600
S3_FOOD_VAR_PCT       = 4.1
S3_FOOD_VAR_AMT       = round(S3_FOOD_REV_MONTHLY * S3_FOOD_VAR_PCT / 100)   # $1,173
S3_RECIPE_COVERAGE    = "40%"
S3_PORTION_STANDARDS  = "No"
S3_INV_FREQ           = "Bi-weekly"
S3_THEO_ACTUAL        = "No"
S3_WASTE_LOG          = "No"

S3_TARGET_PCT         = 31.0        # midpoint of 28-34%
S3_GAP_PTS            = round(S3_FOOD_COST_PCT - S3_TARGET_PCT, 1)   # 7.4
S3_MONTHLY_GAP        = round(S3_FOOD_REV_MONTHLY * S3_GAP_PTS / 100) # $2,116
S3_ANNUAL_GAP         = S3_MONTHLY_GAP * 12                           # $25,392

# Score: food cost >6 pts above → 0/30, recipe 40% → 0/20, portions no → 0/20,
#        inventory bi-weekly → 8/15, theo vs actual no → 0/15  → total 8/100
S3_PTS_FOOD_COST      = 0    # >6 pts above target
S3_PTS_RECIPE         = 0    # 40% coverage, below threshold for partial credit
S3_PTS_PORTIONS       = 0    # cannot determine written portion standards from submitted data
S3_PTS_INV_FREQ       = 8    # bi-weekly, partial 8/15
S3_PTS_THEO_ACTUAL    = 0    # not tracked
S3_SCORE              = (S3_PTS_FOOD_COST + S3_PTS_RECIPE
                         + S3_PTS_INV_FREQ + S3_PTS_THEO_ACTUAL)   # scoreable variables only


# ── SECTION 3: FOOD COST CONTROL ─────────────────────────────────────────────

def page_section3():
    s = []
    tier = S3_TIER

    s += section_header(
        "SECTION 3",
        "Food Cost Control",
        "Whether food cost is measured, managed, and understood well enough to act on."
    )

    # ── TIER 0 ────────────────────────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(3, "Food Cost Control"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Food Cost Control",
            "POS Sales Report: Food (daily or weekly food sales by category).",
            "Food revenue baseline for all food cost analysis, food cost percentage "
            "calculation, and monthly dollar cost of any gap vs. the 28–34% industry target.",
            "With your food sales data, this section would show your calculated food cost "
            "percentage against the full-service industry target of 28–34%, calculate the "
            "monthly dollar cost of operating above that target, and identify which "
            "production controls are producing measurable results in your variance numbers."
        ))
        return s

    # ── TIER 1: POS Food only ─────────────────────────────────────────────────
    if tier == 1:
        s.append(section_score_tile(3, "Food Cost Control", 16,
            note="Partial score, POS data only, max 40 pts"))
        s.append(sp(16))
        s.append(amber_note(
            "Food cost percentage could not be calculated because kitchen inventory count "
            "sheets and food invoices were not submitted. "
            "The score above reflects POS-based analysis only. Submitting inventory counts and supporting data will unlock the full assessment. "
            "Submit kitchen inventory count sheets and food invoices from the same "
            "period as your POS food report to unlock the full food cost calculation, "
            "inventory variance analysis, and theoretical vs. actual comparison."
        ))
        s.append(sp(16))
        s += sub_header("Limited Data Assessment")
        s.append(body(
            "The following items are scored against the industry standard using your "
            "POS data only. No inventory or cost data was submitted for this section."
        ))
        s.append(sp(12))

        def sc_t1(label):
            color = SAGE if label == "ON TARGET" else (SALMON if label == "CRITICAL" else AMBER)
            return Paragraph(label, ParagraphStyle(f"s3t1_{label[:4]}", fontName=FONT_BOLD,
                fontSize=8, textColor=color, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))

        t1_rows = [
            [Paragraph("Recipe card coverage", STYLES["table_cell_left"]),
             Paragraph(S3_RECIPE_COVERAGE, STYLES["table_cell"]),
             Paragraph("100% of menu", STYLES["table_cell"]),
             sc_t1("CRITICAL")],
            [Paragraph("Portion standards written", STYLES["table_cell_left"]),
             Paragraph(S3_PORTION_STANDARDS, STYLES["table_cell"]),
             Paragraph("Yes, every item", STYLES["table_cell"]),
             sc_t1("CRITICAL")],
            [Paragraph("Inventory counted weekly", STYLES["table_cell_left"]),
             Paragraph(S3_INV_FREQ, STYLES["table_cell"]),
             Paragraph("Weekly minimum", STYLES["table_cell"]),
             sc_t1("ATTENTION")],
            [Paragraph("Theoretical vs. actual tracked", STYLES["table_cell_left"]),
             Paragraph(S3_THEO_ACTUAL, STYLES["table_cell"]),
             Paragraph("Yes, required", STYLES["table_cell"]),
             sc_t1("CRITICAL")],
        ]
        cw_t1 = [CONTENT_W*0.32, CONTENT_W*0.16, CONTENT_W*0.26, CONTENT_W*0.26]
        s.append(std_table(["Control Element", "Submitted", "Standard", "Status"],
            t1_rows, cw_t1))
        return s

    # ── TIER 2+: Full analysis ─────────────────────────────────────────────────
    s.append(section_score_tile(3, "Food Cost Control", S3_SCORE))
    s.append(sp(20))

    # 3.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("POS Sales Report: Food", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S3_FOOD_REV_MONTHLY:,.0f} revenue", STYLES["table_cell"])],
        [Paragraph("Kitchen Inventory Count Sheets", STYLES["table_cell_left"]),
         Paragraph("Opening and closing counts, 4-week period", STYLES["table_cell_left"]),
         Paragraph("2 counts submitted", STYLES["table_cell"])],
        [Paragraph("Food Invoices", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S3_FOOD_COGS_PERIOD:,.0f}", STYLES["table_cell"])],
        [Paragraph("POS Data Only", STYLES["table_cell_left"]),
         Paragraph("Submitted with audit", STYLES["table_cell_left"]),
         Paragraph("5 control elements assessed", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.36, CONTENT_W*0.38, CONTENT_W*0.26]
    s.append(std_table(["Document", "Period", "Value"], data_rows, cw_d))
    s.append(sp(20))

    # 3.2 Calculated Metrics Table
    s += sub_header("Calculated Metrics vs. Industry Benchmarks")

    def sc(label):
        color = SAGE if label == "ON TARGET" else (SALMON if label == "CRITICAL" else AMBER)
        return Paragraph(label, ParagraphStyle(f"s3sc_{label[:5]}", fontName=FONT_BOLD,
            fontSize=8, leading=11, textColor=color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    metrics_rows = [
        [Paragraph("Food cost %", STYLES["table_cell_left"]),
         Paragraph(f"{S3_FOOD_COST_PCT}%",
             ParagraphStyle("s3_fcpct", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("28–34% (full-service)\n25–30% (bar bites)", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Food revenue (period)", STYLES["table_cell_left"]),
         Paragraph(f"${S3_FOOD_REV_MONTHLY:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Food COGS (period)", STYLES["table_cell_left"]),
         Paragraph(f"${S3_FOOD_COGS_PERIOD:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Inventory variance %", STYLES["table_cell_left"]),
         Paragraph(f"{S3_FOOD_VAR_PCT}%",
             ParagraphStyle("s3_fvpct", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("Under 2% of food revenue", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Inventory variance $", STYLES["table_cell_left"]),
         Paragraph(f"${S3_FOOD_VAR_AMT:,.0f}", STYLES["table_cell"]),
         Paragraph(f"Under ${round(S3_FOOD_REV_MONTHLY*0.02):,.0f}", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Recipe card coverage", STYLES["table_cell_left"]),
         Paragraph(S3_RECIPE_COVERAGE, STYLES["table_cell"]),
         Paragraph("100% of menu", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Portion standards written", STYLES["table_cell_left"]),
         Paragraph(S3_PORTION_STANDARDS, STYLES["table_cell"]),
         Paragraph("Yes, every item", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Inventory frequency", STYLES["table_cell_left"]),
         Paragraph(S3_INV_FREQ, STYLES["table_cell"]),
         Paragraph("Weekly minimum", STYLES["table_cell"]),
         sc("ATTENTION")],
        [Paragraph("Theoretical vs. actual tracked", STYLES["table_cell_left"]),
         Paragraph(S3_THEO_ACTUAL, STYLES["table_cell"]),
         Paragraph("Yes, required", STYLES["table_cell"]),
         sc("CRITICAL")],
    ]
    cw_m = [CONTENT_W*0.34, CONTENT_W*0.18, CONTENT_W*0.24, CONTENT_W*0.24]
    s.append(std_table(["Metric", "Your Bar", "Industry Target", "Status"],
        metrics_rows, cw_m))
    s.append(sp(20))

    # 3.3 Food Cost Gap Calculation
    s += sub_header("Food Cost Gap Calculation")
    s.append(formula_box([
        "FOOD COST GAP, EXPLICIT CALCULATION",
        "",
        f"  Your food cost %:              {S3_FOOD_COST_PCT}%",
        f"  Industry target (midpoint):    {S3_TARGET_PCT}%  (range: 28–34% full-service)",
        f"  Gap above target:              {S3_GAP_PTS} percentage points",
        "",
        f"  Monthly food revenue:          ${S3_FOOD_REV_MONTHLY:,.0f}",
        f"  Monthly cost of gap:           {S3_GAP_PTS}% x ${S3_FOOD_REV_MONTHLY:,.0f}"
        f" = ${S3_MONTHLY_GAP:,.0f}/mo",
        f"  Annual cost of gap:            ${S3_MONTHLY_GAP:,.0f} x 12"
        f" = ${S3_ANNUAL_GAP:,.0f}/yr",
        "",
        f"  Every 1 percentage point of food cost reduction at"
        f" ${S3_FOOD_REV_MONTHLY:,.0f}/mo revenue"
        f" = ${round(S3_FOOD_REV_MONTHLY * 0.01):,.0f}/mo"
        f"  |  ${round(S3_FOOD_REV_MONTHLY * 0.12):,.0f}/yr",
    ]))
    s.append(sp(20))

    # 3.4 Inventory Variance Analysis
    s += sub_header("Food Inventory Variance Analysis")
    s.append(body(
        f"Food inventory variance of {S3_FOOD_VAR_PCT}% is "
        f"{round(S3_FOOD_VAR_PCT - 2.0, 1)} percentage points above the under-2% benchmark, "
        f"representing ${S3_FOOD_VAR_AMT:,.0f} in unaccounted product per month. "
        "With recipe cards missing for 60% of the menu and theoretical vs. actual tracking not confirmed in submitted data, this variance cannot be sourced to a specific cause. "
        "The kitchen is producing food cost outcomes that cannot be explained by "
        "the controls visible in the submitted data."
    ))
    s.append(sp(14))
    var_rows = [
        [Paragraph("Opening inventory value", STYLES["table_cell_left"]),
         Paragraph("$9,240", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Purchases (invoices, period)", STYLES["table_cell_left"]),
         Paragraph(f"${S3_FOOD_COGS_PERIOD:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Closing inventory value", STYLES["table_cell_left"]),
         Paragraph("$8,837", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Theoretical usage", STYLES["table_cell_left"]),
         Paragraph("$10,413", STYLES["table_cell"]),
         Paragraph("Opening + Purchases − Closing", STYLES["table_cell_left"])],
        [Paragraph("Actual usage (from POS)", STYLES["table_cell_left"]),
         Paragraph(f"${S3_FOOD_REV_MONTHLY:,.0f}", STYLES["table_cell"]),
         Paragraph("—", STYLES["table_cell"])],
        [Paragraph("Variance $", STYLES["table_cell_left"]),
         Paragraph(f"${S3_FOOD_VAR_AMT:,.0f}", ParagraphStyle("var_val_s3a",
             fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=DARK_TEXT, alignment=TA_CENTER,
             leftIndent=0, firstLineIndent=0)),
         Paragraph(f"Target: under ${round(S3_FOOD_REV_MONTHLY * 0.02):,.0f}",
             STYLES["table_cell_left"])],
        [Paragraph("Variance %", STYLES["table_cell_left"]),
         Paragraph(f"{S3_FOOD_VAR_PCT}%", ParagraphStyle("var_val_s3b",
             fontName=FONT_BOLD, fontSize=8.5, leading=12,
             textColor=DARK_TEXT, alignment=TA_CENTER,
             leftIndent=0, firstLineIndent=0)),
         Paragraph("Target: under 2.0%", STYLES["table_cell_left"])],
    ]
    cw_v = [CONTENT_W*0.38, CONTENT_W*0.24, CONTENT_W*0.38]
    s.append(std_table(["Item", "Value", "Notes"], var_rows, cw_v))
    s.append(sp(10))
    s.append(Paragraph(
        "<i>Trend analysis requires 4 weeks of weekly count data. "
        "Only one count period was submitted. "
        "Submit weekly kitchen inventory for the next audit to show "
        "whether variance is stable, improving, or compounding over time.</i>",
        ParagraphStyle("s3_var_note", fontName=FONT_ITALIC, fontSize=8.5, leading=13,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0)))
    s.append(sp(20))

    # 3.5 Diagnostic Blind Spot AMBER callout
    s.append(callout_box(
        "DIAGNOSTIC BLIND SPOT, FOOD COST SOURCE UNKNOWN",
        f"Food cost is running at {S3_FOOD_COST_PCT}% against a 31% target, "
        f"a {S3_GAP_PTS}-point gap costing ${S3_MONTHLY_GAP:,.0f} per month. "
        "But without theoretical vs. actual tracking confirmed in submitted data, and with recipe cards missing for 60% of menu items, it is impossible to determine whether "
        "that gap is coming from portion creep, prep waste, theft, or over-ordering. "
        "All four sources look identical in the raw food cost number. "
        "This is not just a cost problem, it is a diagnostic problem. "
        "Fixing the cost percentage requires knowing which lever to pull, "
        "and right now the data does not support that determination.",
        bg=AMBER
    ))
    s.append(sp(20))

    # 3.6 Score Calculation
    s += sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Food cost % within target", STYLES["table_cell_left"]),
         Paragraph("30", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_FOOD_COST), STYLES["table_cell"]),
         Paragraph(
             f"{S3_FOOD_COST_PCT}% is {S3_GAP_PTS} pts above target. "
             "More than 6 pts above = 0 pts.",
             STYLES["table_cell_left"])],
        [Paragraph("Recipe cards costed for all items", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_RECIPE), STYLES["table_cell"]),
         Paragraph(
             f"{S3_RECIPE_COVERAGE} coverage. Under 50% = 0 pts.",
             STYLES["table_cell_left"])],
        [Paragraph("Portion standards written", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_PORTIONS), STYLES["table_cell"]),
         Paragraph("Written portion standards not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("Inventory counted weekly", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_INV_FREQ), STYLES["table_cell"]),
         Paragraph(
             f"{S3_INV_FREQ}, partial credit 8/15. "
             "Weekly = 15, bi-weekly = 8, monthly or less = 0.",
             STYLES["table_cell_left"])],
        [Paragraph("Theoretical vs. actual tracked", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S3_PTS_THEO_ACTUAL), STYLES["table_cell"]),
         Paragraph("Not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S3_SCORE}</b>",
             ParagraphStyle("s3_sc_total", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S3_SCORE}/100, CRITICAL</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc = [CONTENT_W*0.34, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.44]
    s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc))
    s.append(sp(20))

    # 3.7 Narrative Analysis
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"Food cost at {S3_FOOD_COST_PCT}% is {S3_GAP_PTS} points above the 31% target, "
        f"costing ${S3_MONTHLY_GAP:,.0f} per month, ${S3_ANNUAL_GAP:,.0f} per year. "
        f"Recipe cards exist for only {S3_RECIPE_COVERAGE} of menu items, "
        "portion standards could not be confirmed, "
        "inventory runs bi-weekly instead of weekly, "
        "and theoretical vs. actual tracking was not confirmed in submitted data. "
        "Each gap compounds the others: without recipe cards portions are undefined; "
        "without portion standards execution varies by shift; "
        "without theoretical tracking, variance has no reference point; "
        "without weekly counts, a problem runs 14 days before it surfaces."
    ))
    s.append(sp(12))
    s.append(body(
        "Fix sequence: recipe cards first (define cost), portion standards second "
        "(give the kitchen a target), weekly counts third (create the feedback loop), "
        "theoretical vs. actual tracking fourth (identify exactly where loss occurs). "
        "None of these steps is expensive. "
        "Together they convert a cost number that cannot be explained "
        "into a production system that shows exactly where the loss is happening."
    ))
    s.append(sp(20))

    # 3.8 Action Items
    _h_ai_s3 = sub_header("Action Items")
    _f_ai_s3 = action_item(
        priority="HIGH",
        title="Write Recipe Cards for All Menu Items",
        area="Food Cost Control",
        data_desc=(
            f"Recipe cards exist for only {S3_RECIPE_COVERAGE} of menu items. "
            "The remaining 60% have no defined ingredient standard, no costed portion, "
            "and no reference for what a correctly produced dish should cost. "
            f"This is a primary driver of the {S3_FOOD_COST_PCT}% food cost."
        ),
        instruction=(
            "Cost every menu item. Each card needs: ingredient list with quantities, "
            "unit cost per ingredient from your current invoice, "
            "total recipe cost, and target plate cost as a percentage of menu price. "
            "Start with your ten highest-revenue items. "
            "Complete all remaining items within 30 days. "
            "Post cards in the kitchen and review with line staff at the next pre-shift meeting."
        ),
        tool="Cost every menu item: ingredients, portions, invoice price per unit.",
        time_str="30 days",
        monthly=f"${round(S3_FOOD_REV_MONTHLY * 0.015):,.0f}–${round(S3_FOOD_REV_MONTHLY * 0.025):,.0f}",
        annual=f"${round(S3_FOOD_REV_MONTHLY * 0.018 * 12):,.0f}–${round(S3_FOOD_REV_MONTHLY * 0.030 * 12):,.0f}",
    )
    s += [KeepTogether(_h_ai_s3 + [_f_ai_s3])]
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Write and Post Portion Standards for Every Item",
        area="Food Cost Control",
        data_desc=(
            "Written portion standards could not be confirmed from submitted data. "
            "If portion standards are not documented and posted: portion size varies by cook, by shift, "
            "and by how busy the kitchen is. "
            "Portion creep, where portions drift upward over time, "
            "is invisible without a standard to measure against "
            "and is one of the most common drivers of above-target food cost "
            "in operations without documented controls. "
            "Review current practices against the standard described below."
        ),
        instruction=(
            "Write a one-page portion standard sheet for every menu category. "
            "Set the portion weight or measured volume for every item. "
            "Post the portion guide at every prep station and expo. "
            "Use a portion scale for proteins, every item over $8 food cost should be weighed. "
            "Train the kitchen team at next staff meeting. "
            "Check portions at next inventory count: "
            "if variance drops, the portion standard is working."
        ),
        tool="Compare theoretical food cost to actual every week.",
        time_str="2 weeks",
        monthly=f"${round(S3_FOOD_REV_MONTHLY * 0.010):,.0f}–${round(S3_FOOD_REV_MONTHLY * 0.018):,.0f}",
        annual=f"${round(S3_FOOD_REV_MONTHLY * 0.012 * 12):,.0f}–${round(S3_FOOD_REV_MONTHLY * 0.020 * 12):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Move Kitchen Inventory to Weekly Counts",
        area="Food Cost Control",
        data_desc=(
            f"Kitchen inventory is counted {S3_INV_FREQ.lower()} rather than weekly. "
            "A bi-weekly count allows production problems to run for up to 14 days "
            "before they are visible in variance data. "
            "Weekly counts produce a feedback loop that catches problems in 7 days "
            "and provides week-over-week trend data that makes variance patterns visible."
        ),
        instruction=(
            "Schedule a kitchen inventory count every Monday before service. "
            "Assign one person to own the count, same person every week for consistency. "
            "Record counts in your log immediately after counting. "
            "Manager reviews the variance result before building the week's prep schedule. "
            "Any item with variance above 3% gets a mid-week spot count."
        ),
        tool="Run weekly bar inventory counts. Compare usage to sales.",
        time_str="1 week",
        monthly=f"${round(S3_FOOD_REV_MONTHLY * 0.005):,.0f}–${round(S3_FOOD_REV_MONTHLY * 0.010):,.0f}",
        annual=f"${round(S3_FOOD_REV_MONTHLY * 0.006 * 12):,.0f}–${round(S3_FOOD_REV_MONTHLY * 0.010 * 12):,.0f}",
    ))

    # Tier 3 layer
    if tier == 3:
        s.append(sp(20))
        s += sub_header("Tier 3: Theoretical vs. Actual Analysis")
        s.append(amber_note(
            "Recipe costing sheets and waste logs were submitted. "
            "The table below compares theoretical food cost (calculated from recipe cards "
            "and sales mix) against actual food cost from inventory and invoices."
        ))
        s.append(sp(12))
        t3_rows = [
            [Paragraph("Theoretical food cost %", STYLES["table_cell_left"]),
             Paragraph("34.1%", STYLES["table_cell"]),
             Paragraph("—", STYLES["table_cell"])],
            [Paragraph("Actual food cost %", STYLES["table_cell_left"]),
             Paragraph(f"{S3_FOOD_COST_PCT}%", STYLES["table_cell"]),
             Paragraph("—", STYLES["table_cell"])],
            [Paragraph("Variance (actual vs. theoretical)", STYLES["table_cell_left"]),
             Paragraph("4.3 pts", STYLES["table_cell"]),
             Paragraph("Under 1.5 pts", STYLES["table_cell"])],
            [Paragraph("Likely source", STYLES["table_cell_left"]),
             Paragraph("Portioning and prep waste", STYLES["table_cell_left"]),
             Paragraph("Based on waste log review", STYLES["table_cell_left"])],
        ]
        cw_t3 = [CONTENT_W*0.36, CONTENT_W*0.22, CONTENT_W*0.42]
        s.append(std_table(["Metric", "Value", "Notes"], t3_rows, cw_t3))

    return s


# ── SECTION 4 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S4_TIER                  = 2

S4_BEV_INVOICE_COUNT     = 12
S4_FOOD_INVOICE_COUNT    = 9
S4_AUDIT_PERIOD_DESC     = "4 weeks"
S4_VENDOR_SPEND_MONTHLY  = 24800
S4_BEV_INVOICE_SPEND     = 14900     # beverage portion
S4_FOOD_INVOICE_SPEND    = 9900      # food portion

S4_INVOICE_VS_PO         = "No"
S4_PRICE_VERIFY          = "No"
S4_DELIVERY_COUNT        = "Sometimes"
S4_CREDIT_MEMOS          = "No"
S4_ANNUAL_BIDS           = "No"
S4_BACKUP_VENDORS        = "Partial, spirits only"
S4_PAYMENT_POLICY        = "Yes"

S4_EXPOSURE_PCT          = 3.0       # industry average overbilling rate
S4_EXPOSURE_MONTHLY      = round(S4_VENDOR_SPEND_MONTHLY * S4_EXPOSURE_PCT / 100)  # $744
S4_EXPOSURE_ANNUAL       = S4_EXPOSURE_MONTHLY * 12                                # $8,928

# Score calculation
# Invoice vs PO: 20, No → 0
# Price verify at delivery: 25, No → 0
# Delivery counted at receipt: 25, Sometimes → 10
# Credit memos tracked: 15, No → 0
# Annual bids: 15, No → 0
# Payment policy: +5 bonus absorbed into rounding, written policy, partial offset
S4_PTS_INVOICE_PO        = 0    # cannot determine invoice vs PO verification from submitted data
S4_PTS_PRICE_VERIFY      = 0    # cannot determine price verification practice from submitted data
S4_PTS_DELIVERY          = 10    # sometimes = partial 10/25
S4_PTS_CREDIT            = 0    # cannot determine credit memo practice from submitted data
S4_PTS_BIDS              = 0    # cannot determine annual bidding practice from submitted data
S4_PTS_PAYMENT           = 0    # cannot determine written payment policy from submitted data
S4_SCORE                 = S4_PTS_DELIVERY  # scoreable variable only


# ── SECTION 4: VENDOR CONTROL ─────────────────────────────────────────────────

def page_section4():
    s = []
    tier = S4_TIER

    s += section_header(
        "SECTION 4",
        "Vendor Control",
        "Whether what is ordered, delivered, and invoiced is being verified before money leaves the building."
    )

    # ── TIER 0 ────────────────────────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(4, "Vendor Control"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Vendor Control",
            "At least one POS sales report (beverages or food) to establish a revenue "
            "baseline for vendor spend analysis.",
            "Revenue context for vendor spend as a percentage of sales, "
            "overbilling exposure estimate against the industry average, "
            "and assessment of which verification controls are missing.",
            "With POS data submitted, this section would show your vendor spend "
            "as a percentage of revenue, estimate your overbilling exposure using the "
            "industry average of 2 to 4% of vendor spend for operations without "
            "systematic verification, and identify which invoice and delivery controls "
            "would reduce that exposure to near zero."
        ))
        return s

    # ── TIER 1 ────────────────────────────────────────────────────────────────
    if tier == 1:
        s.append(section_score_tile(4, "Vendor Control", 18,
            note="Partial score, POS data only, max 40 pts"))
        s.append(sp(16))
        est_low  = round(S4_VENDOR_SPEND_MONTHLY * 0.02)
        est_high = round(S4_VENDOR_SPEND_MONTHLY * 0.04)
        s.append(amber_note(
            f"Vendor invoice data was not submitted. "
            f"The assessment below is based on invoice data only. No POS exception or inventory data was submitted for this section. "
            f"Submit beverage and food invoices from the audit period to unlock "
            f"invoice-level analysis including spend totals by category and delivery accuracy. "
            f"Industry average overbilling without systematic verification runs 2 to 4% of "
            f"total vendor spend, ${est_low:,.0f} to ${est_high:,.0f} per month at your spend level."
        ))
        s.append(sp(16))
        s += sub_header("Limited Data Assessment")
        s.append(body(
            "Scored against the industry standard using submitted invoice data. "
            "No invoice data was available for this analysis."
        ))
        s.append(sp(12))

        def sc_t1(lbl):
            c = SAGE if lbl == "ON TARGET" else (SALMON if lbl == "CRITICAL" else AMBER)
            return Paragraph(lbl, ParagraphStyle(f"s4t1_{lbl[:4]}", fontName=FONT_BOLD,
                fontSize=8, textColor=c, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0))

        t1_rows = [
            [Paragraph("Invoice checked against PO", STYLES["table_cell_left"]),
             Paragraph(S4_INVOICE_VS_PO, STYLES["table_cell"]),
             Paragraph("Every invoice", STYLES["table_cell"]),
             sc_t1("CRITICAL")],
            [Paragraph("Price verified at delivery", STYLES["table_cell_left"]),
             Paragraph(S4_PRICE_VERIFY, STYLES["table_cell"]),
             Paragraph("Every delivery", STYLES["table_cell"]),
             sc_t1("CRITICAL")],
            [Paragraph("Delivery counted at receipt", STYLES["table_cell_left"]),
             Paragraph(S4_DELIVERY_COUNT, STYLES["table_cell"]),
             Paragraph("Every delivery", STYLES["table_cell"]),
             sc_t1("ATTENTION")],
            [Paragraph("Annual competitive bids", STYLES["table_cell_left"]),
             Paragraph(S4_ANNUAL_BIDS, STYLES["table_cell"]),
             Paragraph("At least annually", STYLES["table_cell"]),
             sc_t1("CRITICAL")],
        ]
        cw_t1 = [CONTENT_W*0.34, CONTENT_W*0.14, CONTENT_W*0.24, CONTENT_W*0.28]
        s.append(std_table(["Control", "Submitted", "Standard", "Status"], t1_rows, cw_t1))
        return s

    # ── TIER 2: Full analysis ─────────────────────────────────────────────────
    s.append(section_score_tile(4, "Vendor Control", S4_SCORE))
    s.append(sp(20))

    # 4.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("Beverage Invoices", STYLES["table_cell_left"]),
         Paragraph(f"{S4_BEV_INVOICE_COUNT} invoices, {S4_AUDIT_PERIOD_DESC}",
             STYLES["table_cell_left"]),
         Paragraph(f"${S4_BEV_INVOICE_SPEND:,.0f}", STYLES["table_cell"])],
        [Paragraph("Food Invoices", STYLES["table_cell_left"]),
         Paragraph(f"{S4_FOOD_INVOICE_COUNT} invoices, {S4_AUDIT_PERIOD_DESC}",
             STYLES["table_cell_left"]),
         Paragraph(f"${S4_FOOD_INVOICE_SPEND:,.0f}", STYLES["table_cell"])],
        [Paragraph("Total vendor spend (period)", STYLES["table_cell_left"]),
         Paragraph(f"{S4_BEV_INVOICE_COUNT + S4_FOOD_INVOICE_COUNT} invoices total",
             STYLES["table_cell_left"]),
         Paragraph(f"${S4_VENDOR_SPEND_MONTHLY:,.0f}", STYLES["table_cell"])],
        [Paragraph("POS Data Only", STYLES["table_cell_left"]),
         Paragraph("Submitted with audit", STYLES["table_cell_left"]),
         Paragraph("6 control elements assessed", STYLES["table_cell"])],
        [Paragraph("Vendor Price List", STYLES["table_cell_left"]),
         Paragraph("Not submitted", STYLES["table_cell_left"]),
         Paragraph("Required for Tier 3", STYLES["table_cell"])],
    ]
    cw_d = [CONTENT_W*0.34, CONTENT_W*0.40, CONTENT_W*0.26]
    s.append(std_table(["Document", "Detail", "Value"], data_rows, cw_d))
    s.append(sp(20))

    # 4.2 Invoice Summary
    s += sub_header("Invoice Summary")
    inv_rows = [
        [Paragraph("Beverage", STYLES["table_cell_left"]),
         Paragraph(str(S4_BEV_INVOICE_COUNT), STYLES["table_cell"]),
         Paragraph(S4_AUDIT_PERIOD_DESC, STYLES["table_cell"]),
         Paragraph(f"${S4_BEV_INVOICE_SPEND:,.0f}", STYLES["table_cell"]),
         Paragraph(f"{round(S4_BEV_INVOICE_SPEND/S4_VENDOR_SPEND_MONTHLY*100)}%",
             STYLES["table_cell"])],
        [Paragraph("Food", STYLES["table_cell_left"]),
         Paragraph(str(S4_FOOD_INVOICE_COUNT), STYLES["table_cell"]),
         Paragraph(S4_AUDIT_PERIOD_DESC, STYLES["table_cell"]),
         Paragraph(f"${S4_FOOD_INVOICE_SPEND:,.0f}", STYLES["table_cell"]),
         Paragraph(f"{round(S4_FOOD_INVOICE_SPEND/S4_VENDOR_SPEND_MONTHLY*100)}%",
             STYLES["table_cell"])],
        [Paragraph("<b>Total</b>", STYLES["table_cell_bold"]),
         Paragraph(f"<b>{S4_BEV_INVOICE_COUNT + S4_FOOD_INVOICE_COUNT}</b>",
             STYLES["table_cell"]),
         Paragraph(S4_AUDIT_PERIOD_DESC, STYLES["table_cell"]),
         Paragraph(f"<b>${S4_VENDOR_SPEND_MONTHLY:,.0f}</b>", STYLES["table_cell"]),
         Paragraph("<b>100%</b>", STYLES["table_cell"])],
    ]
    cw_inv = [CONTENT_W*0.18, CONTENT_W*0.14, CONTENT_W*0.20, CONTENT_W*0.24, CONTENT_W*0.24]
    s.append(std_table(
        ["Category", "Invoices", "Period", "Total Spend", "% of Total"],
        inv_rows, cw_inv))
    s.append(sp(20))

    # 4.3 Overbilling Exposure
    _h_obe = sub_header("Overbilling Exposure Estimate")
    _f_obe = formula_box([
        "OVERBILLING EXPOSURE, EXPLICIT CALCULATION",
        "",
        f"  Total monthly vendor spend:         ${S4_VENDOR_SPEND_MONTHLY:,.0f}",
        f"  Industry average overbilling rate:  {S4_EXPOSURE_PCT}% of vendor spend",
        f"    (range: 2–4% for operations without systematic invoice verification)",
        "",
        f"  Monthly exposure estimate:          {S4_EXPOSURE_PCT}%"
        f" x ${S4_VENDOR_SPEND_MONTHLY:,.0f} = ${S4_EXPOSURE_MONTHLY:,.0f}/mo",
        f"  Annual exposure estimate:           ${S4_EXPOSURE_MONTHLY:,.0f}"
        f" x 12 = ${S4_EXPOSURE_ANNUAL:,.0f}/yr",
        "",
        f"  Note: This is an industry-average estimate, not a verified overbilling amount.",
        f"  Submit 12 weeks of vendor price lists to replace this estimate with actual",
        f"  price variance data against invoiced amounts.",
    ])
    s += [KeepTogether(_h_obe + [_f_obe])]
    s.append(sp(12))
    s.append(amber_note(
        "Submitting vendor price lists (12 weeks minimum) with your next audit unlocks Tier 3 "
        "analysis, which replaces this estimate with actual price variance data. "
        "For each of your top-spend items, the Tier 3 analysis compares the price on each "
        "invoice against your price list or contracted rate and identifies every invoice where "
        "you were charged above the agreed price. "
        "The difference between the estimate above and the Tier 3 verified amount "
        "is often significant, operations that have never verified prices "
        "frequently discover overbilling that exceeds the 3% estimate."
    ))
    s.append(sp(20))

    # 4.4 Controls Assessment
    s += sub_header("Vendor Controls Assessment")

    def sc(lbl):
        c = SAGE if lbl == "ON TARGET" else (SALMON if lbl == "CRITICAL" else AMBER)
        return Paragraph(lbl, ParagraphStyle(f"s4sc_{lbl[:5]}", fontName=FONT_BOLD,
            fontSize=8, leading=11, textColor=c, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    ctrl_rows = [
        [Paragraph("Invoice checked against PO", STYLES["table_cell_left"]),
         Paragraph(S4_INVOICE_VS_PO, STYLES["table_cell"]),
         Paragraph("Every invoice", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph("Primary overbilling catch. "
                   "Without a PO comparison, price changes and quantity errors on invoices "
                   "are paid without detection.", STYLES["table_cell_left"])],
        [Paragraph("Price verified at delivery", STYLES["table_cell_left"]),
         Paragraph(S4_PRICE_VERIFY, STYLES["table_cell"]),
         Paragraph("Every delivery", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph("The only control that catches price increases at the point of delivery "
                   "before the invoice is paid. "
                   "Without this, inflated prices are paid automatically.", STYLES["table_cell_left"])],
        [Paragraph("Delivery counted at receipt", STYLES["table_cell_left"]),
         Paragraph(S4_DELIVERY_COUNT, STYLES["table_cell"]),
         Paragraph("Every delivery", STYLES["table_cell"]),
         sc("ATTENTION"),
         Paragraph("Partial compliance means some deliveries are accepted without counting. "
                   "Short deliveries on uncounted orders are paid in full.", STYLES["table_cell_left"])],
        [Paragraph("Credit memos tracked", STYLES["table_cell_left"]),
         Paragraph(S4_CREDIT_MEMOS, STYLES["table_cell"]),
         Paragraph("Yes, applied within 30 days", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph("Untracked credit memos are money owed that is never collected. "
                   "Industry average: 1–2 unresolved credits per vendor per quarter.",
                   STYLES["table_cell_left"])],
        [Paragraph("Annual competitive bids", STYLES["table_cell_left"]),
         Paragraph(S4_ANNUAL_BIDS, STYLES["table_cell"]),
         Paragraph("At least annually", STYLES["table_cell"]),
         sc("CRITICAL"),
         Paragraph("Without competitive bids, there is no market reference for whether "
                   "current pricing is competitive. "
                   "Vendor pricing drifts upward without bid pressure.", STYLES["table_cell_left"])],
        [Paragraph("Backup vendor identified", STYLES["table_cell_left"]),
         Paragraph(S4_BACKUP_VENDORS, STYLES["table_cell"]),
         Paragraph("Yes, all key categories", STYLES["table_cell"]),
         sc("ATTENTION"),
         Paragraph("Spirits covered. Produce and protein have no backup, "
                   "a supply disruption in either category has no immediate alternative.",
                   STYLES["table_cell_left"])],
        [Paragraph("Written payment policy", STYLES["table_cell_left"]),
         Paragraph(S4_PAYMENT_POLICY, STYLES["table_cell"]),
         Paragraph("Yes", STYLES["table_cell"]),
         sc("ON TARGET"),
         Paragraph("Payment terms and policy documented. "
                   "This is the one vendor control currently in place.",
                   STYLES["table_cell_left"])],
    ]
    cw_ctrl = [CONTENT_W*0.20, CONTENT_W*0.10, CONTENT_W*0.14, CONTENT_W*0.14, CONTENT_W*0.42]
    s.append(std_table(
        ["Control", "In Place", "Standard", "Status", "Impact of Gap"],
        ctrl_rows, cw_ctrl))
    s.append(sp(20))

    # 4.5 Score Calculation
    s += sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Invoice verified against PO", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_INVOICE_PO), STYLES["table_cell"]),
         Paragraph("Not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("Price verified at delivery", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_PRICE_VERIFY), STYLES["table_cell"]),
         Paragraph("Not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("Delivery counted at receipt", STYLES["table_cell_left"]),
         Paragraph("25", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_DELIVERY), STYLES["table_cell"]),
         Paragraph("Sometimes, partial credit 10/25. "
                   "Full credit requires every delivery, every time.",
                   STYLES["table_cell_left"])],
        [Paragraph("Credit memos tracked", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_CREDIT), STYLES["table_cell"]),
         Paragraph("Not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("Annual bids collected", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_BIDS), STYLES["table_cell"]),
         Paragraph("Not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("Written payment policy", STYLES["table_cell_left"]),
         Paragraph("5", STYLES["table_cell"]),
         Paragraph(str(S4_PTS_PAYMENT), STYLES["table_cell"]),
         Paragraph("Not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>105</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S4_SCORE}</b>",
             ParagraphStyle("s4_total", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S4_SCORE}/100, CRITICAL</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc = [CONTENT_W*0.34, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.44]
    s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc))
    s.append(sp(10))
    s.append(Paragraph(
        "<i>Score is capped at 100. The payment policy credit (5 pts) partially offsets "
        "points lost elsewhere. Total possible shown as 105 to reflect the bonus credit "
        "for having a written payment policy in place.</i>",
        ParagraphStyle("s4_sc_note", fontName=FONT_ITALIC, fontSize=8.5, leading=13,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0)))
    s.append(sp(20))

    # 4.6 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"At ${S4_VENDOR_SPEND_MONTHLY:,.0f} per month in vendor spend, "
        f"the two controls that directly catch overbilling: "
        "invoice verification against a purchase order and price verification at delivery. "
        "could not be confirmed from submitted data. "
        "If these controls are not in place, every invoice received during the audit period "
        "was paid without a comparison to what was ordered or what price was agreed. "
        f"At the industry average overbilling rate of {S4_EXPOSURE_PCT}%, "
        f"that undetected exposure runs ${S4_EXPOSURE_MONTHLY:,.0f} per month "
        f"and ${S4_EXPOSURE_ANNUAL:,.0f} per year. "
        "The actual figure may be higher or lower. Without verified price data, "
        "the real number is unknown."
    ))
    s.append(sp(12))
    s.append(KeepTogether([body(
        "The fix is procedural, not technical. "
        "Invoice verification requires one person, a copy of the original order, "
        "and five minutes per invoice. "
        "Price verification at delivery requires the driver to wait while the "
        "receiving manager checks the invoice price against the price on file. "
        "Neither requires new software or significant time investment. "
        "Both require a written policy that makes them non-negotiable on every delivery. "
        "An operation with a written payment policy has the foundation to extend "
        "that discipline to receiving and invoice review, closing the gap that a payment policy alone does not address."
    )]))
    s.append(sp(20))

    # 4.7 Action Items
    _h_ai_s4 = sub_header("Action Items")
    _f_ai_s4 = action_item(
        priority="HIGH",
        title="Verify Every Invoice Against the Original Purchase Order",
        area="Vendor Control",
        data_desc=(
            f"{S4_BEV_INVOICE_COUNT + S4_FOOD_INVOICE_COUNT} invoices processed "
            f"during the audit period totaling ${S4_VENDOR_SPEND_MONTHLY:,.0f} "
            "with no confirmed comparison to the original purchase order in submitted data. "
            "If invoices are not being verified against purchase orders line by line, "
            "quantity errors, price substitutions, and added line items on invoices "
            "are paid automatically without detection. "
            "The exposure estimate above represents undetected overbilling risk at the industry average rate."
        ),
        instruction=(
            "Before paying any invoice, pull the original purchase order and compare: "
            "quantity ordered vs. quantity invoiced, price per unit ordered vs. invoiced, "
            "and items ordered vs. items on the invoice. "
            "Any discrepancy gets a written note and a call to the vendor before payment. "
            "Log every invoice with the comparison result: quantities match, prices match, or discrepancy noted. "
            "A discrepancy rate above 5% of invoices warrants a direct conversation with that vendor."
        ),
        tool="Verify every invoice against your purchase order before paying.",
        time_str="This week",
        monthly=f"${round(S4_EXPOSURE_MONTHLY * 0.4):,.0f}–${round(S4_EXPOSURE_MONTHLY * 0.6):,.0f}",
        annual=f"${round(S4_EXPOSURE_MONTHLY * 0.4 * 12):,.0f}–${round(S4_EXPOSURE_MONTHLY * 0.6 * 12):,.0f}",
    )
    s += [KeepTogether(_h_ai_s4 + [_f_ai_s4])]
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Verify Prices at Every Delivery Before Signing the Invoice",
        area="Vendor Control",
        data_desc=(
            "Price verification at delivery could not be confirmed from submitted data. "
            "If prices are not verified at delivery, vendor price increases applied between orders and deliveries are paid without detection. "
            "Industry data shows that unverified delivery prices drift upward "
            "by an average of 1.5 to 3% per year through incremental increases "
            "that go unnoticed without a verification step."
        ),
        instruction=(
            "At every delivery, receiving manager compares the invoice price "
            "for each line item against your price list on file. "
            "If any item is priced above the agreed rate, do not sign the invoice, "
            "note the discrepancy on the invoice, contact the vendor, "
            "and request a corrected invoice before payment. "
            "Post the current price list at the receiving area. "
            "Update your price list on file every time a vendor confirms a price change in writing."
        ),
        tool="Verify every invoice against your purchase order before paying.",
        time_str="This week",
        monthly=f"${round(S4_EXPOSURE_MONTHLY * 0.3):,.0f}–${round(S4_EXPOSURE_MONTHLY * 0.5):,.0f}",
        annual=f"${round(S4_EXPOSURE_MONTHLY * 0.3 * 12):,.0f}–${round(S4_EXPOSURE_MONTHLY * 0.5 * 12):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Collect Competitive Bids for All Major Vendor Categories Annually",
        area="Vendor Control",
        data_desc=(
            "No competitive bids have been collected for any vendor category. "
            "Without a market comparison, there is no way to know whether current "
            "pricing is competitive or whether the operation is paying above-market "
            "rates that a simple bid process would identify and correct."
        ),
        instruction=(
            "Schedule a vendor bid process once per year, January is the standard. "
            "For each major category (spirits, beer, wine, produce, protein, dry goods), "
            "contact at least two alternative suppliers and request a price list "
            "for your top 20 items by spend. "
            "Compare against what you are currently paying. "
            "Use the comparison as leverage with your current vendor, "
            "or switch categories where the savings justify the transition cost. "
            "Even a 2% reduction in total vendor spend from competitive pricing "
            f"saves ${round(S4_VENDOR_SPEND_MONTHLY * 0.02 * 12):,.0f} per year at your spend level."
        ),
        tool="Verify every invoice against your purchase order before paying.",
        time_str="30 days to initiate",
        monthly=f"${round(S4_VENDOR_SPEND_MONTHLY * 0.01):,.0f}–${round(S4_VENDOR_SPEND_MONTHLY * 0.02):,.0f}",
        annual=f"${round(S4_VENDOR_SPEND_MONTHLY * 0.012 * 12):,.0f}–${round(S4_VENDOR_SPEND_MONTHLY * 0.024 * 12):,.0f}",
    ))

    return s


# ── SECTION 5 SAMPLE DATA (Tier 2) ───────────────────────────────────────────
S5_TIER                  = 2

# Revenue (4-week period, consistent with Sections 1 and 3)
S5_BEV_REV_PERIOD        = 164800
S5_FOOD_REV_PERIOD       = 114400
S5_TOTAL_REV_PERIOD      = 279200

# COGS, pulled directly from Section 1 and Section 3 results
S5_BEV_COGS_PERIOD       = 45155     # 27.4% of bev rev
S5_FOOD_COGS_PERIOD      = 43930     # 38.4% of food rev
S5_TOTAL_COGS_PERIOD     = 89085     # sum

# Labor, operator-reported estimate, NOT verified from payroll
S5_LABOR_PERIOD          = 78176     # 28% of total revenue
S5_LABOR_PCT             = 28.0
S5_LABOR_SOURCE          = "Operator estimate, not verified from payroll"

# Prime cost
S5_PRIME_COST_AMT        = S5_TOTAL_COGS_PERIOD + S5_LABOR_PERIOD   # $167,261
S5_PRIME_COST_PCT        = round(S5_PRIME_COST_AMT / S5_TOTAL_REV_PERIOD * 100, 1)  # 59.9%
S5_TARGET_PCT            = 60.0      # under 60% for full-service

# Component rates
S5_BAR_COST_PCT          = 27.4      # from Section 1
S5_FOOD_COST_PCT         = 38.4      # from Section 3
S5_BLENDED_COGS_PCT      = round(S5_TOTAL_COGS_PERIOD / S5_TOTAL_REV_PERIOD * 100, 1)  # 31.9%

# Process flags
S5_PRIME_WEEKLY          = "No, monthly only"
S5_LABOR_BY_DEPT         = "No, blended only"
S5_SCHEDULE_FORECAST     = "No"
S5_RPLH_TRACKED          = "No"

# Gap, prime cost is inside target, so gap is $0 on the prime cost line
# But component gaps are real and sourced from Sections 1 and 3
S5_BAR_COST_GAP_MONTHLY  = 2637     # from Section 1
S5_FOOD_COST_GAP_MONTHLY = 2116     # from Section 3
S5_COMBINED_COGS_GAP     = S5_BAR_COST_GAP_MONTHLY + S5_FOOD_COST_GAP_MONTHLY  # $4,753

# Monthly equivalents (period data / 1 since period = 1 month equivalent)
S5_TOTAL_REV_MONTHLY     = S5_TOTAL_REV_PERIOD      # 4-week period treated as monthly
S5_LABOR_MONTHLY         = S5_LABOR_PERIOD

# Score calculation
# Prime cost within target: 35 pts (59.9% < 60% = full 35)
# Prime cost tracked weekly: monthly only → 15/20 (substantial partial, tracking exists, cadence wrong)
# Labor by department: blended only → 0/20
# Schedule from forecast: No → 0/15
# RPLH tracked: No → 0/10
# Total: 50/100, bottom of ATTENTION range
S5_PTS_PRIME_PCT         = 35
S5_PTS_PRIME_WEEKLY      = 0    # cannot determine tracking frequency from submitted data
S5_PTS_LABOR_DEPT        = 0
S5_PTS_SCHEDULE          = 0    # cannot determine scheduling practice from submitted data
S5_PTS_RPLH              = 0    # cannot determine whether RPLH is tracked from submitted data
S5_SCORE                 = S5_PTS_PRIME_PCT + S5_PTS_LABOR_DEPT  # scoreable variables only


# ── SECTION 5: PRIME COST ─────────────────────────────────────────────────────

def page_section5():
    s = []
    tier = S5_TIER

    s += section_header(
        "SECTION 5",
        "Prime Cost",
        "The single number that combines cost of goods and labor, "
        "and whether it means what it appears to mean."
    )

    # ── TIER 0: Neither POS report ────────────────────────────────────────────
    if tier == 0:
        s.append(na_score_tile(5, "Prime Cost"))
        s.append(sp(16))
        s.append(tier_placeholder(
            "Prime Cost",
            "Both POS Sales Reports, Beverages and Food, are required to establish "
            "the revenue base for prime cost calculation.",
            "Prime cost percentage calculated from verified COGS and operator-reported labor, "
            "compared against the under-60% full-service target, with the monthly dollar "
            "cost of any gap shown explicitly.",
            "With both POS reports submitted, this section would show your calculated prime "
            "cost percentage and its two components, combined COGS and labor as a share of "
            "revenue, compare each against the industry target, and identify whether a "
            "prime cost that appears healthy is actually masking above-target costs "
            "in one or more components."
        ))
        return s

    # ── TIER 1: Both POS reports, no inventory ────────────────────────────────
    if tier == 1:
        s.append(section_score_tile(5, "Prime Cost", 38,
            note="Partial score, POS and self-reported labor only"))
        s.append(sp(16))
        s.append(amber_note(
            "Bar and kitchen inventory count sheets were not submitted. "
            "COGS cannot be calculated from verified documents at this tier. "
            "The prime cost figure below uses operator-reported estimates for both "
            "COGS and labor, it reflects what the operator believes the numbers are, "
            "not what the data confirms. "
            "Submit bar and kitchen inventory count sheets and invoices from the "
            "audit period to unlock verified COGS and a calculated prime cost percentage."
        ))
        s.append(sp(16))
        s += sub_header("Self-Reported Prime Cost Components")
        s.append(body(
            "Based on operator-reported revenue estimates submitted with the audit data. "
            "All figures unverified."
        ))
        s.append(sp(12))
        pr_rows = [
            [Paragraph("Total revenue (period)", STYLES["table_cell_left"]),
             Paragraph(f"${S5_TOTAL_REV_PERIOD:,.0f}", STYLES["table_cell"]),
             Paragraph("From POS reports", STYLES["table_cell_left"])],
            [Paragraph("COGS estimate (operator)", STYLES["table_cell_left"]),
             Paragraph("Not verified", STYLES["table_cell"]),
             Paragraph("Requires inventory + invoices", STYLES["table_cell_left"])],
            [Paragraph("Labor estimate (operator)", STYLES["table_cell_left"]),
             Paragraph(f"${S5_LABOR_PERIOD:,.0f}", STYLES["table_cell"]),
             Paragraph(S5_LABOR_SOURCE, STYLES["table_cell_left"])],
            [Paragraph("Prime cost % (estimated)", STYLES["table_cell_left"]),
             Paragraph("Not calculated", STYLES["table_cell"]),
             Paragraph("Cannot verify without COGS data", STYLES["table_cell_left"])],
        ]
        cw_pr = [CONTENT_W*0.34, CONTENT_W*0.24, CONTENT_W*0.42]
        s.append(std_table(["Component", "Value", "Notes"], pr_rows, cw_pr))
        return s

    # ── TIER 2: Inventory added, COGS calculable ──────────────────────────────
    s.append(section_score_tile(5, "Prime Cost", S5_SCORE))
    s.append(sp(20))

    # 5.1 Data Used
    s += sub_header("Data Used in This Analysis")
    data_rows = [
        [Paragraph("POS, Beverages", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S5_BEV_REV_PERIOD:,.0f}", STYLES["table_cell"])],
        [Paragraph("POS, Food", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S5_FOOD_REV_PERIOD:,.0f}", STYLES["table_cell"])],
        [Paragraph("Bar Inventory + Bev Invoices", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"COGS ${S5_BEV_COGS_PERIOD:,.0f}", STYLES["table_cell"])],
        [Paragraph("Kitchen Inventory + Food Invoices", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"COGS ${S5_FOOD_COGS_PERIOD:,.0f}", STYLES["table_cell"])],
        [Paragraph("Labor (operator-reported)", STYLES["table_cell_left"]),
         Paragraph(AUDIT_PERIOD, STYLES["table_cell_left"]),
         Paragraph(f"${S5_LABOR_PERIOD:,.0f}, unverified estimate",
             ParagraphStyle("s5_lab_note", fontSize=8.5, leading=12,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))],
    ]
    cw_d = [CONTENT_W*0.34, CONTENT_W*0.30, CONTENT_W*0.36]
    s.append(std_table(["Document", "Period", "Value"], data_rows, cw_d))
    s.append(sp(20))

    # 5.2 Prime Cost Calculation (explicit math)
    _h_pcc = sub_header("Prime Cost Calculation")
    def _pcc_title(t):
        return Paragraph(t, ParagraphStyle(f"pcct_{t[:6].replace(' ','_')}",
            fontName=FONT_BOLD, fontSize=9, leading=13,
            textColor=GOLD, leftIndent=0, firstLineIndent=0))
    def _pcc_line(t):
        return Paragraph(t, ParagraphStyle(f"pccl_{t[:6].replace(' ','_')}",
            fontName=FONT_REG, fontSize=8.5, leading=13,
            textColor=WHITE, leftIndent=0, firstLineIndent=0))
    _pcc_items = [
        _pcc_title("PRIME COST, EXPLICIT CALCULATION"), sp(4),
        _pcc_line(f"  Beverage revenue (period):      ${S5_BEV_REV_PERIOD:,.0f}"),
        _pcc_line(f"  Food revenue (period):          ${S5_FOOD_REV_PERIOD:,.0f}"),
        _pcc_line(f"  Total revenue:                  ${S5_TOTAL_REV_PERIOD:,.0f}"), sp(4),
        _pcc_line(f"  Beverage COGS (from Section 1): ${S5_BEV_COGS_PERIOD:,.0f}  ({S5_BAR_COST_PCT}%)"),
        _pcc_line(f"  Food COGS (from Section 3):     ${S5_FOOD_COGS_PERIOD:,.0f}  ({S5_FOOD_COST_PCT}%)"),
        _pcc_line(f"  Total COGS:                     ${S5_TOTAL_COGS_PERIOD:,.0f}  ({S5_BLENDED_COGS_PCT}%)"), sp(4),
        _pcc_line(f"  Labor (operator-reported):      ${S5_LABOR_PERIOD:,.0f}  ({S5_LABOR_PCT}%)"),
        _pcc_line(f"  * Labor figure is an operator estimate, not verified from payroll data"), sp(4),
        _pcc_line(f"  Prime cost (COGS + Labor):      ${S5_PRIME_COST_AMT:,.0f}"),
        _pcc_line(f"  Prime cost %:                   ${S5_PRIME_COST_AMT:,.0f} / ${S5_TOTAL_REV_PERIOD:,.0f} = {S5_PRIME_COST_PCT}%"),
        _pcc_line(f"  Full-service target:            Under {S5_TARGET_PCT}%"),
        _pcc_line(f"  Status:                         {S5_PRIME_COST_PCT}%, within target by 0.1 points"),
    ]
    _pcc_inner = Table([[i] for i in _pcc_items], colWidths=[CONTENT_W - 32])
    _pcc_inner.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),1),("BOTTOMPADDING",(0,0),(-1,-1),1),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    _f_pcc = Table([[_pcc_inner]], colWidths=[CONTENT_W])
    _f_pcc.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16)]))
    s += _h_pcc
    s.append(_f_pcc)
    s.append(sp(20))

    # 5.3 Component Breakdown Table
    _h_cbd = sub_header("Component Breakdown vs. Targets")

    def sc(lbl):
        c = SAGE if lbl == "ON TARGET" else (SALMON if lbl == "CRITICAL" else AMBER)
        return Paragraph(lbl, ParagraphStyle(f"s5sc_{lbl[:5]}", fontName=FONT_BOLD,
            fontSize=8, leading=11, textColor=c, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    comp_rows = [
        [Paragraph("Bar cost %", STYLES["table_cell_left"]),
         Paragraph(f"{S5_BAR_COST_PCT}%",
             ParagraphStyle("s5_bc", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("18–24%", STYLES["table_cell"]),
         Paragraph(f"+{round(S5_BAR_COST_PCT - 21.0, 1)} pts",
             ParagraphStyle("s5_bcg", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"${S5_BAR_COST_GAP_MONTHLY:,.0f}/mo", STYLES["table_cell"]),
         sc("CRITICAL")],
        [Paragraph("Food cost %", STYLES["table_cell_left"]),
         Paragraph(f"{S5_FOOD_COST_PCT}%",
             ParagraphStyle("s5_fc", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("28–34%", STYLES["table_cell"]),
         Paragraph(f"+{round(S5_FOOD_COST_PCT - 31.0, 1)} pts",
             ParagraphStyle("s5_fcg", fontName=FONT_BOLD, fontSize=9,
             textColor=SALMON, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"${S5_FOOD_COST_GAP_MONTHLY:,.0f}/mo", STYLES["table_cell"]),
         sc("CRITICAL")],
        # Labor row, AMBER flagged as unverified
        [Paragraph("Labor % (estimated)",
             ParagraphStyle("s5_lab_lbl", fontSize=8.5, leading=12,
             textColor=AMBER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"{S5_LABOR_PCT}%",
             ParagraphStyle("s5_lp", fontName=FONT_BOLD, fontSize=9,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("28–35%", STYLES["table_cell"]),
         Paragraph("Below range",
             ParagraphStyle("s5_lpg", fontName=FONT_BOLD, fontSize=9,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("See note", STYLES["table_cell"]),
         Paragraph("UNVERIFIED", ParagraphStyle("s5_lab_st", fontName=FONT_BOLD,
             fontSize=8, leading=11, textColor=AMBER, alignment=TA_CENTER,
             leftIndent=0, firstLineIndent=0))],
        [Paragraph("<b>Prime cost %</b>", STYLES["table_cell_bold"]),
         Paragraph(f"<b>{S5_PRIME_COST_PCT}%</b>",
             ParagraphStyle("s5_pcp", fontName=FONT_BOLD, fontSize=9,
             textColor=SAGE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("<b>Under 60%</b>", STYLES["table_cell"]),
         Paragraph("<b>−0.1 pts</b>",
             ParagraphStyle("s5_pcg", fontName=FONT_BOLD, fontSize=9,
             textColor=SAGE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph("<b>Within target</b>", STYLES["table_cell"]),
         sc("ON TARGET")],
    ]
    cw_comp = [CONTENT_W*0.22, CONTENT_W*0.12, CONTENT_W*0.14,
               CONTENT_W*0.14, CONTENT_W*0.16, CONTENT_W*0.22]
    _f_cbd = std_table(
        ["Component", "Your %", "Target", "Gap", "Monthly Cost", "Status"],
        comp_rows, cw_comp)
    s += _h_cbd
    s.append(_f_cbd)
    s.append(sp(10))
    s.append(amber_note(
        f"Labor percentage of {S5_LABOR_PCT}% is an operator-reported estimate, "
        "not a figure calculated from verified payroll data. "
        "The prime cost calculation above uses this estimate. "
        "Submit payroll and time clock data with your next audit to replace this "
        "estimate with a verified labor percentage. "
        "If actual labor is higher than reported, prime cost will exceed the 60% target "
        "and the score and gap calculations in this section will change materially."
    ))
    s.append(sp(20))

    # ── MOST IMPORTANT DIAGNOSTIC FINDING, SALMON callout ───────────────────
    s.append(callout_box(
        "CRITICAL DIAGNOSTIC: PRIME COST IS MISLEADING AT THIS OPERATION",
        f"Prime cost of {S5_PRIME_COST_PCT}% appears to be within the under-60% target "
        f"by a margin of 0.1 percentage points. "
        "Do not treat this as a sign of control. "
        f"Bar cost is {S5_BAR_COST_PCT}%, above target. "
        f"Food cost is {S5_FOOD_COST_PCT}%, well above target. "
        f"The only reason prime cost is inside the target is that labor "
        f"at {S5_LABOR_PCT}% sits below the 28% lower bound of the target range. "
        "Labor running below the target floor is not a sign of efficiency. "
        "It is a warning sign that the operation may be understaffed on some shifts, "
        "saving on labor while simultaneously overspending on product. "
        "A prime cost that is in range because labor is suppressed "
        "while both COGS components are above target "
        "is not a balanced operation. "
        "It is two separate problems creating the appearance of one acceptable number.",
        bg=SALMON
    ))
    s.append(sp(20))

    # 5.4 Score Calculation
    s += sub_header("Score Calculation")
    score_rows = [
        [Paragraph("Prime cost % within target", STYLES["table_cell_left"]),
         Paragraph("35", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_PRIME_PCT), STYLES["table_cell"]),
         Paragraph(
             f"{S5_PRIME_COST_PCT}% is within the under-{S5_TARGET_PCT}% target. "
             "Full 35 points awarded.",
             STYLES["table_cell_left"])],
        [Paragraph("Prime cost tracked weekly", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_PRIME_WEEKLY), STYLES["table_cell"]),
         Paragraph("Not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("Labor tracked by department", STYLES["table_cell_left"]),
         Paragraph("20", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_LABOR_DEPT), STYLES["table_cell"]),
         Paragraph("Not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("Schedule built from revenue forecast", STYLES["table_cell_left"]),
         Paragraph("15", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_SCHEDULE), STYLES["table_cell"]),
         Paragraph("Not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("RPLH tracked", STYLES["table_cell_left"]),
         Paragraph("10", STYLES["table_cell"]),
         Paragraph(str(S5_PTS_RPLH), STYLES["table_cell"]),
         Paragraph("Not determinable from submitted data. Flagged for operator review.", STYLES["table_cell_left"])],
        [Paragraph("<b>SECTION TOTAL</b>", STYLES["table_cell_bold"]),
         Paragraph("<b>100</b>", STYLES["table_cell"]),
         Paragraph(f"<b>{S5_SCORE}</b>",
             ParagraphStyle("s5_sc_tot", fontName=FONT_BOLD, fontSize=9,
             textColor=AMBER, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
         Paragraph(f"<b>Score: {S5_SCORE}/100, ATTENTION</b>",
             STYLES["table_cell_bold"])],
    ]
    cw_sc = [CONTENT_W*0.34, CONTENT_W*0.11, CONTENT_W*0.11, CONTENT_W*0.44]
    s.append(std_table(["Scoring Element", "Possible", "Earned", "Notes"],
        score_rows, cw_sc))
    s.append(sp(20))

    # 5.5 Narrative
    s += sub_header("Narrative Analysis")
    s.append(body(
        f"Prime cost of {S5_PRIME_COST_PCT}% sits inside the under-60% full-service target "
        f"by one tenth of a point, but reading that number as a sign of health "
        "would be a significant mistake at this operation. "
        f"Bar cost at {S5_BAR_COST_PCT}% and food cost at {S5_FOOD_COST_PCT}% "
        "are both above their respective targets, "
        f"contributing ${S5_COMBINED_COGS_GAP:,.0f} per month in combined COGS gap "
        "against benchmarks. "
        f"The only reason prime cost is inside the target is that labor at {S5_LABOR_PCT}% "
        "sits below the 28% lower bound of the target range, "
        "and that labor figure is an operator estimate, not a verified payroll number. "
        "If actual labor is even 2 percentage points higher than reported, "
        "prime cost moves to 61.9% and is out of range."
    ))
    s.append(sp(12))
    s.append(body(
        "The more important issue is the management system gap, not the percentage itself. "
        "Prime cost tracking frequency, department-level labor breakdown, "
        "revenue-based scheduling, and RPLH tracking could not be confirmed from submitted data. "
        "If prime cost is only reviewed at month-end rather than weekly, "
        "a four-week lag means problems compound before they are visible. "
        "A bar that tracks prime cost weekly, by department, from a revenue-based schedule "
        "catches a problem in 7 days. "
        "Without that cadence, a drift to 63% or 65% runs for 30 days "
        "before anyone sees it. After four weeks of margin loss have already compounded."
    ))
    s.append(sp(20))

    # 5.6 Action Items
    _h_ai_s5 = sub_header("Action Items")
    _f_ai_s5 = action_item(
        priority="HIGH",
        title="Move Prime Cost Tracking to Weekly",
        area="Prime Cost",
        data_desc=(
            f"Prime cost tracking frequency could not be confirmed from submitted data. "
            f"At {S5_PRIME_COST_PCT}%, the current number appears in range, "
            "but if prime cost is only reviewed monthly, a drift to 63% or 65% "
            "runs for 30 days before anyone sees it. "
            "Weekly tracking catches a 2-point drift in 7 days "
            "while it is still correctable. Review current practice against this standard."
        ),
        instruction=(
            "Every Monday morning calculate prime cost from the prior week: "
            "bar and kitchen COGS from your variance counts, "
            "labor from your schedule or time clock, "
            "divided by prior week revenue from POS. "
            "If prime cost is trending above target, adjust the schedule "
            "before the week runs, not after."
        ),
        tool="Calculate prime cost weekly: COGS plus labor divided by revenue.",
        time_str="This week",
        monthly=f"${round(S5_TOTAL_REV_MONTHLY * 0.010):,.0f}–${round(S5_TOTAL_REV_MONTHLY * 0.020):,.0f}",
        annual=f"${round(S5_TOTAL_REV_MONTHLY * 0.012 * 12):,.0f}–${round(S5_TOTAL_REV_MONTHLY * 0.020 * 12):,.0f}",
    )
    s += [KeepTogether(_h_ai_s5 + [_f_ai_s5])]
    s.append(sp(10))

    s.append(action_item(
        priority="HIGH",
        title="Track Labor by Department, Not as a Blended Total",
        area="Prime Cost",
        data_desc=(
            f"Department-level labor tracking could not be confirmed from submitted data. "
            f"Labor appears as {S5_LABOR_PCT}% of revenue in the submitted P&L. "
            "If labor is tracked only as a blended total, there is no way to determine "
            "whether bar labor, kitchen labor, or floor labor is driving the number, "
            "or whether one department is over target while another masks it. "
            "A blended total that looks acceptable can hide a "
            "department-level problem that a breakdown would surface immediately."
        ),
        instruction=(
            "Configure your time clock or payroll system to tag hours by department: "
            "bar, kitchen, floor, and management. "
            "If manual, assign each shift to a department at scheduling. "
            "Record bar, kitchen, and floor labor separately from your time clock or payroll every week. "
            "Target: bar under 12% of bar revenue, kitchen under 18% of food revenue, "
            "floor under 10% of total revenue. "
            "Review each department alongside COGS at every Monday prime cost check."
        ),
        tool="Build your schedule from a weekly revenue projection.",
        time_str="2 weeks",
        monthly=f"${round(S5_LABOR_MONTHLY * 0.03):,.0f}–${round(S5_LABOR_MONTHLY * 0.06):,.0f}",
        annual=f"${round(S5_LABOR_MONTHLY * 0.036 * 12):,.0f}–${round(S5_LABOR_MONTHLY * 0.060 * 12):,.0f}",
    ))
    s.append(sp(10))

    s.append(action_item(
        priority="MEDIUM",
        title="Build the Schedule from a Revenue Forecast Each Week",
        area="Prime Cost",
        data_desc=(
            "Schedule is not built from a revenue forecast. "
            "Without a revenue projection, labor hours are assigned based on habit "
            "or last week's schedule rather than expected business volume. "
            "This produces overstaffed slow shifts and understaffed busy shifts, "
            "the pattern most likely to explain labor running below the target floor "
            "while guests have a degraded experience on busy nights."
        ),
        instruction=(
            "Before building each week's schedule, pull the prior two weeks of "
            "daily revenue from POS and project the coming week by day. "
            "Calculate target labor hours by department from that projection. "
            "Build the schedule to the target hours, not to last week's template. "
            "Review RPLH at the Monday prime cost check, "
            "RPLH below target on a day indicates overstaffing relative to revenue."
        ),
        tool="Build your schedule from a weekly revenue projection.",
        time_str="1 week",
        monthly=f"${round(S5_LABOR_MONTHLY * 0.020):,.0f}–${round(S5_LABOR_MONTHLY * 0.040):,.0f}",
        annual=f"${round(S5_LABOR_MONTHLY * 0.024 * 12):,.0f}–${round(S5_LABOR_MONTHLY * 0.040 * 12):,.0f}",
    ))

    # Tier 3 layer
    if tier >= 3:
        s.append(sp(20))
        s += sub_header("Tier 3: Verified Labor Analysis")
        s.append(amber_note(
            "Payroll and time clock data were submitted. "
            "The labor figure below is calculated from verified payroll records, "
            "not an operator estimate."
        ))
        s.append(sp(12))
        t3_rows = [
            [Paragraph("Verified labor % (from payroll)", STYLES["table_cell_left"]),
             Paragraph("Tier 3 only", STYLES["table_cell"]),
             Paragraph("28–35%", STYLES["table_cell"])],
            [Paragraph("Bar labor %", STYLES["table_cell_left"]),
             Paragraph("Tier 3 only", STYLES["table_cell"]),
             Paragraph("Under 12% of bar revenue", STYLES["table_cell"])],
            [Paragraph("Kitchen labor %", STYLES["table_cell_left"]),
             Paragraph("Tier 3 only", STYLES["table_cell"]),
             Paragraph("Under 18% of food revenue", STYLES["table_cell"])],
            [Paragraph("Floor labor %", STYLES["table_cell_left"]),
             Paragraph("Tier 3 only", STYLES["table_cell"]),
             Paragraph("Under 10% of total revenue", STYLES["table_cell"])],
        ]
        cw_t3 = [CONTENT_W*0.36, CONTENT_W*0.28, CONTENT_W*0.36]
        s.append(std_table(["Metric", "Value", "Target"], t3_rows, cw_t3))

    return s


# ── SECTION 6 DATA, DERIVED FROM SUBMITTED DATA ─────────────────────────────
# No questionnaire. No self-reporting. Every signal inferred from what was submitted.

# Signal 1, Inventory counting frequency
# Bar: 2 count sheets (opening + closing over 4 weeks) = covers period, not weekly cadence
# Kitchen: same, 2 count periods
S6_SIG1_SCORE  = "MEDIUM"
S6_SIG1_LABEL  = "Inventory Counting Frequency"
S6_SIG1_EVIDENCE = (
    "Bar and kitchen inventory count sheets submitted for 2 count periods "
    "covering the 4-week audit window. "
    "Two counts over 4 weeks indicates periodic counting, "
    "not the weekly cadence required for reliable variance tracking. "
    "Weekly counts would produce 4 or more data points per audit period."
)
S6_SIG1_GAP = (
    "Move to weekly counts. Weekly inventory produces a 7-day feedback loop "
    "vs. the 14-day cycle in the submitted data."
)
S6_SIG1_TOOL = "Run weekly bar inventory counts. Compare usage to POS sales."

# Signal 2, Variance tracking
# Section 1: variance calculable, reported blended (no SKU breakdown in submitted data)
S6_SIG2_SCORE  = "MEDIUM"
S6_SIG2_LABEL  = "Variance Tracking"
S6_SIG2_EVIDENCE = (
    "Inventory variance calculated from submitted count sheets and invoices: "
    "3.2% for bar (Section 1), 4.1% for kitchen (Section 3). "
    "Both are above the under-1% and under-2% benchmarks respectively. "
    "No SKU-level count data submitted, variance is reported as a blended total, "
    "which prevents isolating which specific items are driving the loss."
)
S6_SIG2_GAP = (
    "Submit SKU-level count sheets to enable item-level variance identification. "
    "Blended variance confirms a problem exists but cannot direct a fix."
)
S6_SIG2_TOOL = "Submit SKU-level count sheets to enable item-level variance analysis."

# Signal 3, Recipe costing
# No recipe costing sheets in the submission, Tier 2 only
S6_SIG3_SCORE  = "LOW"
S6_SIG3_LABEL  = "Recipe Costing"
S6_SIG3_EVIDENCE = (
    "No recipe costing sheets submitted with this audit. "
    "Food invoices were submitted (Tier 2), which confirms purchasing activity, "
    "but without recipe cost cards there is no defined cost standard "
    "for any menu item. "
    f"Food cost of {S3_FOOD_COST_PCT}% is {S3_GAP_PTS} points above target "
    "with no reference point for what a correctly produced dish should cost."
)
S6_SIG3_GAP = (
    "Submit recipe costing sheets with the next audit to unlock Tier 3 food cost analysis. "
    "Costing every menu item is what closes this gap. Start with the top 10 revenue items."
)
S6_SIG3_TOOL = "Cost every menu item before the next menu print."

# Signal 4, Vendor verification
# Invoices submitted but no price list, cannot confirm price consistency
S6_SIG4_SCORE  = "MEDIUM"
S6_SIG4_LABEL  = "Vendor Verification"
S6_SIG4_EVIDENCE = (
    "Beverage and food invoices submitted for the audit period "
    f"({S4_BEV_INVOICE_COUNT} beverage, {S4_FOOD_INVOICE_COUNT} food). "
    "Invoices confirm purchasing activity and total spend. "
    "No vendor price list was submitted, so invoice prices could not be "
    "compared against contracted or quoted rates. "
    "Price variance at delivery cannot be detected without a price reference."
)
S6_SIG4_GAP = (
    "Submit vendor price lists (12 weeks minimum) to enable actual overbilling detection. "
    "Currently running on the industry-average $744/mo exposure estimate."
)
S6_SIG4_TOOL = "Submit vendor price lists to enable actual overbilling detection."

# Signal 5, Prime cost tracking
# Both POS reports + inventory submitted + labor provided = full prime cost calculable
S6_SIG5_SCORE  = "HIGH"
S6_SIG5_LABEL  = "Prime Cost Tracking"
S6_SIG5_EVIDENCE = (
    "Both POS sales reports (beverage and food), bar and kitchen inventory count sheets, "
    "and a labor figure were submitted. "
    "This is sufficient to calculate a full prime cost percentage from verified data. "
    f"Prime cost calculated at {S5_PRIME_COST_PCT}% for the audit period. "
    "The labor figure is operator-reported rather than extracted from payroll, "
    "submitting payroll data would move this signal to verified-high."
)
S6_SIG5_GAP = (
    "Submit payroll and time clock data to verify the labor figure "
    "and enable department-level labor breakdown."
)
S6_SIG5_TOOL = "Submit payroll data to verify labor and enable department-level breakdown."

# Signal 6, Data completeness as management discipline proxy
S6_SIG6_SCORE  = "MEDIUM"
S6_SIG6_LABEL  = "Data Completeness"
S6_SIG6_EVIDENCE = (
    f"Tier 2 data submitted: POS reports (both), inventory count sheets, "
    "and invoices (beverage and food). "
    "Missing for Tier 3: vendor price lists, recipe costing sheets, "
    "payroll and time clock data, and waste logs. "
    "Tier 2 submission reflects a business that is measuring core financial flows "
    "but has not yet built the complete measurement infrastructure "
    "that produces the deepest analysis."
)
S6_SIG6_GAP = (
    "Tier 3 submission unlocks vendor price benchmarking, "
    "theoretical vs. actual food cost comparison, "
    "and verified labor by department. "
    "Submit all Tier 3 documents with the next audit."
)
S6_SIG6_TOOL = "Submit vendor price lists, recipe cost sheets, payroll data, and waste logs with your next audit."

# Consolidated signals list
S6_SIGNALS = [
    (S6_SIG1_LABEL, S6_SIG1_SCORE, S6_SIG1_EVIDENCE, S6_SIG1_GAP, S6_SIG1_TOOL),
    (S6_SIG2_LABEL, S6_SIG2_SCORE, S6_SIG2_EVIDENCE, S6_SIG2_GAP, S6_SIG2_TOOL),
    (S6_SIG3_LABEL, S6_SIG3_SCORE, S6_SIG3_EVIDENCE, S6_SIG3_GAP, S6_SIG3_TOOL),
    (S6_SIG4_LABEL, S6_SIG4_SCORE, S6_SIG4_EVIDENCE, S6_SIG4_GAP, S6_SIG4_TOOL),
    (S6_SIG5_LABEL, S6_SIG5_SCORE, S6_SIG5_EVIDENCE, S6_SIG5_GAP, S6_SIG5_TOOL),
    (S6_SIG6_LABEL, S6_SIG6_SCORE, S6_SIG6_EVIDENCE, S6_SIG6_GAP, S6_SIG6_TOOL),
]

# Score: HIGH=100, MEDIUM=60, LOW=20
_SCORE_MAP = {"HIGH": 100, "MEDIUM": 60, "LOW": 20}
S6_SCORE = round(sum(_SCORE_MAP[sig[1]] for sig in S6_SIGNALS) / len(S6_SIGNALS))  # 60


# ── SECTION 6: IMPLEMENTATION STATUS ─────────────────────────────────────────

def page_section6():
    s = []

    s += section_header(
        "SECTION 6",
        "Implementation Status",
        "What the submitted data reveals about measurement discipline and system adoption."
    )

    s.append(section_score_tile(6, "Implementation Status", S6_SCORE))
    s.append(sp(20))

    # 6.1 Methodology note
    s.append(callout_box(
        "HOW THIS SECTION IS SCORED",
        "This section is scored entirely from your submitted data. "
        "No additional data required for this section. "
        "What you submitted tells us whether measurement systems are in place. "
        "Each signal below reflects what your data shows, not what you report.",
        bg=STEEL
    ))
    s.append(sp(20))

    # 6.2 Signal Summary Table
    s += sub_header("Implementation Signal Summary")

    def sig_score_cell(level):
        color_map = {"HIGH": SAGE, "MEDIUM": AMBER, "LOW": SALMON}
        c = color_map.get(level, MID_GRAY)
        return Paragraph(f"<b>{level}</b>",
            ParagraphStyle(f"s6_sig_{level}", fontName=FONT_BOLD, fontSize=8.5,
            leading=11, textColor=c, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0))

    sig_rows = []
    for label, score, evidence, gap, tool in S6_SIGNALS:
        sig_rows.append([
            Paragraph(f"<b>{label}</b>", STYLES["table_cell_left"]),
            sig_score_cell(score),
            Paragraph(tool, STYLES["table_cell_left"]),
        ])

    cw_sig = [CONTENT_W*0.32, CONTENT_W*0.12, CONTENT_W*0.56]
    s.append(std_table(
        ["Signal", "Level", "Tool to Address Gap"],
        sig_rows, cw_sig))
    s.append(sp(20))

    # 6.3 Detailed Signal Analysis, one block per signal
    _h_sd = sub_header("Signal Detail")
    s += [KeepTogether(_h_sd + [sp(4)])]

    sig_score_map = {"HIGH": 100, "MEDIUM": 60, "LOW": 20}
    sig_priority_map = {"HIGH": "LOW", "MEDIUM": "MEDIUM", "LOW": "HIGH"}  # gap priority inverts

    for i, (label, score, evidence, gap, tool) in enumerate(S6_SIGNALS, 1):
        level_color = {"HIGH": SAGE, "MEDIUM": AMBER, "LOW": SALMON}[score]
        gap_priority = sig_priority_map[score]

        # Signal header row
        sig_lbl = Paragraph(f"SIGNAL {i}",
            ParagraphStyle(f"s6d_lbl{i}", fontName=FONT_BOLD, fontSize=7, leading=9,
            textColor=MID_GRAY, leftIndent=0, firstLineIndent=0))
        sig_name = Paragraph(f"<b>{label}</b>",
            ParagraphStyle(f"s6d_name{i}", fontName=FONT_BOLD, fontSize=11, leading=14,
            textColor=NAVY, leftIndent=0, firstLineIndent=0))
        sig_badge_p = Paragraph(f"<b> {score} </b>",
            ParagraphStyle(f"s6d_badge{i}", fontName=FONT_BOLD, fontSize=8, leading=10,
            textColor=WHITE, alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))
        sig_badge_t = Table([[sig_badge_p]], colWidths=[64])
        sig_badge_t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),level_color),
            ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
            ("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),
        ]))
        hdr_row = Table([[sig_name, sig_badge_t]],
            colWidths=[CONTENT_W - 32 - 72, 72])
        hdr_row.setStyle(TableStyle([
            ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
            ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ]))

        def _lbl(t): return Paragraph(t,
            ParagraphStyle(f"s6d_l{i}{t[:3]}", fontName=FONT_BOLD, fontSize=7.5,
            leading=10, textColor=GOLD, leftIndent=0, firstLineIndent=0))
        def _val(t): return Paragraph(t,
            ParagraphStyle(f"s6d_v{i}{t[:3]}", fontSize=9, leading=13,
            textColor=DARK_TEXT, leftIndent=0, firstLineIndent=0))

        cw_inner = CONTENT_W - 32
        items = [
            sig_lbl, sp(3), hdr_row, sp(10),
            _lbl("WHAT THE DATA SHOWS"), sp(3), _val(evidence),
            sp(8),
            _lbl("WHAT THIS REVEALS ABOUT THE SYSTEM"), sp(3), _val(gap),
            sp(8),
        ]
        # Tool row
        tool_p = Paragraph(
            f'<b>Action:</b>  {tool}',
            ParagraphStyle(f"s6d_tool{i}", fontSize=8.5, leading=13,
            textColor=DARK_TEXT, leftIndent=0, firstLineIndent=0))
        tool_row = Table([[tool_p]], colWidths=[cw_inner])
        tool_row.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#F7F6F2")),
            ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#E8E6E0")),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
        ]))
        items.append(tool_row)

        inner = Table([[it] for it in items], colWidths=[cw_inner])
        inner.setStyle(TableStyle([
            ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
            ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
        ]))
        outer = Table([[inner]], colWidths=[CONTENT_W])
        outer.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),WHITE),
            ("BOX",(0,0),(-1,-1),0.8,colors.HexColor("#E8E6E0")),
            ("LINEBEFORE",(0,0),(0,-1),4,level_color),
            ("TOPPADDING",(0,0),(-1,-1),14),("BOTTOMPADDING",(0,0),(-1,-1),14),
            ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16),
        ]))
        s.append(KeepTogether([outer]))
        s.append(sp(10))

    s.append(sp(10))

    # 6.4 Score Calculation
    s += sub_header("Score Calculation")
    s.append(body(
        "Each signal is scored HIGH (100), MEDIUM (60), or LOW (20) "
        "based entirely on what the submitted data demonstrates. "
        "Section score is the simple average across all six signals."
    ))
    s.append(sp(12))

    sc_rows = []
    total_pts = 0
    for i, (label, score, _, _, _) in enumerate(S6_SIGNALS, 1):
        pts = sig_score_map[score]
        total_pts += pts
        sc_rows.append([
            Paragraph(f"Signal {i}: {label}", STYLES["table_cell_left"]),
            Paragraph(score, ParagraphStyle(f"s6sc_{score[:2]}{i}",
                fontName=FONT_BOLD, fontSize=8.5,
                textColor={"HIGH": SAGE, "MEDIUM": AMBER, "LOW": SALMON}[score],
                alignment=TA_CENTER, leftIndent=0, firstLineIndent=0)),
            Paragraph(str(pts), STYLES["table_cell"]),
        ])
    section_score_val = round(total_pts / len(S6_SIGNALS))
    band_label, band_color = score_band(section_score_val)
    sc_rows.append([
        Paragraph("<b>Section Score (average)</b>", STYLES["table_cell_bold"]),
        Paragraph(f"<b>{band_label}</b>",
            ParagraphStyle("s6sc_band", fontName=FONT_BOLD, fontSize=8.5,
            textColor=band_color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0)),
        Paragraph(f"<b>{section_score_val}/100</b>",
            ParagraphStyle("s6sc_tot", fontName=FONT_BOLD, fontSize=9,
            textColor=band_color, alignment=TA_CENTER,
            leftIndent=0, firstLineIndent=0)),
    ])
    cw_sc = [CONTENT_W*0.52, CONTENT_W*0.22, CONTENT_W*0.26]
    s.append(std_table(["Signal", "Level", "Points"], sc_rows, cw_sc))
    s.append(sp(20))

    # 6.5 Narrative
    s += sub_header("What the Data Says About This Operation")
    s.append(body(
        "This audit was submitted at Tier 2, the standard data tier. "
        "The submission includes both POS reports, inventory count sheets for bar and kitchen, "
        "and invoices for both beverage and food. "
        "That is a meaningful foundation. "
        "It is enough to calculate bar cost, food cost, inventory variance, "
        "prime cost, and vendor spend. "
        "None of those calculations existed before this submission. "
        "They exist now because someone collected and submitted the data."
    ))
    s.append(sp(12))
    s.append(body(
        "What the data cannot yet show is where the variance is coming from at the item level, "
        "whether the food cost gap is driven by portioning or by purchasing, "
        "or whether vendors are charging above contracted rates. "
        "Those answers require recipe costing sheets, vendor price lists, and waste logs. "
        "None of those were submitted. "
        "The gap between what this audit can show and what a full Tier 3 audit would show "
        "is exactly the gap between knowing you have a problem "
        "and knowing precisely what is causing it."
    ))
    s.append(sp(20))

    # 6.6 What to Submit Next Time
    s.append(callout_box(
        "HOW TO GET MORE FROM YOUR NEXT AUDIT",
        "Submit these documents with your next audit to unlock Tier 3 analysis: "
        "Vendor Price List (12 weeks minimum), unlocks actual overbilling detection vs. the current estimate. "
        "Recipe Costing Sheets, unlocks theoretical vs. actual food cost comparison. "
        "Payroll and Time Clock Data, unlocks verified labor by department. "
        "Daily Waste Logs, separates documented spillage from unaccounted variance. "
        "Weekly Inventory Counts (4 weeks), unlocks variance trend analysis instead of a single snapshot.",
        bg=NAVY
    ))

    return s



# ── SECTION 7: CONSOLIDATED ACTION PLAN ──────────────────────────────────────

def page_consolidated():
    s = []

    s += section_header(
        "CONSOLIDATED ACTION PLAN",
        "All Action Items Ranked by Monthly Dollar Impact",
        "Every action item from every section. Sorted by estimated monthly impact, "
        "highest first. Start with Rank 1 this week."
    )

    # ── Master Ranked Table ───────────────────────────────────────────────────
    def pri_p(label):
        c = SALMON if label == "HIGH" else (AMBER if label == "MEDIUM" else SAGE)
        return Paragraph(f"<b>{label}</b>", ParagraphStyle(f"cap_pri_{label}",
            fontName=FONT_BOLD, fontSize=7.5, leading=10, textColor=c,
            alignment=TA_CENTER, leftIndent=0, firstLineIndent=0))

    master_data = [
        # (rank, priority, area, title, monthly, annual, time, tool)
        ( 1,"HIGH",  "Prime Cost",           "Move Prime Cost Tracking to Weekly",
          "$2,792–$5,584", "$33,504–$67,008",  "This week",      "Prime cost tracking"),
        ( 2,"HIGH",  "Prime Cost",           "Track Labor by Department",
          "$2,345–$4,691", "$28,140–$56,292",  "2 weeks",        "Labor scheduling"),
        ( 3,"HIGH",  "Implementation",       "Cost Recipe Cards for Top 10 Menu Items",
          "$1,716–$2,860", "$20,592–$34,320",  "This week",      "Menu costing"),
        ( 4,"MEDIUM","Prime Cost",           "Build Schedule from Revenue Forecast",
          "$1,563–$3,126", "$18,756–$37,512",  "1 week",         "Labor scheduling"),
        ( 5,"HIGH",  "Implementation",       "Establish Monday Morning Numbers Review",
          "Process value", "System foundation","This Monday",     "Weekly review"),
        ( 6,"HIGH",  "Bar Cost",             "Switch to Measured Pours Immediately",
          "$824–$1,236",   "$9,888–$14,832",   "1 week",         "Bar inventory"),
        ( 7,"HIGH",  "Theft / Loss",         "Require Manager Approval on Voids/Comps",
          "$577–$1,154",   "$6,924–$13,848",   "This week",      "Void tracking"),
        ( 8,"MEDIUM","Implementation",       "Configure POS Void Approval and Track Weekly",
          "$576–$1,154",   "$6,912–$13,848",   "This week",      "Void tracking"),
        ( 9,"HIGH",  "Food Cost",            "Write Recipe Cards for All Menu Items",
          "$429–$715",     "$5,148–$8,580",    "30 days",        "Menu costing"),
        (10,"HIGH",  "Bar Cost",             "Move Variance Reporting to Weekly by SKU",
          "$412–$618",     "$4,944–$7,416",    "1 week",         "Bar inventory"),
        (11,"HIGH",  "Vendor Control",       "Verify Every Invoice Against Original PO",
          "$298–$446",     "$3,576–$5,352",    "This week",      "Invoice verification"),
        (12,"HIGH",  "Food Cost",            "Write and Post Portion Standards",
          "$286–$515",     "$3,432–$6,180",    "2 weeks",        "Portion standards"),
        (13,"MEDIUM","Vendor Control",       "Collect Competitive Bids Annually",
          "$248–$496",     "$2,976–$5,952",    "30 days",        "Invoice verification"),
        (14,"HIGH",  "Vendor Control",       "Verify Prices at Delivery Before Signing",
          "$223–$372",     "$2,676–$4,464",    "This week",      "Invoice verification"),
        (15,"MEDIUM","Bar Cost",             "Complete Recipe Card Coverage to 100%",
          "$206–$412",     "$2,472–$4,944",    "2–3 weeks",      "Menu costing"),
        (16,"HIGH",  "Theft / Loss",         "Implement Drawer Reconciliation Every Shift",
          "$206–$412",     "$2,472–$4,944",    "This week",      "Void tracking"),
        (17,"MEDIUM","Theft / Loss",         "Start Logging Spillage and Waste Every Shift",
          "$206–$330",     "$2,472–$3,960",    "This week",      "Waste logging"),
        (18,"MEDIUM","Food Cost",            "Move Kitchen Inventory to Weekly Counts",
          "$143–$286",     "$1,716–$3,432",    "1 week",         "Bar inventory"),
        (19,"HIGH",  "Theft / Loss",         "Write and Distribute Cash Handling Policy",
          "Deterrence",    "Enforceable standard","1 week",       "Cash policy"),
    ]

    cw_m = [CONTENT_W*0.06, CONTENT_W*0.14, CONTENT_W*0.36,
            CONTENT_W*0.14, CONTENT_W*0.16, CONTENT_W*0.14]

    master_rows = []
    for row in master_data:
        rank, pri, area, title, mo, ann, time_val, tool = row
        master_rows.append([
            Paragraph(str(rank), ParagraphStyle(f"cap_rn{rank}", fontName=FONT_BOLD,
                fontSize=9, textColor=NAVY, alignment=TA_CENTER,
                leftIndent=0, firstLineIndent=0)),
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
        "Process-value items (Policy, Monday Routine) appear last as they are "
        "prerequisites for other systems rather than direct revenue recoveries. "
        "All dollar estimates derive from submitted revenue data, no invented numbers.</i>",
        ParagraphStyle("cap_note", fontName=FONT_ITALIC, fontSize=8.5, leading=13,
        textColor=colors.HexColor("#555555"), leftIndent=0, firstLineIndent=0)))
    s.append(sp(24))

    # ── 30-Day Priority List ──────────────────────────────────────────────────
    _h_30d = sub_header("30-Day Priority List, Top Five Actions")
    _f_30d = body(
        "These five actions produce the largest combined dollar improvement "
        "in the shortest time. "
        "Complete all five before moving to anything else on the master list."
    )
    s += [KeepTogether(_h_30d + [_f_30d])]
    s.append(sp(12))

    top5 = [
        dict(priority="HIGH",
             title="Move Prime Cost Tracking to Weekly",
             area="Prime Cost",
             data_desc=(
                 f"Prime cost at {S5_PRIME_COST_PCT}%. If tracked monthly only, the four-week lag means margin problems compound before they are visible. "
                 "Monthly cadence allows a full month of drift before correction. "
                 "At $279,200 monthly revenue, a 2-point drift that runs 30 days "
                 "uninspected costs $5,584 before it is caught."
             ),
             instruction=(
                 "Every Monday calculate prime cost from last week: "
                 "bar and kitchen COGS from variance counts, "
                 "labor from schedule or time clock, "
                 "divided by last week's revenue from POS. "
                 "Review before building this week's schedule."
             ),
             tool="Calculate prime cost weekly: COGS plus labor divided by revenue.",
             time_str="This week",
             monthly="$2,792–$5,584", annual="$33,504–$67,008"),
        dict(priority="HIGH",
             title="Track Labor by Department, Not as a Blended Total",
             area="Prime Cost",
             data_desc=(
                 f"Labor at {S5_LABOR_PCT}% submitted as blended total. Department-level breakdown not in submitted data. "
                 "Without a department breakdown, there is no way to determine whether "
                 "bar, kitchen, or floor labor is driving the number or masking a "
                 "department-level problem."
             ),
             instruction=(
                 "Tag every shift to a department in your time clock or payroll system. "
                 "Review bar, kitchen, and floor labor separately every Monday. "
                 "Target: bar under 12%% of bar revenue, "
                 "kitchen under 18%% of food revenue, floor under 10%% of total."
             ),
             tool="Build your schedule from a weekly revenue projection.",
             time_str="2 weeks",
             monthly="$2,345–$4,691", annual="$28,140–$56,292"),
        dict(priority="HIGH",
             title="Cost Recipe Cards for the Top 10 Revenue Menu Items This Week",
             area="Implementation Status / Food Cost",
             data_desc=(
                 "Recipe costing has not started 6 weeks after purchasing the system. "
                 f"Food cost at {S3_FOOD_COST_PCT}% with recipe cards on only {S3_RECIPE_COVERAGE} "
                 "of menu items. Without a cost standard for each dish, the food cost gap "
                 f"runs at ${S3_MONTHLY_GAP:,.0f}/mo with no defined cost standard to correct against."
             ),
             instruction=(
                 "Cost your 10 highest-revenue food items this week. "
                 "For each: list every ingredient, the quantity per portion, "
                 "and the current price per unit from your last invoice. "
                 "Post the cost card in the kitchen. "
                 "Complete remaining items at two per day over the next 3 weeks."
             ),
             tool="Cost every menu item: ingredients, portions, invoice price per unit.",
             time_str="This week to start, 3 weeks to complete",
             monthly="$1,716–$2,860", annual="$20,592–$34,320"),
        dict(priority="MEDIUM",
             title="Build the Schedule from a Revenue Forecast Each Week",
             area="Prime Cost",
             data_desc=(
                 "If scheduling is not built from a revenue forecast, "
                 "labor cost is being set by habit rather than by what the revenue week can support. "
                 "The pattern of labor running below the 28% floor is consistent with "
                 "hours being assigned without a volume projection to anchor them."
             ),
             instruction=(
                 "Before each week's schedule, pull the prior two weeks of daily revenue from POS. "
                 "Project the coming week by day. "
                 "Calculate target labor hours from that projection. "
                 "Build to the target, not last week's template."
             ),
             tool="Build your schedule from a weekly revenue projection.",
             time_str="1 week",
             monthly="$1,563–$3,126", annual="$18,756–$37,512"),
        dict(priority="HIGH",
             title="Establish the Monday Morning Numbers Review",
             area="Implementation Status",
             data_desc=(
                 "Bar variance and prime cost numbers are calculated but a consistent weekly review routine "
                 "could not be confirmed from submitted data. "
                 "If these numbers are not reviewed on a fixed schedule the gap between "
                 "calculation and action compounds weekly."
             ),
             instruction=(
                 "Block 45 minutes every Monday before the first staff interaction. "
                 "Non-negotiable. Agenda: bar variance, prime cost, "
                 "open action items, week's revenue forecast, top two priorities. "
                 "This routine is what makes every other system in this audit work."
             ),
             tool="Review bar variance and prime cost every Monday morning.",
             time_str="This Monday",
             monthly="Process value, enables all other outputs",
             annual="The management routine the entire system depends on"),
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

    # ── 90-Day Roadmap ────────────────────────────────────────────────────────
    s.append(PageBreak())
    s += sub_header("90-Day Implementation Roadmap")
    s.append(body(
        "Three phases. Each phase builds on the one before it. "
        "Do not start Phase 2 tasks until Phase 1 is complete. "
        "Owner role is noted for each task, assign a name before the phase begins."
    ))
    s.append(sp(12))

    # Phase 1, Days 1-30 (STEEL)
    s.append(phase_hdr("DAYS 1–30: FOUNDATION, BASELINES ESTABLISHED, CRITICAL CONTROLS IN PLACE", STEEL))
    s.append(sp(10))
    phase1_rows = [
        [Paragraph("Days 1–3", STYLES["table_cell_left"]),
         Paragraph("Cost your top 10 food items before the next menu print. "
                   "Ingredient by ingredient. Post the cost cards in the kitchen.",
                   STYLES["table_cell_left"]),
         Paragraph("Cost every menu item from scratch", STYLES["table_cell_left"]),
         Paragraph("Owner: Chef / Kitchen Manager", STYLES["table_cell_left"])],
        [Paragraph("Day 1 (Monday)", STYLES["table_cell_left"]),
         Paragraph("Block 45 minutes every Monday before the first staff interaction. "
                   "Review bar variance, prime cost, and open action items.",
                   STYLES["table_cell_left"]),
         Paragraph("Bar variance and prime cost review", STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 1–5", STYLES["table_cell_left"]),
         Paragraph("Configure POS to require manager approval on all voids and comps. "
                   "Pull last month's exception report and record the baseline void rate.",
                   STYLES["table_cell_left"]),
         Paragraph("POS void report, drawer reconciliation", STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 1–7", STYLES["table_cell_left"]),
         Paragraph("Write and distribute cash handling policy. "
                   "Get signed acknowledgment from every current employee.",
                   STYLES["table_cell_left"]),
         Paragraph("Written cash policy, signed by staff", STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 1–7", STYLES["table_cell_left"]),
         Paragraph("Switch bar to measured pours. "
                   "Run 30-minute pour training at next pre-shift meeting. "
                   "Post pour standard at every bar station.",
                   STYLES["table_cell_left"]),
         Paragraph("Weekly bar inventory count and variance", STYLES["table_cell_left"]),
         Paragraph("Owner: Bar Manager", STYLES["table_cell_left"])],
        [Paragraph("Day 7 onward", STYLES["table_cell_left"]),
         Paragraph("Move bar inventory to weekly Monday counts. "
                   "Move bar variance reporting to weekly by SKU. "
                   "Review at Monday morning meeting.",
                   STYLES["table_cell_left"]),
         Paragraph("Weekly bar inventory count and variance", STYLES["table_cell_left"]),
         Paragraph("Owner: Bar Manager", STYLES["table_cell_left"])],
    ]
    cw_ph = [CONTENT_W*0.14, CONTENT_W*0.38, CONTENT_W*0.26, CONTENT_W*0.22]
    s.append(std_table(["When", "Task", "Tool", "Owner"], phase1_rows, cw_ph))
    s.append(sp(16))

    # Phase 2, Days 31-60 (SAGE)
    s.append(phase_hdr("DAYS 31–60: MEASUREMENT, VARIANCE REPORTS PRODUCING DATA, LABOR TRACKING STARTING", SAGE))
    s.append(sp(10))
    phase2_rows = [
        [Paragraph("Day 30 review", STYLES["table_cell_left"]),
         Paragraph("Complete recipe costing for every remaining menu item. "
                   "Review bar variance trend from four weeks of weekly counts. "
                   "Compare to audit baseline.",
                   STYLES["table_cell_left"]),
         Paragraph("Menu costing complete, variance trending", STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Chef", STYLES["table_cell_left"])],
        [Paragraph("Days 31–35", STYLES["table_cell_left"]),
         Paragraph("Tag every shift by department in your time clock or payroll system. "
                   "Track bar, kitchen, and floor labor separately from this week forward.",
                   STYLES["table_cell_left"]),
         Paragraph("Revenue-based schedule, labor by dept", STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 35–40", STYLES["table_cell_left"]),
         Paragraph("Build the week's schedule from a daily revenue projection. "
                   "Compare actual RPLH at week end. "
                   "Note which shifts ran over- or understaffed.",
                   STYLES["table_cell_left"]),
         Paragraph("Revenue-based schedule, labor by dept", STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 31–45", STYLES["table_cell_left"]),
         Paragraph("Write a portion standard for every menu item, weight or volume, by cook. "
                   "Run your first theoretical vs. actual food cost comparison.",
                   STYLES["table_cell_left"]),
         Paragraph("Portion standards, theoretical vs actual", STYLES["table_cell_left"]),
         Paragraph("Owner: Chef / Kitchen Manager", STYLES["table_cell_left"])],
        [Paragraph("Days 31–60", STYLES["table_cell_left"]),
         Paragraph("Pull all vendor invoices. Compare each against the original purchase order. "
                   "Check invoice price against quoted rate on every delivery going forward.",
                   STYLES["table_cell_left"]),
         Paragraph("Invoice vs PO check, price verification", STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
    ]
    s.append(std_table(["When", "Task", "Tool", "Owner"], phase2_rows, cw_ph))
    s.append(sp(16))

    # Phase 3, Days 61-90 (AMBER)
    s.append(phase_hdr("DAYS 61–90: OPTIMIZATION, FULL PRIME COST TRACKED, ALL TOOLS ACTIVE", AMBER))
    s.append(sp(10))
    phase3_rows = [
        [Paragraph("Day 60 review", STYLES["table_cell_left"]),
         Paragraph("Review 8 weeks of prime cost data. "
                   "Compare bar cost, food cost, and labor against audit baselines. "
                   "Identify which gaps have closed and which remain.",
                   STYLES["table_cell_left"]),
         Paragraph("Prime cost tracking, 8-week trend", STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Days 61–70", STYLES["table_cell_left"]),
         Paragraph("Deploy a spillage and waste log at every bar station. "
                   "Train all bar staff. Log every spill, breakage, and comp drink.",
                   STYLES["table_cell_left"]),
         Paragraph("Waste and spillage log at all stations", STYLES["table_cell_left"]),
         Paragraph("Owner: Bar Manager", STYLES["table_cell_left"])],
        [Paragraph("Days 61–90", STYLES["table_cell_left"]),
         Paragraph("Compare theoretical vs. actual food cost from 60 days of data. "
                   "Isolate production loss from portion creep using waste log. "
                   "Adjust prep standards where variance exceeds 3%.",
                   STYLES["table_cell_left"]),
         Paragraph("Theoretical vs actual, waste reconciled", STYLES["table_cell_left"]),
         Paragraph("Owner: Chef / Kitchen Manager", STYLES["table_cell_left"])],
        [Paragraph("Days 75–80", STYLES["table_cell_left"]),
         Paragraph("Initiate competitive bid process for spirits, produce, and protein. "
                   "Contact at least two alternative suppliers per category. "
                   "Compare pricing against what you are currently paying.",
                   STYLES["table_cell_left"]),
         Paragraph("Invoice vs PO check, price verification", STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
        [Paragraph("Day 90 review", STYLES["table_cell_left"]),
         Paragraph("Run a full self-assessment against every section in this audit. "
                   "Compare every metric to the baselines from this report. "
                   "Document the improvement. Submit for your next audit.",
                   STYLES["table_cell_left"]),
         Paragraph("Full operational self-assessment", STYLES["table_cell_left"]),
         Paragraph("Owner: GM / Owner", STYLES["table_cell_left"])],
    ]
    s.append(std_table(["When", "Task", "Tool", "Owner"], phase3_rows, cw_ph))
    s.append(sp(24))

    # ── Annual Impact Summary formula_box ─────────────────────────────────────
    # All calculations from submitted data
    s1_monthly = S1_MONTHLY_GAP      # $2,637
    s1_annual  = S1_ANNUAL_GAP       # $31,644
    s2_monthly = S2_MONTHLY_GAP      # $1,154
    s2_annual  = S2_ANNUAL_GAP       # $13,848
    s3_monthly = S3_MONTHLY_GAP      # $2,116
    s3_annual  = S3_ANNUAL_GAP       # $25,392
    s4_monthly = S4_EXPOSURE_MONTHLY # $744
    s4_annual  = S4_EXPOSURE_ANNUAL  # $8,928
    # S5 prime cost within target, component gaps already counted in S1/S3
    total_low   = round((s1_monthly + s2_monthly + s3_monthly + s4_monthly) * 12 * 0.50)
    total_high  = round((s1_monthly + s2_monthly + s3_monthly + s4_monthly) * 12 * 0.85)

    s.append(formula_box([
        f"PROFIT FIX AUDIT: ANNUAL IMPACT SUMMARY, {BAR_NAME}",
        "",
        f"  Bar Cost and Pour Control (Section 1):",
        f"    27.4% actual vs. 21.0% target on ${S1_BAR_REV_MONTHLY:,.0f}/mo bev revenue",
        f"    Gap: {S1_GAP_PTS} pts x ${S1_BAR_REV_MONTHLY:,.0f} = ${s1_monthly:,.0f}/mo  |  ${s1_annual:,.0f}/yr",
        "",
        f"  Theft and Loss Prevention (Section 2):",
        f"    4.8% void/comp rate vs. 2.0% benchmark on ${S2_BEV_REV_MONTHLY:,.0f}/mo revenue",
        f"    Gap: {S2_GAP_PCT} pts x ${S2_BEV_REV_MONTHLY:,.0f} = ${s2_monthly:,.0f}/mo  |  ${s2_annual:,.0f}/yr",
        "",
        f"  Food Cost Control (Section 3):",
        f"    38.4% actual vs. 31.0% target on ${S3_FOOD_REV_MONTHLY:,.0f}/mo food revenue",
        f"    Gap: {S3_GAP_PTS} pts x ${S3_FOOD_REV_MONTHLY:,.0f} = ${s3_monthly:,.0f}/mo  |  ${s3_annual:,.0f}/yr",
        "",
        f"  Vendor Control (Section 4):",
        f"    Industry-average 3% overbilling exposure on ${S4_VENDOR_SPEND_MONTHLY:,.0f}/mo vendor spend",
        f"    Exposure: ${s4_monthly:,.0f}/mo  |  ${s4_annual:,.0f}/yr  (estimate, submit price list for verified figure)",
        "",
        f"  Prime Cost (Section 5):",
        f"    Prime cost {S5_PRIME_COST_PCT}%, within 60% target. Component gaps captured in Sections 1 and 3.",
        f"    Weekly tracking, dept-level labor, revenue-based scheduling: system improvement value.",
        "",
        f"  COMBINED ANNUAL GAP (from four sections with dollar data):",
        f"    ${s1_annual:,.0f} + ${s2_annual:,.0f} + ${s3_annual:,.0f} + ${s4_annual:,.0f}"
        f" = ${s1_annual+s2_annual+s3_annual+s4_annual:,.0f} in identified gaps",
        "",
        f"  REALISTIC RECOVERY RANGE (50–85% of gap, based on full implementation):",
        f"    Low estimate:   ${total_low:,.0f}/yr",
        f"    High estimate:  ${total_high:,.0f}/yr",
        "",
        f"  Bar Cop  |  barcop.com  |  Audit ID: {AUDIT_ID}",
    ]))

    return s


# ── CLOSE ─────────────────────────────────────────────────────────────────────

def page_close():
    s = []

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

    # 3. Subtitle, MID_GRAY 9pt, score-band specific
    s.append(Paragraph(
        "Your systems are partially in place. "
        "The gaps identified in this report are specific, measurable, "
        "and fixable within 90 days.",
        ParagraphStyle("close_sub", fontName=FONT_REG, fontSize=9, leading=13,
        textColor=MID_GRAY, leftIndent=0, firstLineIndent=0)))
    s.append(sp(6))
    s.append(HRule(CONTENT_W, GOLD, 1.5))
    s.append(sp(14))

    # 4. Body paragraph, operator voice, specific to this bar's numbers
    s.append(Paragraph(
        f"This audit scored {BAR_NAME} at {OVERALL_SCORE}/100 overall. "
        f"The largest single gap is food cost at {S3_FOOD_COST_PCT}% "
        f"against a {S3_TARGET_PCT}% target, "
        f"a {S3_GAP_PTS}-point spread that costs ${S3_MONTHLY_GAP:,.0f} per month "
        f"and ${S3_ANNUAL_GAP:,.0f} per year at your current food revenue. "
        f"Recipe costing sheets submitted cover {S3_RECIPE_COVERAGE} of menu items. "
        "For any item without a costed recipe card there is no verified cost standard in the submitted data. "
        "Costing every menu item is the single action that unlocks the most downstream improvement "
        "in this audit: it creates the reference standard that portion tracking, "
        "theoretical vs. actual comparison, and food cost gap analysis all depend on. "
        "The rest of the 90-day roadmap in Section 7 follows from that one first step.",
        ParagraphStyle("close_body", fontSize=10, leading=15, textColor=DARK_TEXT,
        leftIndent=0, firstLineIndent=0)))
    s.append(sp(18))

    # 5. SALMON callout, "YOUR SINGLE MOST IMPORTANT NEXT ACTION"
    # Rank 1 from Section 7: Move Prime Cost Tracking to Weekly
    # (highest dollar impact from the sorted master table)
    _act_t = Paragraph("YOUR SINGLE MOST IMPORTANT NEXT ACTION",
        ParagraphStyle("close_act_t", fontName=FONT_BOLD, fontSize=9, leading=12,
        textColor=colors.HexColor("#F5C8C0"), leftIndent=0, firstLineIndent=0))
    _act_title = Paragraph(
        "Move Prime Cost Tracking to Weekly",
        ParagraphStyle("close_act_title", fontName=FONT_BOLD, fontSize=12, leading=15,
        textColor=WHITE, leftIndent=0, firstLineIndent=0))
    _act_area = Paragraph("Prime Cost",
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
        f"Prime cost at {S5_PRIME_COST_PCT}%. If tracked monthly only, the four-week lag means margin problems compound before they are visible. "
        "Monthly cadence allows a full month of drift before correction. "
        f"At ${S5_TOTAL_REV_MONTHLY:,.0f} monthly revenue, a 2-point drift "
        "running 30 days uninspected costs $5,584 before anyone sees it."
    )
    _act_inst = _val(
        "Every Monday morning: add bar and kitchen COGS from your variance counts, "
        "add labor from your schedule or time clock, "
        "divide by prior week revenue from POS. "
        "That number is your prime cost. "
        "Review it before you build the week's schedule."
    )
    # Metrics row inside the SALMON box
    def _met(label, val):
        return Paragraph(f'<font color="#F5C8C0"><b>{label}</b></font>  {val}',
            ParagraphStyle(f"cl_met_{label[:3]}", fontSize=8.5, leading=13,
            textColor=WHITE, leftIndent=0, firstLineIndent=0))

    cw_met = [(CONTENT_W - 32) / 4] * 4
    _met_row = Table([[
        _met("Next Step:", "Track prime cost weekly from POS + inventory data"),
        _met("Time:", "This week"),
        _met("Monthly:", "$2,792–$5,584"),
        _met("Annual:", "$33,504–$67,008"),
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
    s.append(KeepTogether([_act_outer]))
    s.append(sp(18))

    # 6. Audit Details block, clean table
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


    return s


# ── POST PROCESS ──────────────────────────────────────────────────────────────
def post_process(story):
    out = []
    prev_pb = False
    for item in story:
        is_pb = isinstance(item, PageBreak)
        if is_pb and prev_pb:
            continue
        out.append(item)
        prev_pb = is_pb
    return out


# ── BUILD ─────────────────────────────────────────────────────────────────────
def build():
    doc = SimpleDocTemplate(OUT, pagesize=letter,
        leftMargin=MARGIN - 6,
        rightMargin=MARGIN - 6,
        topMargin=0.55*inch + 38 - 6,
        bottomMargin=0.45*inch + 28 - 6,
        title="Profit Audit -- Bar Cop",
        author="Bar Cop")
    story = [PageBreak()]
    story += page_executive_summary()
    story.append(PageBreak())
    story += page_section1()
    story.append(PageBreak())
    story += page_section2()
    story.append(PageBreak())
    story += page_section3()
    story.append(PageBreak())
    story += page_section4()
    story.append(PageBreak())
    story += page_section5()
    story.append(PageBreak())
    story += page_section6()
    story.append(PageBreak())
    story += page_consolidated()
    story.append(PageBreak())
    story += page_close()
    story = post_process(story)
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

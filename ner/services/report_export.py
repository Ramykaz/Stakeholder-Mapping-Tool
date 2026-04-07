"""Service for generating full stakeholder analysis reports as PDF and DOCX."""

from __future__ import annotations

import io
import logging
import re
from datetime import date
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ingestion.models import Project

logger = logging.getLogger(__name__)

# Brand colours
NAVY = '#0D1B3E'
TEAL = '#007A87'
LIGHT_GREY = '#F5F9FA'

NAVY_RGB = (0x0D / 255, 0x1B / 255, 0x3E / 255)
TEAL_RGB = (0x00 / 255, 0x7A / 255, 0x87 / 255)
LIGHT_GREY_RGB = (0xF5 / 255, 0xF9 / 255, 0xFA / 255)


def get_export_status(project) -> dict:
    """Return export readiness information for a project."""
    from ner.models import ReportSection, EngagementNote, StakeholderPersona, WorkplanComponent

    sections = list(
        ReportSection.objects.filter(project=project)
        .select_related('section')
        .order_by('section__section_number')
    )

    complete_sections = sum(1 for s in sections if s.status == ReportSection.STATUS_DONE)
    has_stakeholder_table = EngagementNote.objects.filter(project=project).exists()
    has_personas = StakeholderPersona.objects.filter(project=project).exists()
    has_workplan = WorkplanComponent.objects.filter(project=project).exists()
    can_export = complete_sections > 0

    section_statuses = [
        {
            'section_number': s.section.section_number,
            'title': s.section.title,
            'status': s.status,
        }
        for s in sections
    ]

    return {
        'can_export': can_export,
        'complete_sections': complete_sections,
        'total_sections': 8,
        'has_stakeholder_table': has_stakeholder_table,
        'has_personas': has_personas,
        'has_workplan': has_workplan,
        'section_statuses': section_statuses,
    }


def _parse_section_text(text: str) -> list[dict]:
    """Parse generated report text into typed blocks for rendering.

    Returns list of {'type': 'heading'|'bullet'|'paragraph', 'text': str}
    """
    blocks = []
    normalized = (text or '').replace('\r\n', '\n').replace('\r', '\n')
    for para in re.split(r'\n\n+', normalized):
        para = para.strip()
        if not para:
            continue
        lines = para.split('\n')
        for line in lines:
            line = re.sub(r'\*\*(.*?)\*\*', r'\1', line or '').strip()
            if not line:
                continue
            if line.startswith('## ') or re.match(r'^\s{0,3}#{1,6}\s+', line):
                clean = re.sub(r'^\s{0,3}#{1,6}\s*', '', line).strip()
                blocks.append({'type': 'subheading', 'text': clean})
            elif line.endswith(':') and len(line) <= 120:
                blocks.append({'type': 'subheading', 'text': line})
            elif re.match(r'^\s*([-*•●▪◦‣]|\d+[\.)])\s+', line):
                clean = re.sub(r'^\s*([-*•●▪◦‣]|\d+[\.)])\s+', '', line).strip()
                blocks.append({'type': 'bullet', 'text': clean})
            else:
                blocks.append({'type': 'paragraph', 'text': line})
    return blocks


def generate_pdf_report(project) -> bytes:
    """Generate a full PDF stakeholder analysis report.

    Assembles: cover page, TOC, complete report sections, Appendix A, Appendix B.
    Returns raw bytes.
    """
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        PageBreak, HRFlowable,
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from ner.models import ReportSection, EngagementNote, StakeholderPersona, WorkplanComponent
    from ner.services.pdf_utils import pdf_safe, resolve_pdf_fonts

    FONT_REGULAR, FONT_BOLD, _ = resolve_pdf_fonts()

    navy_color = colors.HexColor(NAVY)
    teal_color = colors.HexColor(TEAL)
    light_grey_color = colors.HexColor(LIGHT_GREY)
    alt_row_color = colors.HexColor('#EBF4F5')

    # ── Styles ──────────────────────────────────────────────────────────────
    styles = getSampleStyleSheet()
    cover_title = ParagraphStyle(
        'CoverTitle', fontName=FONT_BOLD, fontSize=28, textColor=navy_color,
        spaceAfter=16, alignment=TA_CENTER,
    )
    cover_sub = ParagraphStyle(
        'CoverSub', fontName=FONT_REGULAR, fontSize=14, textColor=teal_color,
        spaceAfter=8, alignment=TA_CENTER,
    )
    cover_meta = ParagraphStyle(
        'CoverMeta', fontName=FONT_REGULAR, fontSize=11,
        textColor=colors.HexColor('#6B7280'), spaceAfter=6, alignment=TA_CENTER,
    )
    h1_style = ParagraphStyle(
        'H1', fontName=FONT_BOLD, fontSize=18, textColor=navy_color,
        spaceBefore=28, spaceAfter=14, leading=24,
    )
    h2_style = ParagraphStyle(
        'H2', fontName=FONT_BOLD, fontSize=13, textColor=teal_color,
        spaceBefore=16, spaceAfter=8, leading=18,
    )
    body_style = ParagraphStyle(
        'Body', fontName=FONT_REGULAR, fontSize=10,
        spaceBefore=5, spaceAfter=7, leading=15,
    )
    bullet_style = ParagraphStyle(
        'Bullet', fontName=FONT_REGULAR, fontSize=10,
        leftIndent=16, spaceBefore=2, spaceAfter=2, leading=14,
    )
    toc_style = ParagraphStyle(
        'TOC', fontName=FONT_REGULAR, fontSize=10,
        spaceBefore=4, spaceAfter=4,
    )
    tbl_hdr_style = ParagraphStyle(
        'TblHdr', fontName=FONT_BOLD, fontSize=9, textColor=colors.white,
    )
    tbl_body_style = ParagraphStyle(
        'TblBody', fontName=FONT_REGULAR, fontSize=9,
    )

    def tbl_style(has_alternating=True):
        cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), teal_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, light_grey_color]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ]
        return TableStyle(cmds)

    # ── Gather data ─────────────────────────────────────────────────────────
    initiative_name = project.name
    host_org = ''
    country = ''
    try:
        profile = project.initiative_profile
        initiative_name = profile.initiative_name or project.name
        host_org = profile.host_organization or ''
        country = profile.country or profile.geography or ''
    except Exception:
        pass

    sections = list(
        ReportSection.objects.filter(project=project, status=ReportSection.STATUS_DONE)
        .select_related('section')
        .order_by('section__section_number')
    )

    engagement_notes = list(
        EngagementNote.objects.filter(project=project)
        .select_related('entity')
        .order_by('id')
    )

    personas = list(
        StakeholderPersona.objects.filter(project=project)
        .select_related('entity_type')
        .order_by('entity_type__name')
    )
    workplan_components = list(
        WorkplanComponent.objects.filter(project=project)
        .prefetch_related('tasks__related_entity')
        .order_by('order')
    )

    # ── Build PDF ───────────────────────────────────────────────────────────
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.5 * cm,
    )
    story = []

    # Cover page
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph(pdf_safe(initiative_name), cover_title))
    story.append(Paragraph('Stakeholder Analysis Report', cover_sub))
    story.append(Spacer(1, 1 * cm))
    if host_org:
        story.append(Paragraph(pdf_safe(host_org), cover_meta))
    if country:
        story.append(Paragraph(pdf_safe(country), cover_meta))
    story.append(Paragraph(f'Generated: {date.today().strftime("%d %B %Y")}', cover_meta))
    story.append(PageBreak())

    # Table of Contents
    story.append(Paragraph('Table of Contents', h1_style))
    story.append(HRFlowable(width='100%', thickness=1, color=teal_color))
    story.append(Spacer(1, 0.3 * cm))
    for s in sections:
        story.append(Paragraph(
            f'Section {s.section.section_number}: {pdf_safe(s.section.title)}',
            toc_style,
        ))
    if engagement_notes:
        story.append(Paragraph('Appendix A: Stakeholder Priority Table', toc_style))
    if personas:
        story.append(Paragraph('Appendix B: Stakeholder Personas', toc_style))
    if workplan_components:
        story.append(Paragraph('Appendix C: Stakeholder Engagement Workplan', toc_style))
    story.append(PageBreak())

    # Report sections
    for s in sections:
        story.append(Paragraph(
            f'Section {s.section.section_number}: {pdf_safe(s.section.title)}',
            h1_style,
        ))
        story.append(HRFlowable(width='100%', thickness=1, color=teal_color))
        story.append(Spacer(1, 0.2 * cm))

        blocks = _parse_section_text(s.generated_text or '')
        for block in blocks:
            if block['type'] == 'subheading':
                story.append(Paragraph(pdf_safe(block['text']), h2_style))
            elif block['type'] == 'bullet':
                story.append(Paragraph(pdf_safe(block['text']), body_style))
            else:
                story.append(Paragraph(pdf_safe(block['text']), body_style))

        story.append(PageBreak())

    # Appendix A: Stakeholder Priority Table
    if engagement_notes:
        story.append(Paragraph('Appendix A: Stakeholder Priority Table', h1_style))
        story.append(HRFlowable(width='100%', thickness=1, color=teal_color))
        story.append(Spacer(1, 0.2 * cm))

        tbl_data = [[
            Paragraph('No.', tbl_hdr_style),
            Paragraph('Name', tbl_hdr_style),
            Paragraph('Type', tbl_hdr_style),
            Paragraph('Engagement Notes', tbl_hdr_style),
        ]]
        for i, note in enumerate(engagement_notes, 1):
            entity_name = note.entity.canonical_name if note.entity else ''
            entity_type = note.entity.entity_type if note.entity else ''
            tbl_data.append([
                Paragraph(str(i), tbl_body_style),
                Paragraph(pdf_safe(entity_name), tbl_body_style),
                Paragraph(pdf_safe(entity_type), tbl_body_style),
                Paragraph(pdf_safe(note.note_text[:200] if note.note_text else ''), tbl_body_style),
            ])
        col_widths = [1.2 * cm, 4.5 * cm, 3 * cm, 7.5 * cm]
        tbl = Table(tbl_data, colWidths=col_widths)
        tbl.setStyle(tbl_style())
        story.append(tbl)
        story.append(PageBreak())

    # Appendix B: Stakeholder Personas
    if personas:
        story.append(Paragraph('Appendix B: Stakeholder Personas', h1_style))
        story.append(HRFlowable(width='100%', thickness=1, color=teal_color))
        story.append(Spacer(1, 0.2 * cm))

        for persona in personas:
            story.append(Paragraph(
                f'{pdf_safe(persona.persona_name)} — {pdf_safe(persona.archetype_label)}',
                h2_style,
            ))
            entity_type_name = persona.entity_type.name if persona.entity_type else 'Unknown'
            story.append(Paragraph(
                f'<i>Stakeholder type: {pdf_safe(entity_type_name)}</i>',
                body_style,
            ))
            story.append(Paragraph(pdf_safe(persona.demographics), body_style))

            if persona.motivations:
                story.append(Paragraph('<b>Motivations</b>', body_style))
                for idx, m in enumerate(persona.motivations, 1):
                    story.append(Paragraph(f'{idx}. {pdf_safe(m)}', body_style))

            if persona.frustrations:
                story.append(Paragraph('<b>Frustrations</b>', body_style))
                for idx, f in enumerate(persona.frustrations, 1):
                    story.append(Paragraph(f'{idx}. {pdf_safe(f)}', body_style))

            story.append(Spacer(1, 0.4 * cm))

    # Appendix C: Stakeholder Engagement Workplan
    if workplan_components:
        story.append(PageBreak())
        story.append(Paragraph('Appendix C: Stakeholder Engagement Workplan', h1_style))
        story.append(HRFlowable(width='100%', thickness=1, color=teal_color))
        story.append(Spacer(1, 0.2 * cm))

        for component in workplan_components:
            story.append(Paragraph(pdf_safe(component.title), h2_style))
            tasks = list(component.tasks.all())
            if not tasks:
                story.append(Paragraph('No tasks defined.', body_style))
                continue
            for idx, task in enumerate(tasks, 1):
                owner = task.suggested_owner or 'Unassigned'
                timeline = task.timeline or 'TBD'
                related = task.related_entity.canonical_name if task.related_entity else 'N/A'
                story.append(Paragraph(f'{idx}. {pdf_safe(task.task_description)}', body_style))
                story.append(Paragraph(f'Owner: {pdf_safe(owner)} | Timeline: {pdf_safe(timeline)} | Related: {pdf_safe(related)}', bullet_style))
                if (task.dependencies or '').strip():
                    story.append(Paragraph(f'Dependencies: {pdf_safe(task.dependencies)}', bullet_style))
                if (task.kpis or '').strip():
                    story.append(Paragraph(f'KPIs: {pdf_safe(task.kpis)}', bullet_style))
            story.append(Spacer(1, 0.3 * cm))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()


def generate_docx_report(project) -> bytes:
    """Generate a full DOCX stakeholder analysis report.

    Equivalent structure to PDF using python-docx.
    Returns raw bytes.
    """
    from docx import Document as DocxDocument
    from docx.shared import Pt, Cm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from ner.models import ReportSection, EngagementNote, StakeholderPersona, WorkplanComponent

    NAVY_COLOR = RGBColor(0x0D, 0x1B, 0x3E)
    TEAL_COLOR = RGBColor(0x00, 0x7A, 0x87)

    def _set_heading_colour(paragraph, colour):
        for run in paragraph.runs:
            run.font.color.rgb = colour

    # Gather data
    initiative_name = project.name
    host_org = ''
    country = ''
    try:
        profile = project.initiative_profile
        initiative_name = profile.initiative_name or project.name
        host_org = profile.host_organization or ''
        country = profile.country or profile.geography or ''
    except Exception:
        pass

    sections = list(
        ReportSection.objects.filter(project=project, status=ReportSection.STATUS_DONE)
        .select_related('section')
        .order_by('section__section_number')
    )
    engagement_notes = list(
        EngagementNote.objects.filter(project=project)
        .select_related('entity')
        .order_by('id')
    )
    personas = list(
        StakeholderPersona.objects.filter(project=project)
        .select_related('entity_type')
        .order_by('entity_type__name')
    )
    workplan_components = list(
        WorkplanComponent.objects.filter(project=project)
        .prefetch_related('tasks__related_entity')
        .order_by('order')
    )

    doc = DocxDocument()

    normal_style = doc.styles['Normal']
    normal_style.paragraph_format.space_after = Pt(8)
    normal_style.paragraph_format.line_spacing = 1.25
    heading_1_style = doc.styles['Heading 1']
    heading_1_style.paragraph_format.space_before = Pt(12)
    heading_1_style.paragraph_format.space_after = Pt(10)
    heading_2_style = doc.styles['Heading 2']
    heading_2_style.paragraph_format.space_before = Pt(10)
    heading_2_style.paragraph_format.space_after = Pt(8)

    # Cover page
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title_para.add_run(initiative_name)
    run.bold = True
    run.font.size = Pt(28)
    run.font.color.rgb = NAVY_COLOR

    sub_para = doc.add_paragraph()
    sub_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub_para.add_run('Stakeholder Analysis Report')
    sub_run.font.size = Pt(16)
    sub_run.font.color.rgb = TEAL_COLOR

    if host_org:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run(host_org).font.size = Pt(12)

    if country:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run(country).font.size = Pt(12)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(f'Generated: {date.today().strftime("%d %B %Y")}').font.size = Pt(11)

    doc.add_page_break()

    # TOC
    h = doc.add_heading('Table of Contents', level=1)
    _set_heading_colour(h, NAVY_COLOR)
    for s in sections:
        doc.add_paragraph(f'Section {s.section.section_number}: {s.section.title}')
    if engagement_notes:
        doc.add_paragraph('Appendix A: Stakeholder Priority Table')
    if personas:
        doc.add_paragraph('Appendix B: Stakeholder Personas')
    if workplan_components:
        doc.add_paragraph('Appendix C: Stakeholder Engagement Workplan')
    doc.add_page_break()

    # Report sections
    for s in sections:
        h = doc.add_heading(
            f'Section {s.section.section_number}: {s.section.title}', level=1
        )
        _set_heading_colour(h, NAVY_COLOR)

        blocks = _parse_section_text(s.generated_text or '')
        for block in blocks:
            if block['type'] == 'subheading':
                sh = doc.add_heading(block['text'], level=2)
                _set_heading_colour(sh, TEAL_COLOR)
            elif block['type'] == 'bullet':
                doc.add_paragraph(block['text'])
            else:
                doc.add_paragraph(block['text'])

        doc.add_page_break()

    # Appendix A
    if engagement_notes:
        h = doc.add_heading('Appendix A: Stakeholder Priority Table', level=1)
        _set_heading_colour(h, NAVY_COLOR)

        table = doc.add_table(rows=1, cols=4)
        table.style = 'Table Grid'
        hdr_cells = table.rows[0].cells
        for i, text in enumerate(['No.', 'Name', 'Type', 'Engagement Notes']):
            run = hdr_cells[i].paragraphs[0].add_run(text)
            run.bold = True
            run.font.color.rgb = TEAL_COLOR

        for i, note in enumerate(engagement_notes, 1):
            row_cells = table.add_row().cells
            row_cells[0].text = str(i)
            row_cells[1].text = note.entity.canonical_name if note.entity else ''
            row_cells[2].text = note.entity.entity_type if note.entity else ''
            row_cells[3].text = (note.note_text or '')[:300]

        doc.add_page_break()

    # Appendix B
    if personas:
        h = doc.add_heading('Appendix B: Stakeholder Personas', level=1)
        _set_heading_colour(h, NAVY_COLOR)

        for persona in personas:
            entity_type_name = persona.entity_type.name if persona.entity_type else 'Unknown'
            sh = doc.add_heading(
                f'{persona.persona_name} — {persona.archetype_label}', level=2
            )
            _set_heading_colour(sh, TEAL_COLOR)
            doc.add_paragraph(f'Stakeholder type: {entity_type_name}')
            doc.add_paragraph(persona.demographics or '')

            if persona.motivations:
                p = doc.add_paragraph()
                p.add_run('Motivations').bold = True
                for idx, m in enumerate(persona.motivations, 1):
                    doc.add_paragraph(f'{idx}. {m}')

            if persona.frustrations:
                p = doc.add_paragraph()
                p.add_run('Frustrations').bold = True
                for idx, f in enumerate(persona.frustrations, 1):
                    doc.add_paragraph(f'{idx}. {f}')

    # Appendix C
    if workplan_components:
        doc.add_page_break()
        h = doc.add_heading('Appendix C: Stakeholder Engagement Workplan', level=1)
        _set_heading_colour(h, NAVY_COLOR)

        for component in workplan_components:
            sh = doc.add_heading(component.title, level=2)
            _set_heading_colour(sh, TEAL_COLOR)
            tasks = list(component.tasks.all())
            if not tasks:
                doc.add_paragraph('No tasks defined.')
                continue
            for idx, task in enumerate(tasks, 1):
                entity_name = task.related_entity.canonical_name if task.related_entity else 'N/A'
                doc.add_paragraph(f'{idx}. {task.task_description}')
                doc.add_paragraph(f'Owner: {task.suggested_owner or "Unassigned"} | Timeline: {task.timeline or "TBD"} | Related: {entity_name}')
                if task.dependencies:
                    doc.add_paragraph(f'Dependencies: {task.dependencies}')
                if task.kpis:
                    doc.add_paragraph(f'KPIs: {task.kpis}')

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.read()

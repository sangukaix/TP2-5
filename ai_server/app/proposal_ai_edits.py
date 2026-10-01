"""Apply validated chatbot visual edits after the approved PPT layout is complete."""

from __future__ import annotations

from typing import Any

from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Pt


ALIGNMENTS = {'left': PP_ALIGN.LEFT, 'center': PP_ALIGN.CENTER, 'right': PP_ALIGN.RIGHT}


def _font_snapshot(run) -> dict[str, Any]:
    color = None
    try:
        color = str(run.font.color.rgb) if run.font.color.rgb is not None else None
    except (AttributeError, ValueError):
        pass
    return {
        'name': run.font.name,
        'size': run.font.size,
        'bold': run.font.bold,
        'italic': run.font.italic,
        'underline': run.font.underline,
        'color': color,
    }


def _style_run(run, base: dict[str, Any], edit: dict[str, Any], *, edited: bool) -> None:
    if base.get('name'):
        run.font.name = base['name']
    if base.get('size'):
        run.font.size = base['size']
    run.font.bold = base.get('bold')
    run.font.italic = base.get('italic')
    run.font.underline = base.get('underline')
    if base.get('color'):
        run.font.color.rgb = RGBColor.from_string(base['color'])
    if not edited:
        return
    if edit.get('font_family'):
        run.font.name = str(edit['font_family'])
    if edit.get('font_size_pt') is not None:
        run.font.size = Pt(float(edit['font_size_pt']))
    if edit.get('bold') is not None:
        run.font.bold = bool(edit['bold'])
    color = str(edit.get('text_color') or '').lstrip('#')
    if len(color) == 6:
        run.font.color.rgb = RGBColor.from_string(color.upper())


def _edit_paragraph(paragraph, edit: dict[str, Any]) -> bool:
    target = str(edit.get('target_text') or '')
    original = paragraph.text
    if not target or target not in original:
        return False
    operation = edit.get('operation')
    inserted = str(edit.get('text') or '')
    before, after = original.split(target, 1)
    if operation == 'append':
        segments = [(before + target, False), (inserted, True), (after, False)]
    elif operation == 'prepend':
        segments = [(before, False), (inserted, True), (target + after, False)]
    elif operation == 'replace':
        segments = [(before, False), (inserted, True), (after, False)]
    elif operation == 'style':
        segments = [(before, False), (target, True), (after, False)]
    else:
        return False
    base_run = paragraph.runs[0] if paragraph.runs else paragraph.add_run()
    base = _font_snapshot(base_run)
    for run in list(paragraph.runs):
        paragraph._p.remove(run._r)
    for text, edited in segments:
        if not text:
            continue
        run = paragraph.add_run()
        run.text = text
        _style_run(run, base, edit, edited=edited)
    alignment = edit.get('alignment')
    if alignment in ALIGNMENTS:
        paragraph.alignment = ALIGNMENTS[alignment]
    return True


def apply_presentation_edits(prs, report: dict[str, Any]) -> None:
    """Apply only validated text/style operations; data, charts and images stay unchanged."""
    for edit in report.get('presentation_edits') or []:
        if not isinstance(edit, dict):
            continue
        slide_number = edit.get('slide_number')
        if not isinstance(slide_number, int) or not 1 <= slide_number <= len(prs.slides):
            continue
        slide = prs.slides[slide_number - 1]
        applied = False
        for shape in slide.shapes:
            if not getattr(shape, 'has_text_frame', False):
                continue
            for paragraph in shape.text_frame.paragraphs:
                if _edit_paragraph(paragraph, edit):
                    applied = True
                    break
            if applied:
                break

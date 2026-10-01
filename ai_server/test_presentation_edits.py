import unittest

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Inches

from ai_server.app.proposal_ai_edits import apply_presentation_edits


class PresentationEditsTest(unittest.TestCase):
    def test_appends_colored_emoji_to_matching_slide_text(self):
        prs = Presentation()
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        shape = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(8), Inches(1))
        shape.text = '강원특별자치도 강릉시'
        apply_presentation_edits(prs, {'presentation_edits': [{
            'slide_number': 1, 'target_text': '강릉시', 'operation': 'append', 'text': ' ♡',
            'text_color': '#F50045', 'font_size_pt': None, 'font_family': None,
            'bold': None, 'alignment': None,
        }]})
        paragraph = shape.text_frame.paragraphs[0]
        self.assertEqual(paragraph.text, '강원특별자치도 강릉시 ♡')
        self.assertEqual(paragraph.runs[-1].font.color.rgb, RGBColor(0xF5, 0x00, 0x45))


if __name__ == '__main__':
    unittest.main()

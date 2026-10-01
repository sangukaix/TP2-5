import unittest
import asyncio
from unittest.mock import patch

from ai_server.app.report_regeneration import detect_report_regeneration, enforce_requested_candidate
from ai_server.app import main


def sample_report():
    return {
        '__savedEntryId': 'old-report',
        'planning_brief': {'region_code': '42150', 'input_profile': 'guided_v2'},
        'planning_decision': {
            'design_candidates': [
                {'candidate_id': 'one', 'title': '첫 후보', 'case_source_ids': ['case-1']},
                {'candidate_id': 'two', 'title': '둘째 후보', 'case_source_ids': ['case-2']},
            ],
        },
    }


class ReportRegenerationTest(unittest.TestCase):
    def test_second_candidate_is_deterministic_without_llm(self):
        result = detect_report_regeneration(sample_report(), '지역 사례 중 2번째 후보군으로 제안서를 만들어줘')
        self.assertEqual(result['mode'], 'regenerate')
        self.assertEqual(result['regeneration_request']['requested_candidate_id'], 'two')
        self.assertEqual(result['regeneration_request']['source_report_id'], 'old-report')

    def test_budget_change_updates_planning_brief(self):
        result = detect_report_regeneration(sample_report(), '예산 편성을 1억 5천만원으로 변경해줘')
        self.assertEqual(result['mode'], 'regenerate')
        self.assertEqual(result['regeneration_request']['requested_budget_krw'], 150_000_000)
        self.assertEqual(result['regeneration_request']['planning_brief']['budget_max_krw'], 150_000_000)

    def test_reference_estimate_change_remains_lightweight_edit(self):
        self.assertIsNone(detect_report_regeneration(sample_report(), '견적 총액을 5천만원으로 변경해줘'))

    def test_confirmed_candidate_is_forced_after_generation(self):
        decision = {'design_candidates': [
            {'candidate_id': 'one', 'title': '첫 후보', 'case_source_ids': ['case-1']},
            {'candidate_id': 'two', 'title': '둘째 후보', 'case_source_ids': ['case-2']},
        ], 'selected_candidate_id': 'one'}
        result = enforce_requested_candidate(decision, {
            'reason': 'candidate_change', 'requested_candidate_id': 'two', 'requested_candidate_title': '둘째 후보',
        })
        self.assertEqual(result['selected_candidate_id'], 'two')
        self.assertIn('사용자가', result['selection_reason'])

    def test_chat_endpoint_classifies_without_snapshot_or_llm(self):
        request = main.AssistantChatRequest(
            region_name='강원특별자치도 강릉시', question='2번째 후보군으로 다시 만들어줘',
            current_report=sample_report(), enable_web_search=False,
        )
        response = asyncio.run(main.chat_with_tourism_assistant('42150', request, None))
        self.assertEqual(response.mode, 'regenerate')
        self.assertEqual(response.regeneration_request['requested_candidate_id'], 'two')

    def test_job_request_reloads_candidate_from_saved_report(self):
        request = main.ReportRequest(
            region_name='강원특별자치도 강릉시',
            planning_brief={'region_code': '42150', 'input_profile': 'guided_v2'},
            regeneration_request={
                'reason': 'candidate_change', 'request_text': '2번째 후보',
                'source_report_id': 'old-report', 'requested_candidate_id': 'two',
                'requested_candidate_title': '둘째 후보', 'requested_candidate_index': 2,
            },
        )
        with patch.object(main, 'read_strategy_report', return_value=sample_report()):
            validated = main._validated_regeneration_request('42150', request)
        self.assertEqual(validated.regeneration_request.source_candidate['candidate_id'], 'two')


if __name__ == '__main__':
    unittest.main()

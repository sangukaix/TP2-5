"""ML 시계열 검증과 기획 근거의 안전한 실패 경로를 확인합니다."""

from __future__ import annotations

import unittest
from unittest.mock import Mock, patch
from datetime import date
from types import SimpleNamespace
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from ai_server.ml.evaluation import TEST_MONTHS, VALIDATION_MONTHS, select_and_evaluate
from ai_server.ml.horizon_policy import resolve_planning_horizon
from ai_server.ml.planning_evidence import build_planning_ml_evidence
from ai_server.ml.learning_catalog import build_ml_learning_catalog, list_ml_learning_region_options
from ai_server.ml.validation import data_fingerprint, validate_monthly_data


class MlValidationTest(unittest.TestCase):
    """월 누수 방지 규칙과 미지원 지역 처리만 빠르게 검증합니다."""

    def _frame(self) -> pd.DataFrame:
        months = pd.date_range('2024-01-01', periods=24, freq='MS').strftime('%Y%m')
        return pd.DataFrame({
            'region_code': '11680', 'year_month': months,
            'visitors': np.arange(100, 124), 'spending_krw': np.arange(1000, 1024),
            'lodging_nights': np.repeat(2.5, 24),
            'lodging_rate_pct': np.repeat(3.1, 24),
            'stay_minutes': np.arange(500, 524),
            'navigation_searches': np.arange(8000, 8024),
            'lodging_searches': np.arange(1000, 1024),
        })

    def test_validation_rejects_a_missing_month(self) -> None:
        """월 누락을 0으로 채우지 않고 학습 전 오류로 처리합니다."""
        frame = self._frame().drop(index=8).reset_index(drop=True)
        with self.assertRaisesRegex(ValueError, 'ML_MONTH_GAP'):
            validate_monthly_data(frame, '11680')

    def test_data_fingerprint_changes_when_a_value_changes(self) -> None:
        """같은 기간이라도 수치가 바뀌면 구형 모델을 감지할 수 있어야 합니다."""
        frame = self._frame()
        changed = frame.copy()
        changed.loc[0, 'visitors'] += 1
        self.assertNotEqual(data_fingerprint(frame), data_fingerprint(changed))

    def test_model_selection_never_uses_final_test_rows(self) -> None:
        """메타데이터에 Validation 3개월과 최종 Test 4개월을 분리해 기록합니다."""
        x = np.arange(20, dtype=float).reshape(-1, 1)
        y = np.arange(20, dtype=float) * 2 + 10
        baseline = np.repeat(10.0, 20)
        _, result = select_and_evaluate(x, y, baseline, LinearRegression)
        self.assertEqual(result['selection_basis'], 'validation_mae_only')
        self.assertEqual(result['validation']['candidate']['sample_count'], VALIDATION_MONTHS)
        self.assertEqual(result['selected_model_metrics']['sample_count'], TEST_MONTHS)

    def test_forecast_can_require_learned_model_with_baseline_disclosure(self) -> None:
        """모든 전망은 학습모델을 쓰되 기준선 열세를 숨기지 않습니다."""
        x = np.arange(20, dtype=float).reshape(-1, 1)
        y = np.tile([100.0, 200.0], 10)
        baseline = y.copy()
        model, result = select_and_evaluate(
            x, y, baseline, LinearRegression, prefer_learned_model=True,
        )
        self.assertIsNotNone(model)
        self.assertEqual(result['selected_model'], 'LinearRegression')
        self.assertEqual(result['selection_basis'], 'learned_model_required_with_baseline_disclosure')
        self.assertFalse(result['candidate_beats_baseline_on_validation'])
        self.assertFalse(result['beats_baseline_on_test'])

    def test_unsupported_region_never_uses_gangnam_model(self) -> None:
        """등록하지 않은 지역에는 강남 예측을 복사하지 않습니다."""
        result = build_planning_ml_evidence('99999', '테스트시 테스트구')
        self.assertEqual(result.status, 'unsupported')
        self.assertEqual(result.forecasts, [])

    def test_unknown_schedule_compares_three_and_six_months(self) -> None:
        """일정 미정은 3·6개월 후보를 모두 계산해 Agent가 근거로 선택하게 합니다."""
        result = build_planning_ml_evidence('11680', '서울특별시 강남구', as_of_date=date(2026, 8, 1))
        self.assertEqual(result.status, 'available')
        self.assertEqual(len(result.forecasts), 6)
        self.assertTrue(result.source_id.startswith('ml:11680:'))
        self.assertEqual(len(result.research_questions), 3)
        self.assertEqual(len(result.signals), 14)
        self.assertEqual(result.horizon_policy['selection_basis'], 'unknown_compare_3_and_6_months')
        self.assertEqual([window['months'] for window in result.horizon_policy['decision_windows']], [3, 6])
        self.assertGreater(result.forecasts[0].navigation_searches, 0)

    def test_model_and_horizon_reliability_are_separate(self) -> None:
        """숫자가 생성됐다고 기준선보다 우수하다고 포장하지 않습니다."""
        result = build_planning_ml_evidence('11680', '서울특별시 강남구', as_of_date=date(2026, 9, 2))
        metrics = result.evaluation['metrics']
        for signal in result.signals:
            self.assertEqual(signal['model_reliability'], metrics[signal['metric']]['model_reliability'])
        for metric in metrics.values():
            if metric['test_mae'] > metric['baseline_test_mae']:
                self.assertEqual(metric['model_reliability'], 'below_baseline_on_test')
            if metric['selected_model'].startswith('seasonal_naive'):
                self.assertEqual(metric['model_reliability'], 'seasonal_baseline')

    def test_user_schedule_predicts_through_requested_end_month(self) -> None:
        """희망 기간이 뒤에서 시작해도 시작월이 아니라 종료월까지 예측해 필요한 월만 집계합니다."""
        result = build_planning_ml_evidence('11680', '서울특별시 강남구', {
            'schedule_status': 'flexible', 'start_date': '2026-11-01', 'end_date': '2027-01-31',
        })
        self.assertEqual(result.status, 'available')
        self.assertEqual(len(result.forecasts), 6)
        window = result.horizon_policy['decision_windows'][0]
        self.assertEqual((window['start_month'], window['end_month'], window['months']), ('202611', '202701', 3))
        self.assertEqual({signal['period'] for signal in result.signals}, {'202611~202701'})

    def test_horizon_policy_marks_months_after_three_as_exploratory(self) -> None:
        """6개월 계산을 3개월 재귀 검증과 같은 정확도로 포장하지 않는지 확인합니다."""
        policy = resolve_planning_horizon(None, '202607', as_of_date=date(2026, 8, 1))
        self.assertEqual(policy.forecast_horizon_months, 6)
        self.assertEqual(policy.decision_windows[0].reliability, 'short_term_backtested')
        self.assertEqual(policy.decision_windows[1].reliability, 'exploratory_longer_horizon')

    def test_learning_catalog_comes_from_registered_model_targets(self) -> None:
        """현재 모델 Target 7개가 학습 페이지 카드 7개로 자동 변환되는지 확인합니다."""
        # This contract checks one region, not a nationwide batch forecast.
        from ai_server.ml.learning_catalog import list_region_pipelines
        selected = [item for item in list_region_pipelines() if item.region_code == '11680']
        self.assertEqual(len(selected), 1)
        with patch('ai_server.ml.learning_catalog.list_region_pipelines', return_value=selected):
            catalog = build_ml_learning_catalog()
        gangnam = next(region for region in catalog.regions if region.region_code == '11680')
        self.assertEqual(gangnam.status, 'available')
        self.assertEqual(
            {module.id for module in gangnam.modules},
            {
                'visitors', 'spending_krw', 'lodging_nights', 'lodging_rate_pct',
                'stay_minutes', 'navigation_searches', 'lodging_searches',
            },
        )
        self.assertTrue(all(len(module.forecast) == 3 for module in gangnam.modules))

    def test_learning_page_reads_only_the_selected_region(self) -> None:
        """목록 조회는 예측하지 않고, 상세 조회는 선택 지역에만 예측을 요청합니다."""
        selected = SimpleNamespace(
            region_code='11111', region_name='선택 지역',
            load_history=Mock(return_value=pd.DataFrame()),
            predict=Mock(return_value={'model': {'target': {}}, 'forecasts': []}),
        )
        other = SimpleNamespace(
            region_code='22222', region_name='다른 지역',
            load_history=Mock(), predict=Mock(),
        )
        with patch('ai_server.ml.learning_catalog.list_region_pipelines', return_value=(selected, other)):
            options = list_ml_learning_region_options()
            self.assertEqual([item.region_code for item in options.regions], ['11111', '22222'])
            selected.predict.assert_not_called()
            other.predict.assert_not_called()

            catalog = build_ml_learning_catalog('11111')
            self.assertEqual([item.region_code for item in catalog.regions], ['11111'])
            selected.predict.assert_called_once_with(3)
            other.load_history.assert_not_called()
            other.predict.assert_not_called()


if __name__ == '__main__':
    unittest.main()

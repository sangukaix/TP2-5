"""기획서 생성 취소가 후속 Agent·저장·BYOK 세션에 미치는 영향을 네트워크 없이 검증합니다."""

import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from ai_server.app import main


class StrategyCancellationTests(unittest.IsolatedAsyncioTestCase):
    def _job(self, status='running'):
        return {
            'region_code': '11680', 'region_name': '서울특별시 강남구', 'status': status,
            'message': '생성 중', 'error': '', 'progress_step': 1,
        }

    async def test_running_job_cancellation_skips_report_save_and_releases_byok_job_reference(self):
        request = main.ReportRequest(region_name='서울특별시 강남구')
        jobs, tasks, cancellations = {'job-a': self._job()}, {}, {'job-a': asyncio.Event()}
        started = asyncio.Event()

        async def waiting_generation(*args, **kwargs):
            started.set()
            await asyncio.Event().wait()

        with (patch.object(main, 'STRATEGY_REPORT_JOBS', jobs),
              patch.object(main, 'STRATEGY_REPORT_TASKS', tasks),
              patch.object(main, 'STRATEGY_REPORT_CANCELLATIONS', cancellations),
              patch.object(main, 'generate_orchestrated_report', new=AsyncMock(side_effect=waiting_generation)),
              patch.object(main, '_persist_job_state_best_effort'),
              patch.object(main, '_persist_completed_strategy_report') as persist,
              patch.object(main, '_is_openai_byok_mode', return_value=True),
              patch.object(main.BYOK_VAULT, 'release_job_credential', new=AsyncMock()) as release):
            task = asyncio.create_task(main._run_strategy_report_job(
                'job-a', '11680', request, cancellation_event=cancellations['job-a'],
            ))
            tasks['job-a'] = task
            await asyncio.wait_for(started.wait(), timeout=1)
            cancellations['job-a'].set()
            task.cancel()
            await task
        self.assertEqual(jobs['job-a']['status'], 'cancelled')
        self.assertIsNone(jobs['job-a'].get('report'))
        persist.assert_not_called()
        release.assert_awaited_once_with('job-a')

    async def test_repeated_cancel_is_idempotent_and_completed_job_is_not_overwritten(self):
        jobs = {
            'cancelled': self._job('cancelled'),
            'completed': {**self._job('completed'), 'report': None},
        }
        with patch.object(main, 'STRATEGY_REPORT_JOBS', jobs):
            first = await main.cancel_region_strategy_report_job('11680', 'cancelled')
            second = await main.cancel_region_strategy_report_job('11680', 'cancelled')
            completed = await main.cancel_region_strategy_report_job('11680', 'completed')
        self.assertEqual(first.status, 'cancelled')
        self.assertEqual(second.status, 'cancelled')
        self.assertEqual(completed.status, 'completed')
        self.assertEqual(jobs['completed']['status'], 'completed')

    async def test_cancelled_event_blocks_the_next_agent_boundary_before_it_starts(self):
        event = asyncio.Event()
        event.set()
        with self.assertRaises(asyncio.CancelledError):
            from ai_server.app.agents.report_orchestrator import _raise_if_cancelled
            _raise_if_cancelled(event)

    async def test_local_job_uses_the_same_task_cancellation_path(self):
        request = main.ReportRequest(region_name='서울특별시 강남구')
        jobs, tasks, cancellations = {'local-job': self._job()}, {}, {'local-job': asyncio.Event()}
        first_agent_started, second_agent_calls = asyncio.Event(), AsyncMock()

        async def first_agent_only(*args, **kwargs):
            first_agent_started.set()
            await asyncio.Event().wait()
            await second_agent_calls()

        with (patch.object(main, 'STRATEGY_REPORT_JOBS', jobs),
              patch.object(main, 'STRATEGY_REPORT_TASKS', tasks),
              patch.object(main, 'STRATEGY_REPORT_CANCELLATIONS', cancellations),
              patch.object(main, 'generate_orchestrated_report', new=AsyncMock(side_effect=first_agent_only)),
              patch.object(main, '_persist_job_state_best_effort'),
              patch.object(main, '_is_openai_byok_mode', return_value=False)):
            task = asyncio.create_task(main._run_strategy_report_job(
                'local-job', '11680', request, cancellation_event=cancellations['local-job'],
            ))
            tasks['local-job'] = task
            await asyncio.wait_for(first_agent_started.wait(), timeout=1)
            cancellations['local-job'].set()
            task.cancel()
            await task
        self.assertEqual(jobs['local-job']['status'], 'cancelled')
        second_agent_calls.assert_not_awaited()


if __name__ == '__main__':
    unittest.main()

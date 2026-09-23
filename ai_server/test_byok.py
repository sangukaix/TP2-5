"""OpenAI BYOK session과 production credential 격리를 실제 네트워크 없이 검증합니다."""

import asyncio
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from ai_server.app.byok import ByokCredentialVault, ByokSessionError
from ai_server.app.llm.models import LLMRequest, LLMResult, ProviderHealth
from ai_server.app.llm.router import LLMRouter


class FakeProvider:
    def __init__(self, name):
        self.name = name
        self.default_model = f'{name}-model'
        self.requests = []

    async def generate(self, request):
        self.requests.append(request)
        return LLMResult(payload={'ok': True}, provider=self.name, model=request.model or self.default_model, duration_ms=1)

    async def health(self):
        return ProviderHealth(self.name, 'active', 'ok', [self.default_model], [])


def request(task='planner'):
    return LLMRequest(task=task, instructions='test', input_payload={}, schema_name='test', schema={'type': 'object'})


class ByokVaultTests(unittest.IsolatedAsyncioTestCase):
    async def test_disconnect_keeps_running_job_but_blocks_new_requests(self):
        vault = ByokCredentialVault(ttl_seconds=60)
        session_id, _ = await vault.create('BYOK_USER_KEY')
        self.assertEqual(await vault.acquire_job_credential(session_id, 'job-a'), 'BYOK_USER_KEY')
        await vault.disconnect(session_id)
        with self.assertRaises(ByokSessionError) as error:
            await vault.require_session_credential(session_id)
        self.assertEqual(error.exception.code, 'BYOK_SESSION_EXPIRED')
        await vault.release_job_credential('job-a')

    async def test_missing_and_expired_session_are_rejected(self):
        vault = ByokCredentialVault(ttl_seconds=60)
        with self.assertRaises(ByokSessionError):
            await vault.require_session_credential(None)
        session_id, _ = await vault.create('BYOK_USER_KEY')
        async with vault._lock:
            vault._sessions[session_id].expires_at = vault._now()
        with self.assertRaises(ByokSessionError) as error:
            await vault.require_session_credential(session_id)
        self.assertEqual(error.exception.code, 'BYOK_SESSION_EXPIRED')


class ProductionByokRouterTests(unittest.TestCase):
    def test_all_agent_tasks_use_openai_without_team_key_fallback(self):
        with TemporaryDirectory() as directory:
            router = LLMRouter(project_root=Path(directory), env_values={
                'AI_RUNTIME_MODE': 'openai_byok', 'OPENAI_API_KEY': 'BYOK_USER_KEY',
                'LLM_MODE': 'student_budget', 'OPENAI_MODEL': 'byok-model',
            })
            openai = FakeProvider('openai')
            router.providers = {'openai': openai, 'qwen': FakeProvider('qwen'), 'gemma': FakeProvider('gemma')}
            for task in ('evidence', 'case_study', 'transferability', 'planner', 'reviewer', 'final_reviewer', 'chat_revise'):
                asyncio.run(router.generate(request(task)))
            self.assertEqual(len(router.providers['qwen'].requests), 0)
            self.assertEqual(len(router.providers['gemma'].requests), 0)
            self.assertEqual(len(openai.requests), 7)
            self.assertTrue(all(row['provider'] == 'openai' and not row['fallback'] for row in router.consume_trace()))


if __name__ == '__main__':
    unittest.main()

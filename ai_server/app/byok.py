"""일시적인 OpenAI BYOK credential을 메모리에서만 관리합니다."""

from __future__ import annotations

import asyncio
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta


class ByokSessionError(Exception):
    """사용자에게 안전한 BYOK 세션 오류를 전달합니다."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass
class _Session:
    api_key: str
    expires_at: datetime


class ByokCredentialVault:
    """DB·파일·로그에 쓰지 않는 단일 프로세스용 credential vault입니다.

    job이 시작될 때 credential을 별도 reference로 잡아 두므로, 사용자가 연결을
    해제하거나 세션 TTL이 지나도 이미 시작한 생성 작업은 끝까지 수행할 수 있습니다.
    """

    def __init__(self, *, ttl_seconds: int) -> None:
        self.ttl_seconds = max(60, ttl_seconds)
        self._sessions: dict[str, _Session] = {}
        self._job_credentials: dict[str, str] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    async def create(self, api_key: str) -> tuple[str, datetime]:
        key = str(api_key or '').strip()
        if not key:
            raise ByokSessionError('BYOK_KEY_MISSING', 'OpenAI API Key를 입력해주세요.')
        session_id = secrets.token_urlsafe(32)
        expires_at = self._now() + timedelta(seconds=self.ttl_seconds)
        async with self._lock:
            self._purge_expired_locked()
            self._sessions[session_id] = _Session(api_key=key, expires_at=expires_at)
        return session_id, expires_at

    async def status(self, session_id: str | None) -> datetime | None:
        if not session_id:
            return None
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            return session.expires_at if session else None

    async def require_session_credential(self, session_id: str | None) -> str:
        if not session_id:
            raise ByokSessionError('BYOK_SESSION_REQUIRED', 'OpenAI API Key를 연결해주세요.')
        async with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                raise ByokSessionError('BYOK_SESSION_EXPIRED', 'OpenAI API Key 세션이 만료되었습니다. 다시 연결해주세요.')
            return session.api_key

    async def acquire_job_credential(self, session_id: str | None, job_id: str) -> str:
        credential = await self.require_session_credential(session_id)
        async with self._lock:
            self._job_credentials[job_id] = credential
        return credential

    async def release_job_credential(self, job_id: str) -> None:
        async with self._lock:
            self._job_credentials.pop(job_id, None)

    async def disconnect(self, session_id: str | None) -> None:
        if not session_id:
            return
        async with self._lock:
            self._sessions.pop(session_id, None)
            self._purge_expired_locked()

    async def clear(self) -> None:
        async with self._lock:
            self._sessions.clear()
            self._job_credentials.clear()

    def _purge_expired_locked(self) -> None:
        now = self._now()
        for session_id, session in tuple(self._sessions.items()):
            if session.expires_at <= now:
                self._sessions.pop(session_id, None)

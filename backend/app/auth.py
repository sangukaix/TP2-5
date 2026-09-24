"""Optional member authentication; tourism and BYOK routes stay public."""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import re
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from dotenv import dotenv_values
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
import pymysql
from pymysql import IntegrityError, MySQLError

from app.config import ENV_PATH
from app.services.vworld import get_sigungu_boundaries


router = APIRouter(prefix='/api/v1')
COOKIE_NAME = 'oligo_member_session'
SESSION_DAYS = 7
hasher = PasswordHasher()
_values = dotenv_values(ENV_PATH)


def setting(name: str, default: str = '') -> str:
    return str(os.getenv(name) or _values.get(name) or default).strip()


def database():
    return pymysql.connect(
        host=setting('MYSQL_HOST', '127.0.0.1'),
        port=int(setting('MYSQL_PORT', '3306')),
        user=setting('MYSQL_USER', 'tourism_app'),
        password=setting('MYSQL_PASSWORD'),
        database=setting('MYSQL_DATABASE', 'tourism_strategy'),
        charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor,
        autocommit=False, connect_timeout=5,
    )


def _secret() -> bytes:
    value = setting('AUTH_SESSION_SECRET')
    if len(value) < 32:
        raise HTTPException(503, detail={'code': 'AUTH_UNAVAILABLE', 'message': '인증 설정을 확인해주세요.'})
    return value.encode()


def _token_hash(token: str) -> str:
    return hmac.new(_secret(), token.encode(), hashlib.sha256).hexdigest()


def _db_error() -> HTTPException:
    return HTTPException(503, detail={'code': 'DB_UNAVAILABLE', 'message': '회원 서비스를 잠시 이용할 수 없습니다.'})


def _error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status, detail={'code': code, 'message': message})


def _require_origin(request: Request):
    origin = request.headers.get('origin')
    host_origin = f'{request.url.scheme}://{request.headers.get("host", "")}'
    allowed = {host_origin, 'http://localhost:5177', 'http://127.0.0.1:5177'}
    configured = setting('APP_ORIGIN')
    if configured:
        allowed.add(configured.rstrip('/'))
    if setting('APP_ENV') == 'production':
        allowed = {configured.rstrip('/')} if configured.startswith('https://') else set()
    if origin not in allowed:
        raise _error(403, 'ORIGIN_FORBIDDEN', '허용되지 않은 요청입니다.')


def _cookie_options() -> dict:
    return {'key': COOKIE_NAME, 'httponly': True, 'samesite': 'lax',
            'secure': setting('APP_ENV') == 'production', 'path': '/',
            'max_age': SESSION_DAYS * 86400}


def _public(row: dict) -> dict:
    return {key: row[key] for key in ('id', 'username', 'email', 'name', 'phone',
                                     'region_code', 'hint_question', 'created_at', 'updated_at')}


class SignupInput(BaseModel):
    username: str = Field(min_length=6, max_length=12, pattern=r'^[!-~]+$')
    password: str = Field(min_length=4, max_length=12, pattern=r'^[!-~]+$')
    email: str = Field(min_length=3, max_length=254)
    phone: str | None = Field(default=None, max_length=30)
    region_code: str = Field(pattern=r'^\d{5}$')
    hint_question: str = Field(min_length=1, max_length=100)
    hint_answer: str = Field(min_length=1, max_length=255)

    @field_validator('email')
    @classmethod
    def valid_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            raise ValueError('Invalid email')
        return value


class LoginInput(BaseModel):
    username: str
    password: str


class ProfileInput(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    region_code: str | None = Field(default=None, pattern=r'^\d{5}$')


class PasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=4, max_length=12, pattern=r'^[!-~]+$')


class HintInput(BaseModel):
    current_password: str
    hint_question: str = Field(min_length=1, max_length=100)
    hint_answer: str = Field(min_length=1, max_length=255)


async def _valid_region(code: str):
    try:
        collection = await get_sigungu_boundaries()
    except Exception:
        raise _error(503, 'REGION_UNAVAILABLE', '지역 목록을 확인할 수 없습니다.') from None
    codes = {feature['properties']['region_code'] for feature in collection['features']}
    # 경계 API가 원자료 호환용으로 노출하는 인천 구 서구 코드를 동일하게 인정합니다.
    if code == '28260' and {'28275', '28290'} <= codes:
        return
    if code not in codes:
        raise _error(422, 'INVALID_REGION', '지역을 다시 선택해주세요.')


def current_member(token: str | None = Cookie(default=None, alias=COOKIE_NAME)) -> dict:
    if not token:
        raise _error(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
    try:
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('''SELECT m.* FROM oligo_member_sessions s
                JOIN oligo_members m ON m.id = s.member_id
                WHERE s.token_hash=%s AND s.expires_at > UTC_TIMESTAMP()''', (_token_hash(token),))
            row = cursor.fetchone()
    except MySQLError:
        raise _db_error() from None
    if not row:
        raise _error(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
    return row


@router.post('/auth/signup', status_code=201)
async def signup(payload: SignupInput, request: Request):
    _require_origin(request)
    await _valid_region(payload.region_code)
    try:
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('SELECT username, email FROM oligo_members WHERE username=%s OR email=%s',
                           (payload.username, payload.email))
            duplicate = cursor.fetchone()
            if duplicate:
                if duplicate['username'].lower() == payload.username.lower():
                    raise _error(409, 'DUPLICATE_USERNAME', '이미 사용 중인 아이디입니다.')
                raise _error(409, 'DUPLICATE_EMAIL', '이미 등록된 이메일입니다.')
            cursor.execute('''INSERT INTO oligo_members
                (username, password_hash, email, phone, region_code, hint_question, hint_answer_hash)
                VALUES (%s,%s,%s,%s,%s,%s,%s)''',
                (payload.username, hasher.hash(payload.password), payload.email, payload.phone,
                 payload.region_code, payload.hint_question, hasher.hash(payload.hint_answer.strip())))
            member_id = cursor.lastrowid
            conn.commit()
            cursor.execute('SELECT * FROM oligo_members WHERE id=%s', (member_id,))
            return _public(cursor.fetchone())
    except IntegrityError as exc:
        if exc.args[0] == 1062:
            field = 'USERNAME' if 'username' in str(exc).lower() else 'EMAIL'
            message = '이미 사용 중인 아이디입니다.' if field == 'USERNAME' else '이미 등록된 이메일입니다.'
            raise _error(409, f'DUPLICATE_{field}', message) from None
        raise _db_error() from None
    except MySQLError:
        raise _db_error() from None


@router.post('/auth/login')
def login(payload: LoginInput, request: Request, response: Response):
    _require_origin(request)
    try:
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('SELECT * FROM oligo_members WHERE username=%s',
                           (payload.username,))
            member = cursor.fetchone()
            try:
                valid = bool(member) and hasher.verify(member['password_hash'], payload.password)
            except (VerifyMismatchError, VerificationError):
                valid = False
            if not valid:
                raise _error(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.')
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=SESSION_DAYS)
            cursor.execute('INSERT INTO oligo_member_sessions (member_id, token_hash, expires_at) VALUES (%s,%s,%s)',
                           (member['id'], _token_hash(token), expires))
            conn.commit()
            response.set_cookie(value=token, **_cookie_options())
            return _public(member)
    except MySQLError:
        raise _db_error() from None


@router.get('/auth/me')
def me(member: dict = Depends(current_member)):
    return _public(member)


@router.post('/auth/logout', status_code=204)
def logout(request: Request, response: Response,
           token: str | None = Cookie(default=None, alias=COOKIE_NAME)):
    _require_origin(request)
    if token:
        try:
            with database() as conn, conn.cursor() as cursor:
                cursor.execute('DELETE FROM oligo_member_sessions WHERE token_hash=%s', (_token_hash(token),))
                conn.commit()
        except MySQLError:
            raise _db_error() from None
    response.delete_cookie(COOKIE_NAME, path='/', secure=_cookie_options()['secure'], samesite='lax')


@router.patch('/users/me')
async def update_profile(payload: ProfileInput, request: Request, member: dict = Depends(current_member)):
    _require_origin(request)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return _public(member)
    if 'region_code' in updates:
        if not updates['region_code']:
            raise _error(422, 'INVALID_REGION', '지역을 다시 선택해주세요.')
        await _valid_region(updates['region_code'])
    fields = ', '.join(f'{key}=%s' for key in updates)
    try:
        with database() as conn, conn.cursor() as cursor:
            cursor.execute(f'UPDATE oligo_members SET {fields} WHERE id=%s', (*updates.values(), member['id']))
            conn.commit()
            cursor.execute('SELECT * FROM oligo_members WHERE id=%s', (member['id'],))
            return _public(cursor.fetchone())
    except MySQLError:
        raise _db_error() from None


@router.post('/auth/change-password', status_code=204)
def change_password(payload: PasswordInput, request: Request, member: dict = Depends(current_member)):
    _require_origin(request)
    try:
        hasher.verify(member['password_hash'], payload.current_password)
    except (VerifyMismatchError, VerificationError):
        raise _error(403, 'WRONG_PASSWORD', '현재 비밀번호가 올바르지 않습니다.') from None
    try:
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('UPDATE oligo_members SET password_hash=%s WHERE id=%s',
                           (hasher.hash(payload.new_password), member['id']))
            cursor.execute('DELETE FROM oligo_member_sessions WHERE member_id=%s', (member['id'],))
            conn.commit()
    except MySQLError:
        raise _db_error() from None


@router.post('/auth/change-hint', status_code=204)
def change_hint(payload: HintInput, request: Request, member: dict = Depends(current_member)):
    _require_origin(request)
    try:
        hasher.verify(member['password_hash'], payload.current_password)
    except (VerifyMismatchError, VerificationError):
        raise _error(403, 'WRONG_PASSWORD', '현재 비밀번호가 올바르지 않습니다.') from None
    try:
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('UPDATE oligo_members SET hint_question=%s, hint_answer_hash=%s WHERE id=%s',
                           (payload.hint_question, hasher.hash(payload.hint_answer.strip()), member['id']))
            conn.commit()
    except MySQLError:
        raise _db_error() from None


@router.delete('/users/me', status_code=204)
def delete_account(request: Request, response: Response, member: dict = Depends(current_member)):
    _require_origin(request)
    try:
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('DELETE FROM oligo_members WHERE id=%s', (member['id'],))
            conn.commit()
    except MySQLError:
        raise _db_error() from None
    response.delete_cookie(COOKIE_NAME, path='/', secure=_cookie_options()['secure'], samesite='lax')

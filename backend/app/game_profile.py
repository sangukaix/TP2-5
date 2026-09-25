"""Oligo World profile and progress, scoped to the existing member cookie."""

import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from pymysql import IntegrityError, MySQLError

from app.auth import _db_error, _error, _require_origin, _valid_region, current_member, database


router = APIRouter(prefix='/api/v1/game', tags=['Oligo World'])
CHARACTER_IDS = {'toki', 'hochi', 'miho'}
TRAVEL_STYLES = {'mountain', 'ocean', 'forest', 'camping', 'pension',
                 'city', 'rural', 'drive', 'transit', 'hotel'}
NICKNAME_PATTERN = re.compile(r'^[가-힣A-Za-z0-9_]{2,16}$')
MAP_TILES = {
    'map001': ('############', '#....bb.ss.#', '#....bb.ss.#', '#..........#',
               '#D..tttt...#', '#...tttt...#', '############'),
    'map002': ('PPPPPPPPPPPP', 'P..........P', 'P..R.......P', 'P..........P',
               'P.......HH.P', 'P.......HH.P', 'PPPPPPPPPPPP'),
}
BLOCKED = {'map001': set('#bts'), 'map002': set('PRH')}
MAP002_SPAWN = (6, 5)
PROFILE_FIELDS = ('member_id', 'profile_status', 'character_id', 'game_nickname',
                  'region_code', 'travel_style', 'level', 'exp', 'currency_w',
                  'current_map_id', 'position_x', 'position_y', 'tutorial_stage',
                  'tutorial_valid_moves', 'tutorial_reward_granted', 'created_at', 'updated_at')


def public_profile(row):
    if row is None:
        return None
    return {field: row[field] for field in PROFILE_FIELDS}


def valid_nickname(value: str) -> str:
    value = value.strip()
    if not NICKNAME_PATTERN.fullmatch(value):
        raise ValueError('게임 닉네임은 2~16자의 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.')
    return value


class DraftInput(BaseModel):
    character_id: str | None = None
    game_nickname: str | None = None
    region_code: str | None = Field(default=None, pattern=r'^\d{5}$')
    travel_style: str | None = None

    @field_validator('character_id')
    @classmethod
    def character(cls, value):
        if value is not None and value not in CHARACTER_IDS:
            raise ValueError('Invalid character')
        return value

    @field_validator('game_nickname')
    @classmethod
    def nickname(cls, value):
        if value is None or not value.strip():
            return None
        value = value.strip()
        if not re.fullmatch(r'[가-힣A-Za-z0-9_]{1,16}', value):
            raise ValueError('Invalid draft nickname')
        return value

    @field_validator('travel_style')
    @classmethod
    def style(cls, value):
        if value is not None and value not in TRAVEL_STYLES:
            raise ValueError('Invalid travel style')
        return value


class FinalizeInput(BaseModel):
    character_id: str
    game_nickname: str
    region_code: str = Field(pattern=r'^\d{5}$')
    travel_style: str

    @field_validator('character_id')
    @classmethod
    def character(cls, value):
        if value not in CHARACTER_IDS:
            raise ValueError('Invalid character')
        return value

    @field_validator('game_nickname')
    @classmethod
    def nickname(cls, value):
        return valid_nickname(value)

    @field_validator('travel_style')
    @classmethod
    def style(cls, value):
        if value not in TRAVEL_STYLES:
            raise ValueError('Invalid travel style')
        return value


class ProgressInput(BaseModel):
    current_map_id: str
    position_x: int = Field(ge=0, le=11)
    position_y: int = Field(ge=0, le=6)
    tutorial_stage: str
    tutorial_valid_moves: int = Field(ge=0, le=4)


def _profile(cursor, member_id, lock=False):
    cursor.execute('SELECT * FROM oligo_game_profiles WHERE member_id=%s' +
                   (' FOR UPDATE' if lock else ''), (member_id,))
    return cursor.fetchone()


def _nickname_error(exc):
    if exc.args[0] == 1062 and 'uq_oligo_game_nickname' in str(exc):
        return _error(409, 'DUPLICATE_GAME_NICKNAME', '이미 사용 중인 게임 닉네임입니다.')
    return _db_error()


@router.get('/profile')
def get_profile(member: dict = Depends(current_member)):
    try:
        with database() as conn, conn.cursor() as cursor:
            return {'profile': public_profile(_profile(cursor, member['id']))}
    except MySQLError:
        raise _db_error() from None


@router.patch('/profile/draft')
async def save_draft(payload: DraftInput, request: Request, member: dict = Depends(current_member)):
    _require_origin(request)
    updates = payload.model_dump(exclude_unset=True)
    if updates.get('region_code'):
        await _valid_region(updates['region_code'])
    try:
        with database() as conn, conn.cursor() as cursor:
            row = _profile(cursor, member['id'], lock=True)
            if row and row['profile_status'] == 'ACTIVE':
                raise _error(409, 'PROFILE_ACTIVE', '이미 캐릭터 생성이 완료되었습니다.')
            if row:
                if updates:
                    fields = ', '.join(f'{field}=%s' for field in updates)
                    cursor.execute(f'UPDATE oligo_game_profiles SET {fields} WHERE member_id=%s',
                                   (*updates.values(), member['id']))
            else:
                fields = ', '.join(updates)
                placeholders = ', '.join(['%s'] * len(updates))
                cursor.execute(f'INSERT INTO oligo_game_profiles (member_id{", " + fields if fields else ""}) '
                               f'VALUES (%s{", " + placeholders if placeholders else ""})',
                               (member['id'], *updates.values()))
            conn.commit()
            return {'profile': public_profile(_profile(cursor, member['id']))}
    except IntegrityError as exc:
        raise _nickname_error(exc) from None
    except MySQLError:
        raise _db_error() from None


@router.post('/profile/finalize')
async def finalize_profile(payload: FinalizeInput, request: Request,
                           member: dict = Depends(current_member)):
    _require_origin(request)
    await _valid_region(payload.region_code)
    try:
        with database() as conn, conn.cursor() as cursor:
            row = _profile(cursor, member['id'], lock=True)
            if row and row['profile_status'] == 'ACTIVE':
                raise _error(409, 'PROFILE_ACTIVE', '이미 캐릭터 생성이 완료되었습니다.')
            values = (payload.character_id, payload.game_nickname,
                      payload.region_code, payload.travel_style)
            if row:
                cursor.execute('''UPDATE oligo_game_profiles SET profile_status='ACTIVE',
                    character_id=%s, game_nickname=%s, region_code=%s, travel_style=%s
                    WHERE member_id=%s''', (*values, member['id']))
            else:
                cursor.execute('''INSERT INTO oligo_game_profiles
                    (member_id, profile_status, character_id, game_nickname, region_code, travel_style)
                    VALUES (%s, 'ACTIVE', %s, %s, %s, %s)''', (member['id'], *values))
            conn.commit()
            return {'profile': public_profile(_profile(cursor, member['id']))}
    except IntegrityError as exc:
        raise _nickname_error(exc) from None
    except MySQLError:
        raise _db_error() from None


def _walkable(map_id, x, y):
    tiles = MAP_TILES.get(map_id)
    return bool(tiles and y < len(tiles) and x < len(tiles[y]) and
                tiles[y][x] not in BLOCKED[map_id])


@router.patch('/profile/progress')
def save_progress(payload: ProgressInput, request: Request,
                  member: dict = Depends(current_member)):
    _require_origin(request)
    if not _walkable(payload.current_map_id, payload.position_x, payload.position_y):
        raise _error(422, 'INVALID_POSITION', '이동 위치를 확인해주세요.')
    if payload.tutorial_stage not in {'greeting', 'movementIntro', 'moving', 'doorIntro',
                                       'toDoor', 'complete'}:
        raise _error(422, 'INVALID_TUTORIAL', 'Tutorial 상태를 확인해주세요.')
    try:
        with database() as conn, conn.cursor() as cursor:
            row = _profile(cursor, member['id'], lock=True)
            if not row or row['profile_status'] != 'ACTIVE':
                raise _error(409, 'PROFILE_NOT_ACTIVE', '캐릭터를 먼저 생성해주세요.')
            if row['current_map_id'] != payload.current_map_id:
                raise _error(409, 'PROGRESS_CONFLICT', '게임 진행 상태를 새로 불러와주세요.')
            if row['tutorial_reward_granted'] and payload.tutorial_stage != 'complete':
                raise _error(409, 'PROGRESS_CONFLICT', '게임 진행 상태를 새로 불러와주세요.')
            if not row['tutorial_reward_granted'] and payload.tutorial_stage == 'complete':
                raise _error(409, 'TUTORIAL_INCOMPLETE', 'Tutorial을 먼저 완료해주세요.')
            if not row['tutorial_reward_granted'] and payload.tutorial_stage == 'toDoor' and \
                    payload.tutorial_valid_moves < 4:
                raise _error(409, 'TUTORIAL_INCOMPLETE', '방향키 이동을 완료해주세요.')
            if payload.tutorial_valid_moves < row['tutorial_valid_moves']:
                raise _error(409, 'PROGRESS_CONFLICT', '게임 진행 상태를 새로 불러와주세요.')
            cursor.execute('''UPDATE oligo_game_profiles SET position_x=%s, position_y=%s,
                tutorial_stage=%s, tutorial_valid_moves=%s WHERE member_id=%s''',
                (payload.position_x, payload.position_y, payload.tutorial_stage,
                 payload.tutorial_valid_moves, member['id']))
            conn.commit()
            return {'profile': public_profile(_profile(cursor, member['id']))}
    except MySQLError:
        raise _db_error() from None


@router.post('/tutorial/complete')
def complete_tutorial(request: Request, member: dict = Depends(current_member)):
    _require_origin(request)
    try:
        with database() as conn, conn.cursor() as cursor:
            row = _profile(cursor, member['id'], lock=True)
            if not row or row['profile_status'] != 'ACTIVE':
                raise _error(409, 'PROFILE_NOT_ACTIVE', '캐릭터를 먼저 생성해주세요.')
            if not row['tutorial_reward_granted']:
                if row['current_map_id'] != 'map001' or row['tutorial_stage'] != 'toDoor' or \
                        row['tutorial_valid_moves'] < 4 or (row['position_x'], row['position_y']) != (1, 4):
                    raise _error(409, 'TUTORIAL_INCOMPLETE', '현관문까지 이동해주세요.')
                cursor.execute('''UPDATE oligo_game_profiles SET exp=exp+10, currency_w=currency_w+10,
                    current_map_id='map002', position_x=%s, position_y=%s,
                    tutorial_stage='complete', tutorial_reward_granted=TRUE WHERE member_id=%s''',
                    (*MAP002_SPAWN, member['id']))
                conn.commit()
            return {'profile': public_profile(_profile(cursor, member['id']))}
    except MySQLError:
        raise _db_error() from None

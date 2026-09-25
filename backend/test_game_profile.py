"""Game profile API contracts without changing a real MySQL database."""

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from pymysql import IntegrityError

from app import game_profile
from app.main import app


class FakeGameDatabase:
    def __init__(self):
        self.rows = {}
        self.result = None

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def cursor(self):
        return self

    def commit(self):
        pass

    def fetchone(self):
        return self.result

    def execute(self, sql, args=()):
        sql = ' '.join(sql.split())
        self.result = None
        if sql.startswith('SELECT * FROM oligo_game_profiles'):
            self.result = self.rows.get(args[0])
        elif sql.startswith('INSERT INTO oligo_game_profiles'):
            member_id = args[0]
            if "'ACTIVE'" in sql and any(row['profile_status'] == 'ACTIVE' and
                    row['game_nickname'] == args[2] for row in self.rows.values()):
                raise IntegrityError(1062, 'Duplicate entry for uq_oligo_game_nickname')
            self.rows[member_id] = dict.fromkeys(game_profile.PROFILE_FIELDS)
            row = self.rows[member_id]
            row.update(member_id=member_id, profile_status='DRAFT', level=1, exp=0,
                       currency_w=0, current_map_id='map001', position_x=5, position_y=3,
                       tutorial_stage='greeting', tutorial_valid_moves=0,
                       tutorial_reward_granted=False)
            if "'ACTIVE'" in sql:
                row.update(profile_status='ACTIVE', character_id=args[1], game_nickname=args[2],
                           region_code=args[3], travel_style=args[4])
            else:
                columns = sql.split('(', 1)[1].split(')', 1)[0].replace(' ', '').split(',')
                row.update(dict(zip(columns, args)))
        elif sql.startswith("UPDATE oligo_game_profiles SET profile_status='ACTIVE'"):
            if any(row['profile_status'] == 'ACTIVE' and row['game_nickname'] == args[1]
                   for row in self.rows.values()):
                raise IntegrityError(1062, 'Duplicate entry for uq_oligo_game_nickname')
            self.rows[args[-1]].update(profile_status='ACTIVE', character_id=args[0],
                                       game_nickname=args[1], region_code=args[2], travel_style=args[3])
        elif sql.startswith('UPDATE oligo_game_profiles SET exp=exp+10'):
            row = self.rows[args[-1]]
            row.update(exp=row['exp'] + 10, currency_w=row['currency_w'] + 10,
                       current_map_id='map002', position_x=args[0], position_y=args[1],
                       tutorial_stage='complete', tutorial_reward_granted=True)
        elif sql.startswith('UPDATE oligo_game_profiles SET position_x='):
            self.rows[args[-1]].update(position_x=args[0], position_y=args[1],
                                       tutorial_stage=args[2], tutorial_valid_moves=args[3])
        elif sql.startswith('UPDATE oligo_game_profiles SET'):
            columns = sql.split('SET ', 1)[1].split(' WHERE')[0].split(', ')
            self.rows[args[-1]].update({column.split('=')[0]: value
                                        for column, value in zip(columns, args[:-1])})
        else:
            raise AssertionError(sql)


async def fake_boundaries():
    return {'features': [{'properties': {'region_code': '11680'}},
                         {'properties': {'region_code': '11110'}}]}


class GameProfileApiTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeGameDatabase()
        self.patchers = [patch.object(game_profile, 'database', return_value=self.db),
                         patch.object(game_profile, '_valid_region', self.valid_region)]
        for patcher in self.patchers:
            patcher.start()
        app.dependency_overrides[game_profile.current_member] = lambda: {'id': 7, 'region_code': '11680'}
        self.client = TestClient(app, headers={'Origin': 'http://localhost:5177'})
        self.valid = dict(character_id='miho', game_nickname='관악산호랑이',
                          region_code='11680', travel_style='forest')

    async def valid_region(self, code):
        if code not in {'11680', '11110'}:
            raise game_profile._error(422, 'INVALID_REGION', '지역을 다시 선택해주세요.')

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        for patcher in reversed(self.patchers):
            patcher.stop()

    def test_anonymous_and_member_scoping(self):
        app.dependency_overrides.clear()
        self.assertEqual(self.client.get('/api/v1/game/profile').status_code, 401)
        self.assertEqual(self.client.patch('/api/v1/game/profile/draft', json={}).status_code, 401)
        app.dependency_overrides[game_profile.current_member] = lambda: {'id': 7}
        self.assertIsNone(self.client.get('/api/v1/game/profile').json()['profile'])
        self.client.patch('/api/v1/game/profile/draft', json={'character_id': 'toki'})
        app.dependency_overrides[game_profile.current_member] = lambda: {'id': 8}
        self.assertIsNone(self.client.get('/api/v1/game/profile').json()['profile'])

    def test_draft_finalize_progress_and_one_time_reward(self):
        saved = self.client.patch('/api/v1/game/profile/draft', json={
            'character_id': 'hochi', 'game_nickname': '관', 'region_code': '11680',
        })
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()['profile']['profile_status'], 'DRAFT')
        self.assertEqual(saved.json()['profile']['game_nickname'], '관')
        self.assertEqual(self.client.get('/api/v1/game/profile').json()['profile']['character_id'], 'hochi')
        invalid = self.client.post('/api/v1/game/profile/finalize', json={**self.valid,
                                    'travel_style': 'unknown'})
        self.assertEqual(invalid.status_code, 422)
        active = self.client.post('/api/v1/game/profile/finalize', json=self.valid)
        self.assertEqual(active.status_code, 200)
        self.assertEqual(active.json()['profile']['profile_status'], 'ACTIVE')
        self.assertEqual(active.json()['profile']['exp'], 0)
        self.assertEqual(active.json()['profile']['current_map_id'], 'map001')
        self.assertEqual(self.client.patch('/api/v1/game/profile/draft', json={}).status_code, 409)
        self.assertEqual(self.client.post('/api/v1/game/profile/finalize', json=self.valid).status_code, 409)
        progress = dict(current_map_id='map001', position_x=1, position_y=4,
                        tutorial_stage='toDoor', tutorial_valid_moves=4)
        self.assertEqual(self.client.post('/api/v1/game/tutorial/complete').status_code, 409)
        self.assertEqual(self.client.patch('/api/v1/game/profile/progress', json=progress).status_code, 200)
        first = self.client.post('/api/v1/game/tutorial/complete')
        again = self.client.post('/api/v1/game/tutorial/complete')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(again.json()['profile']['exp'], 10)
        self.assertEqual(again.json()['profile']['currency_w'], 10)
        self.assertEqual(again.json()['profile']['current_map_id'], 'map002')
        self.assertEqual(again.json()['profile']['tutorial_reward_granted'], 1)
        self.assertEqual(self.client.patch('/api/v1/game/profile/progress', json={
            **progress, 'current_map_id': 'map002'}).status_code, 409)
        self.assertEqual(self.client.get('/api/v1/game/profile').json()['profile']['exp'], 10)

    def test_validation_and_origin(self):
        self.assertEqual(self.client.patch('/api/v1/game/profile/draft', json={
            'character_id': 'other'}).status_code, 422)
        self.assertEqual(self.client.post('/api/v1/game/profile/finalize', json={
            **self.valid, 'game_nickname': 'has spaces'}).status_code, 422)
        self.assertEqual(self.client.post('/api/v1/game/profile/finalize', json={
            **self.valid, 'region_code': '99999'}).status_code, 422)
        self.assertEqual(self.client.patch('/api/v1/game/profile/draft', json={},
            headers={'Origin': 'https://other.example'}).status_code, 403)

    def test_drafts_do_not_reserve_an_active_nickname(self):
        self.db.rows[8] = dict.fromkeys(game_profile.PROFILE_FIELDS)
        self.db.rows[8].update(profile_status='ACTIVE', game_nickname='관악산호랑이')
        draft = self.client.patch('/api/v1/game/profile/draft', json={
            'game_nickname': '관악산호랑이'})
        self.assertEqual(draft.status_code, 200)
        finalize = self.client.post('/api/v1/game/profile/finalize', json=self.valid)
        self.assertEqual(finalize.status_code, 409)
        self.assertEqual(finalize.json()['detail']['code'], 'DUPLICATE_GAME_NICKNAME')


if __name__ == '__main__':
    unittest.main()

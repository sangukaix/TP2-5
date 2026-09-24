"""회원 API 계약을 외부 DB와 VWorld 호출 없이 검증합니다."""

from datetime import datetime
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import auth
from app.main import app


class FakeDatabase:
    def __init__(self):
        self.members = {}
        self.sessions = {}
        self.result = None
        self.lastrowid = 0

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
        if sql.startswith('SELECT username, email'):
            self.result = next((m for m in self.members.values()
                                if m['username'].lower() == args[0].lower() or m['email'] == args[1]), None)
        elif sql.startswith('INSERT INTO oligo_members'):
            self.lastrowid += 1
            self.members[self.lastrowid] = dict(id=self.lastrowid, username=args[0], password_hash=args[1],
                email=args[2], phone=args[3], region_code=args[4], hint_question=args[5],
                hint_answer_hash=args[6], name=None, created_at=datetime.now(),
                updated_at=datetime.now())
        elif sql.startswith('SELECT * FROM oligo_members WHERE username'):
            self.result = next((m for m in self.members.values()
                                if m['username'] == args[0]), None)
        elif sql.startswith('SELECT * FROM oligo_members WHERE id'):
            self.result = self.members.get(args[0])
        elif sql.startswith('INSERT INTO oligo_member_sessions'):
            self.sessions[args[1]] = args[0]
        elif sql.startswith('SELECT m.* FROM oligo_member_sessions'):
            member_id = self.sessions.get(args[0])
            member = self.members.get(member_id)
            self.result = member
        elif sql.startswith('UPDATE oligo_members SET password_hash'):
            self.members[args[1]]['password_hash'] = args[0]
        elif sql.startswith('UPDATE oligo_members SET hint_question'):
            self.members[args[2]]['hint_question'] = args[0]
            self.members[args[2]]['hint_answer_hash'] = args[1]
        elif sql.startswith('DELETE FROM oligo_members WHERE id'):
            self.members.pop(args[0], None)
            self.sessions = {key: value for key, value in self.sessions.items() if value != args[0]}
        elif sql.startswith('UPDATE oligo_members SET'):
            fields = sql.split('SET ', 1)[1].split(' WHERE')[0].split(', ')
            self.members[args[-1]].update({field.split('=')[0]: value
                                            for field, value in zip(fields, args[:-1])})
        elif sql.startswith('DELETE FROM oligo_member_sessions WHERE member_id'):
            self.sessions = {key: value for key, value in self.sessions.items() if value != args[0]}
        elif sql.startswith('DELETE FROM oligo_member_sessions WHERE token_hash'):
            self.sessions.pop(args[0], None)
        else:
            raise AssertionError(sql)


async def fake_boundaries():
    return {'features': [{'properties': {'region_code': code}} for code in ('11680', '11110')]}


class AuthApiTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDatabase()
        self.patchers = [patch.object(auth, 'database', return_value=self.db),
                         patch.object(auth, 'get_sigungu_boundaries', fake_boundaries),
                         patch.dict(os.environ, {'AUTH_SESSION_SECRET': 'test-secret-with-at-least-thirty-two-characters'})]
        for patcher in self.patchers:
            patcher.start()
        self.client = TestClient(app, headers={'Origin': 'http://localhost:5177'})
        self.signup = dict(username='tester01', password='ab12!c', email='test@example.com',
                           region_code='11680', hint_question='question', hint_answer='secret answer')

    def tearDown(self):
        self.client.close()
        for patcher in reversed(self.patchers):
            patcher.stop()

    def test_full_member_flow(self):
        self.assertEqual(self.client.get('/api/v1/auth/me').status_code, 401)
        signup_response = self.client.post('/api/v1/auth/signup', json=self.signup)
        self.assertEqual(signup_response.status_code, 201)
        self.assertNotIn('password_hash', signup_response.json())
        self.assertNotIn('hint_answer_hash', signup_response.json())
        row = self.db.members[1]
        self.assertNotEqual(row['password_hash'], self.signup['password'])
        self.assertNotEqual(row['hint_answer_hash'], self.signup['hint_answer'])
        self.assertTrue(auth.hasher.verify(row['password_hash'], self.signup['password']))
        self.assertEqual(row['region_code'], '11680')
        self.assertEqual(self.client.post('/api/v1/auth/signup', json=self.signup).json()['detail']['code'],
                         'DUPLICATE_USERNAME')
        other = {**self.signup, 'username': 'tester02'}
        self.assertEqual(self.client.post('/api/v1/auth/signup', json=other).json()['detail']['code'],
                         'DUPLICATE_EMAIL')
        self.assertEqual(self.client.post('/api/v1/auth/login', json={
            'username': 'tester01', 'password': 'wrong'}).status_code, 401)
        response = self.client.post('/api/v1/auth/login', json={
            'username': 'tester01', 'password': 'ab12!c'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('httponly', response.headers['set-cookie'].lower())
        self.assertEqual(self.client.get('/api/v1/auth/me').json()['region_code'], '11680')
        self.assertEqual(self.client.patch('/api/v1/users/me', json={
            'name': 'Tester', 'phone': '010-0000-0000'}).json()['name'], 'Tester')
        self.assertEqual(self.client.patch('/api/v1/users/me', json={
            'region_code': '11110'}).json()['region_code'], '11110')
        self.assertEqual(self.client.post('/api/v1/auth/change-hint', json={
            'current_password': 'ab12!c', 'hint_question': 'new question',
            'hint_answer': 'new answer'}).status_code, 204)
        self.assertEqual(self.client.post('/api/v1/auth/change-password', json={
            'current_password': 'ab12!c', 'new_password': 'new123!'}).status_code, 204)
        self.assertEqual(self.client.get('/api/v1/auth/me').status_code, 401)
        self.assertEqual(self.client.post('/api/v1/auth/login', json={
            'username': 'tester01', 'password': 'new123!'}).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/logout').status_code, 204)
        self.assertEqual(self.client.get('/api/v1/auth/me').status_code, 401)
        self.assertEqual(self.client.post('/api/v1/auth/login', json={
            'username': 'tester01', 'password': 'new123!'}).status_code, 200)
        self.assertEqual(self.client.delete('/api/v1/users/me').status_code, 204)
        self.assertEqual(self.client.get('/api/v1/auth/me').status_code, 401)
        self.assertFalse(self.db.members)

    def test_public_and_origin_boundary(self):
        self.assertEqual(self.client.get('/health').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/signup', json={}).json()['detail']['code'],
                         'VALIDATION_ERROR')
        self.assertEqual(self.client.post('/api/v1/auth/signup', json=self.signup,
            headers={'Origin': 'https://untrusted.example'}).status_code, 403)
        self.assertEqual(self.client.post('/api/v1/auth/signup', json={
            **self.signup, 'region_code': '99999'}).status_code, 422)


if __name__ == '__main__':
    unittest.main()

"""Opt-in real MySQL auth flow; never runs against a non-local database."""

import os
import secrets
import unittest

from fastapi.testclient import TestClient

from app.auth import database, hasher, setting
from app.main import app


@unittest.skipUnless(os.getenv('RUN_LOCAL_MYSQL_AUTH_TEST') == '1', 'local MySQL opt-in only')
class LocalMysqlAuthTests(unittest.TestCase):
    def setUp(self):
        if setting('MYSQL_HOST') not in ('127.0.0.1', 'localhost'):
            self.fail('Local MySQL test refuses a remote host')
        if setting('MYSQL_DATABASE') != 'tourism_strategy':
            self.fail('Local MySQL test refuses an unexpected database')
        self.username = 'it' + secrets.token_hex(4)
        self.email = self.username + '@example.invalid'
        self.password = secrets.token_urlsafe(7)
        self.new_password = secrets.token_urlsafe(7)
        self.client = TestClient(app, headers={'Origin': 'http://localhost:5177'})

    def tearDown(self):
        self.client.close()
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('DELETE FROM oligo_members WHERE username=%s AND email=%s',
                           (self.username, self.email))
            conn.commit()

    def test_schema_contract(self):
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('SHOW CREATE TABLE oligo_members')
            members_ddl = cursor.fetchone()['Create Table']
            cursor.execute('SHOW CREATE TABLE oligo_member_sessions')
            sessions_ddl = cursor.fetchone()['Create Table']
        for column in ('`id`', '`username`', '`email`', '`password_hash`',
                       '`hint_answer_hash`', '`region_code`', '`created_at`', '`updated_at`'):
            self.assertIn(column, members_ddl)
        self.assertIn('PRIMARY KEY', members_ddl)
        self.assertIn('UNIQUE KEY `uq_oligo_members_username`', members_ddl)
        self.assertIn('UNIQUE KEY `uq_oligo_members_email`', members_ddl)
        self.assertIn('`token_hash`', sessions_ddl)
        self.assertIn('FOREIGN KEY', sessions_ddl)
        self.assertIn('ON DELETE CASCADE', sessions_ddl)

    def test_signup_login_profile_password_logout(self):
        payload = {'username': self.username, 'password': self.password,
                   'email': self.email, 'phone': '010-0000-0000',
                   'region_code': '11680', 'hint_question': '테스트 질문',
                   'hint_answer': '테스트 답변'}
        signup = self.client.post('/api/v1/auth/signup', json=payload)
        self.assertEqual(signup.status_code, 201, signup.text)
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('SELECT * FROM oligo_members WHERE username=%s', (self.username,))
            member = cursor.fetchone()
        self.assertEqual(member['email'], self.email)
        self.assertEqual(member['phone'], payload['phone'])
        self.assertEqual(member['region_code'], '11680')
        self.assertNotEqual(member['password_hash'], self.password)
        self.assertTrue(hasher.verify(member['password_hash'], self.password))
        self.assertNotEqual(member['hint_answer_hash'], payload['hint_answer'])

        duplicate = self.client.post('/api/v1/auth/signup', json=payload)
        self.assertEqual(duplicate.json()['detail']['code'], 'DUPLICATE_USERNAME')
        duplicate_email = self.client.post('/api/v1/auth/signup', json={
            **payload, 'username': 'it' + secrets.token_hex(4)})
        self.assertEqual(duplicate_email.json()['detail']['code'], 'DUPLICATE_EMAIL')
        bad_login = self.client.post('/api/v1/auth/login', json={
            'username': self.username, 'password': 'wrong-password'})
        self.assertEqual(bad_login.status_code, 401)
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) AS count FROM oligo_member_sessions WHERE member_id=%s',
                           (member['id'],))
            self.assertEqual(cursor.fetchone()['count'], 0)

        login = self.client.post('/api/v1/auth/login', json={
            'username': self.username, 'password': self.password})
        self.assertEqual(login.status_code, 200, login.text)
        self.assertIn('httponly', login.headers['set-cookie'].lower())
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('SELECT token_hash FROM oligo_member_sessions WHERE member_id=%s',
                           (member['id'],))
            session = cursor.fetchone()
        self.assertEqual(len(session['token_hash']), 64)
        self.assertNotEqual(session['token_hash'], self.client.cookies.get('oligo_member_session'))
        self.assertEqual(self.client.get('/api/v1/auth/me').json()['username'], self.username)

        with TestClient(app, headers={'Origin': 'http://localhost:5177'},
                        cookies=dict(self.client.cookies)) as refreshed:
            self.assertEqual(refreshed.get('/api/v1/auth/me').json()['username'], self.username)

        profile = self.client.patch('/api/v1/users/me', json={
            'name': 'Local Test', 'phone': '010-1111-2222', 'region_code': '11110'})
        self.assertEqual(profile.status_code, 200, profile.text)
        self.assertEqual(profile.json()['region_code'], '11110')
        self.assertEqual(self.client.get('/api/v1/auth/me').json()['name'], 'Local Test')
        with database() as conn, conn.cursor() as cursor:
            cursor.execute('SELECT name, phone, region_code FROM oligo_members WHERE id=%s',
                           (member['id'],))
            stored = cursor.fetchone()
        self.assertEqual(stored, {'name': 'Local Test', 'phone': '010-1111-2222',
                                  'region_code': '11110'})

        hint = self.client.post('/api/v1/auth/change-hint', json={
            'current_password': self.password, 'hint_question': '새 질문',
            'hint_answer': '새 답변'})
        self.assertEqual(hint.status_code, 204, hint.text)
        changed = self.client.post('/api/v1/auth/change-password', json={
            'current_password': self.password, 'new_password': self.new_password})
        self.assertEqual(changed.status_code, 204, changed.text)
        self.assertEqual(self.client.get('/api/v1/auth/me').status_code, 401)
        self.assertEqual(self.client.post('/api/v1/auth/login', json={
            'username': self.username, 'password': self.password}).status_code, 401)
        self.assertEqual(self.client.post('/api/v1/auth/login', json={
            'username': self.username, 'password': self.new_password}).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/logout').status_code, 204)
        self.assertEqual(self.client.get('/api/v1/auth/me').status_code, 401)


if __name__ == '__main__':
    unittest.main()

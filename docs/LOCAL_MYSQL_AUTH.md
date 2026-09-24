# TP2-5 로컬 MySQL 회원 인증 연결

2026-09-25 점검: 루트 `.env`의 `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`,
`MYSQL_USER`, `MYSQL_PASSWORD`는 Backend가 읽는 이름과 일치한다.
로컬 MySQL 서비스는 실행 중이며 `tourism_app`으로 TCP `127.0.0.1`과
`localhost`에 접속하면 DB 선택 전 모두 오류 1045가 발생했다.
따라서 회원 테이블 SQL을 적용하기 전에 MySQL 관리자 권한으로 계정
존재·호스트·비밀번호를 확인해야 한다. 이 파일에 실제 비밀번호를 기록하지 않는다.

MySQL Workbench의 **로컬 관리자 연결**에서 다음 읽기 전용 SQL을 실행한다.

```sql
SELECT user, host, plugin, account_locked
FROM mysql.user WHERE user = 'tourism_app';
SHOW DATABASES LIKE 'tourism_strategy';
```

`tourism_app`@`localhost`가 없으면 다음 SQL에서 `LOCAL_PASSWORD_HERE`를
루트 `.env`의 `MYSQL_PASSWORD`와 같은 값으로 **Workbench에서만 교체**한 뒤 실행한다.
이미 계정이 있으면 `CREATE USER`는 건너뛰고 비밀번호가 일치하는지 관리자가
확인한다. 기존 계정의 비밀번호를 변경해야 한다면 같은 값을 사용하는 다른
로컬 서비스에도 영향을 주는지 먼저 확인한다. 실제 비밀번호를 Git이나 채팅에 넣지 않는다.

```sql
CREATE USER IF NOT EXISTS 'tourism_app'@'localhost'
  IDENTIFIED BY 'LOCAL_PASSWORD_HERE';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES
  ON tourism_strategy.* TO 'tourism_app'@'localhost';
SHOW GRANTS FOR 'tourism_app'@'localhost';
```

계정이 존재하지만 저장된 비밀번호가 다를 때에만, 로컬 서비스에 미치는 영향을
확인한 후 관리자가 다음을 실행한다. `.env`와 같은 값을 사용한다.

```sql
ALTER USER 'tourism_app'@'localhost'
  IDENTIFIED BY 'LOCAL_PASSWORD_HERE' ACCOUNT UNLOCK;
```

그다음 프로젝트 루트에서 Backend가 실제 사용하는 연결로 다시 확인한다.
관리자 계정을 앱 `.env`에 넣지 않는다.

```powershell
@'
import sys
sys.path.insert(0, 'backend')
from app.auth import database
with database() as conn, conn.cursor() as cursor:
    cursor.execute('SELECT CURRENT_USER(), DATABASE()')
    print('회원 DB 연결 성공:', bool(cursor.fetchone()))
'@ | .\backend\.venv\Scripts\python.exe -
```

연결 성공 후 `database/mysql/006_member_auth.sql`의 두 신규 테이블만 적용한다.
`CREATE TABLE IF NOT EXISTS`이므로 기존 관광 테이블을 변경하지 않는다.
Production DB에는 이 절차를 실행하지 않는다.

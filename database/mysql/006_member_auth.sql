-- OLIGO-K 선택형 회원 인증. MySQL 8.x, 기존 관광 데이터 변경 없음.
-- mysql -u <user> -p <database> < database/mysql/006_member_auth.sql
CREATE TABLE IF NOT EXISTS oligo_members (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(12) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(254) NOT NULL,
    name VARCHAR(100) NULL,
    phone VARCHAR(30) NULL,
    region_code CHAR(5) NOT NULL,
    hint_question VARCHAR(100) NOT NULL,
    hint_answer_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_oligo_members_username (username),
    UNIQUE KEY uq_oligo_members_email (email),
    KEY ix_oligo_members_region_code (region_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oligo_member_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_oligo_sessions_token_hash (token_hash),
    KEY ix_oligo_sessions_member_id (member_id),
    KEY ix_oligo_sessions_expires_at (expires_at),
    CONSTRAINT fk_oligo_sessions_member FOREIGN KEY (member_id)
        REFERENCES oligo_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

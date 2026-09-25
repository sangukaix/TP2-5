-- Oligo World member-owned progress. Apply after 006_member_auth.sql on MySQL 8.x.
-- Existing tourism and member rows are not changed. Review an existing same-name table before applying.
CREATE TABLE IF NOT EXISTS oligo_game_profiles (
    member_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    profile_status VARCHAR(6) NOT NULL DEFAULT 'DRAFT',
    character_id VARCHAR(8) NULL,
    game_nickname VARCHAR(16) NULL,
    active_nickname VARCHAR(16) GENERATED ALWAYS AS
        (CASE WHEN profile_status = 'ACTIVE' THEN game_nickname ELSE NULL END) STORED,
    region_code CHAR(5) NULL,
    travel_style VARCHAR(20) NULL,
    level INT UNSIGNED NOT NULL DEFAULT 1,
    exp INT UNSIGNED NOT NULL DEFAULT 0,
    currency_w INT UNSIGNED NOT NULL DEFAULT 0,
    current_map_id VARCHAR(16) NOT NULL DEFAULT 'map001',
    position_x SMALLINT UNSIGNED NOT NULL DEFAULT 5,
    position_y SMALLINT UNSIGNED NOT NULL DEFAULT 3,
    tutorial_stage VARCHAR(20) NOT NULL DEFAULT 'greeting',
    tutorial_valid_moves TINYINT UNSIGNED NOT NULL DEFAULT 0,
    tutorial_reward_granted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_oligo_game_nickname (active_nickname),
    KEY ix_oligo_game_region (region_code),
    CONSTRAINT fk_oligo_game_member FOREIGN KEY (member_id)
        REFERENCES oligo_members(id) ON DELETE CASCADE,
    CONSTRAINT ck_oligo_game_status CHECK (profile_status IN ('DRAFT', 'ACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

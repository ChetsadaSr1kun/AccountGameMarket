CREATE TABLE IF NOT EXISTS games (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(500) NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_games_name (name),
  UNIQUE KEY uq_games_slug (slug),
  KEY idx_games_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_attributes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  type ENUM('TEXT', 'NUMBER', 'SELECT', 'BOOLEAN') NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_filterable BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_game_attributes_game_slug (game_id, slug),
  KEY idx_game_attributes_game_status (game_id, status, sort_order),
  CONSTRAINT fk_game_attributes_game FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_attribute_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_attribute_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(100) NOT NULL,
  value VARCHAR(100) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_game_attribute_options_value (game_attribute_id, value),
  KEY idx_game_attribute_options_attribute (game_attribute_id, status, sort_order),
  CONSTRAINT fk_game_attribute_options_attribute FOREIGN KEY (game_attribute_id) REFERENCES game_attributes (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id BIGINT UNSIGNED NOT NULL,
  game_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  status ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'SOLD', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_products_game_status (game_id, status),
  KEY idx_products_seller_status (seller_id, status),
  KEY idx_products_status_price (status, price),
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_products_game FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE RESTRICT,
  CONSTRAINT chk_products_price_nonnegative CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_product_images_product_order (product_id, sort_order),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_attribute_values (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  game_attribute_id BIGINT UNSIGNED NOT NULL,
  game_attribute_option_id BIGINT UNSIGNED NULL,
  value_text VARCHAR(1000) NULL,
  value_number DECIMAL(14,2) NULL,
  value_boolean BOOLEAN NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_attribute_values_product_attribute (product_id, game_attribute_id),
  KEY idx_product_attribute_values_attribute_number (game_attribute_id, value_number),
  KEY idx_product_attribute_values_attribute_option (game_attribute_id, game_attribute_option_id),
  CONSTRAINT fk_product_attribute_values_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_attribute_values_attribute FOREIGN KEY (game_attribute_id) REFERENCES game_attributes (id) ON DELETE RESTRICT,
  CONSTRAINT fk_product_attribute_values_option FOREIGN KEY (game_attribute_option_id) REFERENCES game_attribute_options (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_credentials (
  product_id BIGINT UNSIGNED NOT NULL,
  game_username_encrypted TEXT NULL,
  game_password_encrypted TEXT NULL,
  email_encrypted TEXT NULL,
  email_password_encrypted TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (product_id),
  CONSTRAINT fk_product_credentials_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO games (name, slug, status) VALUES
  ('Valorant', 'valorant', 'ACTIVE'),
  ('ROV', 'rov', 'ACTIVE'),
  ('PUBG', 'pubg', 'ACTIVE'),
  ('Free Fire', 'free-fire', 'ACTIVE'),
  ('Genshin Impact', 'genshin-impact', 'ACTIVE'),
  ('Honkai: Star Rail', 'honkai-star-rail', 'ACTIVE')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  status = VALUES(status);

INSERT INTO game_attributes (game_id, name, slug, type, is_required, is_filterable, sort_order)
SELECT id, 'Rank', 'rank', 'SELECT', TRUE, TRUE, 1 FROM games WHERE slug = 'valorant'
UNION ALL SELECT id, 'Account Level', 'account-level', 'NUMBER', TRUE, TRUE, 2 FROM games WHERE slug = 'valorant'
UNION ALL SELECT id, 'Region', 'region', 'SELECT', TRUE, TRUE, 3 FROM games WHERE slug = 'valorant'
UNION ALL SELECT id, 'Skin Count', 'skin-count', 'NUMBER', TRUE, TRUE, 4 FROM games WHERE slug = 'valorant'
UNION ALL SELECT id, 'Agent Count', 'agent-count', 'NUMBER', FALSE, TRUE, 5 FROM games WHERE slug = 'valorant'
UNION ALL SELECT id, 'Battle Pass', 'battle-pass', 'SELECT', FALSE, TRUE, 6 FROM games WHERE slug = 'valorant'
UNION ALL SELECT id, 'Rank', 'rank', 'SELECT', TRUE, TRUE, 1 FROM games WHERE slug = 'rov'
UNION ALL SELECT id, 'Hero Count', 'hero-count', 'NUMBER', TRUE, TRUE, 2 FROM games WHERE slug = 'rov'
UNION ALL SELECT id, 'Skin Count', 'skin-count', 'NUMBER', TRUE, TRUE, 3 FROM games WHERE slug = 'rov'
UNION ALL SELECT id, 'Server', 'server', 'SELECT', TRUE, TRUE, 4 FROM games WHERE slug = 'rov'
UNION ALL SELECT id, 'Account Level', 'account-level', 'NUMBER', FALSE, TRUE, 5 FROM games WHERE slug = 'rov'
UNION ALL SELECT id, 'Arcana Level', 'arcana-level', 'NUMBER', FALSE, TRUE, 6 FROM games WHERE slug = 'rov'
UNION ALL SELECT id, 'Rank', 'rank', 'SELECT', TRUE, TRUE, 1 FROM games WHERE slug = 'pubg'
UNION ALL SELECT id, 'Account Level', 'account-level', 'NUMBER', TRUE, TRUE, 2 FROM games WHERE slug = 'pubg'
UNION ALL SELECT id, 'Region', 'region', 'SELECT', TRUE, TRUE, 3 FROM games WHERE slug = 'pubg'
UNION ALL SELECT id, 'Skin Count', 'skin-count', 'NUMBER', TRUE, TRUE, 4 FROM games WHERE slug = 'pubg'
UNION ALL SELECT id, 'Weapon Skin Count', 'weapon-skin-count', 'NUMBER', FALSE, TRUE, 5 FROM games WHERE slug = 'pubg'
UNION ALL SELECT id, 'Outfit Count', 'outfit-count', 'NUMBER', FALSE, TRUE, 6 FROM games WHERE slug = 'pubg'
UNION ALL SELECT id, 'Rank', 'rank', 'SELECT', TRUE, TRUE, 1 FROM games WHERE slug = 'free-fire'
UNION ALL SELECT id, 'Account Level', 'account-level', 'NUMBER', TRUE, TRUE, 2 FROM games WHERE slug = 'free-fire'
UNION ALL SELECT id, 'Region', 'region', 'SELECT', TRUE, TRUE, 3 FROM games WHERE slug = 'free-fire'
UNION ALL SELECT id, 'Skin Count', 'skin-count', 'NUMBER', TRUE, TRUE, 4 FROM games WHERE slug = 'free-fire'
UNION ALL SELECT id, 'Character Count', 'character-count', 'NUMBER', FALSE, TRUE, 5 FROM games WHERE slug = 'free-fire'
UNION ALL SELECT id, 'Weapon Skin Count', 'weapon-skin-count', 'NUMBER', FALSE, TRUE, 6 FROM games WHERE slug = 'free-fire';

INSERT INTO game_attributes (game_id, name, slug, type, is_required, is_filterable, sort_order)
SELECT id, 'Adventure Rank', 'adventure-rank', 'NUMBER', TRUE, TRUE, 1 FROM games WHERE slug = 'genshin-impact'
UNION ALL SELECT id, 'Server', 'server', 'SELECT', TRUE, TRUE, 2 FROM games WHERE slug = 'genshin-impact'
UNION ALL SELECT id, '5-Star Character Count', 'five-star-character-count', 'NUMBER', TRUE, TRUE, 3 FROM games WHERE slug = 'genshin-impact'
UNION ALL SELECT id, '5-Star Weapon Count', 'five-star-weapon-count', 'NUMBER', FALSE, TRUE, 4 FROM games WHERE slug = 'genshin-impact'
UNION ALL SELECT id, 'Character Count', 'character-count', 'NUMBER', FALSE, TRUE, 5 FROM games WHERE slug = 'genshin-impact'
UNION ALL SELECT id, 'Primogem Count', 'primogem-count', 'NUMBER', FALSE, FALSE, 6 FROM games WHERE slug = 'genshin-impact'
UNION ALL SELECT id, 'Spiral Abyss Progress', 'spiral-abyss-progress', 'SELECT', FALSE, TRUE, 7 FROM games WHERE slug = 'genshin-impact'
UNION ALL SELECT id, 'Trailblaze Level', 'trailblaze-level', 'NUMBER', TRUE, TRUE, 1 FROM games WHERE slug = 'honkai-star-rail'
UNION ALL SELECT id, 'Server', 'server', 'SELECT', TRUE, TRUE, 2 FROM games WHERE slug = 'honkai-star-rail'
UNION ALL SELECT id, '5-Star Character Count', 'five-star-character-count', 'NUMBER', TRUE, TRUE, 3 FROM games WHERE slug = 'honkai-star-rail'
UNION ALL SELECT id, '5-Star Light Cone Count', 'five-star-light-cone-count', 'NUMBER', FALSE, TRUE, 4 FROM games WHERE slug = 'honkai-star-rail'
UNION ALL SELECT id, 'Character Count', 'character-count', 'NUMBER', FALSE, TRUE, 5 FROM games WHERE slug = 'honkai-star-rail'
UNION ALL SELECT id, 'Stellar Jade Count', 'stellar-jade-count', 'NUMBER', FALSE, FALSE, 6 FROM games WHERE slug = 'honkai-star-rail'
UNION ALL SELECT id, 'Memory of Chaos Progress', 'memory-of-chaos-progress', 'SELECT', FALSE, TRUE, 7 FROM games WHERE slug = 'honkai-star-rail';

INSERT INTO game_attribute_options (game_attribute_id, label, value, sort_order)
SELECT id, 'Iron', 'iron', 1 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Bronze', 'bronze', 2 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Silver', 'silver', 3 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Gold', 'gold', 4 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Platinum', 'platinum', 5 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Diamond', 'diamond', 6 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Ascendant', 'ascendant', 7 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Immortal', 'immortal', 8 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Radiant', 'radiant', 9 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Asia', 'asia', 1 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'NA', 'na', 2 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'EU', 'eu', 3 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'OCE', 'oce', 4 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Other', 'other', 5 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Owned', 'owned', 1 FROM game_attributes WHERE slug = 'battle-pass' AND game_id = (SELECT id FROM games WHERE slug = 'valorant')
UNION ALL SELECT id, 'Not Owned', 'not-owned', 2 FROM game_attributes WHERE slug = 'battle-pass' AND game_id = (SELECT id FROM games WHERE slug = 'valorant');

INSERT INTO game_attribute_options (game_attribute_id, label, value, sort_order)
SELECT id, 'Bronze', 'bronze', 1 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Silver', 'silver', 2 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Gold', 'gold', 3 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Platinum', 'platinum', 4 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Diamond', 'diamond', 5 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Conqueror', 'conqueror', 6 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Supreme Conqueror', 'supreme-conqueror', 7 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Glorious Ruler', 'glorious-ruler', 8 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Thailand', 'thailand', 1 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Indonesia', 'indonesia', 2 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Vietnam', 'vietnam', 3 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Taiwan', 'taiwan', 4 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Other', 'other', 5 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'rov')
UNION ALL SELECT id, 'Bronze', 'bronze', 1 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Silver', 'silver', 2 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Gold', 'gold', 3 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Platinum', 'platinum', 4 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Diamond', 'diamond', 5 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Crown', 'crown', 6 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Ace', 'ace', 7 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Master', 'master', 8 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Grandmaster', 'grandmaster', 9 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Conqueror', 'conqueror', 10 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'pubg');

INSERT INTO game_attribute_options (game_attribute_id, label, value, sort_order)
SELECT id, 'Asia', 'asia', 1 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'NA', 'na', 2 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'EU', 'eu', 3 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'OCE', 'oce', 4 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Other', 'other', 5 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'pubg')
UNION ALL SELECT id, 'Bronze', 'bronze', 1 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire')
UNION ALL SELECT id, 'Silver', 'silver', 2 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire')
UNION ALL SELECT id, 'Gold', 'gold', 3 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire')
UNION ALL SELECT id, 'Platinum', 'platinum', 4 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire')
UNION ALL SELECT id, 'Diamond', 'diamond', 5 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire')
UNION ALL SELECT id, 'Heroic', 'heroic', 6 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire')
UNION ALL SELECT id, 'Grandmaster', 'grandmaster', 7 FROM game_attributes WHERE slug = 'rank' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire')
UNION ALL SELECT id, 'Asia', 'asia', 1 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire')
UNION ALL SELECT id, 'NA', 'na', 2 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire')
UNION ALL SELECT id, 'EU', 'eu', 3 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire')
UNION ALL SELECT id, 'Other', 'other', 4 FROM game_attributes WHERE slug = 'region' AND game_id = (SELECT id FROM games WHERE slug = 'free-fire');

INSERT INTO game_attribute_options (game_attribute_id, label, value, sort_order)
SELECT id, 'Asia', 'asia', 1 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'genshin-impact')
UNION ALL SELECT id, 'America', 'america', 2 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'genshin-impact')
UNION ALL SELECT id, 'Europe', 'europe', 3 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'genshin-impact')
UNION ALL SELECT id, 'TW/HK/MO', 'tw-hk-mo', 4 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'genshin-impact')
UNION ALL SELECT id, 'Not Cleared', 'not-cleared', 1 FROM game_attributes WHERE slug = 'spiral-abyss-progress' AND game_id = (SELECT id FROM games WHERE slug = 'genshin-impact')
UNION ALL SELECT id, 'Partially Cleared', 'partially-cleared', 2 FROM game_attributes WHERE slug = 'spiral-abyss-progress' AND game_id = (SELECT id FROM games WHERE slug = 'genshin-impact')
UNION ALL SELECT id, 'Fully Cleared', 'fully-cleared', 3 FROM game_attributes WHERE slug = 'spiral-abyss-progress' AND game_id = (SELECT id FROM games WHERE slug = 'genshin-impact');

INSERT INTO game_attribute_options (game_attribute_id, label, value, sort_order)
SELECT id, 'Asia', 'asia', 1 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'honkai-star-rail')
UNION ALL SELECT id, 'America', 'america', 2 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'honkai-star-rail')
UNION ALL SELECT id, 'Europe', 'europe', 3 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'honkai-star-rail')
UNION ALL SELECT id, 'TW/HK/MO', 'tw-hk-mo', 4 FROM game_attributes WHERE slug = 'server' AND game_id = (SELECT id FROM games WHERE slug = 'honkai-star-rail')
UNION ALL SELECT id, 'Not Cleared', 'not-cleared', 1 FROM game_attributes WHERE slug = 'memory-of-chaos-progress' AND game_id = (SELECT id FROM games WHERE slug = 'honkai-star-rail')
UNION ALL SELECT id, 'Partially Cleared', 'partially-cleared', 2 FROM game_attributes WHERE slug = 'memory-of-chaos-progress' AND game_id = (SELECT id FROM games WHERE slug = 'honkai-star-rail')
UNION ALL SELECT id, 'Fully Cleared', 'fully-cleared', 3 FROM game_attributes WHERE slug = 'memory-of-chaos-progress' AND game_id = (SELECT id FROM games WHERE slug = 'honkai-star-rail');

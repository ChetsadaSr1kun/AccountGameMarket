CREATE TABLE IF NOT EXISTS product_valorant_verifications (
  product_id BIGINT UNSIGNED NOT NULL,

  riot_game_name VARCHAR(100) NOT NULL,
  riot_tag_line VARCHAR(20) NOT NULL,
  riot_puuid VARCHAR(100) NOT NULL,

  verified_at DATETIME(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3),

  last_checked_at DATETIME(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3),

  created_at DATETIME(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3),

  updated_at DATETIME(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (product_id),

  UNIQUE KEY uq_product_valorant_verifications_puuid (
    riot_puuid
  ),

  CONSTRAINT fk_product_valorant_verifications_product
    FOREIGN KEY (product_id)
    REFERENCES products (id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
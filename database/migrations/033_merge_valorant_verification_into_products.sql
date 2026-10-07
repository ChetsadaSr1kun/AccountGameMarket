ALTER TABLE products
  ADD COLUMN valorant_riot_game_name VARCHAR(100) NULL,
  ADD COLUMN valorant_riot_tag_line VARCHAR(20) NULL,
  ADD COLUMN valorant_riot_puuid VARCHAR(100) NULL,
  ADD COLUMN valorant_verified_at DATETIME(3) NULL,
  ADD COLUMN valorant_last_checked_at DATETIME(3) NULL,
  ADD COLUMN valorant_verification_created_at DATETIME(3) NULL,
  ADD COLUMN valorant_verification_updated_at DATETIME(3) NULL,
  ADD UNIQUE KEY uq_products_valorant_riot_puuid (
    valorant_riot_puuid
  );

UPDATE products p
INNER JOIN product_valorant_verifications vv
  ON vv.product_id = p.id
SET
  p.valorant_riot_game_name =
    vv.riot_game_name,

  p.valorant_riot_tag_line =
    vv.riot_tag_line,

  p.valorant_riot_puuid =
    vv.riot_puuid,

  p.valorant_verified_at =
    vv.verified_at,

  p.valorant_last_checked_at =
    vv.last_checked_at,

  p.valorant_verification_created_at =
    vv.created_at,

  p.valorant_verification_updated_at =
    vv.updated_at;
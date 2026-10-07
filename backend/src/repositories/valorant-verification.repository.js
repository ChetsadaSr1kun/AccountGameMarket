const { pool } =
  require('../config/database');


function mapVerification(row) {
  if (!row) return null;

  return {
    productId:
      Number(row.product_id),

    gameName:
      row.riot_game_name,

    tagLine:
      row.riot_tag_line,

    puuid:
      row.riot_puuid,

    verifiedAt:
      row.verified_at,

    lastCheckedAt:
      row.last_checked_at,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


async function findByProductId(
  productId,
  executor = pool
) {
  const [rows] =
    await executor.execute(
      `
      SELECT
        id AS product_id,

        valorant_riot_game_name
          AS riot_game_name,

        valorant_riot_tag_line
          AS riot_tag_line,

        valorant_riot_puuid
          AS riot_puuid,

        valorant_verified_at
          AS verified_at,

        valorant_last_checked_at
          AS last_checked_at,

        valorant_verification_created_at
          AS created_at,

        valorant_verification_updated_at
          AS updated_at

      FROM products

      WHERE id = ?
        AND valorant_riot_puuid IS NOT NULL

      LIMIT 1
      `,
      [productId]
    );

  return mapVerification(
    rows[0]
  );
}


async function findByPuuid(
  puuid,
  executor = pool
) {
  const [rows] =
    await executor.execute(
      `
      SELECT
        id AS product_id,

        valorant_riot_game_name
          AS riot_game_name,

        valorant_riot_tag_line
          AS riot_tag_line,

        valorant_riot_puuid
          AS riot_puuid,

        valorant_verified_at
          AS verified_at,

        valorant_last_checked_at
          AS last_checked_at,

        valorant_verification_created_at
          AS created_at,

        valorant_verification_updated_at
          AS updated_at

      FROM products

      WHERE valorant_riot_puuid = ?

      LIMIT 1
      `,
      [puuid]
    );

  return mapVerification(
    rows[0]
  );
}


async function saveVerified(
  productId,
  data,
  executor = pool
) {
  const existing =
    await findByProductId(
      productId,
      executor
    );

  if (existing) {
    await executor.execute(
      `
      UPDATE products
      SET
        valorant_riot_game_name = ?,
        valorant_riot_tag_line = ?,
        valorant_riot_puuid = ?,

        valorant_last_checked_at =
          UTC_TIMESTAMP(3),

        valorant_verification_updated_at =
          UTC_TIMESTAMP(3),

        updated_at = updated_at

      WHERE id = ?
      `,
      [
        data.gameName,
        data.tagLine,
        data.puuid,
        productId,
      ]
    );

    return findByProductId(
      productId,
      executor
    );
  }

  await executor.execute(
    `
    UPDATE products
    SET
      valorant_riot_game_name = ?,
      valorant_riot_tag_line = ?,
      valorant_riot_puuid = ?,

      valorant_verified_at =
        UTC_TIMESTAMP(3),

      valorant_last_checked_at =
        UTC_TIMESTAMP(3),

      valorant_verification_created_at =
        UTC_TIMESTAMP(3),

      valorant_verification_updated_at =
        UTC_TIMESTAMP(3),

      updated_at = updated_at

    WHERE id = ?
    `,
    [
      data.gameName,
      data.tagLine,
      data.puuid,
      productId,
    ]
  );

  return findByProductId(
    productId,
    executor
  );
}


async function deleteByProductId(
  productId,
  executor = pool
) {
  const [result] =
    await executor.execute(
      `
      UPDATE products
      SET
        valorant_riot_game_name = NULL,
        valorant_riot_tag_line = NULL,
        valorant_riot_puuid = NULL,
        valorant_verified_at = NULL,
        valorant_last_checked_at = NULL,
        valorant_verification_created_at = NULL,
        valorant_verification_updated_at = NULL,

        updated_at = updated_at

      WHERE id = ?
      `,
      [productId]
    );

  return (
    result.affectedRows > 0
  );
}


module.exports = {
  findByProductId,
  findByPuuid,
  saveVerified,
  deleteByProductId,
};
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
        product_id,
        riot_game_name,
        riot_tag_line,
        riot_puuid,
        verified_at,
        last_checked_at,
        created_at,
        updated_at
      FROM product_valorant_verifications
      WHERE product_id = ?
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
        product_id,
        riot_game_name,
        riot_tag_line,
        riot_puuid,
        verified_at,
        last_checked_at,
        created_at,
        updated_at
      FROM product_valorant_verifications
      WHERE riot_puuid = ?
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
      UPDATE product_valorant_verifications
      SET
        riot_game_name = ?,
        riot_tag_line = ?,
        riot_puuid = ?,
        last_checked_at =
          UTC_TIMESTAMP(3)
      WHERE product_id = ?
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
    INSERT INTO product_valorant_verifications (
      product_id,
      riot_game_name,
      riot_tag_line,
      riot_puuid,
      verified_at,
      last_checked_at
    )
    VALUES (
      ?,
      ?,
      ?,
      ?,
      UTC_TIMESTAMP(3),
      UTC_TIMESTAMP(3)
    )
    `,
    [
      productId,
      data.gameName,
      data.tagLine,
      data.puuid,
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
      DELETE
      FROM product_valorant_verifications
      WHERE product_id = ?
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
const { pool } = require('../config/database');

function mapGame(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, slug: row.slug, description: row.description, imageUrl: row.image_url, status: row.status };
}

function mapAttribute(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    required: Boolean(row.is_required),
    filterable: Boolean(row.is_filterable),
    options: [],
  };
}

async function listActive() {
  const [rows] = await pool.execute("SELECT id, name, slug, description, image_url, status FROM games WHERE status = 'ACTIVE' ORDER BY name");
  return rows.map(mapGame);
}

async function findActiveById(id) {
  const [rows] = await pool.execute("SELECT id, name, slug, description, image_url, status FROM games WHERE id = ? AND status = 'ACTIVE' LIMIT 1", [id]);
  return mapGame(rows[0]);
}

async function listActiveAttributes(gameId) {
  const [rows] = await pool.execute(
    `SELECT ga.id, ga.name, ga.slug, ga.type, ga.is_required, ga.is_filterable,
            gao.id AS option_id, gao.label AS option_label, gao.value AS option_value,
            gao.sort_order AS option_sort_order
     FROM game_attributes ga
     LEFT JOIN game_attribute_options gao
       ON gao.game_attribute_id = ga.id AND gao.status = 'ACTIVE'
     WHERE ga.game_id = ? AND ga.status = 'ACTIVE'
     ORDER BY ga.sort_order, ga.id, gao.sort_order, gao.id`,
    [gameId],
  );

  const attributes = new Map();
  for (const row of rows) {
    if (!attributes.has(row.id)) attributes.set(row.id, mapAttribute(row));
    if (row.option_id !== null) {
      attributes.get(row.id).options.push({
        id: row.option_id,
        label: row.option_label,
        value: row.option_value,
        sortOrder: row.option_sort_order,
      });
    }
  }
  return [...attributes.values()];
}

module.exports = { listActive, findActiveById, listActiveAttributes };

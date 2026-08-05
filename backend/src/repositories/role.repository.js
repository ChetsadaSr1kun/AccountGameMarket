async function findIdsByCodes(executor, codes) {
  const placeholders = codes.map(() => '?').join(', ');
  const [rows] = await executor.execute(`SELECT id, code FROM roles WHERE code IN (${placeholders})`, codes);
  const byCode = new Map(rows.map((row) => [row.code, row.id]));
  return codes.map((code) => byCode.get(code));
}

module.exports = { findIdsByCodes };

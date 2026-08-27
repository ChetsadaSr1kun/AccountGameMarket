const repository = require('../repositories/public-product-list.repository');

async function listPublicProducts(query) {
  const filters = {
    gameId: query.gameId ? Number(query.gameId) : null,
    search: String(query.search || '').trim(),
    minPrice: query.minPrice !== undefined ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice !== undefined ? Number(query.maxPrice) : undefined,
    sort: query.sort || 'newest',
    page: query.page || 1,
    pageSize: query.pageSize || 12,
  };
  return repository.listPublic(filters);
}

module.exports = { listPublicProducts };

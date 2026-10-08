function rolesFromAccountMode(mode) {
  switch (mode) {
    case 'ADMIN': return ['ADMIN'];
    case 'UNIFIED': return ['CUSTOMER', 'SELLER'];
    case 'SELLER_ONLY': return ['SELLER'];
    case 'CUSTOMER_ONLY': return ['CUSTOMER'];
    default: return []; // Corrupt/unknown modes must never grant permissions.
  }
}

module.exports = { rolesFromAccountMode };

function listingEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function listingCard(product) {
  const image = product.primaryImageUrl ? `<img src="${listingEscape(product.primaryImageUrl)}" style="width:100%;height:180px;object-fit:cover;border-radius:10px;margin-bottom:12px"/>` : `<div class="game-img" style="height:180px;margin-bottom:12px;display:flex;align-items:center;justify-content:center">🎮</div>`;
  return `<div class="card card-hover" onclick="openProductDetail(${Number(product.id)})" style="cursor:pointer">
    ${image}<span class="badge badge-gray" style="margin-bottom:8px">${listingEscape(product.game?.name || '-')}</span>
    <div style="font-weight:600;font-size:14px;margin-bottom:4px">${listingEscape(product.title)}</div>
    <div style="color:var(--muted);font-size:12px;margin-bottom:10px">ผู้ขาย: <button type="button" class="seller-name-link" onclick="event.stopPropagation();openSellerProfile(${Number(product.seller?.id || 0)})">${listingEscape(product.seller?.username || '-')}</button></div>
    <div class="flex-between"><span class="kanit" style="font-size:18px;font-weight:800;color:var(--accent)">${Number(product.price || 0).toLocaleString('th-TH')} ฿</span><span style="font-size:12px;color:var(--muted)">ดูรายละเอียด →</span></div>
  </div>`;
}

async function loadPublicListings(options = {}) {
  const target = document.getElementById(options.targetId || 'public-listings-grid');
  const count = document.getElementById(options.countId || 'public-listings-count');
  if (!target) return;
  target.innerHTML = '<div class="card" style="padding:28px;text-align:center;color:var(--muted);grid-column:1/-1">กำลังโหลดรายการสินค้า...</div>';
  try {
    const query = new URLSearchParams();
    if (options.search) query.set('search', options.search);
    if (options.sort) query.set('sort', options.sort);
    const response = await fetch(`/api/v1/products?${query.toString()}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'โหลดรายการสินค้าไม่สำเร็จ');
    const data = body.data || body;
    if (count) count.textContent = `พบ ${data.total || 0} รายการ`;
    target.innerHTML = data.items?.length ? data.items.map(listingCard).join('') : '<div class="card" style="padding:28px;text-align:center;color:var(--muted);grid-column:1/-1">ยังไม่มีสินค้าที่เปิดขาย</div>';
  } catch (error) {
    console.error('loadPublicListings failed:', error);
    target.innerHTML = `<div class="notice danger" style="grid-column:1/-1">${listingEscape(error.message || 'โหลดรายการสินค้าไม่สำเร็จ')}</div>`;
  }
}

window.loadPublicListings = loadPublicListings;

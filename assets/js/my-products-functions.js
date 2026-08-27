async function loadMyProducts() {
  const list = document.getElementById('my-products-list');
  if (!list) return;
  list.innerHTML = '<div class="card" style="padding:28px;text-align:center;color:var(--muted)">กำลังโหลดประกาศ...</div>';
  try {
    const response = await fetch('/api/v1/user/products', { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'โหลดประกาศไม่สำเร็จ');
    renderMyProducts(data.data || data.products || data || []);
  } catch (error) {
    console.error('loadMyProducts failed:', error);
    list.innerHTML = `<div class="notice danger">${escapeHtml(error.message || 'โหลดประกาศไม่สำเร็จ')}</div>`;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
}

function renderMyProducts(products) {
  const list = document.getElementById('my-products-list');
  if (!list) return;
  if (!Array.isArray(products) || products.length === 0) {
    list.innerHTML = '<div class="card" style="padding:32px;text-align:center;color:var(--muted)">ยังไม่มีประกาศสินค้า</div>';
    return;
  }
  const sellableProducts = products.filter((product) => String(product.status || '').toUpperCase() !== 'SOLD');
  if (!sellableProducts.length) {
    list.innerHTML = '<div class="card" style="padding:32px;text-align:center;color:var(--muted)">ยังไม่มีประกาศสินค้าที่เปิดขาย</div>';
    return;
  }
  list.innerHTML = sellableProducts.map((product) => productCardHtml(product)).join('');
}

function productCardHtml(product) {
  const id = Number(product.id);
  const title = escapeHtml(product.title || product.name || 'ประกาศสินค้า');
  const game = escapeHtml(product.game_name || product.game?.name || '-');
  const price = Number(product.price || 0).toLocaleString('th-TH');
  const status = String(product.status || 'DRAFT').toUpperCase();
  const statusLabel = status === 'DRAFT' ? 'ฉบับร่าง' : status === 'ACTIVE' ? 'เปิดขาย' : status === 'PAUSED' ? 'พักขาย' : status;
  const publishButton = status === 'DRAFT'
    ? `<button class="btn btn-primary btn-sm" onclick="publishMyProduct(${id})">🚀 เผยแพร่</button>`
    : '';
  return `<div class="card" style="margin-bottom:12px;padding:18px 22px"><div class="flex-between"><div><div style="font-weight:700">${title}</div><div style="color:var(--muted);font-size:13px;margin-top:4px">${game} · ${escapeHtml(statusLabel)}</div><div class="kanit" style="font-size:20px;font-weight:800;color:var(--accent);margin-top:8px">${price} บาท</div></div><div class="flex gap-8">${publishButton}<button class="btn btn-secondary btn-sm" onclick="openMyProductEditor(${id})">แก้ไข</button><button class="btn btn-danger btn-sm" onclick="deleteMyProduct(${id})">ลบ</button></div></div></div>`;
}

async function publishMyProduct(id) {
  if (!window.confirm('ต้องการเผยแพร่ประกาศนี้ให้ผู้ซื้อเห็นหรือไม่?')) return;
  const activeCsrfToken = csrfToken || getCookieValue('gm_csrf');
  if (!activeCsrfToken) {
    alert('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่');
    return;
  }
  try {
    const response = await fetch(`/api/v1/user/products/${Number(id)}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': activeCsrfToken },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || 'เผยแพร่ประกาศไม่สำเร็จ');
    await loadMyProducts();
    alert('เผยแพร่ประกาศเรียบร้อยแล้ว ผู้ซื้อสามารถมองเห็นสินค้าได้แล้ว');
  } catch (error) {
    console.error('publishMyProduct failed:', error);
    alert(error.message || 'เผยแพร่ประกาศไม่สำเร็จ');
  }
}

async function openMyProductEditor(id) {
  try {
    const response = await fetch(`/api/v1/user/products/${id}`, { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || 'โหลดข้อมูลสินค้าไม่สำเร็จ');
    const product = data.data || data.product || data;
    window.editingProductId = Number(product.id || id);
    window.editingProductData = product;
    goPage('add-listing');
    await window.loadCreateProductGames?.();
    await window.populateCreateProductForEdit?.(product);
  } catch (error) {
    console.error('openMyProductEditor failed:', error);
    alert(error.message || 'ไม่สามารถเปิดหน้าแก้ไขสินค้าได้');
  }
}

async function deleteMyProduct(id) {
  if (!window.confirm('ต้องการลบประกาศนี้ใช่หรือไม่?')) return;
  try {
    const response = await fetch(`/api/v1/user/products/${id}`, { method: 'DELETE', credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || 'ลบสินค้าไม่สำเร็จ');
    await loadMyProducts();
  } catch (error) {
    console.error('deleteMyProduct failed:', error);
    alert(error.message || 'ลบสินค้าไม่สำเร็จ');
  }
}

window.publishMyProduct = publishMyProduct;

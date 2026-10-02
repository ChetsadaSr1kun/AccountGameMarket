// ===================== CREATE PRODUCT =====================
function setCreateProductFeedback(message, type = 'info') {
  const el = document.getElementById('create-product-feedback');
  if (!el) return;
  el.className = `notice ${type === 'error' ? 'warn' : 'info'}`;
  el.textContent = message;
  el.style.display = message ? 'block' : 'none';
}

async function loadCreateProductGames() {
  const select = document.getElementById('create-product-game');
  if (!select) return;
  select.innerHTML = '<option value="">กำลังโหลดเกม...</option>';
  try {
    const response = await fetch('/api/v1/games', { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'โหลดเกมไม่สำเร็จ');
    const games = Array.isArray(data.data) ? data.data : [];
    select.innerHTML = '<option value="">เลือกเกม</option>' + games.map((game) =>
      `<option value="${Number(game.id)}">${escapeHtml(game.name)}</option>`
    ).join('');
  } catch (error) {
    select.innerHTML = '<option value="">ไม่สามารถโหลดเกมได้</option>';
    setCreateProductFeedback(error.message || 'ไม่สามารถโหลดเกมได้', 'error');
  }
}

async function populateCreateProductForEdit(product) {
  const game = document.getElementById('create-product-game');
  const title = document.getElementById('create-product-title');
  const description = document.getElementById('create-product-description');
  const price = document.getElementById('create-product-price');
  const credentials = product.credentials || {};
  if (game) { game.value = String(product.gameId || product.game?.id || ''); game.disabled = true; }
  if (title) title.value = product.title || product.name || '';
  if (description) description.value = product.description || '';
  if (price) price.value = product.price ?? '';
  const credentialFields = { 'create-product-username': credentials.gameUsername, 'create-product-password': credentials.gamePassword, 'create-product-email': credentials.email, 'create-product-email-password': credentials.emailPassword };
  Object.entries(credentialFields).forEach(([id, value]) => { const input = document.getElementById(id); if (input) input.value = value || ''; });
  const heading = document.querySelector('#pg-add-listing .sec-title');
  const sub = document.querySelector('#pg-add-listing .sec-sub');
  const saveButton = document.getElementById('create-product-save-button');
  if (heading) heading.textContent = '✏️ แก้ไขประกาศขายบัญชีเกม';
  if (sub) sub.textContent = 'แก้ไขข้อมูลเดิมของประกาศนี้ แล้วบันทึกการเปลี่ยนแปลง';
  if (saveButton) saveButton.textContent = '💾 บันทึกการแก้ไข';
  await window.loadExistingProductImages?.(product.id);
}

function cancelCreateProductEditor() {
  window.editingProductId = null;
  window.editingProductData = null;
  resetCreateProductEditorMode();
  goPage('my-listings');
}

function resetCreateProductEditorMode() {
  if (window.editingProductId) return;
  const game = document.getElementById('create-product-game');
  if (game) game.disabled = false;
  ['create-product-title','create-product-description','create-product-price','create-product-username','create-product-password','create-product-email','create-product-email-password'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
  window.resetProductImages?.();
  const heading = document.querySelector('#pg-add-listing .sec-title');
  const sub = document.querySelector('#pg-add-listing .sec-sub');
  const saveButton = document.getElementById('create-product-save-button');
  if (heading) heading.textContent = '➕ เพิ่มประกาศขายบัญชีเกม';
  if (sub) sub.textContent = 'กรอกรายละเอียดสินค้าที่ต้องการขาย';
  if (saveButton) saveButton.textContent = '💾 บันทึก';
}

async function createProductFromForm(status = 'DRAFT') {
  const gameId = Number(document.getElementById('create-product-game')?.value);
  const title = document.getElementById('create-product-title')?.value.trim();
  const description = document.getElementById('create-product-description')?.value.trim();
  const price = Number(document.getElementById('create-product-price')?.value);
  if (!gameId || !title || !description || !Number.isFinite(price) || price < 0) {
    setCreateProductFeedback('กรุณาเลือกเกม กรอกชื่อประกาศ รายละเอียด และราคาที่ถูกต้อง', 'error');
    return;
  }
  const activeCsrfToken = csrfToken || getCookieValue('gm_csrf');
  if (!activeCsrfToken) {
    setCreateProductFeedback('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่', 'error');
    return;
  }
  const credentials = { gameUsername: document.getElementById('create-product-username')?.value.trim() || '', gamePassword: document.getElementById('create-product-password')?.value || '', email: document.getElementById('create-product-email')?.value.trim() || '', emailPassword: document.getElementById('create-product-email-password')?.value || '' };
  const hasCredentials = Object.values(credentials).some(Boolean);
  const payload = {
    gameId,
    title,
    description,
    price,
    status,
    ...(hasCredentials
      ? { credentials }
      : {})
  };
  const editingId = Number(window.editingProductId || 0);
  try {
    const isEditing = Number.isInteger(editingId) && editingId > 0;
    const response = await fetch(isEditing ? `/api/v1/user/products/${editingId}` : '/api/v1/user/products', {
      method: isEditing ? 'PATCH' : 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': activeCsrfToken },
      body: JSON.stringify(
        isEditing
          ? {
              title,
              description,
              price,
              status:
                window.editingProductData?.status ||
                status,

              ...(hasCredentials
                ? { credentials }
                : {})
            }
          : payload
      ),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || (isEditing ? 'แก้ไขสินค้าไม่สำเร็จ' : 'บันทึกสินค้าไม่สำเร็จ'));
    const productId = isEditing ? editingId : (data.data?.id || data.data?.product?.id);
    if (!productId) throw new Error('ไม่พบรหัสสินค้า');
    if (window.getSelectedProductImageCount?.()) {
      setCreateProductFeedback('กำลังอัปโหลดรูปภาพ...');
      await window.uploadProductImagesToProduct?.(productId);
      window.resetProductImages?.();
    }
    window.editingProductId = null;
    window.editingProductData = null;
    resetCreateProductEditorMode();
    setCreateProductFeedback(isEditing ? 'บันทึกการแก้ไขประกาศเรียบร้อยแล้ว' : 'บันทึกร่างสินค้าและรูปภาพเรียบร้อยแล้ว');
    setTimeout(() => goPage('my-listings'), 500);
  } catch (error) {
    console.error('createProductFromForm failed:', error);
    setCreateProductFeedback(error.message || 'บันทึกสินค้าไม่สำเร็จ', 'error');
  }
}

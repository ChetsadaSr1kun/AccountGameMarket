// ===================== PRODUCT IMAGE UI =====================
(function () {
  const MAX_IMAGES = 10;
  const MAX_BYTES = 5 * 1024 * 1024;
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const state = { files: [], existingImages: [], productId: null };

  function message(text, error = false) {
    const el = document.getElementById('product-image-feedback');
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? 'var(--danger)' : 'var(--muted)';
  }

  function render() {
    const grid = document.getElementById('product-image-preview-grid');
    const count = document.getElementById('product-image-count');
    const input = document.getElementById('product-image-input');
    if (!grid || !count) return;
    const total = state.existingImages.length + state.files.length;
    count.textContent = `${total}/${MAX_IMAGES} รูป`;
    const existingHtml = state.existingImages.map((item, index) => `
      <div class="product-image-preview" style="position:relative;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--card2);aspect-ratio:1">
        <img src="${item.imageUrl}" alt="รูปสินค้า ${index + 1}" style="width:100%;height:100%;object-fit:cover;display:block"/>
        ${item.isPrimary ? '<span class="badge badge-blue" style="position:absolute;left:6px;top:6px">รูปหลัก</span>' : ''}
        <button type="button" class="btn btn-danger btn-sm" style="position:absolute;right:6px;top:6px;padding:4px 8px" onclick="removeExistingProductImage(${Number(item.id)})">✕</button>
      </div>
    `).join('');
    const newHtml = state.files.map((item, index) => `
      <div class="product-image-preview" style="position:relative;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--card2);aspect-ratio:1">
        <img src="${item.previewUrl}" alt="รูปใหม่ ${index + 1}" style="width:100%;height:100%;object-fit:cover;display:block"/>
        ${total === state.files.length && index === 0 ? '<span class="badge badge-blue" style="position:absolute;left:6px;top:6px">รูปหลัก</span>' : ''}
        <button type="button" class="btn btn-danger btn-sm" style="position:absolute;right:6px;top:6px;padding:4px 8px" onclick="removeProductImage(${index})">✕</button>
      </div>
    `).join('');
    grid.innerHTML = existingHtml + newHtml;
    if (input) input.value = '';
  }

  window.selectProductImages = () => document.getElementById('product-image-input')?.click();

  window.handleProductImageSelection = (fileList) => {
    const files = Array.from(fileList || []);
    if (state.existingImages.length + state.files.length + files.length > MAX_IMAGES) {
      message(`เลือกรูปได้สูงสุด ${MAX_IMAGES} รูป`, true);
      return;
    }
    for (const file of files) {
      if (!allowedTypes.has(file.type)) {
        message('รูปต้องเป็น JPG, PNG หรือ WEBP เท่านั้น', true);
        return;
      }
      if (file.size > MAX_BYTES) {
        message(`รูป ${file.name} มีขนาดเกิน 5 MB`, true);
        return;
      }
    }
    for (const file of files) state.files.push({ file, previewUrl: URL.createObjectURL(file) });
    message('');
    render();
  };

  window.removeProductImage = (index) => {
    const item = state.files[index];
    if (item) URL.revokeObjectURL(item.previewUrl);
    state.files.splice(index, 1);
    message('');
    render();
  };

  window.resetProductImages = () => {
    state.files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    state.files = [];
    state.existingImages = [];
    state.productId = null;
    render();
    message('');
  };

  window.loadExistingProductImages = async (productId) => {
    state.files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    state.files = [];
    state.productId = Number(productId);
    const response = await fetch(`/api/v1/user/products/${state.productId}/images`, { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || 'โหลดรูปสินค้าไม่สำเร็จ');
    state.existingImages = Array.isArray(data.data) ? data.data : (data.data?.images || []);
    render();
  };

  window.removeExistingProductImage = async (imageId) => {
    if (!state.productId) return;
    const activeCsrfToken = window.csrfToken || document.cookie.match(/(?:^|; )gm_csrf=([^;]+)/)?.[1];
    if (!activeCsrfToken) return message('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่', true);
    const response = await fetch(`/api/v1/user/products/${state.productId}/images/${Number(imageId)}`, {
      method: 'DELETE', credentials: 'include', headers: { 'X-CSRF-Token': activeCsrfToken },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return message(data.error?.message || 'ลบรูปสินค้าไม่สำเร็จ', true);
    state.existingImages = state.existingImages.filter((item) => Number(item.id) !== Number(imageId));
    render();
  };

  window.getSelectedProductImageCount = () => state.files.length;

  window.uploadProductImagesToProduct = async (productId) => {
    if (!state.files.length) return [];
    const activeCsrfToken = window.csrfToken || document.cookie.match(/(?:^|; )gm_csrf=([^;]+)/)?.[1];
    if (!activeCsrfToken) throw new Error('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่');
    const form = new FormData();
    state.files.forEach((item) => form.append('images', item.file));
    const response = await fetch(`/api/v1/user/products/${Number(productId)}/images`, {
      method: 'POST', credentials: 'include',
      headers: { 'X-CSRF-Token': activeCsrfToken }, body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || 'อัปโหลดรูปสินค้าไม่สำเร็จ');
    return data.data?.images || [];
  };

  window.resetProductImages();
}());

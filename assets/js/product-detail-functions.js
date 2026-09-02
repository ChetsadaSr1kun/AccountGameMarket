function productDetailEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function formatProductAttribute(item) {
  if (item.optionLabel) return item.optionLabel;
  if (item.valueText !== null && item.valueText !== undefined) return item.valueText;
  if (item.valueNumber !== null && item.valueNumber !== undefined) return item.valueNumber;
  if (item.valueBoolean !== null && item.valueBoolean !== undefined) return item.valueBoolean ? 'ใช่' : 'ไม่ใช่';
  return '-';
}

async function openProductDetail(id) {
  const page = document.getElementById('pg-product-detail');
  const content = document.getElementById('product-detail-content');
  if (!page || !content) return;
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    console.error('openProductDetail received an invalid product ID:', id);
    document.querySelectorAll('.page').forEach((pageElement) => {
    pageElement.classList.remove('active');
    pageElement.style.setProperty('display', 'none', 'important');
  });
  page.classList.add('active');
  page.style.setProperty('display', 'block', 'important');
  page.style.setProperty('visibility', 'visible', 'important');
  page.style.setProperty('opacity', '1', 'important');
  if (typeof currentPage !== 'undefined') currentPage = 'product-detail';
  if (typeof updateNav === 'function') updateNav();
    content.innerHTML = '<div class="notice danger">ไม่พบรหัสสินค้าที่ถูกต้อง</div>';
    return;
  }
  window.currentProductDetailId = productId;
  document.querySelectorAll('.page').forEach((pageElement) => {
    pageElement.classList.remove('active');
    pageElement.style.setProperty('display', 'none', 'important');
  });
  page.classList.add('active');
  page.style.setProperty('display', 'block', 'important');
  page.style.setProperty('visibility', 'visible', 'important');
  page.style.setProperty('opacity', '1', 'important');
  if (typeof currentPage !== 'undefined') currentPage = 'product-detail';
  if (typeof updateNav === 'function') updateNav();
  content.innerHTML = '<div class="card" style="padding:32px;text-align:center;color:var(--muted)">กำลังโหลดรายละเอียดสินค้า...</div>';
  try {
    const response = await fetch(`/api/v1/products/${productId}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'โหลดรายละเอียดสินค้าไม่สำเร็จ');
    renderProductDetail(body.data || body);
  } catch (error) {
    console.error('openProductDetail failed:', error);
    content.innerHTML = `<div class="notice danger">${productDetailEscape(error.message || 'โหลดรายละเอียดสินค้าไม่สำเร็จ')}</div>`;
  }
}function renderProductDetail(product) {
  const content = document.getElementById('product-detail-content');
  if (!content) return;
  const images = Array.isArray(product.images) ? product.images : [];
  const mainImage = images[0]?.imageUrl || '';
  const thumbs = images.map((image, index) => `<button type="button" class="product-detail-thumb ${index === 0 ? 'is-active' : ''}" data-product-image="${productDetailEscape(image.imageUrl)}" aria-label="รูปที่ ${index + 1}"><img src="${productDetailEscape(image.imageUrl)}" alt="รูปสินค้า ${index + 1}"/></button>`).join('');
  const attributes = (product.attributes || []).map((item) => `<div class="product-detail-stat"><div class="product-detail-stat-label">${productDetailEscape(item.name)}</div><div class="product-detail-stat-value">${productDetailEscape(formatProductAttribute(item))}</div></div>`).join('');
  content.innerHTML = `
    <div class="product-detail-shell">
      <div class="product-detail-hero">
        <section class="product-detail-gallery">
          <div class="product-detail-main-media" id="product-detail-main-image">
            ${mainImage ? `<img src="${productDetailEscape(mainImage)}" alt="${productDetailEscape(product.title || 'สินค้า')}"/>` : '<div class="product-detail-empty-media">🖼️<span>ยังไม่มีรูปสินค้า</span></div>'}
          </div>
          <div class="product-detail-thumbs" id="product-detail-thumbs">${thumbs}</div>
        </section>

        <section class="product-detail-summary">
          <div class="product-detail-game">🎮 ${productDetailEscape(product.game?.name || '-')}</div>
          <h1 class="product-detail-title">${productDetailEscape(product.title || 'ประกาศสินค้า')}</h1>
          <div class="product-detail-seller"><span>ผู้ขาย</span><button type="button" class="product-detail-seller-link" onclick="openSellerProfile(${Number(product.seller?.id || product.sellerId || 0)})">${productDetailEscape(product.seller?.username || '-')}</button><span class="product-detail-seller-dot">•</span><span>พร้อมส่งมอบอัตโนมัติ</span></div>
          <div class="product-detail-price">${Number(product.price || 0).toLocaleString('th-TH')} <span>บาท</span></div>

          <div class="product-detail-action-card">
            <div class="product-detail-action-row"><span>สถานะสินค้า</span><strong class="product-detail-status"><span></span> กำลังเปิดขาย</strong></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button class="btn btn-primary btn-lg btn-full product-detail-buy" onclick="startProductPurchase(${Number(product.id)})">🛒 ซื้อสินค้า</button><button class="btn btn-secondary btn-lg btn-full" type="button" onclick="contactProductSeller(${Number(product.seller?.id || product.sellerId || 0)},${Number(product.id)})">💬 ติดต่อผู้ขาย</button></div>
            <div class="product-detail-safe-note">🔒 ข้อมูลบัญชีจะเปิดเผยหลังชำระเงินสำเร็จเท่านั้น</div>
          </div>
        </section>
      </div>

      <section class="product-detail-info-card">
        <div class="product-detail-section-title"><span>📋</span><div><h2>รายละเอียดสินค้า</h2><p>ข้อมูลเพิ่มเติมจากผู้ขาย</p></div></div>
        <div class="product-detail-description">${productDetailEscape(product.description || 'ผู้ขายยังไม่ได้เพิ่มรายละเอียดสินค้า')}</div>
      </section>

      ${attributes ? `<section class="product-detail-info-card"><div class="product-detail-section-title"><span>🎮</span><div><h2>รายละเอียดบัญชีเกม</h2><p>ข้อมูลสำคัญของบัญชี</p></div></div><div class="product-detail-stats">${attributes}</div></section>` : ''}

      <section class="product-detail-info-card" id="product-review-card">
        <div class="product-detail-section-title"><span>⭐</span><div><h2>รีวิวจากผู้ซื้อ</h2><p>ความคิดเห็นจากผู้ซื้อสินค้านี้</p></div></div>
        <div id="product-review-content"><div class="product-review-loading">กำลังโหลดรีวิว...</div></div>
      </section>
    </div>`;

  document.querySelectorAll('#product-detail-thumbs [data-product-image]').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const url = thumb.dataset.productImage;
      setProductDetailMainImage(url);
      document.querySelectorAll('#product-detail-thumbs .product-detail-thumb').forEach((el) => el.classList.remove('is-active'));
      thumb.classList.add('is-active');
    });
  });

  bindProductDetailMainImage();
  window.loadProductReviews?.(product.id);
}

window.renderProductDetail = renderProductDetail;

function ensureProductImageLightbox() {
  let lightbox = document.getElementById('product-image-lightbox');
  if (lightbox) return lightbox;
  lightbox = document.createElement('div');
  lightbox.id = 'product-image-lightbox';
  lightbox.className = 'product-image-lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.innerHTML = '<button type="button" class="product-image-lightbox-close" aria-label="ปิด">✕</button><button type="button" class="product-image-lightbox-prev" aria-label="รูปก่อนหน้า">‹</button><div class="product-image-lightbox-body"><img alt="รูปสินค้าแบบขยาย"/><div class="product-image-lightbox-thumbs" aria-label="เลือกรูปสินค้า"></div></div><button type="button" class="product-image-lightbox-next" aria-label="รูปถัดไป">›</button><div class="product-image-lightbox-count"></div><div class="product-image-lightbox-hint">คลิกพื้นหลังหรือกด Esc เพื่อปิด</div>';
  document.body.appendChild(lightbox);
  const close = () => lightbox.classList.remove('is-open');
  lightbox.querySelector('.product-image-lightbox-close')?.addEventListener('click', close);
  lightbox.querySelector('.product-image-lightbox-prev')?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!productLightboxImages.length) return;
    productLightboxIndex = (productLightboxIndex - 1 + productLightboxImages.length) % productLightboxImages.length;
    renderProductLightbox();
  });
  lightbox.querySelector('.product-image-lightbox-next')?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!productLightboxImages.length) return;
    productLightboxIndex = (productLightboxIndex + 1) % productLightboxImages.length;
    renderProductLightbox();
  });
  lightbox.addEventListener('click', (event) => { if (event.target === lightbox) close(); });
  document.addEventListener('keydown', (event) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft' && productLightboxImages.length > 1) {
      productLightboxIndex = (productLightboxIndex - 1 + productLightboxImages.length) % productLightboxImages.length;
      renderProductLightbox();
    }
    if (event.key === 'ArrowRight' && productLightboxImages.length > 1) {
      productLightboxIndex = (productLightboxIndex + 1) % productLightboxImages.length;
      renderProductLightbox();
    }
  });
  return lightbox;
}

let productLightboxImages = [];
let productLightboxIndex = 0;

function renderProductLightbox() {
  const lightbox = document.getElementById('product-image-lightbox');
  if (!lightbox || !productLightboxImages.length) return;
  const item = productLightboxImages[productLightboxIndex];
  const image = lightbox.querySelector('.product-image-lightbox-body > img');
  const thumbs = lightbox.querySelector('.product-image-lightbox-thumbs');
  const count = lightbox.querySelector('.product-image-lightbox-count');
  if (image) { image.src = item.url; image.alt = item.alt || 'รูปสินค้า'; }
  if (count) count.textContent = `${productLightboxIndex + 1} / ${productLightboxImages.length}`;
  if (thumbs) {
    thumbs.innerHTML = productLightboxImages.map((entry, index) => `<button type="button" class="product-image-lightbox-thumb ${index === productLightboxIndex ? 'is-active' : ''}" data-index="${index}" aria-label="รูปที่ ${index + 1}"><img src="${productDetailEscape(entry.url)}" alt=""/></button>`).join('');
    thumbs.querySelectorAll('.product-image-lightbox-thumb').forEach((thumb) => thumb.addEventListener('click', () => {
      productLightboxIndex = Number(thumb.dataset.index || 0);
      renderProductLightbox();
    }));
    thumbs.querySelector('.is-active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
  const showNav = productLightboxImages.length > 1;
  const prev = lightbox.querySelector('.product-image-lightbox-prev');
  const next = lightbox.querySelector('.product-image-lightbox-next');
  if (prev) prev.style.display = showNav ? 'flex' : 'none';
  if (next) next.style.display = showNav ? 'flex' : 'none';
}

function openProductImageLightbox(imageUrl, altText = 'รูปสินค้า') {
  if (!imageUrl) return;
  const lightbox = ensureProductImageLightbox();
  const thumbs = [...document.querySelectorAll('#product-detail-thumbs [data-product-image]')];
  productLightboxImages = thumbs.map((thumb) => ({ url: thumb.dataset.productImage, alt: thumb.querySelector('img')?.alt || 'รูปสินค้า' })).filter((item) => item.url);
  const canonicalImageUrl = (url) => {
    try { return new URL(url, window.location.origin).pathname; }
    catch { return String(url || ''); }
  };
  const currentPath = canonicalImageUrl(imageUrl);
  if (!productLightboxImages.some((item) => canonicalImageUrl(item.url) === currentPath)) {
    productLightboxImages.unshift({ url: imageUrl, alt: altText });
  }
  productLightboxIndex = Math.max(0, productLightboxImages.findIndex((item) => canonicalImageUrl(item.url) === currentPath));
  renderProductLightbox();
  lightbox.classList.add('is-open');
}

function setProductDetailMainImage(imageUrl) {
  const main = document.getElementById('product-detail-main-image');
  if (!main || !imageUrl) return;
  main.innerHTML = `<img src="${productDetailEscape(imageUrl)}" alt="รูปสินค้า"/>`;
  bindProductDetailMainImage();
}

function bindProductDetailMainImage() {
  const main = document.getElementById('product-detail-main-image');
  const image = main?.querySelector('img');
  if (!main || !image) return;
  main.onclick = () => openProductImageLightbox(image.currentSrc || image.src, image.alt || 'รูปสินค้า');
  main.onkeydown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openProductImageLightbox(image.currentSrc || image.src, image.alt || 'รูปสินค้า');
    }
  };
  main.tabIndex = 0;
  main.setAttribute('role', 'button');
  main.setAttribute('aria-label', 'คลิกเพื่อดูรูปสินค้าแบบขยาย');
}

function selectProductDetailImage(el) {
  if (!el?.src) return;
  setProductDetailMainImage(el.src);
}

function orderCsrfToken() {
  return typeof getCookieValue === 'function' ? getCookieValue('gm_csrf') : '';
}

async function contactProductSeller(sellerId, productId) {
  const sid=Number(sellerId),pid=Number(productId);
  if(!Number.isInteger(sid)||sid<=0||!Number.isInteger(pid)||pid<=0){alert('ไม่พบข้อมูลผู้ขาย');return;}
  if(typeof isLoggedIn!=='undefined'&&!isLoggedIn){goPage('login');return;}
  const csrf=orderCsrfToken();if(!csrf){alert('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่');return;}
  try{const response=await fetch('/api/v1/chat',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({otherUserId:sid,productId:pid})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error?.message||'ไม่สามารถเปิดแชทกับผู้ขายได้');goPage('chat');}catch(error){console.error('contactProductSeller failed:',error);alert(error.message||'ไม่สามารถเปิดแชทกับผู้ขายได้');}
}

async function startProductPurchase(id) {
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) return;
  const csrf = orderCsrfToken();
  if (!csrf) { alert('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่'); return; }

  const confirmed = window.confirm('ยืนยันการสั่งซื้อสินค้านี้หรือไม่?\nระบบจะสร้างรายการสั่งซื้อก่อนเข้าสู่ขั้นตอนชำระเงิน');
  if (!confirmed) return;

  try {
    const response = await fetch('/api/v1/orders', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ productId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'ไม่สามารถสร้างรายการสั่งซื้อได้');

    const order = body.data?.order || body.order;
    window.pendingOrderId = order?.id || null;
    if (!window.pendingOrderId) throw new Error('ไม่พบหมายเลขคำสั่งซื้อที่สร้าง');
    window.openOrderDetail?.(window.pendingOrderId);
  } catch (error) {
    console.error('startProductPurchase failed:', error);
    alert(error.message || 'ไม่สามารถสร้างรายการสั่งซื้อได้');
  }
}

async function openOrderDetail(id) {
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) return;
  const content = document.getElementById('order-detail-content');
  if (!content) return;
  window.pendingOrderId = orderId;
  goPage('order-detail');
  content.innerHTML = '<div class="card" style="padding:32px;text-align:center;color:var(--muted)">กำลังโหลดรายละเอียดคำสั่งซื้อ...</div>';
  try {
    const response = await fetch(`/api/v1/orders/${orderId}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'โหลดรายละเอียดคำสั่งซื้อไม่สำเร็จ');
    const order = body.data?.order || body.order;
    const amount = Number(order?.amount || 0).toLocaleString('th-TH');
    const createdAt = order?.createdAt ? new Date(order.createdAt).toLocaleString('th-TH') : '-';
    const statusText = order?.status === 'PENDING' ? 'PENDING' : order?.status === 'COMPLETED' ? 'COMPLETED' : productDetailEscape(order?.status || '-');
    content.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="goPage('listings-user')" style="margin-bottom:20px">← กลับไปหน้ารายการสินค้า</button>
      <div class="card" style="max-width:820px;margin:0 auto;padding:32px">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:28px;flex-wrap:wrap">
          <div><div class="badge badge-blue" style="margin-bottom:10px">คำสั่งซื้อ #${order.id}</div><h1 style="font-size:28px;margin:0 0 6px">🧾 รายละเอียดคำสั่งซื้อ</h1><p style="color:var(--muted);margin:0">ตรวจสอบข้อมูลก่อนดำเนินการชำระเงิน</p></div>
          <span class="badge badge-yellow" style="font-size:14px">${statusText}</span>
        </div>
        <div class="card" style="background:var(--card2);margin-bottom:18px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">สินค้า</div><div style="font-size:20px;font-weight:700">${productDetailEscape(order.product?.title || '-')}</div>
          <div style="color:var(--muted);margin-top:8px">🎮 ${productDetailEscape(order.product?.gameName || '-')}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          <div class="card" style="padding:16px"><div style="font-size:12px;color:var(--muted)">ยอดที่ต้องชำระ</div><div class="kanit" style="font-size:28px;font-weight:800;color:var(--accent);margin-top:4px">${amount} บาท</div></div>
          <div class="card" style="padding:16px"><div style="font-size:12px;color:var(--muted)">วันที่สร้างรายการ</div><div style="font-weight:600;margin-top:8px">${createdAt}</div></div>
        </div>
        <div class="notice info" style="margin-bottom:18px">🔒 ข้อมูลบัญชีเกมจะถูกเปิดเผยหลังจากชำระเงินสำเร็จเท่านั้น</div>
        ${order?.status === 'PENDING'
          ? `<button class="btn btn-primary btn-full btn-lg" type="button" onclick="payOrderFromWallet(${order.id})">💳 ชำระเงินด้วย Wallet</button>`
          : `<div class="notice success" style="margin-bottom:14px">✓ ชำระเงินสำเร็จแล้ว คุณสามารถเปิดดูข้อมูลบัญชีเกมได้</div>
             <button class="btn btn-primary btn-full btn-lg" type="button" onclick="loadOrderCredentials(${order.id})">🔐 แสดงข้อมูลบัญชีเกม</button>
             <div id="order-credentials-content" style="margin-top:16px"></div>`}
      </div>`;
  } catch (error) {
    console.error('openOrderDetail failed:', error);
    content.innerHTML = `<div class="notice danger">${productDetailEscape(error.message || 'โหลดรายละเอียดคำสั่งซื้อไม่สำเร็จ')}</div>`;
  }
}

async function loadOrderCredentials(id) {
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) return;
  const target = document.getElementById('order-credentials-content');
  if (!target) return;
  target.innerHTML = '<div class="card" style="padding:24px;text-align:center;color:var(--muted)">กำลังโหลดข้อมูลบัญชี...</div>';
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/credentials`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'ไม่สามารถโหลดข้อมูลบัญชีได้');
    const credentials = body.data?.credentials || body.credentials || {};
    const fields = [
      ['Username', credentials.gameUsername || '-'],
      ['Password', credentials.gamePassword || '-'],
      ['Email', credentials.email || '-'],
      ['Email Password', credentials.emailPassword || '-'],
    ];
    target.innerHTML = `<div class="card" style="background:var(--card2);padding:20px">
      <div style="font-weight:800;font-size:18px;margin-bottom:14px">🔐 ข้อมูลบัญชีเกม</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${fields.map(([label, value], index) => `<div class="card" style="padding:14px"><div style="font-size:12px;color:var(--muted);margin-bottom:6px">${label}</div><div style="display:flex;gap:8px;align-items:center"><div id="credential-value-${index}" style="font-weight:700;word-break:break-all;flex:1" data-value="${productDetailEscape(value)}">${index === 1 || index === 3 ? '••••••••' : productDetailEscape(value)}</div>${index === 1 || index === 3 ? `<button class="btn btn-ghost btn-sm" type="button" onclick="toggleCredential(${index})">👁</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" onclick="copyCredential(${index})">📋</button></div></div>`).join('')}
      </div>
    </div>`;
  } catch (error) {
    console.error('loadOrderCredentials failed:', error);
    target.innerHTML = `<div class="notice danger">${productDetailEscape(error.message || 'ไม่สามารถโหลดข้อมูลบัญชีได้')}</div>`;
  }
}

function toggleCredential(index) {
  const element = document.getElementById(`credential-value-${index}`);
  if (!element) return;
  const value = element.dataset.value || '-';
  const hidden = element.textContent.includes('••••');
  element.textContent = hidden ? value : '••••••••';
}

async function copyCredential(index) {
  const element = document.getElementById(`credential-value-${index}`);
  if (!element) return;
  try {
    await navigator.clipboard.writeText(element.dataset.value || '');
    alert('คัดลอกข้อมูลแล้ว');
  } catch (error) {
    console.error('copyCredential failed:', error);
    alert('ไม่สามารถคัดลอกข้อมูลได้');
  }
}

async function payOrderFromWallet(id) {
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) return;
  const csrf = orderCsrfToken();
  if (!csrf) { alert('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่'); return; }
  if (!window.confirm('ยืนยันการชำระเงินด้วย Wallet หรือไม่?\nระบบจะหักพ้อยท์จากยอดคงเหลือของคุณทันที')) return;
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/pay`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrf },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'ไม่สามารถชำระเงินได้');
    alert('ชำระเงินสำเร็จ');
    window.pendingOrderId = orderId;
    goPage('order-success');
    if (typeof window.loadWallet === 'function') window.loadWallet();
  } catch (error) {
    console.error('payOrderFromWallet failed:', error);
    alert(error.message || 'ไม่สามารถชำระเงินได้');
  }
}

window.contactProductSeller = contactProductSeller;
window.openProductDetail = openProductDetail;
window.selectProductDetailImage = selectProductDetailImage;
window.startProductPurchase = startProductPurchase;
window.payOrderFromWallet = payOrderFromWallet;
window.loadOrderCredentials = loadOrderCredentials;
window.toggleCredential = toggleCredential;
window.copyCredential = copyCredential;
window.openOrderDetail = openOrderDetail;

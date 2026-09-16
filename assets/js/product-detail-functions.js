function productDetailEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function formatProductAttribute(item) {
  if (item.optionLabel) return item.optionLabel;
  if (item.valueText !== null && item.valueText !== undefined) return item.valueText;
  if (item.valueNumber !== null && item.valueNumber !== undefined) return item.valueNumber;
  if (item.valueBoolean !== null && item.valueBoolean !== undefined) return item.valueBoolean ? 'à¹ƒà¸Šà¹ˆ' : 'à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ';
  return '-';
}

async function openProductDetail(id) {
  const page = document.getElementById('pg-product-detail');
  const content = document.getElementById('product-detail-content');
  if (!page || !content) return;
  window.currentProductDetailId = Number(id);
  goPage('product-detail');
  content.innerHTML = '<div class="card" style="padding:32px;text-align:center;color:var(--muted)">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸ªà¸´à¸™à¸„à¹‰à¸²...</div>';
  try {
    const response = await fetch(`/api/v1/products/${Number(id)}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸ªà¸´à¸™à¸„à¹‰à¸²à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    renderProductDetail(body.data || body);
  } catch (error) {
    console.error('openProductDetail failed:', error);
    content.innerHTML = `<div class="notice danger">${productDetailEscape(error.message || 'à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸ªà¸´à¸™à¸„à¹‰à¸²à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ')}</div>`;
  }
}function renderProductDetail(product) {
  const content = document.getElementById('product-detail-content');
  if (!content) return;
  const images = Array.isArray(product.images) ? product.images : [];
  const mainImage = images[0]?.imageUrl || '';
  const thumbs = images.map((image, index) => `<button type="button" class="product-detail-thumb ${index === 0 ? 'is-active' : ''}" data-product-image="${productDetailEscape(image.imageUrl)}" aria-label="à¸£à¸¹à¸›à¸—à¸µà¹ˆ ${index + 1}"><img src="${productDetailEscape(image.imageUrl)}" alt="à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸² ${index + 1}"/></button>`).join('');
  const attributes = (product.attributes || []).map((item) => `<div class="product-detail-stat"><div class="product-detail-stat-label">${productDetailEscape(item.name)}</div><div class="product-detail-stat-value">${productDetailEscape(formatProductAttribute(item))}</div></div>`).join('');
  content.innerHTML = `
    <div class="product-detail-shell">
      <div class="product-detail-hero">
        <section class="product-detail-gallery">
          <div class="product-detail-main-media" id="product-detail-main-image">
            ${mainImage ? `<img src="${productDetailEscape(mainImage)}" alt="${productDetailEscape(product.title || 'à¸ªà¸´à¸™à¸„à¹‰à¸²')}"/>` : '<div class="product-detail-empty-media">ðŸ–¼ï¸<span>à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²</span></div>'}
          </div>
          <div class="product-detail-thumbs" id="product-detail-thumbs">${thumbs}</div>
        </section>

        <section class="product-detail-summary">
          <div class="product-detail-game">ðŸŽ® ${productDetailEscape(product.game?.name || '-')}</div>
          <h1 class="product-detail-title">${productDetailEscape(product.title || 'à¸›à¸£à¸°à¸à¸²à¸¨à¸ªà¸´à¸™à¸„à¹‰à¸²')}</h1>
          <div class="product-detail-seller"><span>à¸œà¸¹à¹‰à¸‚à¸²à¸¢</span><button type="button" class="product-detail-seller-link" onclick="openSellerProfile(${Number(product.seller?.id || product.sellerId || 0)})">${productDetailEscape(product.seller?.username || '-')}</button><span class="product-detail-seller-dot">â€¢</span><span>à¸žà¸£à¹‰à¸­à¸¡à¸ªà¹ˆà¸‡à¸¡à¸­à¸šà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</span></div>
          <div class="product-detail-price">${Number(product.price || 0).toLocaleString('th-TH')} <span>à¸šà¸²à¸—</span></div>

          <div class="product-detail-action-card">
            <div class="product-detail-action-row"><span>à¸ªà¸–à¸²à¸™à¸°à¸ªà¸´à¸™à¸„à¹‰à¸²</span><strong class="product-detail-status"><span></span> à¸à¸³à¸¥à¸±à¸‡à¹€à¸›à¸´à¸”à¸‚à¸²à¸¢</strong></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button class="btn btn-primary btn-lg btn-full product-detail-buy" onclick="startProductPurchase(${Number(product.id)})">ðŸ›’ à¸‹à¸·à¹‰à¸­à¸ªà¸´à¸™à¸„à¹‰à¸²</button><button class="btn btn-secondary btn-lg btn-full" type="button" onclick="contactProductSeller(${Number(product.seller?.id || product.sellerId || 0)},${Number(product.id)})">ðŸ’¬ à¸•à¸´à¸”à¸•à¹ˆà¸­à¸œà¸¹à¹‰à¸‚à¸²à¸¢</button></div>
            <div class="product-detail-safe-note">ðŸ”’ à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸±à¸à¸Šà¸µà¸ˆà¸°à¹€à¸›à¸´à¸”à¹€à¸œà¸¢à¸«à¸¥à¸±à¸‡à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™</div>
          </div>
        </section>
      </div>

      <section class="product-detail-info-card">
        <div class="product-detail-section-title"><span>ðŸ“‹</span><div><h2>à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸ªà¸´à¸™à¸„à¹‰à¸²</h2><p>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡à¸ˆà¸²à¸à¸œà¸¹à¹‰à¸‚à¸²à¸¢</p></div></div>
        <div class="product-detail-description">${productDetailEscape(product.description || 'à¸œà¸¹à¹‰à¸‚à¸²à¸¢à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸žà¸´à¹ˆà¸¡à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸ªà¸´à¸™à¸„à¹‰à¸²')}</div>
      </section>

      ${attributes ? `<section class="product-detail-info-card"><div class="product-detail-section-title"><span>ðŸŽ®</span><div><h2>à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸šà¸±à¸à¸Šà¸µà¹€à¸à¸¡</h2><p>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸³à¸„à¸±à¸à¸‚à¸­à¸‡à¸šà¸±à¸à¸Šà¸µ</p></div></div><div class="product-detail-stats">${attributes}</div></section>` : ''}

      <section class="product-detail-info-card" id="product-review-card">
        <div class="product-detail-section-title"><span>â­</span><div><h2>à¸£à¸µà¸§à¸´à¸§à¸ˆà¸²à¸à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­</h2><p>à¸„à¸§à¸²à¸¡à¸„à¸´à¸”à¹€à¸«à¹‡à¸™à¸ˆà¸²à¸à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­à¸ªà¸´à¸™à¸„à¹‰à¸²à¸™à¸µà¹‰</p></div></div>
        <div id="product-review-content"><div class="product-review-loading">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸£à¸µà¸§à¸´à¸§...</div></div>
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

function ensureProductImageLightbox() {
  let lightbox = document.getElementById('product-image-lightbox');
  if (lightbox) return lightbox;
  lightbox = document.createElement('div');
  lightbox.id = 'product-image-lightbox';
  lightbox.className = 'product-image-lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.innerHTML = '<button type="button" class="product-image-lightbox-close" aria-label="à¸›à¸´à¸”">âœ•</button><button type="button" class="product-image-lightbox-prev" aria-label="à¸£à¸¹à¸›à¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²">â€¹</button><div class="product-image-lightbox-body"><img alt="à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²à¹à¸šà¸šà¸‚à¸¢à¸²à¸¢"/><div class="product-image-lightbox-thumbs" aria-label="à¹€à¸¥à¸·à¸­à¸à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²"></div></div><button type="button" class="product-image-lightbox-next" aria-label="à¸£à¸¹à¸›à¸–à¸±à¸”à¹„à¸›">â€º</button><div class="product-image-lightbox-count"></div><div class="product-image-lightbox-hint">à¸„à¸¥à¸´à¸à¸žà¸·à¹‰à¸™à¸«à¸¥à¸±à¸‡à¸«à¸£à¸·à¸­à¸à¸” Esc à¹€à¸žà¸·à¹ˆà¸­à¸›à¸´à¸”</div>';
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
  if (image) { image.src = item.url; image.alt = item.alt || 'à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²'; }
  if (count) count.textContent = `${productLightboxIndex + 1} / ${productLightboxImages.length}`;
  if (thumbs) {
    thumbs.innerHTML = productLightboxImages.map((entry, index) => `<button type="button" class="product-image-lightbox-thumb ${index === productLightboxIndex ? 'is-active' : ''}" data-index="${index}" aria-label="à¸£à¸¹à¸›à¸—à¸µà¹ˆ ${index + 1}"><img src="${productDetailEscape(entry.url)}" alt=""/></button>`).join('');
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

function openProductImageLightbox(imageUrl, altText = 'à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²') {
  if (!imageUrl) return;
  const lightbox = ensureProductImageLightbox();
  const thumbs = [...document.querySelectorAll('#product-detail-thumbs [data-product-image]')];
  productLightboxImages = thumbs.map((thumb) => ({ url: thumb.dataset.productImage, alt: thumb.querySelector('img')?.alt || 'à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²' })).filter((item) => item.url);
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
  main.innerHTML = `<img src="${productDetailEscape(imageUrl)}" alt="à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²"/>`;
  bindProductDetailMainImage();
}

function bindProductDetailMainImage() {
  const main = document.getElementById('product-detail-main-image');
  const image = main?.querySelector('img');
  if (!main || !image) return;
  main.onclick = () => openProductImageLightbox(image.currentSrc || image.src, image.alt || 'à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²');
  main.onkeydown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openProductImageLightbox(image.currentSrc || image.src, image.alt || 'à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²');
    }
  };
  main.tabIndex = 0;
  main.setAttribute('role', 'button');
  main.setAttribute('aria-label', 'à¸„à¸¥à¸´à¸à¹€à¸žà¸·à¹ˆà¸­à¸”à¸¹à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²à¹à¸šà¸šà¸‚à¸¢à¸²à¸¢');
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
  if(!Number.isInteger(sid)||sid<=0||!Number.isInteger(pid)||pid<=0){alert('à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸œà¸¹à¹‰à¸‚à¸²à¸¢');return;}
  if(typeof isLoggedIn!=='undefined'&&!isLoggedIn){goPage('login');return;}
  const csrf=orderCsrfToken();if(!csrf){alert('à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸„à¸§à¸²à¸¡à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢ à¸à¸£à¸¸à¸“à¸²à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¸«à¸™à¹‰à¸²à¹à¸¥à¹‰à¸§à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ');return;}
  try{const response=await fetch('/api/v1/chat',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({otherUserId:sid,productId:pid})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error?.message||'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹€à¸›à¸´à¸”à¹à¸Šà¸—à¸à¸±à¸šà¸œà¸¹à¹‰à¸‚à¸²à¸¢à¹„à¸”à¹‰');goPage('chat');}catch(error){console.error('contactProductSeller failed:',error);alert(error.message||'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹€à¸›à¸´à¸”à¹à¸Šà¸—à¸à¸±à¸šà¸œà¸¹à¹‰à¸‚à¸²à¸¢à¹„à¸”à¹‰');}
}

async function startProductPurchase(id) {
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) return;
  if (typeof isLoggedIn === 'undefined' || !isLoggedIn) {
    goPage('login');
    return;
  }

  if (!currentUser?.accountVerified) {
    alert(
      'à¸à¸£à¸¸à¸“à¸²à¸¢à¸·à¸™à¸¢à¸±à¸™ Email à¹à¸¥à¸°à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£à¸¨à¸±à¸žà¸—à¹Œà¹ƒà¸«à¹‰à¸„à¸£à¸šà¸à¹ˆà¸­à¸™à¸‹à¸·à¹‰à¸­à¸ªà¸´à¸™à¸„à¹‰à¸²'
    );
    goPage('profile');
    return;
  }

  const csrf = orderCsrfToken();
  if (!csrf) { alert('à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸„à¸§à¸²à¸¡à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢ à¸à¸£à¸¸à¸“à¸²à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¸«à¸™à¹‰à¸²à¹à¸¥à¹‰à¸§à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ'); return; }

  const confirmed = window.confirm('à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­à¸ªà¸´à¸™à¸„à¹‰à¸²à¸™à¸µà¹‰à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?\nà¸£à¸°à¸šà¸šà¸ˆà¸°à¸ªà¸£à¹‰à¸²à¸‡à¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­à¸à¹ˆà¸­à¸™à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸‚à¸±à¹‰à¸™à¸•à¸­à¸™à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™');
  if (!confirmed) return;

  try {
    const response = await fetch('/api/v1/orders', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ productId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸ªà¸£à¹‰à¸²à¸‡à¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­à¹„à¸”à¹‰');

    const order = body.data?.order || body.order;
    window.pendingOrderId = order?.id || null;
    if (!window.pendingOrderId) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸«à¸¡à¸²à¸¢à¹€à¸¥à¸‚à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­à¸—à¸µà¹ˆà¸ªà¸£à¹‰à¸²à¸‡');
    window.openOrderDetail?.(window.pendingOrderId);
  } catch (error) {
    console.error('startProductPurchase failed:', error);
    alert(error.message || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸ªà¸£à¹‰à¸²à¸‡à¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­à¹„à¸”à¹‰');
  }
}

async function openOrderDetail(id) {
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) return;
  const content = document.getElementById('order-detail-content');
  if (!content) return;
  window.pendingOrderId = orderId;
  goPage('order-detail');
  content.innerHTML = '<div class="card" style="padding:32px;text-align:center;color:var(--muted)">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­...</div>';
  try {
    const response = await fetch(`/api/v1/orders/${orderId}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    const order = body.data?.order || body.order;
    const amount = Number(order?.amount || 0).toLocaleString('th-TH');
    const createdAt = order?.createdAt ? new Date(order.createdAt).toLocaleString('th-TH') : '-';
    const statusText = order?.status === 'PENDING' ? 'PENDING' : order?.status === 'COMPLETED' ? 'COMPLETED' : productDetailEscape(order?.status || '-');
    content.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="goPage('listings-user')" style="margin-bottom:20px">â† à¸à¸¥à¸±à¸šà¹„à¸›à¸«à¸™à¹‰à¸²à¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¸´à¸™à¸„à¹‰à¸²</button>
      <div class="card" style="max-width:820px;margin:0 auto;padding:32px">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:28px;flex-wrap:wrap">
          <div><div class="badge badge-blue" style="margin-bottom:10px">à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­ #${order.id}</div><h1 style="font-size:28px;margin:0 0 6px">ðŸ§¾ à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­</h1><p style="color:var(--muted);margin:0">à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸à¹ˆà¸­à¸™à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™</p></div>
          <span class="badge badge-yellow" style="font-size:14px">${statusText}</span>
        </div>
        <div class="card" style="background:var(--card2);margin-bottom:18px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">à¸ªà¸´à¸™à¸„à¹‰à¸²</div><div style="font-size:20px;font-weight:700">${productDetailEscape(order.product?.title || '-')}</div>
          <div style="color:var(--muted);margin-top:8px">ðŸŽ® ${productDetailEscape(order.product?.gameName || '-')}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          <div class="card" style="padding:16px"><div style="font-size:12px;color:var(--muted)">à¸¢à¸­à¸”à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸Šà¸³à¸£à¸°</div><div class="kanit" style="font-size:28px;font-weight:800;color:var(--accent);margin-top:4px">${amount} à¸šà¸²à¸—</div></div>
          <div class="card" style="padding:16px"><div style="font-size:12px;color:var(--muted)">à¸§à¸±à¸™à¸—à¸µà¹ˆà¸ªà¸£à¹‰à¸²à¸‡à¸£à¸²à¸¢à¸à¸²à¸£</div><div style="font-weight:600;margin-top:8px">${createdAt}</div></div>
        </div>
        <div class="notice info" style="margin-bottom:18px">ðŸ”’ à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸±à¸à¸Šà¸µà¹€à¸à¸¡à¸ˆà¸°à¸–à¸¹à¸à¹€à¸›à¸´à¸”à¹€à¸œà¸¢à¸«à¸¥à¸±à¸‡à¸ˆà¸²à¸à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™</div>
        ${order?.status === 'PENDING'
          ? `<button class="btn btn-primary btn-full btn-lg" type="button" onclick="payOrderFromWallet(${order.id})">ðŸ’³ à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¸”à¹‰à¸§à¸¢ Wallet</button>`
          : `<div class="notice success" style="margin-bottom:14px">âœ“ à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§ à¸„à¸¸à¸“à¸ªà¸²à¸¡à¸²à¸£à¸–à¹€à¸›à¸´à¸”à¸”à¸¹à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸±à¸à¸Šà¸µà¹€à¸à¸¡à¹„à¸”à¹‰</div>
             <button class="btn btn-primary btn-full btn-lg" type="button" onclick="loadOrderCredentials(${order.id})">ðŸ” à¹à¸ªà¸”à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸±à¸à¸Šà¸µà¹€à¸à¸¡</button>
             <div id="order-credentials-content" style="margin-top:16px"></div>`}
      </div>`;
  } catch (error) {
    console.error('openOrderDetail failed:', error);
    content.innerHTML = `<div class="notice danger">${productDetailEscape(error.message || 'à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ')}</div>`;
  }
}

async function loadOrderCredentials(id) {
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) return;
  const target = document.getElementById('order-credentials-content');
  if (!target) return;
  target.innerHTML = '<div class="card" style="padding:24px;text-align:center;color:var(--muted)">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸±à¸à¸Šà¸µ...</div>';
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/credentials`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸±à¸à¸Šà¸µà¹„à¸”à¹‰');
    const credentials = body.data?.credentials || body.credentials || {};
    const fields = [
      ['Username', credentials.gameUsername || '-'],
      ['Password', credentials.gamePassword || '-'],
      ['Email', credentials.email || '-'],
      ['Email Password', credentials.emailPassword || '-'],
    ];
    target.innerHTML = `<div class="card" style="background:var(--card2);padding:20px">
      <div style="font-weight:800;font-size:18px;margin-bottom:14px">ðŸ” à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸±à¸à¸Šà¸µà¹€à¸à¸¡</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${fields.map(([label, value], index) => `<div class="card" style="padding:14px"><div style="font-size:12px;color:var(--muted);margin-bottom:6px">${label}</div><div style="display:flex;gap:8px;align-items:center"><div id="credential-value-${index}" style="font-weight:700;word-break:break-all;flex:1" data-value="${productDetailEscape(value)}">${index === 1 || index === 3 ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' : productDetailEscape(value)}</div>${index === 1 || index === 3 ? `<button class="btn btn-ghost btn-sm" type="button" onclick="toggleCredential(${index})">ðŸ‘</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" onclick="copyCredential(${index})">ðŸ“‹</button></div></div>`).join('')}
      </div>
    </div>`;
  } catch (error) {
    console.error('loadOrderCredentials failed:', error);
    target.innerHTML = `<div class="notice danger">${productDetailEscape(error.message || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸±à¸à¸Šà¸µà¹„à¸”à¹‰')}</div>`;
  }
}

function toggleCredential(index) {
  const element = document.getElementById(`credential-value-${index}`);
  if (!element) return;
  const value = element.dataset.value || '-';
  const hidden = element.textContent.includes('â€¢â€¢â€¢â€¢');
  element.textContent = hidden ? value : 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢';
}

async function copyCredential(index) {
  const element = document.getElementById(`credential-value-${index}`);
  if (!element) return;
  try {
    await navigator.clipboard.writeText(element.dataset.value || '');
    alert('à¸„à¸±à¸”à¸¥à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹à¸¥à¹‰à¸§');
  } catch (error) {
    console.error('copyCredential failed:', error);
    alert('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸„à¸±à¸”à¸¥à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸”à¹‰');
  }
}

async function payOrderFromWallet(id) {
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) return;
  const csrf = orderCsrfToken();
  if (!csrf) { alert('à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸„à¸§à¸²à¸¡à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢ à¸à¸£à¸¸à¸“à¸²à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¸«à¸™à¹‰à¸²à¹à¸¥à¹‰à¸§à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ'); return; }
  if (!window.confirm('à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¸”à¹‰à¸§à¸¢ Wallet à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?\nà¸£à¸°à¸šà¸šà¸ˆà¸°à¸«à¸±à¸à¸žà¹‰à¸­à¸¢à¸—à¹Œà¸ˆà¸²à¸à¸¢à¸­à¸”à¸„à¸‡à¹€à¸«à¸¥à¸·à¸­à¸‚à¸­à¸‡à¸„à¸¸à¸“à¸—à¸±à¸™à¸—à¸µ')) return;
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/pay`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrf },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¹„à¸”à¹‰');
    alert('à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    window.pendingOrderId = orderId;
    goPage('order-success');
    if (typeof window.loadWallet === 'function') window.loadWallet();
  } catch (error) {
    console.error('payOrderFromWallet failed:', error);
    alert(error.message || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¹„à¸”à¹‰');
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
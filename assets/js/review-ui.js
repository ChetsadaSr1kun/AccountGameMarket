let reviewState = { orderId: null, productId: null, rating: 0 };
function reviewEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
function openReviewModal(order) {
  reviewState = { orderId: Number(order.id), productId: Number(order.productId || order.product_id), rating: 0 };
  let modal = document.getElementById('reviewModal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'reviewModal'; modal.className = 'modal-overlay'; document.body.appendChild(modal); }
  const title = reviewEscape(order.product?.title || 'สินค้า');
  modal.innerHTML = `<div class="modal-card review-modal-card" style="max-width:520px;width:calc(100% - 32px)">
    <div class="review-modal-header"><div><div class="review-modal-title">⭐ รีวิวสินค้า</div><div class="review-modal-product">${title}</div></div><button class="btn btn-ghost btn-sm" onclick="closeReviewModal()" aria-label="ปิด">✕</button></div>
    <div class="review-label">ให้คะแนนสินค้า</div>
    <div id="reviewStars" class="review-stars">${[1,2,3,4,5].map((n) => `<button type="button" data-rating="${n}" onclick="setReviewRating(${n})" aria-label="ให้ ${n} ดาว">☆</button>`).join('')}</div>
    <div class="review-label">ความคิดเห็น <span>(ไม่บังคับ)</span></div>
    <textarea id="reviewComment" maxlength="500" rows="5" placeholder="บอกความคิดเห็นของคุณเกี่ยวกับสินค้านี้"></textarea>
    <div id="reviewMessage" class="review-message"></div>
    <div class="review-modal-actions"><button class="btn btn-secondary" onclick="closeReviewModal()">ยกเลิก</button><button id="reviewSubmitBtn" class="btn btn-primary" onclick="submitReview()">ส่งรีวิว</button></div>
  </div>`;
  modal.style.display = 'flex';
}
function closeReviewModal() {
  const modal = document.getElementById('reviewModal');
  if (modal) modal.remove();
  reviewState = { orderId: null, productId: null, rating: 0 };
}
function setReviewRating(rating) {
  reviewState.rating = Number(rating);
  document.querySelectorAll('#reviewStars [data-rating]').forEach((button) => {
    const active = Number(button.dataset.rating) <= reviewState.rating;
    button.textContent = active ? '★' : '☆';
    button.classList.toggle('active', active);
  });
}
async function submitReview() {
  const message = document.getElementById('reviewMessage');
  const submit = document.getElementById('reviewSubmitBtn');
  const comment = document.getElementById('reviewComment')?.value.trim() || '';
  if (!reviewState.orderId || !reviewState.rating) {
    if (message) message.innerHTML = '<div class="notice danger">กรุณาเลือกคะแนน 1–5 ดาว</div>';
    return;
  }
  if (submit) { submit.disabled = true; submit.textContent = 'กำลังส่งรีวิว...'; }
  try {
    const csrf = typeof getCookieValue === 'function' ? getCookieValue('gm_csrf') : '';
    if (!csrf) throw new Error('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่');
    const response = await fetch('/api/v1/reviews', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ orderId: reviewState.orderId, rating: reviewState.rating, comment }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'ส่งรีวิวไม่สำเร็จ');
    closeReviewModal();
    if (typeof loadTradeHistory === 'function') await loadTradeHistory();
    if (typeof showToast === 'function') showToast('ส่งรีวิวเรียบร้อยแล้ว', 'success');
  } catch (error) {
    if (message) message.innerHTML = `<div class="notice danger">${reviewEscape(error.message || 'ส่งรีวิวไม่สำเร็จ')}</div>`;
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = 'ส่งรีวิว'; }
  }
}
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.setReviewRating = setReviewRating;
window.submitReview = submitReview;

function sellerRatingEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
function sellerRatingStars(rating) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const rounded = Math.round(value);
  return '★★★★★'.split('').map((star,index)=>`<span class="seller-rating-star ${index<rounded?'is-filled':''}">${star}</span>`).join('');
}
function renderSellerProfileRating(payload) {
  const target=document.getElementById('profileSellerRating'); if(!target)return;
  const summary=payload?.rating||payload?.summary||{};
  const reviews=Array.isArray(payload?.reviews)?payload.reviews:[];
  const count=Number(summary.reviewCount||summary.totalReviews||reviews.length||0);
  const average=Number(summary.averageRating||0);
  if(!count){target.innerHTML='<div class="seller-rating-empty">ยังไม่มีคะแนนรีวิวจากผู้ซื้อ</div>';return;}
  target.innerHTML=`<div class="seller-rating-overview"><div class="seller-rating-score">${average.toFixed(1)}</div><div><div class="seller-rating-stars">${sellerRatingStars(average)}</div><div class="seller-rating-count">จาก ${count.toLocaleString('th-TH')} รีวิว</div></div></div>
  <div class="seller-review-list">${reviews.map(r=>`<article class="seller-review-item"><div class="seller-review-head"><div><strong>${sellerRatingEscape(r.buyerUsername||r.username||'ผู้ซื้อ')}</strong><div class="seller-review-stars">${sellerRatingStars(r.rating)}</div></div><time>${r.createdAt?new Date(r.createdAt).toLocaleDateString('th-TH'):'-'}</time></div>${r.comment?`<p>${sellerRatingEscape(r.comment)}</p>`:'<p class="seller-review-no-comment">ไม่ได้เขียนความคิดเห็น</p>'}${r.sellerReply?`<div class="seller-public-reply"><strong>↳ ผู้ขาย</strong><p>${sellerRatingEscape(r.sellerReply)}</p></div>`:''}</article>`).join('')}</div>`;
}
async function loadProfileSellerRating() {
  const target=document.getElementById('profileSellerRating'); if(!target||!window.currentUser?.id)return;
  target.innerHTML='<div class="seller-rating-loading">กำลังโหลดคะแนนรีวิว...</div>';
  try{
    const response=await fetch(`/api/v1/sellers/${Number(window.currentUser.id)}`,{credentials:'include'});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.error?.message||'โหลดคะแนนผู้ขายไม่สำเร็จ');
    renderSellerProfileRating(body.data||body);
  }catch(error){console.error('loadProfileSellerRating failed:',error);target.innerHTML=`<div class="notice danger">${sellerRatingEscape(error.message||'โหลดคะแนนผู้ขายไม่สำเร็จ')}</div>`;}
}
window.loadProfileSellerRating=loadProfileSellerRating;

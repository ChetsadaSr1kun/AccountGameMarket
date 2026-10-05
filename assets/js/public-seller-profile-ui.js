function publicSellerEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function publicSellerStars(r){const n=Math.round(Number(r)||0);return '★★★★★'.split('').map((s,i)=>`<span class="seller-public-star ${i<n?'is-filled':''}">${s}</span>`).join('');}
let publicSellerReviews=[]; let publicSellerIsOwner=false;
function renderPublicSellerReviewFilters(summary,count){return `<div class="seller-review-filters" role="group" aria-label="กรองรีวิว"><button class="seller-review-filter is-active" data-rating="0" onclick="filterPublicSellerReviews(0)">ทั้งหมด ${count}</button>${[5,4,3,2,1].map(s=>`<button class="seller-review-filter" data-rating="${s}" onclick="filterPublicSellerReviews(${s})">${s}★ ${Number(summary?.distribution?.[s]||0)}</button>`).join('')}</div>`;}
function renderPublicSellerReviews(reviews) {
  const target =
    document.getElementById(
      'seller-public-review-list'
    );

  if (!target) return;

  target.innerHTML = reviews.length
    ? reviews.map((review) => `
      <article class="seller-public-review">

        <div class="seller-public-review-head">
          <strong>
            ${publicSellerEscape(
              review.buyerUsername ||
              'ผู้ซื้อ'
            )}
          </strong>

          <span>
            ${publicSellerStars(
              review.rating
            )}
          </span>

          <time>
            ${
              review.createdAt
                ? new Date(
                    review.createdAt
                  ).toLocaleDateString(
                    'th-TH'
                  )
                : '-'
            }
          </time>
        </div>

        <p>
          ${publicSellerEscape(
            review.comment ||
            'ไม่ได้เขียนความคิดเห็น'
          )}
        </p>

        ${
          review.sellerReply
            ? `
              <div class="seller-public-reply">
                <strong>
                  ↪ ผู้ขาย
                </strong>

                <p>
                  ${publicSellerEscape(
                    review.sellerReply
                  )}
                </p>

                <time>
                  ${
                    review.sellerReplyAt
                      ? new Date(
                          review.sellerReplyAt
                        ).toLocaleDateString(
                          'th-TH'
                        )
                      : ''
                  }
                </time>
              </div>
            `
            : ''
        }

        ${
          publicSellerIsOwner
            ? `
              <div class="seller-public-review-actions">

                ${
                  !review.sellerReply
                    ? `
                      <button
                        type="button"
                        class="seller-reply-btn"
                        onclick="
                          openSellerReplyModal(
                            ${Number(review.id)}
                          )
                        "
                      >
                        📝 ตอบกลับ
                      </button>
                    `
                    : ''
                }

                <button
                  type="button"
                  class="btn btn-danger btn-sm"
                  onclick="
                    openSellerReviewReportModal(
                      ${Number(review.id)}
                    )
                  "
                >
                  🚩 รายงานรีวิวนี้
                </button>

              </div>
            `
            : ''
        }

      </article>
    `).join('')
    : `
      <div class="seller-public-empty">
        ยังไม่มีรีวิวในร้านนี้
      </div>
    `;
}
function filterPublicSellerReviews(star){document.querySelectorAll('.seller-review-filter').forEach(b=>b.classList.toggle('is-active',Number(b.dataset.rating)===star));renderPublicSellerReviews(star?publicSellerReviews.filter(x=>Number(x.rating)===star):publicSellerReviews);}
function openSellerReplyModal(reviewId){const m=document.createElement('div');m.id='sellerReplyModal';m.className='modal-overlay';m.style.display='flex';m.innerHTML=`<div class="modal-card seller-reply-modal"><div class="review-modal-header"><div><div class="review-modal-title">💬 ตอบกลับรีวิว</div><div class="review-modal-product">คำตอบจะแสดงในโปรไฟล์ผู้ขายของคุณ</div></div><button class="btn btn-ghost btn-sm" onclick="closeSellerReplyModal()">✕</button></div><textarea id="sellerReplyInput" maxlength="500" placeholder="เขียนคำตอบของคุณ..."></textarea><div id="sellerReplyMessage" class="review-message"></div><div class="review-modal-actions"><button class="btn btn-secondary" onclick="closeSellerReplyModal()">ยกเลิก</button><button id="sellerReplySubmit" class="btn btn-primary" onclick="submitSellerReply(${reviewId})">ส่งคำตอบ</button></div></div>`;document.body.appendChild(m);}
function closeSellerReplyModal(){document.getElementById('sellerReplyModal')?.remove();}
function openSellerReviewReportModal(reviewId) {
  const id = Number(reviewId);

const review =
  publicSellerReviews.find(
    (item) => Number(item.id) === id
  ) ||
  (
    Array.isArray(window.sellerRatingReviews)
      ? window.sellerRatingReviews.find(
          (item) =>
            Number(item.id) === id
        )
      : null
  );

if (!review) {
  return;
}

const activeUser =
  typeof currentUser !== 'undefined'
    ? currentUser
    : window.currentUser;

const currentUserId =
  Number(
    activeUser?.id ||
    window.currentUserId ||
    0
  );

if (
  Number(review.sellerId) !==
  currentUserId
) {
  return;
}

  document
    .getElementById('sellerReviewReportModal')
    ?.remove();

  const modal =
    document.createElement('div');

  modal.id = 'sellerReviewReportModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';

  modal.innerHTML = `
    <div
      class="modal-card review-modal-card"
      style="
        max-width:520px;
        width:calc(100% - 32px);
      "
    >
      <div class="review-modal-header">

        <div>
          <div class="review-modal-title">
            🚩 รายงานรีวิว
          </div>

          <div class="review-modal-product">
            แจ้ง Admin เพื่อตรวจสอบรีวิวที่ได้รับ
          </div>
        </div>

        <button
          type="button"
          class="btn btn-ghost btn-sm"
          onclick="closeSellerReviewReportModal()"
        >
          ✕
        </button>

      </div>

      <div
        style="
          padding:14px;
          margin-bottom:16px;
          border:1px solid var(--border);
          border-radius:10px;
        "
      >
        <div
          style="
            font-size:13px;
            color:var(--muted);
            margin-bottom:6px;
          "
        >
          รีวิวจาก
          <strong>
            ${publicSellerEscape(
              review.buyerUsername || 'ผู้ซื้อ'
            )}
          </strong>
        </div>

        <div>
          ${publicSellerStars(review.rating)}
        </div>

        <p style="margin:8px 0 0">
          ${publicSellerEscape(
            review.comment ||
            'ไม่ได้เขียนความคิดเห็น'
          )}
        </p>
      </div>

      <div class="inp-group">
        <label class="inp-label">
          เหตุผลในการรายงาน
        </label>

        <select
          id="sellerReviewReportReason"
          class="inp"
        >
          <option value="FALSE_REVIEW">
            รีวิวไม่เป็นความจริง
          </option>

          <option value="INAPPROPRIATE">
            เนื้อหาไม่เหมาะสม
          </option>

          <option value="SPAM">
            สแปม
          </option>

          <option value="FRAUD">
            กล่าวหาหรือบิดเบือนข้อเท็จจริง
          </option>

          <option value="ABUSE">
            ใช้คำไม่เหมาะสม / คุกคาม
          </option>

          <option value="OTHER">
            อื่น ๆ
          </option>
        </select>
      </div>

      <div class="inp-group">
        <label class="inp-label">
          รายละเอียดเพิ่มเติม
          <span>(ไม่บังคับ)</span>
        </label>

        <textarea
          id="sellerReviewReportDescription"
          class="inp"
          maxlength="500"
          rows="5"
          placeholder="อธิบายเหตุผลที่คิดว่ารีวิวนี้ไม่ถูกต้อง..."
        ></textarea>
      </div>

      <div
        id="sellerReviewReportMessage"
        class="review-message"
      ></div>

      <div class="review-modal-actions">

        <button
          type="button"
          class="btn btn-secondary"
          onclick="closeSellerReviewReportModal()"
        >
          ยกเลิก
        </button>

        <button
          type="button"
          id="sellerReviewReportSubmit"
          class="btn btn-danger"
          onclick="
            submitSellerReviewReport(${id})
          "
        >
          🚩 ส่งรายงาน
        </button>

      </div>
    </div>
  `;

  document.body.appendChild(modal);
}


function closeSellerReviewReportModal() {
  document
    .getElementById('sellerReviewReportModal')
    ?.remove();
}


async function submitSellerReviewReport(reviewId) {
  const reason =
    document.getElementById(
      'sellerReviewReportReason'
    )?.value || '';

  const description =
    document.getElementById(
      'sellerReviewReportDescription'
    )?.value.trim() || '';

  const message =
    document.getElementById(
      'sellerReviewReportMessage'
    );

  const button =
    document.getElementById(
      'sellerReviewReportSubmit'
    );

  const token =
    typeof csrfToken !== 'undefined'
      ? (
          csrfToken ||
          getCookieValue('gm_csrf')
        )
      : getCookieValue('gm_csrf');

  if (!token) {
    if (message) {
      message.textContent =
        'ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้า';
    }

    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'กำลังส่ง...';
  }

  try {
    const response = await fetch(
      '/api/v1/review-reports',
      {
        method: 'POST',

        credentials: 'include',

        headers: {
          'Content-Type':
            'application/json',

          'X-CSRF-Token':
            token,
        },

        body: JSON.stringify({
          reviewId:
            Number(reviewId),

          reason,

          description,
        }),
      }
    );

    const body =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.error?.message ||
        'ส่งรายงานรีวิวไม่สำเร็จ'
      );
    }

    closeSellerReviewReportModal();

    if (
      typeof showToast ===
      'function'
    ) {
      showToast(
        'ส่งรายงานรีวิวให้ Admin ตรวจสอบแล้ว',
        'success'
      );
    } else {
      alert(
        'ส่งรายงานรีวิวให้ Admin ตรวจสอบแล้ว'
      );
    }

  } catch (error) {
    if (message) {
      message.textContent =
        error.message ||
        'ส่งรายงานรีวิวไม่สำเร็จ';
    }

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        '🚩 ส่งรายงาน';
    }
  }
}
async function submitSellerReply(reviewId){const input=document.getElementById('sellerReplyInput'),msg=document.getElementById('sellerReplyMessage'),btn=document.getElementById('sellerReplySubmit');const text=input?.value.trim()||'';const token=typeof csrfToken!=='undefined'?(csrfToken||getCookieValue('gm_csrf')):getCookieValue('gm_csrf');if(!text){msg.textContent='กรุณาเขียนคำตอบ';return;}if(!token){msg.textContent='ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้า';return;}btn.disabled=true;btn.textContent='กำลังส่ง...';try{const r=await fetch(`/api/v1/reviews/${Number(reviewId)}/reply`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({reply:text})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'ส่งคำตอบไม่สำเร็จ');closeSellerReplyModal();if (
  typeof currentPage !== 'undefined' &&
  currentPage === 'user-profile'
) {
  window.loadUserProfile?.();
} else {
  openSellerProfile(
    Number(
      document.querySelector(
        '.seller-public-hero'
      )?.dataset?.sellerId || 0
    ) ||
    Number(
      (
        typeof currentUser !== 'undefined'
          ? currentUser
          : window.currentUser
      )?.id || 0
    )
  );
}}catch(e){msg.textContent=e.message||'ส่งคำตอบไม่สำเร็จ';}finally{btn.disabled=false;btn.textContent='ส่งคำตอบ';}}
async function openSellerProfile(sellerId){const id=Number(sellerId),page=document.getElementById('pg-seller-profile'),content=document.getElementById('seller-profile-content');if(!page||!content||!Number.isInteger(id)||id<=0)return;goPage('seller-profile');content.innerHTML='<div class="card" style="padding:32px;text-align:center;color:var(--muted)">กำลังโหลดโปรไฟล์ผู้ขาย...</div>';try{const r=await fetch(`/api/v1/sellers/${id}`,{credentials:'include'}),body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error?.message||'โหลดโปรไฟล์ผู้ขายไม่สำเร็จ');renderPublicSellerProfile(body.data||body,id);}catch(e){console.error('openSellerProfile failed:',e);content.innerHTML=`<div class="notice danger">${publicSellerEscape(e.message||'โหลดโปรไฟล์ผู้ขายไม่สำเร็จ')}</div>`;}}
function renderPublicSellerProfile(data,sellerId){
  const c=document.getElementById('seller-profile-content');
  if(!c)return;const s=data.seller||{},rating=data.rating||{},
  reviews=Array.isArray(data.reviews)?data.reviews:[],
  products=Array.isArray(data.activeProducts)?data.activeProducts:[];
  publicSellerReviews = reviews;

  const activeUser =
    typeof currentUser !== 'undefined'
      ? currentUser
      : window.currentUser;

  publicSellerIsOwner =
    Number(activeUser?.id || 0) ===
    Number(s.id || 0);const avatar=s.avatarUrl?`<img src="${publicSellerEscape(s.avatarUrl)}" alt="" class="seller-public-avatar-img">`:publicSellerEscape((s.username||'U').charAt(0).toUpperCase());c.innerHTML=`<div class="seller-public-hero" data-seller-id="${Number(sellerId)||Number(s.id)||0}"><div class="seller-public-avatar">${avatar}</div><div class="seller-public-main"><h1>${publicSellerEscape(s.username||'ผู้ขาย')}</h1><div class="seller-public-rating">${rating.reviewCount?`${publicSellerStars(rating.averageRating)} <strong>${Number(rating.averageRating).toFixed(1)}</strong> / 5 · ${Number(rating.reviewCount).toLocaleString('th-TH')} รีวิว`:'⭐ ยังไม่มีคะแนนรีวิว'}</div><div class="seller-public-meta">${s.accountVerified?'✓ ยืนยันตัวตนแล้ว':'สมาชิก GameMarket'} · สมาชิกตั้งแต่ ${s.createdAt?new Date(s.createdAt).toLocaleDateString('th-TH'):'-'}</div></div></div>`;c.innerHTML+=`<div class="grid3 seller-public-stats"><div class="card"><strong>${rating.reviewCount||0}</strong><span>รีวิว</span></div><div class="card"><strong>${Number(data.completedSales||0).toLocaleString('th-TH')}</strong><span>ขายสำเร็จ</span></div><div class="card"><strong>${products.length}</strong><span>กำลังขาย</span></div></div>`;c.innerHTML+=`<section class="card seller-public-section"><div class="seller-public-section-head"><div><h2>📝 รีวิวจากผู้ซื้อ</h2><p>ความคิดเห็นและคะแนนจากผู้ซื้อทั้งหมด</p></div></div>${renderPublicSellerReviewFilters(rating,reviews.length)}<div id="seller-public-review-list"></div></section>`;c.innerHTML+=`<section class="seller-public-section"><div class="seller-public-section-head"><div><h2>🎮 สินค้าที่กำลังขาย</h2><p>เฉพาะประกาศที่ยังพร้อมซื้อ</p></div></div><div class="seller-public-products">${products.length?products.map(p=>`<div class="card card-hover" onclick="openProductDetail(${Number(p.id)})" style="cursor:pointer"><div class="badge badge-gray">${publicSellerEscape(p.game?.name||'-')}</div><h3>${publicSellerEscape(p.title||'สินค้า')}</h3><div class="kanit" style="font-size:18px;font-weight:800;color:var(--accent)">${Number(p.price||0).toLocaleString('th-TH')} ฿</div></div>`).join(''):'<div class="card seller-public-empty">ผู้ขายยังไม่มีสินค้าที่เปิดขาย</div>'}</div></section>`;renderPublicSellerReviews(reviews);}

window.openSellerProfile =
  openSellerProfile;

window.filterPublicSellerReviews =
  filterPublicSellerReviews;

window.openSellerReplyModal =
  openSellerReplyModal;

window.closeSellerReplyModal =
  closeSellerReplyModal;

window.submitSellerReply =
  submitSellerReply;

window.openSellerReviewReportModal =
  openSellerReviewReportModal;

window.closeSellerReviewReportModal =
  closeSellerReviewReportModal;

window.submitSellerReviewReport =
  submitSellerReviewReport;
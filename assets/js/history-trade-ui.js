function escapeHistoryText(value){return String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function historyTradeOrderJson(order){return JSON.stringify(order).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function historyTradeDate(value){if(!value)return '-';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString('th-TH');}
function historyTradePreview(order) {
  const imageUrl =
    order.product?.primaryImageUrl;

  if (imageUrl) {
    return `
      <img
        src="${escapeHistoryText(imageUrl)}"
        alt="${escapeHistoryText(
          order.product?.title || 'สินค้า'
        )}"
        style="
          width:96px;
          height:64px;
          object-fit:cover;
          border-radius:10px;
          border:1px solid var(--border);
          display:block;
        "
      />
    `;
  }

  return `
    <div
      style="
        width:96px;
        height:64px;
        border-radius:10px;
        border:1px solid var(--border);
        background:var(--card2);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:26px;
      "
    >
      🎮
    </div>
  `;
}
function historyTradeStatus(status){
  if(status==='COMPLETED'){
    return {
      label:'สำเร็จ',
      className:'badge-green'
    };
  }

  return {
    label:status || '-',
    className:'badge-blue'
  };
}
function renderTradeHistory(orders,currentUserId){const list=document.getElementById('histTradeList');if(!list)return;if(!orders.length){list.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted)">ยังไม่มีประวัติการซื้อ/ขาย</div>';return;}
 list.innerHTML=orders.map(order=>{const isBuyer=Number(order.buyerId)===Number(currentUserId),
status=historyTradeStatus(order.status),
person = isBuyer
  ? `
    ผู้ขาย:
    <button
      type="button"
      class="history-trade-seller-link"
      onclick="
        openSellerProfile(
          ${Number(order.sellerId)}
        )
      "
    >
      ${escapeHistoryText(
        order.sellerUsername ||
        'ผู้ขาย'
      )}
    </button>
  `
  : `ผู้ซื้อ: ${escapeHistoryText(
      order.buyerUsername
    )}`,

grossAmount =
  Number(order.amount || 0),

sellerNetAmount =
  Number(
    order.sellerNetAmount ??
    grossAmount
  ),

displayAmount =
  isBuyer
    ? grossAmount
    : sellerNetAmount,

amount =
  `${isBuyer ? '-' : '+'}${
    displayAmount.toLocaleString(
      'th-TH',
      {
        maximumFractionDigits: 2,
      }
    )
  } pts`,

amountColor =
  isBuyer
    ? 'var(--danger)'
    : 'var(--success)';

let action = '';
 if(isBuyer&&order.status==='COMPLETED'){
    const review=order.hasReview?'<span class="badge badge-green history-reviewed-badge">✓ รีวิวแล้ว</span>':
    `<button class="btn btn-primary btn-sm" onclick="openReviewModal(
    ${historyTradeOrderJson(order)})">⭐ รีวิว</button>`;const report=order.hasTransactionReport?
    '<span class="badge badge-green history-report-badge">✓ รายงานแล้ว</span>':`<button class="btn btn-ghost btn-sm history-report-
    btn" onclick="openTransactionReportModal(${Number(order.id)})
    ">🚩 รายงาน</button>`;action=`<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:nowrap">
    <button class="btn btn-ghost btn-sm" onclick="openOrderDetail(${Number(order.id)})">🔐 ดูข้อมูลบัญชี</button>${review}${report}</div>`;}
    const rowColumns=isBuyer
    ? '110px minmax(0,1fr) 88px 100px 340px'
    : '110px minmax(0,1fr) 88px 100px';

    const actionCell=isBuyer
    ? `<div class="history-trade-action" style="display:flex;justify-content:flex-end;align-items:center;min-width:0">${action}</div>`
    : '';

    const feeInfo =
  !isBuyer &&
  Number(
    order.vatRatePercent || 0
  ) > 0
    ? `
      <div
        style="
          margin-top:4px;
          font-size:11px;
          color:var(--muted);
        "
      >
        ราคาขาย
        <span
          style="
            color:var(--text);
            font-weight:600;
          "
        >
          ${grossAmount.toLocaleString(
            'th-TH',
            {
              maximumFractionDigits:2,
            }
          )} pts
        </span>

        • Fee 7%
        <span
          style="
            color:var(--accent2);
            font-weight:700;
          "
        >
          ${Number(
            order.vatAmount || 0
          ).toLocaleString(
            'th-TH',
            {
              maximumFractionDigits:2,
            }
          )} pts
        </span>

        • ได้รับ
        <span
          style="
            color:var(--success);
            font-weight:700;
          "
        >
          ${sellerNetAmount.toLocaleString(
            'th-TH',
            {
              maximumFractionDigits:2,
            }
          )} pts
        </span>
      </div>
    `
    : '';

 return `<div class="card history-trade-row" style="display:grid;grid-template-columns:${rowColumns};align-items:center;column-gap:18px;margin-bottom:12px;padding:16px 20px"><div class="history-trade-preview-wrap" style="display:flex;justify-content:center;align-items:center;justify-self:center">
  ${historyTradePreview(order)}
</div><div
  class="history-trade-info"
  style="
    min-width:0;
    text-align:left
  "
>
  <div
    style="
      font-weight:600;
      font-size:14px
    "
  >
    🎮 ${escapeHistoryText(
      order.product?.title ||
      'สินค้า'
    )}
  </div>

  <div
    style="
      color:var(--muted);
      font-size:12px
    "
  >
    ${escapeHistoryText(
      order.product?.gameName ||
      '-'
    )}
    • ${person}
    • ${historyTradeDate(
      order.createdAt
    )}
  </div>

  ${feeInfo}
</div>
<div class="kanit history-trade-amount" style="font-weight:700;color:${amountColor};white-space:nowrap;min-width:72px;text-align:right">${amount}</div><div class="history-trade-status" style="width:100px;display:flex;justify-content:center;align-items:center;justify-self:center"><span class="badge ${status.className}" style="min-width:70px;text-align:center;display:inline-flex;justify-content:center">${status.label}</span></div>${actionCell}</div>`;}).join('');}
async function loadTradeHistory(){const list=document.getElementById('histTradeList');if(!list)return;list.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted)">กำลังโหลดประวัติซื้อ/ขาย...</div>';try{const r=await fetch('/api/v1/orders',{credentials:'include'}),b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'โหลดประวัติซื้อ/ขายไม่สำเร็จ');const orders=b.data?.orders||b.orders||[];
const completedOrders=Array.isArray(orders)
  ? orders.filter(order=>order.status==='COMPLETED')
  : [];

renderTradeHistory(
  completedOrders,
  window.currentUser?.id||currentUser?.id
);}catch(e){console.error('loadTradeHistory failed:',e);list.innerHTML=`<div class="notice danger">${escapeHistoryText(e.message||'โหลดประวัติซื้อ/ขายไม่สำเร็จ')}</div>`;}}
window.loadTradeHistory=loadTradeHistory;

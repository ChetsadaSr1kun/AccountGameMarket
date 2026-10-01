(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const csrf = () => window.csrfToken || document.cookie.match(/(?:^|; )gm_csrf=([^;]+)/)?.[1] || '';
  const req = (url, options={}) => fetch(url,{credentials:'include',...options});
  const label = s => ({PENDING:'🟡 รอตรวจสอบ',APPROVED:'✅ อนุมัติแล้ว',REJECTED:'❌ ปฏิเสธ'}[s]||esc(s));
  const badge = s => s==='APPROVED'?'badge-green':s==='REJECTED'?'badge-red':'badge-yellow';
  let records=[];
  function row(x){const userId=Number(x.user_id);const name=esc(`${x.first_name||''} ${x.last_name||''}`.trim()||x.username);return `<div class="report-entry"><div class="report-top"><div><div class="report-title-row"><span class="report-title">${name}</span><span class="badge ${badge(x.status)}">${label(x.status)}</span></div><div class="report-meta"><span>@${esc(x.username)}</span><span>${esc(x.email||'-')}</span><span>${x.reviewed_at?new Date(x.reviewed_at).toLocaleString('th-TH'):'ส่งคำขอ '+new Date(x.created_at).toLocaleString('th-TH')}</span></div></div><div class="report-actions"><button class="btn btn-secondary btn-sm" onclick="adminViewSellerVerification(${userId})">👁 ดูรายละเอียด</button>${x.status==='PENDING'?`<button class="btn btn-success btn-sm" onclick="adminApproveSellerVerification(${userId})">✓ อนุมัติ</button><button class="btn btn-danger btn-sm" onclick="adminRejectSellerVerification(${userId})">✗ ปฏิเสธ</button>`:''}</div></div>${x.status==='REJECTED'&&x.rejection_reason?`<div class="report-note" style="margin-top:12px"><strong>เหตุผลปฏิเสธ</strong>${esc(x.rejection_reason)}</div>`:''}</div>`;}
  function render(){const list=document.getElementById('adminSellerVerificationList');if(!list)return;const q=(document.getElementById('adminSellerVerificationSearch')?.value||'').toLowerCase(),s=document.getElementById('adminSellerVerificationStatus')?.value||'ALL';const rows=records.filter(x=>(s==='ALL'||x.status===s)&&(!q||`${x.username} ${x.email} ${x.first_name||''} ${x.last_name||''}`.toLowerCase().includes(q)));list.innerHTML=rows.length?rows.map(row).join(''):'<div class="notice success">ไม่พบรายการตามเงื่อนไข</div>';}
  window.loadAdminSellerVerificationRequests=async()=>{const list=document.getElementById('adminSellerVerificationList');if(list)list.innerHTML='<div class="notice info">กำลังโหลดข้อมูล...</div>';try{const [a,b]=await Promise.all([req('/api/v1/seller-verification/admin/pending'),req('/api/v1/seller-verification/admin/history')]);const pa=await a.json().catch(()=>({})),hb=await b.json().catch(()=>({}));if(!a.ok)throw Error(pa.error?.message||'โหลดคำขอไม่สำเร็จ');if(!b.ok)throw Error(hb.error?.message||'โหลดประวัติไม่สำเร็จ');records=[...(pa.data?.requests||[]),...(hb.data?.history||[])];const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('adminSellerPendingCount',pa.data?.requests?.length||0);set('adminSellerApprovedCount',(hb.data?.history||[]).filter(x=>x.status==='APPROVED').length);set('adminSellerRejectedCount',(hb.data?.history||[]).filter(x=>x.status==='REJECTED').length);render();}catch(e){if(list)list.innerHTML=`<div class="notice warn">${esc(e.message)}</div>`;}};
  window.filterAdminSellerVerification=render;
  async function action(id,a,body){const r=await req(`/api/v1/seller-verification/${id}/${a}`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf()},body:body?JSON.stringify(body):undefined}),b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error?.message||'ดำเนินการไม่สำเร็จ');}
  window.adminApproveSellerVerification=async id=>{if(!confirm('ยืนยันการอนุมัติผู้ขายรายนี้?'))return;try{await action(id,'approve');await window.loadAdminSellerVerificationRequests();}catch(e){alert(e.message);}};
  window.adminRejectSellerVerification=async id=>{const reason=prompt('ระบุเหตุผลที่ปฏิเสธ');if(reason===null)return;try{await action(id,'reject',{reason});await window.loadAdminSellerVerificationRequests();}catch(e){alert(e.message);}};
  window.adminViewSellerVerification = async id => {
  try {
    const r = await req(
      `/api/v1/seller-verification/admin/${id}`
    );

    const b = await r.json().catch(() => ({}));

    if (!r.ok) {
      throw Error(
        b.error?.message || 'โหลดรายละเอียดไม่สำเร็จ'
      );
    }

    const x = b.data?.request;
    const m = document.getElementById(
      'adminSellerVerificationModal'
    );
    const body = document.getElementById(
      'adminSellerVerificationModalBody'
    );

    if (!x || !m || !body) return;

    const docs = x.documents || [];

    const url = type =>
      `/api/v1/seller-verification/admin/${id}/documents/${type}`;

    const doc = (type, name) => {
      const documentInfo = docs.find(
        item => item.document_type === type
      );

      if (!documentInfo) {
        return `
          <div class="seller-admin-doc seller-admin-doc-empty">
            <strong>${name}</strong>
            <div>ไม่พบเอกสาร</div>
          </div>
        `;
      }

      const imageUrl = url(type);

      return `
        <div class="seller-admin-doc">

          <div class="inp-label">
            ${name}
          </div>

          <button
            type="button"
            class="seller-admin-doc-preview-btn"
            onclick="openSellerDocumentPreview(
              '${imageUrl}',
              '${name}'
            )"
            aria-label="ขยายรูป ${name}"
          >
            <img
              src="${imageUrl}"
              alt="${name}"
            >

            <span class="seller-admin-doc-zoom">
              🔍
            </span>
          </button>

          <div class="seller-admin-doc-meta">
            ${Math.ceil(documentInfo.file_size / 1024)} KB
          </div>

        </div>
      `;
    };

    body.innerHTML = `
      <div class="admin-verification-profile">

        <div>
          <span>Username</span>
          <strong>@${esc(x.username)}</strong>
        </div>

        <div>
          <span>ชื่อ</span>
          <strong>
            ${esc(
              `${x.first_name || ''} ${x.last_name || ''}`.trim() || '-'
            )}
          </strong>
        </div>

        <div>
          <span>Email</span>
          <strong>${esc(x.email || '-')}</strong>
        </div>

        <div>
          <span>โทรศัพท์</span>
          <strong>${esc(x.phone || '-')}</strong>
        </div>

        <div>
          <span>วันเกิด</span>
          <strong>
            ${
              x.date_of_birth
                ? esc(
                    x.date_of_birth
                      .split('-')
                      .reverse()
                      .join('/')
                  )
                : '-'
            }
          </strong>
        </div>

        <div>
          <span>สถานะ</span>
          <strong>${label(x.status)}</strong>
        </div>

      </div>

      <h4 style="margin:18px 0 10px">
        📄 เอกสารยืนยัน
      </h4>

      <div class="seller-admin-doc-grid">
        ${doc('ID_FRONT', 'บัตรประชาชนด้านหน้า')}
        ${doc('ID_BACK', 'บัตรประชาชนด้านหลัง')}
        ${doc('SELFIE', 'รูป Selfie')}
      </div>

      ${
        x.rejection_reason
          ? `
            <div class="notice warn" style="margin-top:16px">
              <strong>เหตุผลปฏิเสธ</strong>
              <div style="margin-top:5px">
                ${esc(x.rejection_reason)}
              </div>
            </div>
          `
          : ''
      }

      ${
        x.status === 'PENDING'
          ? `
            <div
              class="report-actions"
              style="margin-top:18px"
            >
              <button
                class="btn btn-danger btn-sm"
                onclick="
                  adminRejectSellerVerification(${id});
                  closeAdminSellerVerificationModal();
                "
              >
                ✗ ปฏิเสธ
              </button>

              <button
                class="btn btn-success btn-sm"
                onclick="
                  adminApproveSellerVerification(${id});
                  closeAdminSellerVerificationModal();
                "
              >
                ✓ อนุมัติ
              </button>
            </div>
          `
          : ''
      }
    `;

    m.hidden = false;

  } catch (e) {
    alert(e.message);
  }
};


window.openSellerDocumentPreview = (src, title) => {
  let modal = document.getElementById(
    'sellerDocumentPreviewModal'
  );

  if (!modal) {
    modal = document.createElement('div');

    modal.id = 'sellerDocumentPreviewModal';
    modal.className = 'seller-document-preview';
    modal.hidden = true;

    modal.innerHTML = `
      <div
        class="seller-document-preview-backdrop"
        onclick="closeSellerDocumentPreview()"
      ></div>

      <div
        class="seller-document-preview-dialog"
        role="dialog"
        aria-modal="true"
      >
        <div class="seller-document-preview-head">

          <strong
            id="sellerDocumentPreviewTitle"
          ></strong>

          <button
            type="button"
            class="seller-document-preview-close"
            onclick="closeSellerDocumentPreview()"
            aria-label="ปิด"
          >
            ✕
          </button>

        </div>

        <div class="seller-document-preview-image-wrap">
          <img
            id="sellerDocumentPreviewImage"
            alt=""
          >
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  }

  const image = document.getElementById(
    'sellerDocumentPreviewImage'
  );

  const heading = document.getElementById(
    'sellerDocumentPreviewTitle'
  );

  image.src = src;
  image.alt = title || 'เอกสารยืนยัน';
  heading.textContent = title || 'เอกสารยืนยัน';

  modal.hidden = false;

  document.body.classList.add(
    'seller-document-preview-open'
  );
};


window.closeSellerDocumentPreview = () => {
  const modal = document.getElementById(
    'sellerDocumentPreviewModal'
  );

  if (!modal) return;

  modal.hidden = true;

  document.body.classList.remove(
    'seller-document-preview-open'
  );
};


document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    window.closeSellerDocumentPreview?.();
  }
});


window.closeAdminSellerVerificationModal = () => {
  const m = document.getElementById(
    'adminSellerVerificationModal'
  );

  if (m) {
    m.hidden = true;
  }
};
})();

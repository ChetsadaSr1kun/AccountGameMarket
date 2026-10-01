let adminTransactionDetailState={reportId:null};
function adminDetailEscape(v){return typeof adminReportEscape==='function'?adminReportEscape(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function adminDetailReason(v){return typeof adminReportReason==='function'?adminReportReason(v):v;}
function adminDetailStatus(v){return typeof adminReportStatus==='function'?adminReportStatus(v):[v,'info'];}
async function openAdminTransactionReportDetail(reportId) {
  adminTransactionDetailState.reportId =
    Number(reportId);

  let report = null;

  try {
    const response = await fetch(
      `/api/v1/transaction-reports/${Number(reportId)}`,
      {
        credentials: 'include',
      }
    );

    const body =
      await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.error?.message ||
        'โหลดรายละเอียดไม่สำเร็จ'
      );
    }

    report =
      body.data?.report ||
      body.report ||
      null;

  } catch (error) {
    console.error(
      'load report detail failed',
      error
    );

    alert(
      error.message ||
      'ไม่สามารถโหลดรายละเอียดรายงานได้'
    );

    return;
  }

  if (!report) {
    alert(
      'ไม่พบข้อมูลรายงานนี้ กรุณารีเฟรชหน้าแล้วลองใหม่'
    );
    return;
  }

  const [
    statusLabel,
    statusTone,
  ] = adminDetailStatus(report.status);

  const formatDate = (value) => {
    if (!value) return '-';

    return new Date(value)
      .toLocaleString('th-TH');
  };

  const isOpen =
    ['PENDING', 'REVIEWED']
      .includes(report.status);

  const reportedStatus =
  String(
    report.reportedStatus || 'ACTIVE'
  ).toUpperCase();

const reportedStatusMeta = {
  ACTIVE: {
    label: 'ใช้งานปกติ',
    tone: 'success',
  },

  BANNED: {
    label: 'ถูกแบนถาวร',
    tone: 'danger',
  },
};

const reportedAccount =
  reportedStatusMeta[reportedStatus] || {
    label: reportedStatus,
    tone: 'info',
  };

let moderationButtons = '';

if (reportedStatus === 'ACTIVE') {
  moderationButtons = `
    <button
      class="btn btn-danger btn-sm"
      type="button"
      onclick="
        adminModerateReportedUser(
          ${Number(report.reportedId)},
          'BANNED'
        )
      "
    >
      🚫 แบนถาวร
    </button>
  `;
}

else if (reportedStatus === 'BANNED') {
  moderationButtons = `
    <button
      class="btn btn-success btn-sm"
      type="button"
      onclick="
        adminModerateReportedUser(
          ${Number(report.reportedId)},
          'ACTIVE'
        )
      "
    >
      ✓ ปลดแบน
    </button>
  `;
}

  const modal =
    document.createElement('div');

  modal.id =
    'adminTransactionDetailModal';

  modal.className =
    'modal-overlay';

  modal.style.display = 'flex';


  const actionButtons =
    report.status === 'PENDING'
      ? `
        <button
          class="btn btn-primary"
          type="button"
          onclick="adminDetailResolve('REVIEWED')"
        >
          📝 รับเคส
        </button>

        <button
          class="btn btn-secondary"
          type="button"
          onclick="adminDetailResolve('DISMISSED')"
        >
          ✓ ไม่พบปัญหา
        </button>

        <button
          class="btn btn-success"
          type="button"
          onclick="adminDetailResolve('RESOLVED')"
        >
          ✓ ดำเนินการแล้ว
        </button>
      `
      : report.status === 'REVIEWED'
        ? `
          <button
            class="btn btn-secondary"
            type="button"
            onclick="adminDetailResolve('DISMISSED')"
          >
            ✓ ไม่พบปัญหา
          </button>

          <button
            class="btn btn-success"
            type="button"
            onclick="adminDetailResolve('RESOLVED')"
          >
            ✓ ดำเนินการแล้ว
          </button>
        `
        : '';


  modal.innerHTML = `
    <div
      class="
        modal-card
        admin-transaction-detail-modal
      "
    >

      <!-- Header -->
      <div class="admin-report-modal-header">

        <div>
          <div class="review-modal-title">
            🚨 รายละเอียดรายงาน
            #${Number(report.id)}
          </div>

          <div class="review-modal-product">
            ตรวจสอบข้อมูลรายงานและธุรกรรมที่เกี่ยวข้อง
          </div>
        </div>

        <div class="admin-report-modal-header-actions">

          <span
            class="
              inline-badge
              ${adminDetailEscape(statusTone)}
            "
          >
            ${adminDetailEscape(statusLabel)}
          </span>

          <button
            class="btn btn-ghost btn-sm"
            type="button"
            onclick="
              closeAdminTransactionReportDetail()
            "
          >
            ✕
          </button>

        </div>
      </div>


      <!-- Reporter / Reported -->
      <div class="admin-report-party-grid">

        <div class="admin-report-party-card">

          <div class="admin-report-party-icon">
            👤
          </div>

          <div>
            <span class="admin-report-party-label">
              ผู้รายงาน
            </span>

            <strong>
              ${adminDetailEscape(
                report.reporterUsername || '-'
              )}
            </strong>

            <small>
              ${adminDetailEscape(
                report.reporterEmail || '-'
              )}
            </small>
          </div>

        </div>


        <div class="admin-report-party-card">

          <div
            class="
              admin-report-party-icon
              reported
            "
          >
            👤
          </div>

          <div>
            <span class="admin-report-party-label">
              ผู้ถูกรายงาน
            </span>

            <strong>
              ${adminDetailEscape(
                report.reportedUsername || '-'
              )}
            </strong>

            <small>
              ${adminDetailEscape(
                report.reportedEmail || '-'
              )}
            </small>
          </div>

        </div>

      </div>


      <!-- Reported user moderation -->
      <div class="admin-report-user-moderation">

        <div>
          <span class="admin-report-party-label">
            สถานะบัญชีผู้ถูกรายงาน
          </span>

          <span
            class="
              inline-badge
              ${adminDetailEscape(
                reportedAccount.tone
              )}
            "
          >
            ${adminDetailEscape(
              reportedAccount.label
            )}
          </span>
        </div>

        <div class="admin-report-user-moderation-actions">
          ${moderationButtons}
        </div>

      </div>


      <!-- Reason -->
      <div class="admin-detail-block">

        <div class="admin-detail-label">
          📄 เหตุผลการรายงาน
        </div>

        <div class="admin-report-reason-box">

          <span class="inline-badge danger">
            ${adminDetailEscape(
              adminDetailReason(
                report.reason
              )
            )}
          </span>

        </div>
      </div>


      <!-- Description -->
      <div class="admin-detail-block">

        <div class="admin-detail-label">
          💬 รายละเอียดจากผู้รายงาน
        </div>

        <div class="admin-detail-description">
          ${adminDetailEscape(
            report.description ||
            'ไม่ได้ระบุรายละเอียด'
          )}
        </div>

      </div>


      <!-- Transaction -->
      <div class="admin-detail-block">

        <div class="admin-detail-label">
          💰 ข้อมูลธุรกรรม
        </div>

        <div class="admin-report-transaction-box">

          <div class="admin-report-transaction-grid">

            <div>
              <span>Order</span>
              <strong>
                #${Number(report.orderId)}
              </strong>
            </div>

            <div>
              <span>เกม</span>
              <strong>
                ${adminDetailEscape(
                  report.gameName || '-'
                )}
              </strong>
            </div>

            <div class="wide">
              <span>ชื่อสินค้า</span>
              <strong>
                ${adminDetailEscape(
                  report.productTitle || '-'
                )}
              </strong>
            </div>

            <div>
              <span>ราคาสินค้า</span>
              <strong>
                ${
                  report.productPrice == null
                    ? '-'
                    : Number(
                        report.productPrice
                      ).toLocaleString(
                        'th-TH'
                      ) + ' ฿'
                }
              </strong>
            </div>

            <div>
              <span>ยอดทำรายการ</span>
              <strong>
                ${Number(
                  report.amount || 0
                ).toLocaleString(
                  'th-TH'
                )} ฿
              </strong>
            </div>

            <div>
              <span>สถานะ Order</span>
              <strong>
                ${adminDetailEscape(
                  report.orderStatus || '-'
                )}
              </strong>
            </div>

            <div>
              <span>สถานะสินค้า</span>
              <strong>
                ${adminDetailEscape(
                  report.productStatus || '-'
                )}
              </strong>
            </div>

            <div>
              <span>วันที่ทำรายการ</span>
              <strong>
                ${formatDate(
                  report.orderCreatedAt
                )}
              </strong>
            </div>

            <div>
              <span>เสร็จสิ้นเมื่อ</span>
              <strong>
                ${formatDate(
                  report.orderCompletedAt
                )}
              </strong>
            </div>

          </div>

        </div>
      </div>


      <!-- Admin note -->
      <div class="admin-detail-block">

        <div class="admin-detail-label">
          📝 หมายเหตุ Admin
        </div>

        <textarea
          id="adminTransactionDetailNote"
          maxlength="500"
          placeholder="เพิ่มหมายเหตุสำหรับการดำเนินการ (ไม่บังคับ)"
          ${isOpen ? '' : 'readonly'}
        >${adminDetailEscape(
          report.adminNote || ''
        )}</textarea>

      </div>


      <!-- Footer -->
      <div class="admin-report-modal-footer">

        <button
          class="btn btn-ghost"
          type="button"
          onclick="
            closeAdminTransactionReportDetail()
          "
        >
          ปิด
        </button>

        <div class="admin-report-modal-actions">
          ${actionButtons}
        </div>

      </div>

      <div
        id="adminTransactionDetailMessage"
        class="review-message"
      ></div>

    </div>
  `;

  document.body.appendChild(modal);
}

function closeAdminTransactionReportDetail(){document.getElementById('adminTransactionDetailModal')?.remove();adminTransactionDetailState.reportId=null;}
function adminOpenReportedProduct(productId){const id=Number(productId);if(!Number.isInteger(id)||id<=0){alert('ไม่พบ Product ID ของรายการนี้');return;}closeAdminTransactionReportDetail();if(typeof window.adminOpenProduct==='function'){window.adminOpenProduct(id);return;}if(typeof goAdmin==='function')goAdmin('admin-products');}
async function adminModerateReportedUser(
  userId,
  status
) {
  const id = Number(userId);

  if (!Number.isInteger(id) || id <= 0) {
    alert('ไม่พบ User ID ที่ต้องการจัดการ');
    return;
  }

  const normalizedStatus =
    String(status || '')
      .trim()
      .toUpperCase();

  const labels = {
    ACTIVE: 'ปลดแบนบัญชี',
    BANNED: 'แบนบัญชีถาวร',
    };

  if (!labels[normalizedStatus]) {
    alert('สถานะบัญชีไม่ถูกต้อง');
    return;
  }

  let reason = null;

  if (normalizedStatus === 'BANNED') {
    reason = prompt(
        'ระบุเหตุผลสำหรับการแบนบัญชีนี้'
    );

    if (
      reason === null ||
      !reason.trim()
    ) {
      return;
    }

    reason = reason.trim();

    if (reason.length > 500) {
      alert(
        'เหตุผลต้องไม่เกิน 500 ตัวอักษร'
      );
      return;
    }
  }

  const confirmed = confirm(
    normalizedStatus === 'ACTIVE'
        ? 'ยืนยันปลดแบนและเปิดใช้งานบัญชีนี้อีกครั้งหรือไม่?'
        : 'ยืนยันแบนผู้ใช้รายนี้แบบถาวรหรือไม่?'
    );

  if (!confirmed) return;

  const token =
    typeof csrfToken !== 'undefined'
      ? (
          csrfToken ||
          getCookieValue('gm_csrf')
        )
      : getCookieValue('gm_csrf');

  const message =
    document.getElementById(
      'adminTransactionDetailMessage'
    );

  if (!token) {
    if (message) {
      message.textContent =
        'ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้า';
    }

    return;
  }

  const currentReportId =
    Number(
      adminTransactionDetailState.reportId
    );

  try {
    const response = await fetch(
      `/api/v1/admin/moderation/users/${id}/status`,
      {
        method: 'PATCH',
        credentials: 'include',

        headers: {
          'Content-Type':
            'application/json',

          'X-CSRF-Token':
            token,
        },

        body: JSON.stringify({
          status: normalizedStatus,
          reason,
        }),
      }
    );

    const body =
      await response.json().catch(
        () => ({})
      );

    if (!response.ok) {
      throw new Error(
        body.error?.message ||
        'จัดการบัญชีไม่สำเร็จ'
      );
    }

    closeAdminTransactionReportDetail();

    await window
      .loadAdminTransactionReports?.();

    if (
      Number.isInteger(currentReportId) &&
      currentReportId > 0
    ) {
      await openAdminTransactionReportDetail(
        currentReportId
      );
    }

    if (typeof showToast === 'function') {
      showToast(
        `${labels[normalizedStatus]}แล้ว`,
        'success'
      );
    }

  } catch (error) {
    if (message) {
      message.textContent =
        error.message ||
        'จัดการบัญชีไม่สำเร็จ';
    } else {
      alert(
        error.message ||
        'จัดการบัญชีไม่สำเร็จ'
      );
    }
  }
}
async function adminDetailResolve(status){const id=adminTransactionDetailState.reportId;const note=document.getElementById('adminTransactionDetailNote')?.value.trim()||'';const token=typeof csrfToken!=='undefined'?(csrfToken||getCookieValue('gm_csrf')):getCookieValue('gm_csrf');const msg=document.getElementById('adminTransactionDetailMessage');if(!token){if(msg)msg.textContent='ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้า';return;}try{const r=await fetch(`/api/v1/transaction-reports/${Number(id)}`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({status,adminNote:note})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'บันทึกไม่สำเร็จ');closeAdminTransactionReportDetail();await window.loadAdminTransactionReports?.();if(typeof showToast==='function')showToast('บันทึกผลการตรวจสอบแล้ว','success');}catch(e){if(msg)msg.textContent=e.message||'บันทึกไม่สำเร็จ';}}
window.openAdminTransactionReportDetail=openAdminTransactionReportDetail;window.closeAdminTransactionReportDetail=closeAdminTransactionReportDetail;window.adminDetailResolve=adminDetailResolve;
window.adminModerateReportedUser =
  adminModerateReportedUser;
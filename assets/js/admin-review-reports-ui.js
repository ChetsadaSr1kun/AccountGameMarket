function adminReviewReportEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function adminReviewReportStars(r){const n=Math.max(0,Math.min(5,Number(r)||0));return '★★★★★'.split('').map((s,i)=>`<span class="admin-report-star ${i<n?'is-filled':''}">${s}</span>`).join('');}
function adminReviewReportReason(reason) {
  return ({
    FALSE_REVIEW: 'รีวิวไม่เป็นความจริง',
    INAPPROPRIATE: 'เนื้อหาไม่เหมาะสม',
    SPAM: 'สแปม',
    FRAUD: 'กล่าวหาหรือบิดเบือนข้อเท็จจริง',
    ABUSE: 'ใช้คำไม่เหมาะสม / คุกคาม',
    OTHER: 'อื่น ๆ',
  })[reason] || reason || '-';
}

function adminReviewReportRowsByFilter(filter) {
  const reports =
    Array.isArray(
      window.adminReviewReportAll
    )
      ? window.adminReviewReportAll
      : [];

  if (filter === 'REMOVED') {
    return reports.filter(
      report =>
        report.status === 'REMOVED'
    );
  }

  if (filter === 'RESOLVED') {
    return reports.filter(
      report =>
        report.status === 'DISMISSED' ||
        report.status === 'REVIEWED'
    );
  }

  return reports.filter(
    report =>
      report.status === 'PENDING'
  );
}

function updateAdminReviewReportCounts() {
  const reports =
    Array.isArray(
      window.adminReviewReportAll
    )
      ? window.adminReviewReportAll
      : [];

  const pending =
    reports.filter(
      report =>
        report.status === 'PENDING'
    ).length;

  const resolved =
    reports.filter(
      report =>
        report.status === 'DISMISSED' ||
        report.status === 'REVIEWED'
    ).length;

  const removed =
    reports.filter(
      report =>
        report.status === 'REMOVED'
    ).length;

  const pendingEl =
    document.getElementById(
      'adminReviewReportPendingCount'
    );

  const resolvedEl =
    document.getElementById(
      'adminReviewReportResolvedCount'
    );

  const removedEl =
    document.getElementById(
      'adminReviewReportRemovedCount'
    );

  if (pendingEl) {
    pendingEl.textContent =
      String(pending);
  }

  if (resolvedEl) {
    resolvedEl.textContent =
      String(resolved);
  }

  if (removedEl) {
    removedEl.textContent =
      String(removed);
  }
}

function adminSetReviewReportFilter(
  filter = 'PENDING'
) {
  const allowed =
    new Set([
      'PENDING',
      'RESOLVED',
      'REMOVED',
    ]);

  const current =
    allowed.has(filter)
      ? filter
      : 'PENDING';

  window.adminReviewReportFilter =
    current;

  document
    .querySelectorAll(
      '[data-review-report-filter]'
    )
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset
          .reviewReportFilter ===
          current
      );
    });

  renderAdminReviewReports(
    adminReviewReportRowsByFilter(
      current
    )
  );
}

async function loadAdminReviewReports() {
  const list =
    document.getElementById(
      'adminReviewReportList'
    );

  const msg =
    document.getElementById(
      'adminReviewReportMessage'
    );

  if (!list) return;

  list.innerHTML = `
    <div class="seller-rating-loading">
      กำลังโหลดรายงานรีวิว...
    </div>
  `;

  if (msg) {
    msg.textContent = '';
  }

  try {
    const response =
      await fetch(
        '/api/v1/review-reports/admin',
        {
          credentials: 'include',
        }
      );

    const body =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.error?.message ||
        'โหลดรายงานรีวิวไม่สำเร็จ'
      );
    }

    const reports =
      body.data?.reports ||
      body.reports ||
      [];

    window.adminReviewReportAll =
      Array.isArray(reports)
        ? reports
        : [];

    updateAdminReviewReportCounts();

    adminSetReviewReportFilter(
      window.adminReviewReportFilter ||
      'PENDING'
    );


  } catch (error) {
    console.error(
      'loadAdminReviewReports failed:',
      error
    );

    list.innerHTML = `
      <div class="notice danger">
        ${adminReviewReportEscape(
          error.message ||
          'โหลดรายงานรีวิวไม่สำเร็จ'
        )}
      </div>
    `;
  }
}

function adminReviewReportStatusMeta(status) {
  if (status === 'REMOVED') {
    return {
      badgeClass: 'danger',
      label: '🚫 ซ่อนรีวิวแล้ว',
    };
  }

  if (status === 'DISMISSED') {
    return {
      badgeClass: 'success',
      label: '✅ ไม่พบปัญหา',
    };
  }

  if (status === 'REVIEWED') {
    return {
      badgeClass: 'info',
      label: '✅ ดำเนินการแล้ว',
    };
  }

  return {
    badgeClass: 'warn',
    label: '⏳ รอตรวจสอบ',
  };
}

function renderAdminReviewReports(reports) {
  const rows =
    Array.isArray(reports)
      ? reports
      : [];

  const list =
    document.getElementById(
      'adminReviewReportList'
    );

  const count =
    document.getElementById(
      'adminReviewReportCount'
    );

  const currentFilter =
  window.adminReviewReportFilter ||
  'PENDING';

  const viewMeta =
    currentFilter === 'REMOVED'
      ? {
          countLabel: 'รายการที่ซ่อนรีวิวแล้ว',
          emptyTitle:
            'ไม่มีรายงานที่ซ่อนรีวิวแล้ว',
          emptyText:
            'รายงานที่ Admin ซ่อนรีวิวจะแสดงที่นี่',
        }
      : currentFilter === 'RESOLVED'
        ? {
            countLabel: 'รายการที่ดำเนินการแล้ว',
            emptyTitle:
              'ยังไม่มีรายงานที่ดำเนินการแล้ว',
            emptyText:
              'รายงานที่ตรวจแล้วและไม่พบปัญหาจะแสดงที่นี่',
          }
        : {
            countLabel: 'รายการรอตรวจ',
            emptyTitle:
              'ไม่มีรายงานรีวิวที่รอตรวจสอบ',
            emptyText:
              'เมื่อมีผู้ใช้รายงานรีวิว รายการจะแสดงที่นี่',
          };

  if (count) {
    count.textContent =
      `${rows.length} ${viewMeta.countLabel}`;
  }
  if (!list) return;

  if (!rows.length) {
    list.innerHTML = `
      <div class="admin-review-report-empty">

        <div class="admin-review-report-empty-icon">
          ⭐
        </div>

        <strong>
          ${viewMeta.emptyTitle}
        </strong>

        <span>
          ${viewMeta.emptyText}
        </span>

      </div>
    `;

    window.adminReviewReports = [];
    return;
  }

  list.innerHTML = rows
    .map(report => {
      const statusMeta =
        adminReviewReportStatusMeta(
          report.status
        );

      const isPending =
        report.status === 'PENDING';
      const date =
        report.createdAt
          ? new Date(
              report.createdAt
            ).toLocaleString('th-TH')
          : '-';

      const comment =
        report.comment ||
        'ไม่ได้เขียนความคิดเห็น';

      return `
        <article
          class="
            report-entry
            admin-review-report-entry
            status-${statusMeta.badgeClass}
          "
        >

          <div class="admin-review-report-head">

            <div>
              <strong>
                รายงาน #${Number(report.id)}
              </strong>

              <span
                class="inline-badge ${statusMeta.badgeClass}"
              >
                ${statusMeta.label}
              </span>
            </div>

            <time>
              ${adminReviewReportEscape(date)}
            </time>

          </div>


          <div class="admin-review-report-meta">

            <div>
              <span>👤 ผู้รายงาน</span>
              <strong>
                ${adminReviewReportEscape(
                  report.reporterUsername || '-'
                )}
              </strong>
            </div>

            <div>
              <span>⭐ ผู้รีวิว</span>
              <strong>
                ${adminReviewReportEscape(
                  report.reviewerUsername || '-'
                )}
              </strong>
            </div>

            <div>
              <span>🏪 ผู้ขาย</span>
              <strong>
                ${adminReviewReportEscape(
                  report.sellerUsername || '-'
                )}
              </strong>
            </div>

          </div>


          <div class="admin-review-report-content">

            <div class="admin-review-report-review">

              <div class="admin-review-report-stars">
                ${adminReviewReportStars(
                  report.rating
                )}

                <strong>
                  ${Number(report.rating || 0)}/5
                </strong>
              </div>

              <p>
                ${adminReviewReportEscape(comment)}
              </p>

            </div>

            <div class="admin-review-report-reason">

              <span>
                เหตุผลที่รายงาน
              </span>

              <strong>
                ${adminReviewReportEscape(
                  adminReviewReportReason(
                    report.reason
                  )
                )}
              </strong>

              ${
                report.description
                  ? `
                    <p>
                      ${adminReviewReportEscape(
                        report.description
                      )}
                    </p>
                  `
                  : ''
              }

            </div>

          </div>


          <div class="admin-review-report-actions">

          <button
            class="btn btn-secondary btn-sm"
            type="button"
            onclick="
              openAdminReviewReportDetail(
                ${Number(report.id)}
              )
            "
          >
            🔍 ดูรายละเอียด
          </button>

          ${
            isPending
              ? `
                <button
                  class="btn btn-secondary btn-sm"
                  type="button"
                  onclick="
                    resolveAdminReviewReport(
                      ${Number(report.id)},
                      'DISMISSED'
                    )
                  "
                >
                  ✅ ไม่พบปัญหา
                </button>

                <button
                  class="btn btn-danger btn-sm"
                  type="button"
                  onclick="
                    resolveAdminReviewReport(
                      ${Number(report.id)},
                      'REMOVED'
                    )
                  "
                >
                  🚫 ซ่อนรีวิว
                </button>
              `
              : ''
          }

        </div>

        </article>
      `;
    })
    .join('');

  window.adminReviewReports = rows;
}
function openAdminReviewReportDetail(reportId){const x=(window.adminReviewReports||[]).find(r=>Number(r.id)===Number(reportId));if(!x)return;alert(`รายงาน #${x.id}\n\nเหตุผล: ${adminReviewReportReason(x.reason)}\n\nผู้รายงาน: ${x.reporterUsername||'-'}\nผู้รีวิว: ${x.reviewerUsername||'-'}\nผู้ขาย: ${x.sellerUsername||'-'}\n\nรีวิว:\n${x.comment||'ไม่ได้เขียนความคิดเห็น'}${x.description?`\n\nรายละเอียดการรายงาน:\n${x.description}`:''}`);}
async function resolveAdminReviewReport(reportId,action){const label=action==='REMOVED'?'ซ่อนรีวิว':'ปิดรายงานโดยไม่พบปัญหา';if(!confirm(`ยืนยันการ${label}หรือไม่?`))return;const token=typeof csrfToken!=='undefined'?(csrfToken||getCookieValue('gm_csrf')):getCookieValue('gm_csrf');if(!token){alert('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่');return;}try{const r=await fetch(`/api/v1/review-reports/${Number(reportId)}`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({action,adminNote:action==='REMOVED'?'ซ่อนรีวิวเนื่องจากละเมิดแนวทางการใช้งาน':''})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'ดำเนินการกับรายงานไม่สำเร็จ');await loadAdminReviewReports();}catch(e){console.error('resolveAdminReviewReport failed:',e);alert(e.message||'ดำเนินการไม่สำเร็จ');}}
function initAdminReviewReports(){const page=document.getElementById('pg-admin-report');if(page&&!page.dataset.reviewReportsBound){page.dataset.reviewReportsBound='1';loadAdminReviewReports();}}
window.loadAdminReviewReports=loadAdminReviewReports;window.resolveAdminReviewReport=resolveAdminReviewReport;window.openAdminReviewReportDetail=openAdminReviewReportDetail;
window.adminSetReviewReportFilter =
  adminSetReviewReportFilter;

function injectAdminReviewReportPanel() {
  const host =
    document.getElementById(
      'adminReviewReportView'
    );

  if (
    !host ||
    document.getElementById(
      'admin-review-report-panel'
    )
  ) {
    return;
  }

  const panel =
    document.createElement('div');

  panel.id =
    'admin-review-report-panel';

  panel.className =
    'card admin-review-report-panel';

  panel.innerHTML = `
    <div class="report-panel">

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          margin-bottom:18px;
        "
      >
        <div>
          <div style="font-weight:700;font-size:16px">
            รายการรายงานรีวิว
          </div>

          <div
            style="
              color:var(--muted);
              font-size:12px;
              margin-top:3px;
            "
          >
            ตรวจสอบรีวิวที่ถูกรายงานจากผู้ใช้งาน
          </div>
        </div>

        <button
          class="btn btn-secondary btn-sm"
          onclick="loadAdminReviewReports()"
        >
          ↻ รีเฟรช
        </button>
      </div>

      <div
        class="
          report-summary-grid
          admin-review-report-summary
        "
      >

        <button
          type="button"
          class="report-stat warn"
          data-review-report-filter="PENDING"
          onclick="
            adminSetReviewReportFilter(
              'PENDING'
            )
          "
        >
          <div class="label">
            ⏳ รอตรวจสอบ
          </div>

          <div
            id="adminReviewReportPendingCount"
            class="value"
          >
            0
          </div>

          <div class="sub">
            รายงานที่ยังรอ Admin ตรวจสอบ
          </div>
        </button>


        <button
          type="button"
          class="report-stat success"
          data-review-report-filter="RESOLVED"
          onclick="
            adminSetReviewReportFilter(
              'RESOLVED'
            )
          "
        >
          <div class="label">
            ✅ ดำเนินการแล้ว
          </div>

          <div
            id="adminReviewReportResolvedCount"
            class="value"
          >
            0
          </div>

          <div class="sub">
            รายงานที่ตรวจแล้วและไม่พบปัญหา
          </div>
        </button>


        <button
          type="button"
          class="report-stat danger"
          data-review-report-filter="REMOVED"
          onclick="
            adminSetReviewReportFilter(
              'REMOVED'
            )
          "
        >
          <div class="label">
            🚫 ซ่อนรีวิวแล้ว
          </div>

          <div
            id="adminReviewReportRemovedCount"
            class="value"
          >
            0
          </div>

          <div class="sub">
            รายงานที่ Admin ซ่อนรีวิวแล้ว
          </div>
        </button>

      </div>

      <div
        id="adminReviewReportMessage"
        class="admin-review-report-message"
      ></div>

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin:18px 0 12px;
        "
      >
        <div style="font-weight:700">
          รายการรายงาน
        </div>

        <div
          id="adminReviewReportCount"
          style="
            color:var(--muted);
            font-size:12px;
          "
        >
          กำลังโหลด...
        </div>
      </div>

      <div
        id="adminReviewReportList"
        class="report-list"
      ></div>

    </div>
  `;

  host.appendChild(panel);
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    injectAdminReviewReportPanel
  );
} else {
  injectAdminReviewReportPanel();
}
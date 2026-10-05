let adminTransactionReports=[];
let adminReportFilterState={query:'',status:'ALL',reason:'ALL',range:'LATEST'};
function adminReportEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function adminReportReason(r){return ({SCAM:'หลอกลวง / พยายามโกง',ITEM_NOT_AS_DESCRIBED:'สินค้าไม่ตรงตามรายละเอียด',NO_DELIVERY:'ไม่ได้รับสินค้า / ไม่ส่งข้อมูล',HARASSMENT:'คำหยาบ / การคุกคาม',CHAT_ABUSE:'พฤติกรรมไม่เหมาะสมในการพูดคุย',OTHER:'อื่น ๆ'})[r]||r;}
function adminReportStatus(status) {
  return ({
    PENDING: [
      'รอตรวจสอบ',
      'danger',
    ],

    REVIEWED: [
      'กำลังตรวจสอบ',
      'warn',
    ],

    RESOLVED: [
      'ดำเนินการแล้ว',
      'success',
    ],

    DISMISSED: [
      'ไม่พบปัญหา',
      'info',
    ],
  })[status] || [status, 'info'];
}
function updateAdminReportSummary(reports) {
  const pending = reports.filter(
    (report) =>
      report.status === 'PENDING'
  ).length;

  const reviewed = reports.filter(
    (report) =>
      report.status === 'REVIEWED'
  ).length;

  const resolved = reports.filter(
    (report) =>
      report.status === 'RESOLVED'
  ).length;

  const dismissed = reports.filter(
    (report) =>
      report.status === 'DISMISSED'
  ).length;

  const set = (id, value) => {
    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = String(value);
    }
  };

  set(
    'adminReportStatPending',
    pending
  );

  set(
    'adminReportStatReviewed',
    reviewed
  );

  set(
    'adminReportStatResolved',
    resolved
  );

  set(
    'adminReportStatDismissed',
    dismissed
  );

  const meta =
    document.getElementById(
      'adminReportUpdatedAt'
    );

  if (meta) {
    meta.textContent =
      `ทั้งหมด ${reports.length.toLocaleString(
        'th-TH'
      )} รายการ • อัปเดต ${new Date()
        .toLocaleString('th-TH')}`;
  }
}
function adminReportMatchesRange(r){const created=new Date(r.createdAt||0).getTime();if(Number.isNaN(created))return true;const now=Date.now();const day=86400000;switch(adminReportFilterState.range){case'TODAY':return created>=new Date(new Date().setHours(0,0,0,0)).getTime();case'7D':return created>=now-7*day;case'30D':return created>=now-30*day;default:return true;}}
function getFilteredAdminReports(){const q=adminReportFilterState.query.toLowerCase();return adminTransactionReports.filter(r=>{if(adminReportFilterState.status!=='ALL'&&r.status!==adminReportFilterState.status)return false;if(adminReportFilterState.reason!=='ALL'&&r.reason!==adminReportFilterState.reason)return false;if(!adminReportMatchesRange(r))return false;if(!q)return true;return [r.reporterUsername,r.reportedUsername,r.productTitle,r.orderId,r.reason,r.description].some(v=>String(v??'').toLowerCase().includes(q));});}
function renderAdminTransactionReports(reports){adminTransactionReports=Array.isArray(reports)?reports:[];window.__adminTransactionReports=adminTransactionReports;updateAdminReportSummary(adminTransactionReports);renderFilteredAdminTransactionReports();}
function renderFilteredAdminTransactionReports() {
  const box =
    document.getElementById(
      'adminTransactionReportList'
    );

  if (!box) return;

  const reports =
    getFilteredAdminReports();

  if (!reports.length) {
    box.innerHTML = `
      <div class="report-empty">
        ไม่พบรายงานตามเงื่อนไขที่เลือก
      </div>
    `;

    return;
  }

  box.innerHTML = reports
    .map((report) => {
      const [statusLabel, statusTone] =
        adminReportStatus(
          report.status
        );

      const date = report.createdAt
        ? new Date(
            report.createdAt
          ).toLocaleString('th-TH')
        : '-';

      return `
        <article
          class="report-entry admin-report-row"
          onclick="
            window.openAdminTransactionReportDetail(
              ${Number(report.id)}
            )
          "
        >
          <div class="admin-report-row-id">
            <strong>
              #${Number(report.id)}
            </strong>

            <span>
              ${date}
            </span>
          </div>

          <div class="admin-report-row-users">
            <div>
              <span class="admin-report-user-icon">
                👤
              </span>

              <div>
                <strong>
                  ${adminReportEscape(
                    report.reporterUsername ||
                    '-'
                  )}
                </strong>

                <span>
                  ผู้รายงาน
                </span>
              </div>
            </div>

            <span class="admin-report-arrow">
              →
            </span>

            <div>
              <span class="admin-report-user-icon muted">
                👤
              </span>

              <div>
                <strong>
                  ${adminReportEscape(
                    report.reportedUsername ||
                    '-'
                  )}
                </strong>

                <span>
                  ผู้ถูกรายงาน
                </span>
              </div>
            </div>
          </div>

          <div class="admin-report-row-info">
            <strong>
              ${adminReportEscape(
                adminReportReason(
                  report.reason
                )
              )}
            </strong>

            <span>
              Order #${Number(
                report.orderId
              )}
              •
              ${adminReportEscape(
                report.productTitle ||
                'สินค้า'
              )}
            </span>
          </div>

          <div class="admin-report-row-amount">
            <span>
              ยอดทำรายการ
            </span>

            <strong>
              ${Number(
                report.amount || 0
              ).toLocaleString(
                'th-TH'
              )} ฿
            </strong>
          </div>

          <div class="admin-report-row-status">
            <span
              class="inline-badge ${statusTone}"
            >
              ${adminReportEscape(
                statusLabel
              )}
            </span>

            <span class="admin-report-chevron">
              ›
            </span>
          </div>
        </article>
      `;
    })
    .join('');
}
async function loadAdminTransactionReports(){const box=document.getElementById('adminTransactionReportList');if(!box)return;box.innerHTML='<div class="report-empty">กำลังโหลดรายงานการทำรายการ...</div>';try{const r=await fetch('/api/v1/transaction-reports/admin',{credentials:'include'});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'โหลดรายงานไม่สำเร็จ');renderAdminTransactionReports(b.data?.reports||b.reports||[]);}catch(e){console.error('loadAdminTransactionReports failed:',e);box.innerHTML=`<div class="notice danger">${adminReportEscape(e.message||'โหลดรายงานไม่สำเร็จ')}</div>`;}}
function applyAdminReportFilter(){adminReportFilterState={query:document.getElementById('adminReportSearch')?.value.trim()||'',status:document.getElementById('adminReportStatusFilter')?.value||'ALL',reason:document.getElementById('adminReportReasonFilter')?.value||'ALL',range:document.getElementById('adminReportRangeFilter')?.value||'LATEST'};renderFilteredAdminTransactionReports();}
function resetAdminReportFilters(){['adminReportSearch','adminReportStatusFilter','adminReportReasonFilter','adminReportRangeFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=id==='adminReportStatusFilter'||id==='adminReportReasonFilter'?'ALL':id==='adminReportRangeFilter'?'LATEST':'';});applyAdminReportFilter();}
async function adminReviewTransactionReport(reportId,status){const labels={REVIEWED:'รับเคส',DISMISSED:'ไม่พบปัญหา',RESOLVED:'ดำเนินการแล้ว'};if(!confirm(`ยืนยันการดำเนินการ: ${labels[status]||status}`))return;const token=typeof csrfToken!=='undefined'?(csrfToken||getCookieValue('gm_csrf')):getCookieValue('gm_csrf');if(!token){alert('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้า');return;}try{const r=await fetch(`/api/v1/transaction-reports/${Number(reportId)}`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({status})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'บันทึกการดำเนินการไม่สำเร็จ');await loadAdminTransactionReports();if(typeof showToast==='function')showToast('อัปเดตรายงานแล้ว','success');}catch(e){alert(e.message||'บันทึกการดำเนินการไม่สำเร็จ');}}
async function loadAdminDashboardSummary() {
  const root = document.getElementById('adminDashboardUserCount');

  if (!root) return;

  const set = (id, value) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  };

  try {
    const response = await fetch('/api/v1/admin/dashboard', {
      credentials: 'include',
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.error?.message || 'โหลด Dashboard ไม่สำเร็จ'
      );
    }

    const summary = body.data?.summary || {};
    const totals = summary.totals || {};
    const actions = summary.actionCounts || {};

    set(
      'adminDashboardUserCount',
      Number(totals.users || 0).toLocaleString('th-TH')
    );

    set(
      'adminDashboardProductCount',
      Number(totals.activeProducts || 0).toLocaleString('th-TH')
    );

    const netCashFlow = Number(totals.netCashFlow || 0);

    set(
      'adminDashboardNetProfit',
      `${netCashFlow.toLocaleString('th-TH')} ฿`
    );

    const profitElement =
      document.getElementById('adminDashboardNetProfit');

    if (profitElement) {
      profitElement.style.color =
        netCashFlow < 0 ? 'var(--danger)' : '#16b364';
    }

    set(
      'adminDashboardCompletedOrderCount',
      Number(totals.completedOrders || 0).toLocaleString('th-TH')
    );

    set(
      'adminDashboardSellerPending',
      Number(actions.sellerVerificationPending || 0)
        .toLocaleString('th-TH')
    );

    set(
      'adminDashboardWithdrawalPending',
      Number(actions.withdrawalPending || 0)
        .toLocaleString('th-TH')
    );

    set(
      'adminDashboardTransactionReportPending',
      Number(actions.transactionReportsOpen || 0)
        .toLocaleString('th-TH')
    );

    set(
      'adminDashboardReviewReportPending',
      Number(actions.reviewReportsPending || 0)
        .toLocaleString('th-TH')
    );


    /* =====================
       Recent transactions
       ===================== */

    const recent =
      document.getElementById('adminDashboardRecentTransactions');

    if (recent) {
      const rows = summary.recentTransactions || [];

      recent.innerHTML = rows.length
        ? rows.map((item) => {
            const image = item.game_image_url
              ? `
                <img
                  src="${adminReportEscape(item.game_image_url)}"
                  alt=""
                  loading="lazy"
                >
              `
              : '🎮';

            const dateValue =
              item.completed_at || item.created_at;

            const date = dateValue
              ? new Date(dateValue).toLocaleString('th-TH')
              : '-';

            return `
              <div class="admin-dashboard-recent-row">

                <div class="admin-dashboard-recent-icon">
                  ${image}
                </div>

                <div class="admin-dashboard-recent-main">
                  <strong>
                    ${adminReportEscape(item.buyer_username)}
                    →
                    ${adminReportEscape(item.seller_username)}
                  </strong>

                  <span>
                    ${adminReportEscape(item.game_name)}
                    •
                    ${Number(item.amount || 0).toLocaleString('th-TH')} ฿
                  </span>
                </div>

                <div class="admin-dashboard-recent-date">
                  ${date}
                </div>

                <span class="admin-dashboard-success-badge">
                  สำเร็จ
                </span>

              </div>
            `;
          }).join('')
        : `
          <div class="report-empty">
            ยังไม่มีธุรกรรมที่สำเร็จ
          </div>
        `;
    }


    /* =====================
       Popular games
       ===================== */

    const popular =
      document.getElementById('adminDashboardPopularGames');

    if (popular) {
      const rows = summary.popularGames || [];

      const maxOrders = Math.max(
        0,
        ...rows.map(
          (item) => Number(item.order_count || 0)
        )
      );

      popular.innerHTML = rows.length
        ? rows.map((item, index) => {
            const count =
              Number(item.order_count || 0);

            const percentage =
              maxOrders > 0
                ? Math.round(
                    (count / maxOrders) * 100
                  )
                : 0;

            const image = item.image_url
              ? `
                <img
                  src="${adminReportEscape(item.image_url)}"
                  alt=""
                  loading="lazy"
                >
              `
              : '🎮';

            return `
              <div class="admin-dashboard-game-row">

                <div
                  class="admin-dashboard-game-rank
                    ${index === 0 ? 'is-first' : ''}"
                >
                  ${index + 1}
                </div>

                <div class="admin-dashboard-game-image">
                  ${image}
                </div>

                <div class="admin-dashboard-game-name">
                  ${adminReportEscape(item.name)}
                </div>

                <div class="admin-dashboard-game-bar">
                  <span style="width:${percentage}%"></span>
                </div>

                <div class="admin-dashboard-game-count">
                  ${count.toLocaleString('th-TH')} ออเดอร์
                </div>

              </div>
            `;
          }).join('')
        : `
          <div class="report-empty">
            ยังไม่มีข้อมูลเกม
          </div>
        `;
    }

  } catch (error) {
    console.error(
      'loadAdminDashboardSummary failed:',
      error
    );

    [
      'adminDashboardUserCount',
      'adminDashboardProductCount',
      'adminDashboardNetProfit',
      'adminDashboardCompletedOrderCount',
      'adminDashboardSellerPending',
      'adminDashboardWithdrawalPending',
      'adminDashboardTransactionReportPending',
      'adminDashboardReviewReportPending',
    ].forEach((id) => set(id, '—'));
  }
}
window.loadAdminTransactionReports=loadAdminTransactionReports;window.adminReviewTransactionReport=adminReviewTransactionReport;window.applyAdminReportFilter=applyAdminReportFilter;window.resetAdminReportFilters=resetAdminReportFilters;window.loadAdminDashboardSummary=loadAdminDashboardSummary;

function adminSetReportView(view) {
  const currentView =
    view === 'REVIEW'
      ? 'REVIEW'
      : 'USER';

  const userView =
    document.getElementById(
      'adminUserReportView'
    );

  const reviewView =
    document.getElementById(
      'adminReviewReportView'
    );

  if (userView) {
    userView.hidden =
      currentView !== 'USER';
  }

  if (reviewView) {
    reviewView.hidden =
      currentView !== 'REVIEW';
  }

  document
    .querySelectorAll(
      '[data-admin-report-view]'
    )
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.adminReportView ===
          currentView
      );
    });

  if (currentView === 'USER') {
    window.loadAdminTransactionReports?.();
  } else {
    window.loadAdminReviewReports?.();
  }
}

window.adminSetReportView =
  adminSetReportView;
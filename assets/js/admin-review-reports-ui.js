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
          <img class="ui-emoji" src="assets/icons/star.svg" alt="">
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
            admin-review-report-row
            status-${statusMeta.badgeClass}
          "
          onclick="
            openAdminReviewReportDetail(
              ${Number(report.id)}
            )
          "
        >

          <div class="admin-review-report-row-id">
            <strong>
              #${Number(report.id)}
            </strong>

            <span>
              ${adminReviewReportEscape(date)}
            </span>
          </div>


          <div class="admin-review-report-row-users">

            <div>
              <strong>
                ${adminReviewReportEscape(
                  report.reporterUsername || '-'
                )}
              </strong>

              <span>
                ผู้รายงาน
              </span>
            </div>

            <span class="admin-review-report-row-arrow">
              →
            </span>

            <div>
              <strong>
                ${adminReviewReportEscape(
                  report.reviewerUsername || '-'
                )}
              </strong>

              <span>
                ผู้รีวิว
              </span>
            </div>

          </div>


          <div class="admin-review-report-row-info">

            <strong>
              ${adminReviewReportEscape(
                adminReviewReportReason(
                  report.reason
                )
              )}
            </strong>

            <div class="admin-review-report-row-rating">
              <span>
                ${adminReviewReportStars(
                  report.rating
                )}
              </span>

              <strong>
                ${Number(report.rating || 0)}/5
              </strong>
            </div>

          </div>


          <div class="admin-review-report-row-status">

            <span
              class="inline-badge ${statusMeta.badgeClass}"
            >
              ${statusMeta.label}
            </span>

            <span class="admin-review-report-row-chevron">
              ›
            </span>

          </div>

        </article>
      `;
    })
    .join('');

  window.adminReviewReports = rows;
}
function closeAdminReviewReportDetail() {
  document
    .getElementById(
      'adminReviewReportDetailModal'
    )
    ?.remove();
}

function adminReviewReportAvatar(
  avatarUrl,
  username
) {
  if (
    typeof adminReportAvatar ===
    'function'
  ) {
    return adminReportAvatar(
      avatarUrl,
      username
    );
  }

  return '<img class="ui-emoji" src="assets/icons/profileUser.svg" alt="">';
}

function openAdminReviewReportDetail(
  reportId
) {
  closeAdminReviewReportDetail();

  const report =
    (
      window.adminReviewReports ||
      []
    ).find(
      item =>
        Number(item.id) ===
        Number(reportId)
    );

  if (!report) {
    return;
  }

  const statusMeta =
    adminReviewReportStatusMeta(
      report.status
    );

  const isPending =
    report.status === 'PENDING';

  const createdAt =
    report.createdAt
      ? new Date(
          report.createdAt
        ).toLocaleString('th-TH')
      : '-';

  const resolvedAt =
    report.resolvedAt
      ? new Date(
          report.resolvedAt
        ).toLocaleString('th-TH')
      : null;

  const comment =
    report.comment ||
    'ไม่ได้เขียนความคิดเห็น';

  const description =
    report.description ||
    'ไม่ได้ระบุรายละเอียดเพิ่มเติม';

  const modal =
    document.createElement('div');

  modal.id =
    'adminReviewReportDetailModal';

  modal.className =
    'modal-overlay';

  modal.style.display =
    'flex';

  modal.innerHTML = `
    <div
      class="
        modal-card
        admin-review-report-detail-modal
      "
    >

      <div class="admin-review-detail-header">

        <div>
          <div class="review-modal-title">
            รายละเอียดรายงานรีวิว
            #${Number(report.id)}
          </div>

          <div class="review-modal-product">
            Review #${Number(
              report.reviewId
            )}
            •
            ${adminReviewReportEscape(
              createdAt
            )}
          </div>
        </div>

        <div class="admin-review-detail-header-actions">

          <span
            class="
              inline-badge
              ${statusMeta.badgeClass}
            "
          >
            ${statusMeta.label}
          </span>

          <button
            class="btn btn-ghost btn-sm"
            type="button"
            onclick="
              closeAdminReviewReportDetail()
            "
          >
            ✕
          </button>

        </div>

      </div>


      <div class="admin-review-detail-users">

        <div>
          <span>
            ผู้รายงาน
          </span>

          <strong>
            ${adminReviewReportEscape(
              report.reporterUsername ||
              '-'
            )}
          </strong>
        </div>

        <div>
          <span>
            ผู้รีวิว
          </span>

          <strong>
            ${adminReviewReportEscape(
              report.reviewerUsername ||
              '-'
            )}
          </strong>
        </div>

        <div>
          <span>
            ผู้ขาย
          </span>

          <strong>
            ${adminReviewReportEscape(
              report.sellerUsername ||
              '-'
            )}
          </strong>
        </div>

      </div>

      <div class="admin-report-chat-review-action">

      <button
        class="btn btn-secondary btn-sm"
        type="button"
        onclick="
          openAdminReviewReportChatReview(
            ${Number(report.id)}
          )
        "
      >
        <img class="ui-emoji" src="assets/icons/chat.svg" alt=""> ตรวจสอบแชทระหว่างผู้ใช้
      </button>

      <span>
        ดูบทสนทนาระหว่างผู้รายงานและผู้รีวิว
      </span>

    </div>


      <div class="admin-review-detail-section">

        <div class="admin-review-detail-label">
          เหตุผลที่รายงาน
        </div>

        <div class="admin-review-detail-reason">
          ${adminReviewReportEscape(
            adminReviewReportReason(
              report.reason
            )
          )}
        </div>

      </div>


      <div class="admin-review-detail-section">

        <div class="admin-review-detail-label">
          รายละเอียดจากผู้รายงาน
        </div>

        <div class="admin-review-detail-text">
          ${adminReviewReportEscape(
            description
          )}
        </div>

      </div>


      <div class="admin-review-detail-section">

        <div class="admin-review-detail-label">
          รีวิวที่ถูกรายงาน
        </div>

        <div class="admin-review-detail-review">

          <div class="admin-review-detail-stars">

            ${adminReviewReportStars(
              report.rating
            )}

            <strong>
              ${Number(
                report.rating || 0
              )}/5
            </strong>

          </div>

          <div class="admin-review-detail-text">
            ${adminReviewReportEscape(
              comment
            )}
          </div>

        </div>

      </div>


      ${
        report.adminNote ||
        resolvedAt
          ? `
            <div class="admin-review-detail-section">

              <div class="admin-review-detail-label">
                ผลการดำเนินการ
              </div>

              <div class="admin-review-detail-resolution">

                ${
                  report.adminNote
                    ? `
                      <div>
                        ${adminReviewReportEscape(
                          report.adminNote
                        )}
                      </div>
                    `
                    : ''
                }

                ${
                  resolvedAt
                    ? `
                      <small>
                        ดำเนินการเมื่อ
                        ${adminReviewReportEscape(
                          resolvedAt
                        )}
                      </small>
                    `
                    : ''
                }

              </div>

            </div>
          `
          : ''
      }

      ${
        isPending
          ? `
            <div class="admin-review-detail-actions">

              <button
                class="btn btn-secondary"
                type="button"
                onclick="
                  resolveAdminReviewReport(
                    ${Number(report.id)},
                    'DISMISSED'
                  )
                "
              >
                ✓ ไม่พบปัญหา
              </button>

              <button
                class="btn btn-danger"
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

            </div>
          `
          : ''
      }

    </div>
  `;

  document.body.appendChild(
    modal
  );
}

function closeAdminReviewReportChatReview() {
  document
    .getElementById(
      'adminReviewReportChatReviewModal'
    )
    ?.remove();
}

async function openAdminReviewReportChatReview(
  reportId
) {
  closeAdminReviewReportChatReview();

  const id =
    Number(reportId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return;
  }

  const modal =
    document.createElement('div');

  modal.id =
    'adminReviewReportChatReviewModal';

  modal.className =
    'modal-overlay';

  modal.style.display =
    'flex';

  modal.innerHTML = `
    <div
      class="
        modal-card
        admin-transaction-detail-modal
        admin-report-chat-review-modal
      "
    >

      <div class="admin-report-modal-header">

        <div>
          <div class="review-modal-title">
            <img class="ui-emoji" src="assets/icons/chat.svg" alt=""> ตรวจสอบแชทระหว่างผู้ใช้
          </div>

          <div class="review-modal-product">
            Review Report #${id}
          </div>
        </div>

        <button
          class="btn btn-ghost btn-sm"
          type="button"
          onclick="
            closeAdminReviewReportChatReview()
          "
        >
          ✕
        </button>

      </div>

      <div
        id="adminReviewReportChatReviewContent"
      >
        กำลังโหลดบทสนทนา...
      </div>

    </div>
  `;

  document.body.appendChild(
    modal
  );

  const content =
    document.getElementById(
      'adminReviewReportChatReviewContent'
    );

  try {
    const response =
      await fetch(
        `/api/v1/review-reports/${id}/chat`,
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
        'โหลดบทสนทนาไม่สำเร็จ'
      );
    }

    const data =
      body.data;

    if (!data || !content) {
      throw new Error(
        'ข้อมูลบทสนทนาไม่ถูกต้อง'
      );
    }

    const reporterName =
      adminReviewReportEscape(
        data.reporter?.username ||
        '-'
      );

    const reviewerName =
      adminReviewReportEscape(
        data.reported?.username ||
        '-'
      );

    const messages =
      Array.isArray(
        data.messages
      )
        ? data.messages
        : [];

    if (!data.conversation) {
      content.innerHTML = `
        <div class="admin-report-chat-review-users">

          <strong>
            ${reporterName}
          </strong>

          <span>
            ↔
          </span>

          <strong>
            ${reviewerName}
          </strong>

        </div>

        <div class="admin-report-chat-review-summary">
          Review Report #${Number(
            data.reportId
          )}
          • Review #${Number(
            data.reviewId
          )}
        </div>

        <div class="admin-report-chat-review-note">
          <img class="ui-emoji" src="assets/icons/chat.svg" alt=""> ไม่พบประวัติการสนทนาระหว่างผู้รายงานและผู้รีวิว
        </div>

        <div class="admin-report-chat-readonly">
          <img class="ui-emoji" src="assets/icons/lock.svg" alt=""> โหมดตรวจสอบเท่านั้น
          Admin ไม่สามารถส่งหรือแก้ไขข้อความได้
        </div>
      `;

      return;
    }

    const reporterId =
      Number(
        data.reporter?.id
      );

    const reviewerId =
      Number(
        data.reported?.id
      );

    const messageHtml =
      messages
        .map(message => {
          const senderId =
            Number(
              message.senderId
            );

          const role =
            senderId === reporterId
              ? 'reporter'
              : (
                  senderId === reviewerId
                    ? 'reported'
                    : 'unknown'
                );

          const roleLabel =
            role === 'reporter'
              ? 'ผู้รายงาน'
              : (
                  role === 'reported'
                    ? 'ผู้รีวิว'
                    : 'ผู้ใช้'
                );

          const senderName =
            adminReviewReportEscape(
              message.senderUsername ||
              '-'
            );

          const senderAvatar =
            adminReviewReportAvatar(
              message.senderAvatarUrl,
              message.senderUsername
            );

          const bodyText =
            adminReviewReportEscape(
              message.body ||
              ''
            );

          const createdAt =
            message.createdAt
              ? new Date(
                  message.createdAt
                ).toLocaleString(
                  'th-TH'
                )
              : '-';

          return `
            <div
              class="
                admin-report-chat-message
                ${role}
              "
            >

              <div class="admin-report-chat-message-head">

                <div class="admin-report-chat-avatar">
                  ${senderAvatar}
                </div>

                <div class="admin-report-chat-message-user">

                  <strong>
                    ${senderName}
                  </strong>

                  <span>
                    ${roleLabel}
                  </span>

                </div>

              </div>

              <div class="admin-report-chat-message-bubble">
                <div class="admin-report-chat-message-body">${bodyText}</div>
              </div>

              <time class="admin-report-chat-message-time">
                ${adminReviewReportEscape(
                  createdAt
                )}
              </time>

            </div>
          `;
        })
        .join('');

    content.innerHTML = `
      <div class="admin-report-chat-review-users">

        <strong>
          ${reporterName}
        </strong>

        <span>
          ↔
        </span>

        <strong>
          ${reviewerName}
        </strong>

      </div>

      <div class="admin-report-chat-review-summary">
        Review Report #${Number(
          data.reportId
        )}
        • Review #${Number(
          data.reviewId
        )}
        • ${messages.length.toLocaleString(
          'th-TH'
        )} ข้อความ
      </div>

      <div class="admin-report-chat-message-list">
        ${messageHtml}
      </div>

      <div class="admin-report-chat-readonly">
        <img class="ui-emoji" src="assets/icons/lock.svg" alt=""> โหมดตรวจสอบเท่านั้น
        Admin ไม่สามารถส่งหรือแก้ไขข้อความได้
      </div>
    `;

  } catch (error) {
    console.error(
      'load review report chat failed',
      error
    );

    if (content) {
      content.innerHTML = `
        <div class="notice danger">
          ${adminReviewReportEscape(
            error.message ||
            'ไม่สามารถโหลดบทสนทนาได้'
          )}
        </div>
      `;
    }
  }
}

async function resolveAdminReviewReport(reportId,action){const label=action==='REMOVED'?'ซ่อนรีวิว':'ปิดรายงานโดยไม่พบปัญหา';if(!confirm(`ยืนยันการ${label}หรือไม่?`))return;const token=typeof csrfToken!=='undefined'?(csrfToken||getCookieValue('gm_csrf')):getCookieValue('gm_csrf');if(!token){alert('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่');return;}try{const r=await fetch(`/api/v1/review-reports/${Number(reportId)}`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({action,adminNote:action==='REMOVED'?'ซ่อนรีวิวเนื่องจากละเมิดแนวทางการใช้งาน':''})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'ดำเนินการกับรายงานไม่สำเร็จ');closeAdminReviewReportDetail();await loadAdminReviewReports();await window
  .loadAdminDashboardSummary?.();}catch(e){console.error('resolveAdminReviewReport failed:',e);alert(e.message||'ดำเนินการไม่สำเร็จ');}}

function initAdminReviewReports(){const page=document.getElementById('pg-admin-report');if(page&&!page.dataset.reviewReportsBound){page.dataset.reviewReportsBound='1';loadAdminReviewReports();}}
window.loadAdminReviewReports=loadAdminReviewReports;window.resolveAdminReviewReport=resolveAdminReviewReport;window.openAdminReviewReportDetail=openAdminReviewReportDetail;
window.closeAdminReviewReportDetail =
  closeAdminReviewReportDetail;
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

window.openAdminReviewReportChatReview =
  openAdminReviewReportChatReview;

window.closeAdminReviewReportChatReview =
  closeAdminReviewReportChatReview;
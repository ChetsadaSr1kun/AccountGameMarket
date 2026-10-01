(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const csrf = () => window.csrfToken || document.cookie.match(/(?:^|; )gm_csrf=([^;]+)/)?.[1];
  const methodLabel = (m) => ({ BANK:'🏦 ธนาคาร', PROMPTPAY:'📱 พร้อมเพย์', TRUEMONEY:'💰 TrueMoney' }[m] || m);
  const bankLabel = (code) => ({
  KBANK: 'กสิกรไทย',
  KTB: 'กรุงไทย',
  GSB: 'ออมสิน',
  BBL: 'กรุงเทพ',
  SCB: 'ไทยพาณิชย์',
  BAY: 'กรุงศรีอยุธยา',
  TTB: 'ทีเอ็มบีธนชาต',
}[code] || code || '-');
  const formatDate = (v) => v ? new Date(v).toLocaleString('th-TH') : '-';
  let withdrawalView = 'PENDING';
  let withdrawalHistory = [];

  const withdrawalViewMeta = {
    PENDING: {
      title: 'คำขอรอตรวจสอบ',
      empty: 'ไม่มีคำขอถอนพ้อยท์ที่รอตรวจสอบ',
    },
    APPROVED: {
      title: 'รายการที่อนุมัติแล้ว',
      empty: 'ยังไม่มีรายการถอนพ้อยท์ที่อนุมัติ',
    },
    REJECTED: {
      title: 'รายการที่ปฏิเสธ',
      empty: 'ยังไม่มีรายการถอนพ้อยท์ที่ปฏิเสธ',
    },
  };

  function ensureAdminWithdrawShell() {
    const page = document.getElementById('pg-admin-withdraw');
    const content = page?.querySelector('.admin-content');
    if (!content) return null;
    content.innerHTML = `
      <div class="sec-header">
        <div class="sec-title">
          💸 อนุมัติการถอนเงิน
        </div>

        <div class="sec-sub">
          ตรวจสอบและจัดการคำขอถอนพ้อยท์จากผู้ขาย
        </div>
      </div>

      <div
        class="grid3"
        style="margin-bottom:24px"
      >
        <div class="card stat-card">
          <div style="font-size:24px">⏳</div>

          <div
            id="adminWithdrawalPendingCount"
            class="stat-val"
            style="color:var(--warn)"
          >
            0
          </div>

          <div class="stat-label">
            รอตรวจสอบ
          </div>
        </div>

        <div class="card stat-card">
          <div style="font-size:24px">✅</div>

          <div
            id="adminWithdrawalApprovedCount"
            class="stat-val"
            style="color:var(--success)"
          >
            0
          </div>

          <div class="stat-label">
            การอนุมัติ
          </div>
        </div>

        <div class="card stat-card">
          <div style="font-size:24px">❌</div>

          <div
            id="adminWithdrawalRejectedCount"
            class="stat-val"
            style="color:var(--danger)"
          >
            0
          </div>

          <div class="stat-label">
            ปฏิเสธ
          </div>
        </div>
      </div>

      <div
        class="card"
        style="
          padding:0;
          margin-bottom:18px;
          overflow:hidden;
        "
      >
        <div
          class="admin-users-tabs"
          style="justify-content:flex-start"
        >
          <div class="admin-users-tab-list">

            <button
              type="button"
              class="admin-users-tab active"
              data-withdrawal-view="PENDING"
              onclick="adminSetWithdrawalView('PENDING')"
            >
              <span>⏳</span>
              รอตรวจสอบ
            </button>

            <button
              type="button"
              class="admin-users-tab"
              data-withdrawal-view="APPROVED"
              onclick="adminSetWithdrawalView('APPROVED')"
            >
              <span>✅</span>
              การอนุมัติ
            </button>

            <button
              type="button"
              class="admin-users-tab"
              data-withdrawal-view="REJECTED"
              onclick="adminSetWithdrawalView('REJECTED')"
            >
              <span>❌</span>
              ปฏิเสธ
            </button>

          </div>
        </div>
      </div>

      <div
        class="card"
        style="margin-bottom:18px;padding:16px 18px"
      >
        <div
          class="flex-between"
          style="
            align-items:center;
            gap:12px;
            flex-wrap:wrap;
          "
        >
          <div>
            <div
              id="adminWithdrawalListTitle"
              style="font-weight:700"
            >
              คำขอรอตรวจสอบ
            </div>

            <div
              id="adminWithdrawalMessage"
              style="
                font-size:13px;
                color:var(--muted);
                margin-top:4px;
              "
            ></div>
          </div>

          <button
            class="btn btn-secondary btn-sm"
            onclick="loadAdminWithdrawalRequests()"
          >
            ↻ รีเฟรช
          </button>
        </div>
      </div>

      <div
        id="adminWithdrawalList"
        style="
          display:flex;
          flex-direction:column;
          gap:12px;
        "
      ></div>
    `;
    return content;
  }

  function ensureConfirmModal() {
    let modal = document.getElementById('adminWithdrawalConfirmModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'adminWithdrawalConfirmModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.55)';
    modal.innerHTML = '<div class="card" style="width:min(460px,100%);padding:26px">'
      + '<div id="adminWithdrawalModalIcon" style="font-size:34px;margin-bottom:10px">✅</div>'
      + '<h3 id="adminWithdrawalModalTitle" style="margin:0 0 8px;font-size:20px">ยืนยันการดำเนินการ</h3>'
      + '<div id="adminWithdrawalModalBody" style="color:var(--muted);font-size:14px;line-height:1.7;margin-bottom:20px"></div>'
      + '<div id="adminWithdrawalRejectWrap" style="display:none;margin-bottom:18px"><label class="inp-label">เหตุผลที่ไม่อนุมัติ</label><textarea id="adminWithdrawalRejectReason" class="inp" rows="3" placeholder="กรอกเหตุผล"></textarea></div>'
      + '<div class="flex gap-8" style="justify-content:flex-end"><button id="adminWithdrawalModalCancel" class="btn btn-secondary btn-sm">ยกเลิก</button><button id="adminWithdrawalModalSubmit" class="btn btn-success btn-sm">ยืนยันอนุมัติ</button></div>'
      + '</div>';
    document.body.appendChild(modal);
    modal.querySelector('#adminWithdrawalModalCancel').onclick = () => { modal.style.display='none'; };
    return modal;
  }

  async function openDecisionModal(id, type, request) {
    const modal = ensureConfirmModal();
    const isReject = type === 'reject';
    modal.querySelector('#adminWithdrawalModalIcon').textContent = isReject ? '❌' : '✅';
    modal.querySelector('#adminWithdrawalModalTitle').textContent = isReject ? 'ไม่อนุมัติการถอนเงิน' : 'ยืนยันการอนุมัติถอนเงิน';
    modal.querySelector('#adminWithdrawalModalBody').innerHTML = `
      ผู้ใช้ <strong>${esc(request.username)}</strong>
      ขอถอน <strong>${Number(request.amount).toLocaleString('th-TH')} pts</strong>
      <br>
      ช่องทาง: ${esc(methodLabel(request.paymentMethod))}
      ${
        request.paymentMethod === 'BANK'
          ? `<br>ธนาคาร: <strong>${esc(bankLabel(request.bankCode))}</strong>`
          : ''
      }
      <br>
      ${esc(request.accountName)} • ${esc(request.accountNumber)}
    `;
    modal.querySelector('#adminWithdrawalRejectWrap').style.display = isReject ? 'block' : 'none';
    const reasonInput = modal.querySelector('#adminWithdrawalRejectReason');
    reasonInput.value = '';
    const submit = modal.querySelector('#adminWithdrawalModalSubmit');
    submit.textContent = isReject ? 'ยืนยันไม่อนุมัติ' : 'ยืนยันอนุมัติ';
    submit.className = `btn ${isReject ? 'btn-danger' : 'btn-success'} btn-sm`;
    modal.style.display = 'flex';
    submit.onclick = async () => {
      const reason = reasonInput.value.trim();
      if (isReject && !reason) { alert('กรุณาระบุเหตุผลที่ไม่อนุมัติ'); return; }
      submit.disabled = true;
      try {
        await action(id, type, isReject ? { reason } : {});
        modal.style.display = 'none';
        await window.loadAdminWithdrawalRequests();
      } catch (error) {
        alert(error.message || 'ดำเนินการไม่สำเร็จ');
      } finally { submit.disabled = false; }
    };
  }

  function updateWithdrawalViewUi() {
    document
      .querySelectorAll('[data-withdrawal-view]')
      .forEach((button) => {
        button.classList.toggle(
          'active',
          button.dataset.withdrawalView === withdrawalView
        );
      });

    const title = document.getElementById(
      'adminWithdrawalListTitle'
    );

    if (title) {
      title.textContent =
        withdrawalViewMeta[withdrawalView]?.title ||
        'รายการถอนพ้อยท์';
    }
  }

  function renderWithdrawalView() {
    const list = document.getElementById(
      'adminWithdrawalList'
    );

    const message = document.getElementById(
      'adminWithdrawalMessage'
    );

    if (!list) return;

    const requests = withdrawalHistory.filter(
      (item) => item.status === withdrawalView
    );

    if (message) {
      message.textContent =
        `พบ ${requests.length} รายการ`;
    }

    if (!requests.length) {
      list.innerHTML = `
        <div
          class="card"
          style="
            padding:40px;
            text-align:center;
            color:var(--muted);
          "
        >
          ${esc(
            withdrawalViewMeta[withdrawalView]?.empty ||
            'ไม่มีรายการ'
          )}
        </div>
      `;

      return;
    }

    list.innerHTML =
      requests.map(renderRequest).join('');
  }

  window.adminSetWithdrawalView = (view) => {
    if (
      !['PENDING', 'APPROVED', 'REJECTED']
        .includes(view)
    ) {
      return;
    }

    withdrawalView = view;

    updateWithdrawalViewUi();
    renderWithdrawalView();
  };

  window.loadAdminWithdrawalRequests = async () => {
    const content = ensureAdminWithdrawShell();

    if (!content) return;

    const list = document.getElementById(
      'adminWithdrawalList'
    );

    list.innerHTML = `
      <div
        class="card"
        style="
          padding:28px;
          text-align:center;
          color:var(--muted);
        "
      >
        กำลังโหลดรายการถอน...
      </div>
    `;

    try {
      const res = await fetch(
        '/api/v1/admin/wallet/withdrawal/history',
        {
          credentials: 'include',
        }
      );

      const body =
        await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          body.error?.message ||
          'โหลดรายการถอนไม่สำเร็จ'
        );
      }

      withdrawalHistory =
        body.data?.history || [];

      const summary =
        body.data?.summary || {};

      window.__adminWithdrawalRequests =
        withdrawalHistory.filter(
          (item) => item.status === 'PENDING'
        );

      document.getElementById(
        'adminWithdrawalPendingCount'
      ).textContent =
        Number(summary.pendingCount || 0);

      document.getElementById(
        'adminWithdrawalApprovedCount'
      ).textContent =
        Number(summary.approvedCount || 0);

      document.getElementById(
        'adminWithdrawalRejectedCount'
      ).textContent =
        Number(summary.rejectedCount || 0);

      updateWithdrawalViewUi();
      renderWithdrawalView();

    } catch (error) {
      const message = document.getElementById(
        'adminWithdrawalMessage'
      );

      if (message) {
        message.textContent = error.message;
      }

      list.innerHTML = `
        <div class="notice danger">
          ไม่สามารถโหลดรายการถอนพ้อยท์ได้
        </div>
      `;
    }
  };

  function renderRequest(r) {
    const initial = esc(
      String(r.username || '?')
        .charAt(0)
        .toUpperCase()
    );

    const avatarHtml = r.avatarUrl
      ? `
        <img
          src="${esc(r.avatarUrl)}"
          alt="${esc(r.username || 'User')}"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
            border-radius:50%;
          "
        >
      `
      : initial;

    const statusBadge = {
      PENDING:
        '<span class="badge badge-yellow">⏳ รอตรวจสอบ</span>',

      APPROVED:
        '<span class="badge badge-green">✅ อนุมัติแล้ว</span>',

      REJECTED:
        '<span class="badge badge-red">❌ ปฏิเสธแล้ว</span>',
    }[r.status] || '';

    const actionButtons =
      r.status === 'PENDING'
        ? `
          <div
            class="flex gap-8"
            style="
              align-self:center;
              margin-left:auto;
            "
          >
            <button
              class="btn btn-success btn-sm"
              onclick="adminApproveWithdrawal(${Number(r.id)})"
            >
              ✓ อนุมัติ
            </button>

            <button
              class="btn btn-danger btn-sm"
              onclick="adminRejectWithdrawal(${Number(r.id)})"
            >
              ✗ ไม่อนุมัติ
            </button>
          </div>
        `
        : '';

    const reviewInfo =
      r.status === 'APPROVED'
        ? `
          <div
            style="
              font-size:12px;
              color:var(--success);
              margin-top:8px;
            "
          >
            ✅ อนุมัติเมื่อ ${formatDate(r.reviewedAt)}
          </div>
        `
        : r.status === 'REJECTED'
          ? `
            <div
              style="
                font-size:12px;
                color:var(--danger);
                margin-top:8px;
              "
            >
              ❌ ปฏิเสธเมื่อ ${formatDate(r.reviewedAt)}
            </div>

            ${
              r.rejectionReason
                ? `
                  <div
                    style="
                      font-size:12px;
                      color:var(--muted);
                      margin-top:4px;
                    "
                  >
                    เหตุผล: ${esc(r.rejectionReason)}
                  </div>
                `
                : ''
            }
          `
          : '';

    return `
      <div
        class="card"
        style="padding:20px 22px"
      >
        <div
          class="flex gap-16"
          style="
            align-items:flex-start;
            flex-wrap:wrap;
          "
        >
          <div
            class="avatar"
            style="
              width:46px;
              height:46px;
              background:var(--accent);
              font-size:20px;
              flex:0 0 46px;
              overflow:hidden;
            "
          >
            ${avatarHtml}
          </div>

          <div
            style="
              flex:1;
              min-width:260px;
            "
          >
            <div
              style="
                display:flex;
                align-items:center;
                gap:10px;
                flex-wrap:wrap;
              "
            >
              <div
                style="
                  font-weight:700;
                  font-size:16px;
                "
              >
                ${esc(r.username)}
              </div>

              ${statusBadge}
            </div>

            <div
              style="
                display:grid;
                grid-template-columns:
                  repeat(2,minmax(0,1fr));
                gap:10px;
                margin-top:14px;
              "
            >
              <div>
                <div
                  style="
                    font-size:11px;
                    color:var(--muted);
                  "
                >
                  จำนวนถอน
                </div>

                <div
                  class="kanit"
                  style="
                    font-size:22px;
                    font-weight:800;
                    color:var(--danger);
                  "
                >
                  -${Number(r.amount).toLocaleString('th-TH')} pts
                </div>
              </div>

              <div>
                <div
                  style="
                    font-size:11px;
                    color:var(--muted);
                  "
                >
                  ช่องทางรับเงิน
                </div>

                <div style="font-weight:600">
                  ${esc(methodLabel(r.paymentMethod))}
                </div>
              </div>

              ${
                r.paymentMethod === 'BANK'
                  ? `
                    <div>
                      <div
                        style="
                          font-size:11px;
                          color:var(--muted);
                        "
                      >
                        ธนาคาร
                      </div>

                      <div style="font-weight:600">
                        ${esc(bankLabel(r.bankCode))}
                      </div>
                    </div>
                  `
                  : ''
              }

              <div>
                <div
                  style="
                    font-size:11px;
                    color:var(--muted);
                  "
                >
                  ชื่อบัญชี
                </div>

                <div
                  style="
                    font-weight:600;
                    word-break:break-word;
                  "
                >
                  ${esc(r.accountName)}
                </div>
              </div>

              <div>
                <div
                  style="
                    font-size:11px;
                    color:var(--muted);
                  "
                >
                  เลขบัญชี / หมายเลขรับเงิน
                </div>

                <div
                  style="
                    font-weight:600;
                    word-break:break-word;
                  "
                >
                  ${esc(r.accountNumber)}
                </div>
              </div>
            </div>

            <div
              style="
                font-size:12px;
                color:var(--dim);
                margin-top:12px;
              "
            >
              ส่งคำขอเมื่อ ${formatDate(r.createdAt)}
            </div>

            ${reviewInfo}
          </div>

          ${actionButtons}
        </div>
      </div>
    `;
  }

  async function action(id, type, body = {}) {
    const res = await fetch(`/api/v1/admin/wallet/withdrawal/${id}/${type}`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json','X-CSRF-Token':csrf()}, body:JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'ดำเนินการไม่สำเร็จ');
  }

  window.adminApproveWithdrawal = (id) => { const r = window.__adminWithdrawalRequests?.find(x => Number(x.id) === Number(id)); if (r) openDecisionModal(id,'approve',r); };
  window.adminRejectWithdrawal = (id) => { const r = window.__adminWithdrawalRequests?.find(x => Number(x.id) === Number(id)); if (r) openDecisionModal(id,'reject',r); };
})();

(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const methodLabel = (m) => ({ CARD:'💳 บัตรเครดิต/เดบิต', BANK:'🏦 โอนผ่านธนาคาร', PROMPTPAY:'📱 PromptPay', TRUEMONEY:'💰 TrueMoney' }[m] || m);
  const statusLabel = (s) => ({ APPROVED:'อนุมัติแล้ว', PENDING:'รอดำเนินการ', REJECTED:'ไม่อนุมัติ' }[s] || s);
  const statusClass = (s) => ({ APPROVED:'badge-green', PENDING:'badge-yellow', REJECTED:'badge-red' }[s] || 'badge-blue');
  const formatDate = (v) => v ? new Date(v).toLocaleString('th-TH') : '-';
  const renderShell = () => {
    const page = document.getElementById('pg-admin-topup');
    const content = page?.querySelector('.admin-content');
    if (!content) return null;
    content.innerHTML = `
      <div class="sec-header"><div class="sec-title">📥 ประวัติการฝากพ้อยท์</div><div class="sec-sub">ตรวจสอบประวัติการฝากพ้อยท์ของผู้ใช้ทั้งหมด</div></div>
      <div class="grid4" style="margin-bottom:24px">
        <div class="card stat-card"><div style="font-size:24px">📋</div><div id="adminTopupTotalCount" class="stat-val">0</div><div class="stat-label">รายการทั้งหมด</div></div>
        <div class="card stat-card"><div style="font-size:24px">✅</div><div id="adminTopupApprovedCount" class="stat-val" style="color:var(--success)">0</div><div class="stat-label">สำเร็จแล้ว</div></div>
        <div class="card stat-card"><div style="font-size:24px">⏳</div><div id="adminTopupPendingCount" class="stat-val" style="color:var(--warn)">0</div><div class="stat-label">รอดำเนินการ</div></div>
        <div class="card stat-card"><div style="font-size:24px">💰</div><div id="adminTopupApprovedAmount" class="stat-val" style="color:var(--accent)">0 pts</div><div class="stat-label">ยอดฝากที่สำเร็จ</div></div>
      </div>
      <div class="card" style="padding:18px">
        <div class="flex-between" style="align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px"><div><div style="font-weight:700">รายการฝากพ้อยท์ล่าสุด</div><div id="adminTopupMessage" style="font-size:13px;color:var(--muted);margin-top:4px"></div></div><button class="btn btn-secondary btn-sm" onclick="loadAdminTopupRequests()">↻ รีเฟรช</button></div>
        <div id="adminTopupList" style="display:flex;flex-direction:column;gap:10px"></div>
      </div>`;
    return content;
  };
  const load = async () => {
    const content = renderShell();
    if (!content) return;
    const list = document.getElementById('adminTopupList');
    const message = document.getElementById('adminTopupMessage');
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted)">กำลังโหลดประวัติ...</div>';
    try {
      const res = await fetch('/api/v1/admin/wallet/topup/history', { credentials:'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error?.message || 'โหลดประวัติไม่สำเร็จ');
      const history = body.data?.history || [];
      const summary = body.data?.summary || {};
      document.getElementById('adminTopupTotalCount').textContent = Number(summary.totalCount || history.length).toLocaleString('th-TH');
      document.getElementById('adminTopupApprovedCount').textContent = Number(summary.approvedCount || 0).toLocaleString('th-TH');
      document.getElementById('adminTopupPendingCount').textContent = Number(summary.pendingCount || 0).toLocaleString('th-TH');
      document.getElementById('adminTopupApprovedAmount').textContent = `${Number(summary.approvedAmount || 0).toLocaleString('th-TH')} pts`;
      if (message) message.textContent = `แสดง ${history.length} รายการล่าสุด`;
      if (!history.length) { list.innerHTML = '<div style="padding:36px;text-align:center;color:var(--muted)">ยังไม่มีประวัติการฝากพ้อยท์</div>'; return; }
      list.innerHTML = history.map((r) => `<div class="card" style="padding:16px 18px"><div class="flex gap-16" style="align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:260px"><div style="font-weight:700">${esc(r.username)}</div><div style="font-size:13px;color:var(--muted);margin-top:4px">คำขอ #${Number(r.id)} • ${esc(methodLabel(r.paymentMethod))} • ${formatDate(r.createdAt)}</div>${r.referenceCode ? `<div style="font-size:12px;color:var(--dim);margin-top:4px">Ref: ${esc(r.referenceCode)}</div>` : ''}</div><div class="kanit" style="font-size:21px;font-weight:800;color:var(--success)">+${Number(r.amount).toLocaleString('th-TH')} pts</div><span class="badge ${statusClass(r.status)}">${statusLabel(r.status)}</span></div></div>`).join('');
    } catch (error) {
      if (message) message.textContent = error.message;
      list.innerHTML = '<div class="notice danger">ไม่สามารถโหลดประวัติการฝากพ้อยท์ได้</div>';
    }
  };
  window.loadAdminTopupRequests = load;
})();

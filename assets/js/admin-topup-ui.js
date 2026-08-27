(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const csrf = () => window.csrfToken || document.cookie.match(/(?:^|; )gm_csrf=([^;]+)/)?.[1];
  const methodLabel = (m) => ({ CARD:'บัตรเครดิต/เดบิต', BANK:'โอนผ่านธนาคาร', PROMPTPAY:'PromptPay', TRUEMONEY:'TrueMoney' }[m] || m);
  const formatDate = (v) => v ? new Date(v).toLocaleString('th-TH') : '-';

  window.loadAdminTopupRequests = async () => {
    const list = document.getElementById('adminTopupList');
    const message = document.getElementById('adminTopupMessage');
    if (!list) return;
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted)">กำลังโหลดคำขอ...</div>';
    try {
      const res = await fetch('/api/v1/admin/wallet/topup/pending', { credentials:'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error?.message || 'โหลดคำขอไม่สำเร็จ');
      const requests = body.data?.requests || [];
      if (message) message.textContent = `พบ ${requests.length} รายการที่รอดำเนินการ`;
      if (!requests.length) { list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">✓ ไม่มีคำขอเติมพ้อยท์ที่รอดำเนินการ</div>'; return; }
      list.innerHTML = requests.map(r => `<div class="card" style="padding:16px 18px">
        <div class="flex gap-16" style="align-items:center"><div style="flex:1"><div style="font-weight:700">${esc(r.username)}</div><div style="font-size:13px;color:var(--muted);margin-top:4px">${esc(methodLabel(r.paymentMethod))} • ${esc(r.referenceCode || '-')} • ${formatDate(r.createdAt)}</div></div>
        <div class="kanit" style="font-size:21px;font-weight:700;color:var(--success)">+${Number(r.amount).toLocaleString()} pts</div><div class="flex gap-8"><button class="btn btn-success btn-sm" onclick="adminApproveTopup(${Number(r.id)})">✓ อนุมัติ</button><button class="btn btn-danger btn-sm" onclick="adminRejectTopup(${Number(r.id)})">✗ ปฏิเสธ</button></div></div></div>`).join('');
    } catch (error) { if (message) message.textContent = error.message; list.innerHTML = ''; }
  };
  async function action(id, name, body = {}) {
    const res = await fetch(`/api/v1/admin/wallet/topup/${id}/${name}`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json','X-CSRF-Token':csrf()}, body:JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'ดำเนินการไม่สำเร็จ');
  }

  window.adminApproveTopup = async (id) => {
    if (!confirm('ยืนยันการอนุมัติคำขอเติมพ้อยท์? ยอดจะถูกเพิ่มเข้ากระเป๋าผู้ใช้ทันที')) return;
    try { await action(id, 'approve'); await window.loadAdminTopupRequests(); }
    catch (error) { alert(error.message); }
  };

  window.adminRejectTopup = async (id) => {
    const reason = prompt('ระบุเหตุผลที่ปฏิเสธคำขอเติมพ้อยท์');
    if (reason === null) return;
    if (!reason.trim()) return alert('กรุณาระบุเหตุผลที่ปฏิเสธ');
    try { await action(id, 'reject', { reason }); await window.loadAdminTopupRequests(); }
    catch (error) { alert(error.message); }
  };
})();

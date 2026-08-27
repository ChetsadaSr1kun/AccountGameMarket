// Seller verification UI
'use strict';
(function () {
  const types = ['ID_FRONT', 'ID_BACK', 'SELFIE'];
  const state = { files: {}, status: null };

  function csrf() { return window.csrfToken || document.cookie.match(/(?:^|; )gm_csrf=([^;]+)/)?.[1] || null; }
  function msg(id, text, error = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? 'var(--danger)' : 'var(--success)';
  }
  function setStatus(text, kind = 'info') {
    const el = document.getElementById('sellerVerificationStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `notice ${kind}`;
  }
  function request(url, options = {}) {
    return fetch(url, { credentials: 'include', ...options });
  }
  window.chooseSellerVerificationDocument = (type) => {
    document.getElementById(`seller-document-input-${type}`)?.click();
  };
  window.renderSellerVerificationDocument = (type, file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      msg('sellerVerificationMessage', 'ใช้ไฟล์ JPEG, PNG หรือ WebP ขนาดไม่เกิน 5 MiB', true); return;
    }
    state.files[type] = file;
    const card = document.querySelector(`[data-seller-document="${type}"]`);
    const name = card?.querySelector('[data-seller-file-name]');
    const preview = card?.querySelector('[data-seller-preview]');
    if (name) name.textContent = file.name;
    if (preview) { preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
    msg('sellerVerificationMessage', '');
  };
  window.updateSellerVerificationSubmitState = () => {
    const button = document.getElementById('sellerVerificationSubmitButton');
    if (button) button.disabled = types.some((type) => !state.files[type]) || state.status === 'PENDING' || state.status === 'APPROVED';
  };
  window.loadSellerVerificationStatus = async () => {
    try {
      const res = await request('/api/v1/seller-verification/me');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || 'โหลดสถานะไม่สำเร็จ');
      const verification = data.data?.verification;
      state.status = verification?.status || 'NOT_SUBMITTED';
      const text = state.status === 'PENDING' ? '⏳ ส่งคำขอแล้ว กำลังรอ Admin ตรวจสอบ'
        : state.status === 'APPROVED' ? '✅ ได้รับอนุมัติเป็นผู้ขายแล้ว'
        : state.status === 'REJECTED' ? `❌ คำขอถูกปฏิเสธ: ${verification?.rejectionReason || 'ไม่ระบุเหตุผล'}`
        : '📝 ยังไม่ได้ส่งคำขอสมัครเป็นผู้ขาย';
      setStatus(text, state.status === 'APPROVED' ? 'success' : state.status === 'REJECTED' ? 'warn' : 'info');
      if (state.status === 'APPROVED') {
        if (window.currentUser && !window.currentUser.roles?.includes('SELLER')) {
          window.currentUser.roles = [...(window.currentUser.roles || []), 'SELLER'];
        }
        setTimeout(() => window.goPage?.('add-listing'), 150);
        return;
      }
      window.updateSellerVerificationSubmitState();
    } catch (error) { setStatus(`ไม่สามารถโหลดสถานะได้: ${error.message}`, 'warn'); }
  };

  async function upload(type, file) {
    const form = new FormData(); form.append('document', file);
    const res = await request(`/api/v1/seller-verification/documents/${type.toLowerCase().replace('_', '-')}`, {
      method: 'POST', headers: { 'X-CSRF-Token': csrf() || '' }, body: form
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `อัปโหลด ${type} ไม่สำเร็จ`);
  }
  window.submitSellerVerificationRequest = async () => {
    if (types.some((type) => !state.files[type])) { msg('sellerVerificationMessage', 'กรุณาเลือกรูปให้ครบทั้ง 3 รายการ', true); return; }
    const button = document.getElementById('sellerVerificationSubmitButton');
    if (button) button.disabled = true;
    try {
      msg('sellerVerificationMessage', 'กำลังอัปโหลดเอกสาร...');
      for (const type of types) await upload(type, state.files[type]);
      msg('sellerVerificationMessage', 'กำลังส่งคำขอ...');
      const res = await request('/api/v1/seller-verification/submit', {
        method: 'POST', headers: { 'X-CSRF-Token': csrf() || '' }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || 'ส่งคำขอไม่สำเร็จ');
      msg('sellerVerificationMessage', 'ส่งคำขอเรียบร้อยแล้ว รอ Admin ตรวจสอบ');
      await window.loadSellerVerificationStatus();
    } catch (error) { msg('sellerVerificationMessage', error.message, true); if (button) button.disabled = false; }
  };
  window.loadAdminSellerVerificationRequests = async () => {
    const list = document.getElementById('adminSellerVerificationList');
    const message = document.getElementById('adminSellerVerificationMessage');
    if (!list) return;
    list.innerHTML = '<div class="notice info">กำลังโหลดคำขอ...</div>';
    try {
      const res = await request('/api/v1/seller-verification/admin/pending');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || 'โหลดคำขอไม่สำเร็จ');
      const requests = data.data?.requests || [];
      if (message) message.textContent = `พบคำขอรอตรวจสอบ ${requests.length} รายการ`;
      list.innerHTML = requests.length ? requests.map((item) => {
        const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username;
        const userId = item.user_id;
        return `<div class="card" style="padding:18px"><div class="flex-between" style="gap:12px;align-items:center"><div><div style="font-weight:700">${name}</div><div style="font-size:13px;color:var(--muted)">@${item.username} • ${item.email || '-'}</div></div><div class="flex gap-8"><button class="btn btn-secondary btn-sm" onclick="adminViewSellerVerification(${userId})">👁️ ดูเอกสาร</button><button class="btn btn-success btn-sm" onclick="adminApproveSellerVerification(${userId})">✓ อนุมัติ</button><button class="btn btn-danger btn-sm" onclick="adminRejectSellerVerification(${userId})">✗ ปฏิเสธ</button></div></div></div>`;
      }).join('') : '<div class="notice success">ไม่มีคำขอที่รอตรวจสอบ</div>';
    } catch (error) { list.innerHTML = `<div class="notice warn">${error.message}</div>`; }
  };
  async function adminAction(userId, action, body) {
    const res = await request(`/api/v1/seller-verification/${userId}/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() || '' }, body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'ดำเนินการไม่สำเร็จ');
  }
  window.adminApproveSellerVerification = async (userId) => {
    if (!confirm('ยืนยันการอนุมัติผู้ขายรายนี้?')) return;
    try { await adminAction(userId, 'approve'); await window.loadAdminSellerVerificationRequests(); }
    catch (error) { alert(error.message); }
  };
  window.adminRejectSellerVerification = async (userId) => {
    const reason = prompt('ระบุเหตุผลที่ปฏิเสธ (อย่างน้อย 3 ตัวอักษร)');
    if (reason === null) return;
    try { await adminAction(userId, 'reject', { reason }); await window.loadAdminSellerVerificationRequests(); }
    catch (error) { alert(error.message); }
  };
  window.adminViewSellerVerification = async (userId) => {
    try {
      const res = await request(`/api/v1/seller-verification/admin/${userId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || 'โหลดเอกสารไม่สำเร็จ');
      const docs = data.data?.request?.documents || [];
      const urls = docs.map((doc) => `${doc.document_type}: /api/v1/seller-verification/admin/${userId}/documents/${doc.document_type}`).join('\n');
      alert(`เอกสารของคำขอ #${userId}\n${urls || 'ไม่พบเอกสาร'}`);
    } catch (error) { alert(error.message); }
  };
}());

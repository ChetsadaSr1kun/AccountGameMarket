(() => {
  let users = [];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const csrf = () => window.csrfToken || document.cookie.match(/(?:^|; )gm_csrf=([^;]+)/)?.[1];
  const roleLabel = (roles) => roles?.includes('SELLER') ? 'SELLER' : (roles?.includes('ADMIN') ? 'ADMIN' : 'USER');
  const statusLabel = (s) => ({ACTIVE:'ใช้งาน',SUSPENDED:'ระงับ',BANNED:'แบนถาวร'}[s] || s);
  const statusClass = (s) => ({ACTIVE:'badge-green',SUSPENDED:'badge-yellow',BANNED:'badge-red'}[s] || 'badge-blue');

  function render() {
    const list = document.getElementById('adminUserList'); if (!list) return;
    const q = (document.getElementById('adminUserSearch')?.value || '').toLowerCase();
    const status = document.getElementById('adminUserStatus')?.value || 'ALL';
    const role = document.getElementById('adminUserRole')?.value || 'ALL';
    const rows = users.filter(u => (!q || `${u.username} ${u.email} ${u.firstName||''} ${u.lastName||''}`.toLowerCase().includes(q)) &&
      (status === 'ALL' || u.status === status) && (role === 'ALL' || roleLabel(u.roles) === role));
    const total = users.length, active = users.filter(u=>u.status==='ACTIVE').length, suspended = users.filter(u=>u.status==='SUSPENDED').length, banned = users.filter(u=>u.status==='BANNED').length;
    for (const [id, value] of [['adminUserTotal',total],['adminUserActive',active],['adminUserSuspended',suspended],['adminUserBanned',banned]]) { const el=document.getElementById(id); if(el) el.textContent=value; }
    list.innerHTML = rows.length ? rows.map(u => `<div class="card" style="padding:16px 18px"><div class="flex-between" style="gap:14px;flex-wrap:wrap"><div style="min-width:220px;flex:1"><div><strong>${esc(u.username)}</strong> <span class="badge ${statusClass(u.status)}">${statusLabel(u.status)}</span> <span class="badge badge-blue">${esc(roleLabel(u.roles))}</span></div><div style="font-size:13px;color:var(--muted);margin-top:6px">${esc(u.email)} • ${esc(u.firstName||'')} ${esc(u.lastName||'')}</div><div style="font-size:12px;color:var(--muted);margin-top:5px">Wallet ${u.walletBalance.toLocaleString()} pts • ซื้อ ${u.boughtCount} • ขาย ${u.soldCount}</div></div><button class="btn btn-secondary btn-sm" onclick="adminOpenUser(${u.id})">ดูรายละเอียด</button></div></div>`).join('') : '<div class="report-empty">ไม่พบผู้ใช้ตามเงื่อนไข</div>';
  }

  window.adminLoadUsers = async () => {
    const list=document.getElementById('adminUserList'); if(list) list.innerHTML='<div class="report-empty">กำลังโหลดข้อมูล...</div>';
    try { const r=await fetch('/api/v1/admin/users',{credentials:'include'}); const b=await r.json().catch(()=>({})); if(!r.ok) throw Error(b.error?.message||'โหลดผู้ใช้ไม่สำเร็จ'); users=b.data?.users||[]; render(); }
    catch(e){ if(list) list.innerHTML=`<div class="notice danger">${esc(e.message)}</div>`; }
  };
  window.adminFilterUsers = render;

  window.adminOpenUser = async (id) => {
    try { const r=await fetch(`/api/v1/admin/users/${id}`,{credentials:'include'}); const b=await r.json().catch(()=>({})); if(!r.ok) throw Error(b.error?.message||'โหลดรายละเอียดไม่สำเร็จ'); const u=b.data?.user; if(!u)return;
      const modal=document.getElementById('adminUserModal'); const body=document.getElementById('adminUserModalBody'); if(!modal||!body)return;
      body.innerHTML=`<div class="grid2" style="gap:12px"><div><div class="inp-label">Username</div><strong>${esc(u.username)}</strong></div><div><div class="inp-label">บทบาท</div><strong>${esc(roleLabel(u.roles))}</strong></div><div><div class="inp-label">Email</div><div>${esc(u.email)}</div></div><div><div class="inp-label">เบอร์โทร</div><div>${esc(u.phone||'-')}</div></div><div><div class="inp-label">สถานะ</div><span class="badge ${statusClass(u.status)}">${statusLabel(u.status)}</span></div><div><div class="inp-label">Wallet</div><strong>${u.walletBalance.toLocaleString()} pts</strong></div><div><div class="inp-label">Email Verification</div><div>${u.emailVerified?'✓ ยืนยันแล้ว':'ยังไม่ยืนยัน'}</div></div><div><div class="inp-label">Phone Verification</div><div>${u.phoneVerified?'✓ ยืนยันแล้ว':'ยังไม่ยืนยัน'}</div></div></div><hr style="border:0;border-top:1px solid var(--border);margin:18px 0"><div class="grid2"><div>ซื้อสำเร็จ <strong>${u.boughtCount}</strong> รายการ</div><div>ขายสำเร็จ <strong>${u.soldCount}</strong> รายการ</div><div>สมัครเมื่อ ${new Date(u.createdAt).toLocaleString('th-TH')}</div></div><div id="adminUserActionBox" style="margin-top:18px"></div>`;
      const action=document.getElementById('adminUserActionBox'); if(u.status==='ACTIVE') action.innerHTML=`<button class="btn btn-warning btn-sm" onclick="adminModerateFromDetail(${u.id},'SUSPENDED')">⏸ ระงับบัญชี</button> <button class="btn btn-danger btn-sm" onclick="adminModerateFromDetail(${u.id},'BANNED')">🚫 แบนถาวร</button>`; else if(u.status!=='ACTIVE') action.innerHTML=`<button class="btn btn-success btn-sm" onclick="adminModerateFromDetail(${u.id},'ACTIVE')">✓ ปลดระงับ</button>`;
      modal.hidden=false;
    } catch(e){ alert(e.message); }
  };
  window.closeAdminUserModal=()=>{const m=document.getElementById('adminUserModal');if(m)m.hidden=true;};
  window.adminModerateFromDetail=async(id,status)=>{let reason=null;if(status!=='ACTIVE'){reason=prompt('ระบุเหตุผลสำหรับการระงับ/แบน');if(reason===null||!reason.trim())return;}try{const r=await fetch(`/api/v1/admin/moderation/users/${id}/status`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf()},body:JSON.stringify({status,reason})});const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error?.message||'ดำเนินการไม่สำเร็จ');closeAdminUserModal();await adminLoadUsers();}catch(e){alert(e.message);}};
})();

(() => {
  'use strict';
  let notifications = [];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const csrf = () => window.csrfToken || (typeof getCookieValue === 'function' ? getCookieValue('gm_csrf') : null) || '';
  const icon = (type) => ({ORDER_PURCHASE:'🛒',ORDER_SOLD:'💰',ORDER_CANCELLED:'❌',WALLET_TOPUP:'💳',WALLET_WITHDRAW_APPROVED:'✅',WALLET_WITHDRAW_REJECTED:'⚠️',SELLER_VERIFICATION_SUBMITTED:'🪪',SELLER_VERIFICATION_APPROVED:'✅',SELLER_VERIFICATION_REJECTED:'❌',NEW_MESSAGE:'💬',NEW_REVIEW:'⭐',PRODUCT_REPORTED:'🚨',PRODUCT_HIDDEN:'⏸',PRODUCT_RESTORED:'▶'}[type] || '🔔');
  const time = (v) => v ? new Date(v).toLocaleString('th-TH') : '-';
  function referenceAction(n) {
    const type = n.referenceType, id = Number(n.referenceId);
    if (!id) return '';
    if (type === 'ORDER') return `goPage('order-detail');`;
    if (type === 'PRODUCT') return `goPage('product-detail');`;
    if (type === 'CHAT') return `goPage('chat');`;
    if (type === 'WALLET' || type === 'WITHDRAWAL') return `goPage('wallet');`;
    if (type === 'SELLER_VERIFICATION') return `goPage('seller-verify');`;
    return '';
  }
  function renderPage() {
    const box = document.getElementById('notificationPageList'); if (!box) return;
    const unreadOnly = document.getElementById('notificationUnreadFilter')?.value === 'UNREAD';
    const rows = notifications.filter(n => !unreadOnly || !n.isRead);
    box.innerHTML = rows.length ? rows.map(n => `<button class="notification-item ${n.isRead?'is-read':'is-unread'}" onclick="openNotification(${n.id})"><span class="notification-icon">${icon(n.type)}</span><span class="notification-body"><strong>${esc(n.title)}</strong><span>${esc(n.message)}</span><time>${time(n.createdAt)}</time></span>${n.isRead?'':'<span class="notification-dot"></span>'}</button>`).join('') : '<div class="report-empty">ไม่มีการแจ้งเตือน</div>';
  }
  window.loadNotifications = async () => { try { const r=await fetch('/api/v1/notifications',{credentials:'include'}),b=await r.json().catch(()=>({})); if(!r.ok)throw Error(b.error?.message||'โหลดการแจ้งเตือนไม่สำเร็จ'); notifications=b.data?.notifications||[]; renderPage(); renderDropdown(); refreshBadgeFromList(); } catch(e) { const b=document.getElementById('notificationPageList'); if(b)b.innerHTML=`<div class="notice warn">${esc(e.message)}</div>`; } };
  window.refreshNotificationBadge = async () => { if(typeof isLoggedIn === 'undefined' || !isLoggedIn || typeof currentUser === 'undefined' || !currentUser)return; try { const r=await fetch('/api/v1/notifications/unread-count',{credentials:'include'}),b=await r.json().catch(()=>({})); if(!r.ok)return; const el=document.getElementById('notificationBadge'); if(el){const count=Number(b.data?.count||0);el.textContent=count>99?'99+':String(count);el.hidden=count===0;} } catch (_) {} };
  function refreshBadgeFromList(){const count=notifications.filter(n=>!n.isRead).length;const el=document.getElementById('notificationBadge');if(el){el.textContent=count>99?'99+':String(count);el.hidden=count===0;}}
  function renderDropdown(){const box=document.getElementById('notificationDropdownList');if(!box)return;const rows=notifications.slice(0,5);box.innerHTML=rows.length?rows.map(n=>`<button class="notification-item-mini ${n.isRead?'is-read':'is-unread'}" onclick="openNotification(${n.id})"><span>${icon(n.type)}</span><span><strong>${esc(n.title)}</strong><small>${esc(n.message)}</small></span></button>`).join(''):'<div class="notification-empty">ยังไม่มีการแจ้งเตือน</div>';}
  window.toggleNotificationDropdown = async () => { const box=document.getElementById('notificationDropdown');if(!box)return;const open=box.classList.toggle('open');if(open)await window.loadNotifications(); };
  window.openNotification = async (id) => { const n=notifications.find(x=>x.id===Number(id)); if(!n)return; if(!n.isRead){await fetch(`/api/v1/notifications/${Number(id)}/read`,{method:'PATCH',credentials:'include',headers:{'X-CSRF-Token':csrf()}});n.isRead=true;} renderPage();renderDropdown();refreshBadgeFromList(); const action=referenceAction(n);if(action){eval(action);}else{goPage('notifications');closeNotificationDropdown();} };
  window.markAllNotificationsRead = async () => { const r=await fetch('/api/v1/notifications/read-all',{method:'PATCH',credentials:'include',headers:{'X-CSRF-Token':csrf()}});if(r.ok){notifications.forEach(n=>{n.isRead=true;});renderPage();renderDropdown();refreshBadgeFromList();} };
  window.closeNotificationDropdown=()=>document.getElementById('notificationDropdown')?.classList.remove('open');
})();

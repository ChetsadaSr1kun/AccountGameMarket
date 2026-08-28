(() => {
  const originalUpdateNav = window.updateNav;
  if (typeof originalUpdateNav !== 'function') return;
  window.updateNav = function (...args) {
    originalUpdateNav.apply(this, args);
    if (!window.currentUser || !window.isLoggedIn || window.isAdmin) return;
    const right = document.getElementById('navRight'); if (!right || document.getElementById('notificationDropdown')) return;
    const anchor = right.querySelector('#walletNavBalance');
    const wrap = document.createElement('div'); wrap.className='notification-dropdown-wrap';
    wrap.innerHTML='<button class="notification-bell-btn" type="button" onclick="toggleNotificationDropdown()" aria-label="การแจ้งเตือน">🔔<span id="notificationBadge" class="notification-badge" hidden>0</span></button><div id="notificationDropdown" class="notification-dropdown"><div class="notification-dropdown-head"><strong>การแจ้งเตือน</strong><button class="btn btn-ghost btn-sm" onclick="loginAndGo(\'notifications\');closeNotificationDropdown()">ดูทั้งหมด</button></div><div id="notificationDropdownList"></div></div>';
    if (anchor) anchor.insertAdjacentElement('afterend', wrap); else right.prepend(wrap);
    window.refreshNotificationBadge?.();
  };
  window.updateNav();
})();

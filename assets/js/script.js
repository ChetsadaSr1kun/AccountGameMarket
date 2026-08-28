// ===================== STATE =====================
let currentPage = 'home';
let isLoggedIn = false;
let isAdmin = false;
let currentUser = null;
let csrfToken = null;
let resetToken = null;
let pendingAvatarFile = null;
let pendingAvatarPreviewUrl = null;
const otpCooldowns = {
  email: { endsAt: 0, timer: null },
  phone: { endsAt: 0, timer: null },
};

const managedAvatarUrlPattern = /^\/uploads\/avatars\/avatar-[a-f0-9-]{36}\.(jpg|png|webp)$/;

const adminPages = ['admin-dashboard','admin-users','admin-products','admin-games','admin-seller-verifications','admin-chat-log','admin-withdraw','admin-topup','admin-report','admin-suspended-users'];
const userPages = ['home-user','listings-user','product-user','profile','wallet','history','chat',
  'order-confirm','order-otp','order-success','order-info','order-detail','review','user-report',
  'seller-verify','add-listing','edit-listing','my-listings','seller-profile'];
const guestPages = ['home','login','register','forgot','otp-reset','reset-success','listings','product','product-detail'];

// ===================== NAVIGATION =====================
function goPage(pageId) {
  // Approved sellers should go directly to the create-listing page.
  if (pageId === 'seller-verify' && currentUser?.roles?.includes('SELLER')) pageId = 'add-listing';

  if (adminPages.includes(pageId) && (!isLoggedIn || !isAdmin)) {
    clearClientAuthState();
    pageId = 'login';
  } else if (userPages.includes(pageId) && !isLoggedIn) {
    pageId = 'login';
  }

  document.querySelectorAll('.page').forEach((p) => {
    p.classList.remove('active');
    p.style.display = 'none';
  });

  const pg = document.getElementById('pg-' + pageId);
  if (!pg) {
    console.error(`Page not found: ${pageId}`);
    return;
  }

  pg.classList.add('active');
  // Force the selected page visible even if a stale or legacy CSS rule overrides .page.active.
  pg.style.setProperty('display', 'block', 'important');
  currentPage = pageId;
  updateNav();
  updateDevBtns();
  renderAdminSidebars();
  if (pageId === 'seller-verify') window.loadSellerVerificationStatus?.();
  if (pageId === 'add-listing') {
    if (!window.editingProductId) window.resetCreateProductEditorMode?.();
    window.loadCreateProductGames?.();
    const attributes = document.getElementById('create-product-attributes');
    if (attributes && !window.editingProductId) attributes.innerHTML = 'เลือกเกมเพื่อโหลดรายละเอียด';
  }
  if (pageId === 'my-listings') window.loadMyProducts?.();
  if (pageId === 'profile') window.loadProfileSellerRating?.();
  if (pageId === 'wallet' || pageId === 'history') {
    window.loadWallet?.();
    if (pageId === 'history') window.loadTradeHistory?.();
    if (pageId === 'wallet') window.loadWalletTopupRequests?.();
  }
  if (pageId === 'admin-seller-verifications') window.loadAdminSellerVerificationRequests?.();
  if (pageId === 'admin-topup') window.loadAdminTopupRequests?.();
  if (pageId === 'admin-withdraw') window.loadAdminWithdrawalRequests?.();
  if (pageId === 'admin-report') window.loadAdminTransactionReports?.();
  if (pageId === 'admin-dashboard') window.loadAdminDashboardSummary?.();
  if (pageId === 'admin-games') window.adminInitGames?.();
  if (pageId === 'admin-users') window.adminLoadUsers?.();
  if (pageId === 'admin-products') window.adminLoadProducts?.();
  if (pageId === 'admin-suspended-users') window.adminLoadSuspendedUsers?.();
  if (pageId === 'admin-chat-log') window.loadAdminChatLog?.();
  if (pageId === 'chat') window.loadChatPage?.();
  window.scrollTo(0,0);
}

function loginAndGo(pageId) {
  if (!isLoggedIn || isAdmin) {
    goPage(isAdmin ? 'admin-dashboard' : 'login');
    return;
  }
  goPage(pageId);
}

function goAdmin(pageId) {
  if (!isLoggedIn || !isAdmin) {
    clearClientAuthState();
    goPage('login');
    return;
  }
  goPage(pageId);
}

function managedAvatarUrl(avatarUrl) {
  return typeof avatarUrl === 'string' && managedAvatarUrlPattern.test(avatarUrl) ? avatarUrl : null;
}

function avatarContent(username, avatarUrl) {
  const managedUrl = managedAvatarUrl(avatarUrl);
  if (managedUrl) return `<img src="${managedUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>`;
  return username.charAt(0).toUpperCase();
}

function syncAvatarElements() {
  const username = currentUser?.username || 'User';
  const managedUrl = managedAvatarUrl(currentUser?.avatarUrl);
  document.querySelectorAll('[data-user-field="avatar"]').forEach((element) => {
    element.textContent = '';
    if (managedUrl) element.innerHTML = `<img src="${managedUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>`;
    else element.textContent = username.charAt(0).toUpperCase();
  });
}

function updateOtpControls(channel) {
  const isEmail = channel === 'email';
  const sendButton = document.getElementById(isEmail ? 'profileEmailVerificationSendButton' : 'profilePhoneVerificationSendButton');
  const verifyButton = document.getElementById(isEmail ? 'profileEmailVerificationVerifyButton' : 'profilePhoneVerificationVerifyButton');
  const otpInput = document.getElementById(isEmail ? 'profileEmailVerificationOtp' : 'profilePhoneVerificationOtp');
  const isVerified = Boolean(isEmail ? currentUser?.emailVerified : currentUser?.phoneVerified);
  const state = otpCooldowns[channel];
  const secondsRemaining = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
  if (sendButton) {
    sendButton.disabled = isVerified || secondsRemaining > 0;
    sendButton.textContent = secondsRemaining > 0 ? `ส่งใหม่ได้ใน ${secondsRemaining} วินาที` : 'ส่งรหัส OTP';
  }
  if (verifyButton) verifyButton.disabled = isVerified;
  if (otpInput) otpInput.disabled = isVerified;
  if (secondsRemaining === 0 && state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function startOtpCooldown(channel, seconds = 60) {
  const state = otpCooldowns[channel];
  state.endsAt = Date.now() + (seconds * 1000);
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(() => updateOtpControls(channel), 1000);
  updateOtpControls(channel);
}

function clearOtpCooldown(channel) {
  const state = otpCooldowns[channel];
  state.endsAt = 0;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  updateOtpControls(channel);
}

function updateVerificationStatus() {
  const verified = Boolean(currentUser?.accountVerified);
  document.querySelectorAll('[data-account-verification]').forEach((element) => {
    element.textContent = verified ? '✓ ยืนยันแล้ว' : 'ยังไม่ยืนยันสถานะ';
    element.className = `badge ${verified ? 'badge-green' : 'badge-blue'}`;
  });

  const emailStatus = document.getElementById('profileEmailVerificationStatus');
  if (emailStatus) emailStatus.textContent = currentUser?.emailVerified ? 'ยืนยันแล้ว' : 'ยังไม่ได้ยืนยัน';

  const phoneStatus = document.getElementById('profilePhoneVerificationStatus');
  if (phoneStatus) phoneStatus.textContent = currentUser?.phoneVerified ? 'ยืนยันแล้ว' : 'ยังไม่ได้ยืนยัน';
  ['email', 'phone'].forEach((channel) => {
    const channelVerified = channel === 'email' ? currentUser?.emailVerified : currentUser?.phoneVerified;
    document.querySelectorAll(`[data-verification-pending="${channel}"]`).forEach((element) => { element.style.display = channelVerified ? 'none' : ''; });
    document.querySelectorAll(`[data-verification-success="${channel}"]`).forEach((element) => { element.style.display = channelVerified ? '' : 'none'; });
    document.querySelectorAll(`[data-verification-change="${channel}"]`).forEach((element) => { element.style.display = channelVerified ? 'none' : ''; });
    updateOtpControls(channel);
  });
}

function updateNav() {
  const linksEl = document.getElementById('navLinks');
  const rightEl = document.getElementById('navRight');
  const username = currentUser?.username || 'User';
  if (isAdmin) {
    linksEl.innerHTML = `
      <button class="nav-btn ${currentPage==='admin-dashboard'?'active':''}" onclick="goAdmin('admin-dashboard')">📊 Dashboard</button>
      <button class="nav-btn ${currentPage==='admin-games'?'active':''}" onclick="goAdmin('admin-games')">🎮 หมวดหมู่</button>
      <button class="nav-btn ${currentPage==='admin-seller-verifications'?'active':''}" onclick="goAdmin('admin-seller-verifications')">🪪 ตรวจสอบผู้ขาย</button>
      <button class="nav-btn ${currentPage==='admin-chat-log'?'active':''}" onclick="goAdmin('admin-chat-log')">💬 ประวัติแชท</button>
      <button class="nav-btn ${currentPage==='admin-withdraw'?'active':''}" onclick="goAdmin('admin-withdraw')">💸 ถอนเงิน</button>
      <button class="nav-btn ${currentPage==='admin-report'?'active':''}" onclick="goAdmin('admin-report')">🚨 รายงาน</button>
      <button class="nav-btn ${currentPage==='admin-suspended-users'?'active':''}" onclick="goAdmin('admin-suspended-users')">⛔ ผู้ใช้ถูกระงับ</button>
    `;
    rightEl.innerHTML = `<span style="color:var(--muted);font-size:13px">Admin Panel</span><button class="btn btn-secondary btn-sm" onclick="logout()">ออกจากระบบ</button>`;
    const adminPage = document.getElementById('pg-' + currentPage);
    if (adminPage && adminPages.includes(currentPage)) {
      adminPage.classList.add('active');
      adminPage.style.setProperty('display', 'block', 'important');
      adminPage.style.setProperty('visibility', 'visible', 'important');
      adminPage.style.setProperty('opacity', '1', 'important');
    }
  } else if (isLoggedIn) {
    linksEl.innerHTML = `
      <button class="nav-btn ${currentPage==='home-user'?'active':''}" onclick="loginAndGo('home-user')">หน้าแรก</button>
      <button class="nav-btn ${currentPage==='listings-user'?'active':''}" onclick="loginAndGo('listings-user')">รายการสินค้า</button>
      <button class="nav-btn ${currentPage==='chat'?'active':''}" onclick="loginAndGo('chat')">💬 แชท</button>
      <button class="nav-btn ${currentPage==='history'?'active':''}" onclick="loginAndGo('history')">ประวัติ</button>
      <button class="nav-btn ${currentPage==='wallet'?'active':''}" onclick="loginAndGo('wallet')">💰 กระเป๋าตัง</button>
    `;
    rightEl.innerHTML = `
      <span id="walletNavBalance" style="color:var(--muted);font-size:13px">💰 0 pts</span>
      <div class="dropdown">
        <div class="avatar" style="width:38px;height:38px;background:var(--accent);font-size:18px;cursor:pointer;overflow:hidden" onclick="toggleDropdown()">${avatarContent(username, currentUser?.avatarUrl)}</div>
        <div class="dropdown-menu" id="userDropdown">
          <button class="dropdown-item" onclick="closeDropdown();loginAndGo('profile')">✏️ แก้ไขข้อมูล</button>
          <button class="dropdown-item" onclick="closeDropdown();loginAndGo('wallet')">💰 ฝาก/ถอน</button>
          <button class="dropdown-item" onclick="closeDropdown();loginAndGo('history')">📋 ประวัติ</button>
          <button class="dropdown-item" onclick="closeDropdown();loginAndGo('seller-verify')">🏷️ ลงขายสินค้า</button>
          <button class="dropdown-item" onclick="closeDropdown();loginAndGo('my-listings')">📦 ประกาศของฉัน</button>
          <button class="dropdown-item danger" onclick="closeDropdown();logout()">🚪 ออกจากระบบ</button>
        </div>
      </div>
    `;
    window.refreshWalletNavBalance?.();
  } else {
    linksEl.innerHTML = `
      <button class="nav-btn ${currentPage==='home'?'active':''}" onclick="goPage('home')">หน้าแรก</button>
      <button class="nav-btn ${currentPage==='listings'?'active':''}" onclick="goPage('listings')">รายการสินค้า</button>
    `;
    rightEl.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="goPage('login')">เข้าสู่ระบบ</button>
      <button class="btn btn-primary btn-sm" onclick="goPage('register')">สมัครสมาชิก</button>
    `;
  }
}

function getCookieValue(name) {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : null;
}

function setUserField(field, value) {
  document.querySelectorAll(`[data-user-field="${field}"]`).forEach((element) => {
    if (element instanceof HTMLInputElement) {
      element.value = value;
      return;
    }

    element.textContent = value;
  });
}

function formatRegisterPhoneInput() {
  const input = document.getElementById('registerPhone');
  if (!input) return;
  input.value = GameMarketPhone.formatThaiPhone(input.value);
}

function applyCurrentUser(user) {
  currentUser = user;
  isLoggedIn = Boolean(currentUser);
  isAdmin = currentUser?.roles?.includes('ADMIN') || false;
  csrfToken = csrfToken || getCookieValue('gm_csrf');

  if (currentUser) {
    const username = currentUser.username || 'User';
    setUserField('username', username);
    setUserField('email', currentUser.email || '');
    syncAvatarElements();
    // Populate read-only profile display fields
    const uInp = document.getElementById('profileUsername');
    const eInp = document.getElementById('profileEmail');
    const firstNameInp = document.getElementById('profileFirstName');
    const lastNameInp = document.getElementById('profileLastName');
    const phoneInp = document.getElementById('profilePhone');
    const dateOfBirthInp = document.getElementById('profileDateOfBirth');
    const avatarFallback = document.getElementById('profileAvatarFallback');
    const avatarImage = document.getElementById('profileAvatarImage');
    if (uInp) uInp.value = username;
    if (eInp) eInp.value = currentUser.email || '';
    if (firstNameInp) firstNameInp.value = currentUser.firstName || 'ยังไม่ได้ระบุ';
    if (lastNameInp) lastNameInp.value = currentUser.lastName || 'ยังไม่ได้ระบุ';
    if (phoneInp) phoneInp.value = GameMarketPhone.formatThaiPhoneForDisplay(currentUser.phone);
    const verificationPhoneValue = document.getElementById('profilePhoneVerificationValue');
    if (verificationPhoneValue) verificationPhoneValue.textContent = GameMarketPhone.formatThaiPhoneForDisplay(currentUser.phone);
    if (dateOfBirthInp) dateOfBirthInp.value = currentUser.dateOfBirth || 'ยังไม่ได้ระบุ';
    if (avatarImage && avatarFallback) {
      const avatarUrl = managedAvatarUrl(currentUser.avatarUrl);
      const hasManagedAvatar = Boolean(avatarUrl);
      avatarImage.style.display = hasManagedAvatar ? 'block' : 'none';
      avatarFallback.style.display = hasManagedAvatar ? 'none' : 'flex';
      if (hasManagedAvatar) avatarImage.src = avatarUrl;
      else avatarImage.removeAttribute('src');
    }
    updateVerificationStatus();
  }

  updateNav();

  // Restore the correct SPA page after authentication is recovered.
  const isAdminPage = adminPages.includes(currentPage);
  if (isAdmin && !isAdminPage) {
    goPage('admin-dashboard');
  } else if (!isAdmin && isLoggedIn && isAdminPage) {
    goPage('home-user');
  }
}

function clearClientAuthState() {
  currentUser = null;
  csrfToken = null;
  isLoggedIn = false;
  isAdmin = false;
  renderListingCard('valorant');
  renderListingCard('rov');
  updateNav();
}

async function getCurrentSession() {
  const response = await fetch('/api/v1/auth/me', {
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function refreshSession() {
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) return false;

  const data = await response.json().catch(() => ({}));
  csrfToken = data.data?.csrfToken || getCookieValue('gm_csrf');
  return true;
}

async function restoreSession() {
  try {
    let session = await getCurrentSession();

    if (session.response.ok) {
      applyCurrentUser(session.data.data?.user || null);
      return;
    }

    if (session.response.status === 401 && await refreshSession()) {
      session = await getCurrentSession();
      if (session.response.ok) {
        applyCurrentUser(session.data.data?.user || null);
        return;
      }
    }

    clearClientAuthState();
  } catch (error) {
    console.error('Session restore failed:', error);
    clearClientAuthState();
  }
}

async function logout() {
  const activeCsrfToken = csrfToken || getCookieValue('gm_csrf');

  if (!activeCsrfToken) {
    alert('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองออกจากระบบอีกครั้ง');
    return;
  }

  try {
    const response = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': activeCsrfToken,
      },
    });

    if (response.status === 204) {
      clearClientAuthState();
      alert('ออกจากระบบสำเร็จ');
      goPage('home');
      return;
    }

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      clearClientAuthState();
      alert('Session หมดอายุ ระบบได้นำคุณกลับสู่หน้าแรกแล้ว');
      goPage('home');
      return;
    }

    if (response.status === 403) {
      alert('ไม่สามารถออกจากระบบได้ เนื่องจากข้อมูลความปลอดภัยไม่ถูกต้อง กรุณารีเฟรชหน้าแล้วลองอีกครั้ง');
      return;
    }

    alert(data.error?.message || 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
  } catch (error) {
    console.error('Logout request failed:', error);
    alert('ไม่สามารถเชื่อมต่อระบบเพื่อออกจากระบบได้ กรุณาลองอีกครั้ง');
  }
}
function toggleDropdown() { document.getElementById('userDropdown').classList.toggle('open'); }
function closeDropdown() { document.getElementById('userDropdown')?.classList.remove('open'); }
document.addEventListener('click', function(e) { if (!e.target.closest('.dropdown')) closeDropdown(); });

// ===================== ADMIN SIDEBAR =====================
const adminNavItems = [
  ['admin-dashboard','📊','Dashboard'],
  ['admin-users','👥','จัดการผู้ใช้'],
  ['admin-products','📦','จัดการสินค้า'],
  ['admin-games','🎮','หมวดหมู่เกม'],
  ['admin-chat-log','💬','ประวัติแชท'],
  ['admin-withdraw','💸','อนุมัติถอนเงิน'],
  ['admin-topup','➕','อนุมัติเติมพ้อยท์'],
  ['admin-seller-verifications','🪪','ตรวจสอบผู้ขาย'],
  ['admin-report','🚨','รายงาน'],
  ['admin-suspended-users','⛔','รายชื่อผู้ใช้ที่ถูกระงับ'],
];
function renderAdminSidebars() {
  ['','2','3','4','5','6','7','8','9'].forEach(sfx => {
    const el = document.getElementById('adminSidebar'+sfx);
    if (!el) return;
    el.innerHTML = `
      <div style="padding:16px 20px;font-size:12px;color:var(--dim);font-weight:600;letter-spacing:.5px">ADMIN PANEL</div>
      ${adminNavItems.map(([id,icon,label]) => `
        <div class="admin-nav-item ${currentPage===id?'active':''}" onclick="goAdmin('${id}')">${icon} ${label}</div>
      `).join('')}
      <div class="divider" style="margin:16px 0"></div>
      <div class="admin-nav-item" onclick="logout()">🚪 ออกจากระบบ</div>
    `;
  });
}

// ===================== DEV BTNS =====================
function updateDevBtns() {
  document.querySelectorAll('.devbtn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.devbtn').forEach(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    if (onclick.includes("'"+currentPage+"'")) btn.classList.add('active');
  });
}

// ===================== TABS =====================
function switchTab(btn, contentId) {
  const tabGroup = btn.closest('.card') || btn.closest('.page');
  const tabButtons = [...tabGroup.querySelectorAll('.tab-btn')];

  tabButtons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // ซ่อนเฉพาะ content ของแท็บ ไม่ใช่ทุก element ที่มี id
  // เพื่อไม่ให้ input และ element ภายในแท็บถูกซ่อนไปด้วย
  const tabIds = tabButtons
    .map((b) => {
      const match = (b.getAttribute('onclick') || '').match(/switchTab\(this,'([^']+)'\)/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  tabIds.forEach((id) => {
    const content = document.getElementById(id);
    if (content) content.style.display = 'none';
  });

  const target = document.getElementById(contentId);
  if (target) target.style.display = 'block';

  if (contentId === 'hist-tx' && typeof window.loadHistoryWalletTransactions === 'function') {
    window.loadHistoryWalletTransactions();
  }
}

// ===================== OTP =====================
function otpNext(input, idx) {
  if (input.value) {
    input.classList.add('filled');
    const boxes = input.closest('.otp-wrap').querySelectorAll('.otp-box');
    if (idx < boxes.length - 1) boxes[idx+1].focus();
  } else { input.classList.remove('filled'); }
}

// ===================== FILTER GAME =====================
function filterGame(el) {
  el.closest('.card').querySelectorAll('.filter-item').forEach(f => f.classList.remove('active'));
  el.classList.add('active');
}

// ===================== OTP METHOD RADIO =====================
function selectOTPMethod(el) {
  const group = el.closest('.card') || el.closest('#pg-forgot');
  group.querySelectorAll('.radio-option').forEach(r => {
    r.classList.remove('selected');
    const dot = r.querySelector('.flex-between > div');
    if (dot) dot.innerHTML = '';
    if (dot) dot.style.borderColor = 'var(--border2)';
  });
  el.classList.add('selected');
  const dot = el.querySelector('.flex-between > div');
  if (dot) { dot.style.borderColor = 'var(--accent)'; dot.innerHTML = '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></div>'; }
}

// ===================== ADD GAME FORM =====================
function toggleAddGame() {
  const f = document.getElementById('addGameForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function setProductImage(mainImageId, thumbEl, imageSrc) {
  const mainImage = document.getElementById(mainImageId);
  if (mainImage) mainImage.src = imageSrc;
  const wrap = thumbEl.closest('.product-thumbs');
  if (wrap) {
    wrap.querySelectorAll('.product-thumb').forEach(img => img.classList.remove('active'));
    thumbEl.classList.add('active');
  }
}

// ===================== EDIT LISTING =====================
const listingStore = {
  valorant: {
    game: 'Valorant',
    title: 'บัญชี Valorant Immortal 3',
    rank: 'Immortal 3',
    skins: '42 สกิน',
    price: '1500',
    server: 'Asia',
    description: 'บัญชีแรงค์ Immortal 3 พร้อมสกินเด่น Prime Phantom, Reaver Vandal และ Glitchpop Sheriff เหมาะสำหรับผู้ที่ต้องการไอดีพร้อมเล่นต่อได้ทันที',
    status: 'active',
    username: 'valorant_im3_pro',
    password: 'V@l0r@nt#2024',
    email: 'seller@gmail.com',
    emailPassword: 'Em@il#Pass123'
  },
  rov: {
    game: 'ROV',
    title: 'บัญชี ROV Diamond สกิน Krixi',
    rank: 'Diamond',
    skins: '25 สกิน',
    price: '700',
    server: 'Asia',
    description: 'บัญชี ROV ระดับ Diamond มีสกิน Krixi และฮีโร่ใช้งานหลักครบ เหมาะสำหรับสายเมจและผู้เล่นเริ่มต้นที่อยากได้ไอดีคุ้มราคา',
    status: 'paused',
    username: 'rov_diamond_krixi',
    password: 'ROV#Diamond2026',
    email: 'rovseller@gmail.com',
    emailPassword: 'RovMail#123'
  }
};

let editingListingId = null;

function openEditListing(listingId) {
  const item = listingStore[listingId];
  if (!item) return;
  editingListingId = listingId;
  document.getElementById('edit-game').value = item.game;
  document.getElementById('edit-title').value = item.title;
  document.getElementById('edit-rank').value = item.rank;
  document.getElementById('edit-skins').value = item.skins;
  document.getElementById('edit-price').value = item.price;
  document.getElementById('edit-server').value = item.server;
  document.getElementById('edit-description').value = item.description;
  document.getElementById('edit-status').value = item.status;
  document.getElementById('edit-username').value = item.username;
  document.getElementById('edit-password').value = item.password;
  document.getElementById('edit-email').value = item.email;
  document.getElementById('edit-email-password').value = item.emailPassword;
  loginAndGo('edit-listing');
}

function saveEditedListing() {
  if (!editingListingId || !listingStore[editingListingId]) {
    alert('ไม่พบรายการที่ต้องการแก้ไข');
    return;
  }

  const updated = {
    game: document.getElementById('edit-game').value,
    title: document.getElementById('edit-title').value,
    rank: document.getElementById('edit-rank').value,
    skins: document.getElementById('edit-skins').value,
    price: document.getElementById('edit-price').value,
    server: document.getElementById('edit-server').value,
    description: document.getElementById('edit-description').value,
    status: document.getElementById('edit-status').value,
    username: document.getElementById('edit-username').value,
    password: document.getElementById('edit-password').value,
    email: document.getElementById('edit-email').value,
    emailPassword: document.getElementById('edit-email-password').value
  };

  listingStore[editingListingId] = updated;
  renderListingCard(editingListingId);
  alert('บันทึกการแก้ไขเรียบร้อยแล้ว');
  loginAndGo('my-listings');
}

function renderListingCard(listingId) {
  const item = listingStore[listingId];
  if (!item) return;
  const titleEl = document.getElementById(`listing-title-${listingId}`);
  const metaEl = document.getElementById(`listing-meta-${listingId}`);
  const priceEl = document.getElementById(`listing-price-${listingId}`);
  const statusEl = document.getElementById(`listing-status-${listingId}`);
  if (titleEl) titleEl.textContent = item.title;
  if (metaEl) metaEl.textContent = `${item.rank} • ${item.skins} • ${item.server}`;
  if (priceEl) priceEl.textContent = `${Number(item.price || 0).toLocaleString('th-TH')} ฿`;
  if (statusEl) {
    statusEl.className = 'badge ' + (item.status === 'active' ? 'badge-green' : 'badge-yellow');
    statusEl.textContent = item.status === 'active' ? '🟢 กำลังขาย' : '⏸️ หยุดขาย';
  }
}

async function login() {

    const username = document
        .getElementById("loginUsername")
        .value
        .trim();

    const password = document
        .getElementById("loginPassword")
        .value;

    if (!username || !password) {
        alert("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
        return;
    }

    try {

        const response = await fetch('/api/v1/auth/login', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                username,
                password
            })
        });

        const data = await response.json();

        if (response.ok) {
            csrfToken = data.data?.csrfToken || getCookieValue('gm_csrf');
            applyCurrentUser(data.data?.user || null);

            alert("เข้าสู่ระบบสำเร็จ");

            goPage(isAdmin ? 'admin-dashboard' : 'home-user');

        } else {

            alert(data.error?.message || "เข้าสู่ระบบไม่สำเร็จ");

        }

    } catch (error) {
        console.error(error);
    }

}

async function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const firstName = document.getElementById('registerFirstName').value.trim();
    const lastName = document.getElementById('registerLastName').value.trim();
    const phone = GameMarketPhone.digitsOnly(document.getElementById('registerPhone').value);
    const dateOfBirth = document.getElementById('registerDateOfBirth').value;
    const acceptedTerms = document.getElementById('registerTerms').checked;

    if (!username || !email || !password || !confirmPassword || !firstName || !lastName || !phone || !dateOfBirth) {
        alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
        return;
    }

    if (password !== confirmPassword) {
        alert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
        return;
    }

    if (!acceptedTerms) {
        alert('กรุณายอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว');
        return;
    }

    try {
        const response = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                username,
                email,
                password,
                firstName,
                lastName,
                phone,
                dateOfBirth,
            }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            csrfToken = data.data?.csrfToken || getCookieValue('gm_csrf');
            applyCurrentUser(data.data?.user || null);
            // Clear form fields after successful registration (security + UX)
            ['registerUsername','registerEmail','registerPassword','registerConfirmPassword','registerFirstName','registerLastName','registerPhone','registerDateOfBirth'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const termsEl = document.getElementById('registerTerms');
            if (termsEl) termsEl.checked = false;
            alert('สมัครสมาชิกสำเร็จ');
            goPage(isAdmin ? 'admin-dashboard' : 'home-user');
            return;
        }

        if (response.status === 409 && data.error?.code === 'DUPLICATE_USER') {
            alert('อีเมลหรือชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาใช้ข้อมูลอื่น');
            return;
        }

        if (response.status === 422 && data.error?.fields) {
            const message = Object.values(data.error.fields)[0];
            alert(`ข้อมูลสมัครสมาชิกไม่ถูกต้อง: ${message}`);
            return;
        }

        alert(data.error?.message || 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } catch (error) {
        console.error('Register request failed:', error);
        alert('ไม่สามารถเชื่อมต่อระบบเพื่อสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง');
    }
}

// ===================== PROFILE =====================

function setProfileMsg(id, text, isError) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#e53935' : '#43a047';
}

// updateProfile() and resetProfileForm() removed — personal info is read-only.
// Backend PATCH /api/v1/user/username and /api/v1/user/email APIs are kept for
// potential future admin use but are no longer called from the frontend.

async function uploadAvatarFromProfile() {
    const input = document.getElementById('profileAvatarInput');
    const file = input?.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > (2 * 1024 * 1024)) {
        setProfileMsg('profileAvatarMsg', 'กรุณาเลือกรูป JPEG, PNG หรือ WebP ขนาดไม่เกิน 2 MiB', true);
        return;
    }

    if (pendingAvatarPreviewUrl) URL.revokeObjectURL(pendingAvatarPreviewUrl);
    pendingAvatarFile = file;
    pendingAvatarPreviewUrl = URL.createObjectURL(file);
    const avatarFallback = document.getElementById('profileAvatarFallback');
    const avatarImage = document.getElementById('profileAvatarImage');
    if (avatarImage && avatarFallback) {
        avatarImage.src = pendingAvatarPreviewUrl;
        avatarImage.style.display = 'block';
        avatarFallback.style.display = 'none';
    }
    document.getElementById('profileAvatarConfirmButton').style.display = 'inline-flex';
    document.getElementById('profileAvatarCancelButton').style.display = 'inline-flex';
    setProfileMsg('profileAvatarMsg', 'ตรวจสอบตัวอย่าง แล้วกดยืนยันการเปลี่ยนรูป', false);
}

function openProfileAvatarPicker() {
    document.getElementById('profileAvatarInput')?.click();
}

function clearPendingAvatarChange(restoreCurrentAvatar) {
    if (pendingAvatarPreviewUrl) URL.revokeObjectURL(pendingAvatarPreviewUrl);
    pendingAvatarPreviewUrl = null;
    pendingAvatarFile = null;
    const input = document.getElementById('profileAvatarInput');
    if (input) input.value = '';
    const confirmButton = document.getElementById('profileAvatarConfirmButton');
    const cancelButton = document.getElementById('profileAvatarCancelButton');
    if (confirmButton) confirmButton.style.display = 'none';
    if (cancelButton) cancelButton.style.display = 'none';
    if (restoreCurrentAvatar && currentUser) applyCurrentUser(currentUser);
}

function cancelAvatarChangeFromProfile() {
    clearPendingAvatarChange(true);
    setProfileMsg('profileAvatarMsg', 'ยกเลิกการเปลี่ยนรูปแล้ว', false);
}

async function confirmAvatarChangeFromProfile() {
    const input = document.getElementById('profileAvatarInput');
    const file = pendingAvatarFile;
    if (!file) return;

    const activeCsrfToken = csrfToken || getCookieValue('gm_csrf');
    if (!activeCsrfToken) {
        setProfileMsg('profileAvatarMsg', 'ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่', true);
        return;
    }

    try {
        const formData = new FormData();
        formData.append('avatar', file);
        const response = await fetch('/api/v1/user/avatar', {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-CSRF-Token': activeCsrfToken },
            body: formData,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            setProfileMsg('profileAvatarMsg', data.error?.message || 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ', true);
            return;
        }

        clearPendingAvatarChange(false);
        applyCurrentUser(data.data?.user || currentUser);
        setProfileMsg('profileAvatarMsg', 'อัปโหลดรูปโปรไฟล์สำเร็จ', false);
    } catch (error) {
        console.error('Avatar upload failed:', error);
        setProfileMsg('profileAvatarMsg', 'ไม่สามารถอัปโหลดรูปโปรไฟล์ได้ กรุณาลองใหม่', true);
    }
}

async function sendEmailVerificationOtp() {
    const activeCsrfToken = csrfToken || getCookieValue('gm_csrf');
    if (!activeCsrfToken) {
        setProfileMsg('profileEmailVerificationMsg', 'ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่', true);
        return;
    }
    try {
        const response = await fetch('/api/v1/user/verification/email/send', {
            method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': activeCsrfToken },
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            if (data.error?.code === 'OTP_RESEND_COOLDOWN' && data.error?.retryAfterSeconds) startOtpCooldown('email', data.error.retryAfterSeconds);
            setProfileMsg('profileEmailVerificationMsg', data.error?.message || 'ส่งรหัสยืนยันไม่สำเร็จ', true);
            return;
        }
        const otpInput = document.getElementById('profileEmailVerificationOtp');
        if (otpInput) otpInput.value = '';
        startOtpCooldown('email');
        setProfileMsg('profileEmailVerificationMsg', 'ส่งรหัสยืนยันไปยังอีเมลของคุณแล้ว', false);
    } catch (error) {
        setProfileMsg('profileEmailVerificationMsg', 'ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่', true);
    }
}

async function verifyEmailVerificationOtp() {
    const otp = document.getElementById('profileEmailVerificationOtp')?.value.trim() || '';
    if (!/^\d{6}$/.test(otp)) {
        setProfileMsg('profileEmailVerificationMsg', 'กรุณากรอกรหัส OTP จำนวน 6 หลัก', true);
        return;
    }
    const activeCsrfToken = csrfToken || getCookieValue('gm_csrf');
    if (!activeCsrfToken) {
        setProfileMsg('profileEmailVerificationMsg', 'ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่', true);
        return;
    }
    try {
        const response = await fetch('/api/v1/user/verification/email/verify', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': activeCsrfToken },
            body: JSON.stringify({ otp }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setProfileMsg('profileEmailVerificationMsg', data.error?.message || 'ยืนยันอีเมลไม่สำเร็จ', true);
            return;
        }
        clearOtpCooldown('email');
        applyCurrentUser(data.data?.user || currentUser);
        document.getElementById('profileEmailVerificationOtp').value = '';
        setProfileMsg('profileEmailVerificationMsg', 'ยืนยันอีเมลสำเร็จ', false);
    } catch (error) {
        setProfileMsg('profileEmailVerificationMsg', 'ไม่สามารถยืนยันอีเมลได้ กรุณาลองใหม่', true);
    }
}

async function sendPhoneVerificationOtp() {
    const activeCsrfToken = csrfToken || getCookieValue('gm_csrf');
    if (!activeCsrfToken) {
        setProfileMsg('profilePhoneVerificationMsg', 'ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่', true);
        return;
    }
    try {
        const response = await fetch('/api/v1/user/verification/phone/send', {
            method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': activeCsrfToken },
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            if (data.error?.code === 'OTP_RESEND_COOLDOWN' && data.error?.retryAfterSeconds) startOtpCooldown('phone', data.error.retryAfterSeconds);
            setProfileMsg('profilePhoneVerificationMsg', data.error?.message || 'ส่งรหัสยืนยันทาง SMS ไม่สำเร็จ', true);
            return;
        }
        const otpInput = document.getElementById('profilePhoneVerificationOtp');
        if (otpInput) otpInput.value = '';
        startOtpCooldown('phone');
        setProfileMsg('profilePhoneVerificationMsg', 'ส่งรหัสยืนยันทาง SMS แล้ว', false);
    } catch (error) {
        setProfileMsg('profilePhoneVerificationMsg', 'ไม่สามารถส่งรหัสยืนยันทาง SMS ได้ กรุณาลองใหม่', true);
    }
}

async function verifyPhoneVerificationOtp() {
    const otp = document.getElementById('profilePhoneVerificationOtp')?.value.trim() || '';
    if (!/^\d{6}$/.test(otp)) {
        setProfileMsg('profilePhoneVerificationMsg', 'กรุณากรอกรหัส OTP จำนวน 6 หลัก', true);
        return;
    }
    const activeCsrfToken = csrfToken || getCookieValue('gm_csrf');
    if (!activeCsrfToken) {
        setProfileMsg('profilePhoneVerificationMsg', 'ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่', true);
        return;
    }
    try {
        const response = await fetch('/api/v1/user/verification/phone/verify', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': activeCsrfToken },
            body: JSON.stringify({ otp }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setProfileMsg('profilePhoneVerificationMsg', data.error?.message || 'ยืนยันเบอร์โทรศัพท์ไม่สำเร็จ', true);
            return;
        }
        clearOtpCooldown('phone');
        applyCurrentUser(data.data?.user || currentUser);
        document.getElementById('profilePhoneVerificationOtp').value = '';
        setProfileMsg('profilePhoneVerificationMsg', 'ยืนยันเบอร์โทรศัพท์สำเร็จ', false);
    } catch (error) {
        setProfileMsg('profilePhoneVerificationMsg', 'ไม่สามารถยืนยันเบอร์โทรศัพท์ได้ กรุณาลองใหม่', true);
    }
}

function openVerificationTargetModal(channel) {
    const isEmail = channel === 'email';
    const modal = document.getElementById(isEmail ? 'changeEmailModal' : 'changePhoneModal');
    const input = document.getElementById(isEmail ? 'changeEmailInput' : 'changePhoneInput');
    const currentInput = document.getElementById(isEmail ? 'changeEmailCurrent' : 'changePhoneCurrent');
    if (!modal || !input || !currentUser) return;
    const currentValue = isEmail ? (currentUser.email || '') : GameMarketPhone.formatThaiPhoneForDisplay(currentUser.phone);
    if (currentInput) currentInput.value = currentValue;
    input.value = currentValue;
    document.getElementById(isEmail ? 'changeEmailModalMsg' : 'changePhoneModalMsg').textContent = '';
    modal.hidden = false;
    input.focus();
}

function closeVerificationTargetModal(channel) {
    const modal = document.getElementById(channel === 'email' ? 'changeEmailModal' : 'changePhoneModal');
    if (modal) modal.hidden = true;
}

function formatChangePhoneInput() {
    const input = document.getElementById('changePhoneInput');
    if (input) input.value = GameMarketPhone.formatThaiPhone(input.value);
}

async function saveVerificationTarget(channel) {
    const isEmail = channel === 'email';
    const input = document.getElementById(isEmail ? 'changeEmailInput' : 'changePhoneInput');
    const messageId = isEmail ? 'changeEmailModalMsg' : 'changePhoneModalMsg';
    const value = isEmail ? input?.value.trim() : GameMarketPhone.digitsOnly(input?.value);
    if (!value) {
        setProfileMsg(messageId, 'กรุณากรอกข้อมูลให้ครบ', true);
        return;
    }
    const activeCsrfToken = csrfToken || getCookieValue('gm_csrf');
    if (!activeCsrfToken) {
        setProfileMsg(messageId, 'ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่', true);
        return;
    }
    try {
        const response = await fetch(`/api/v1/user/${isEmail ? 'email' : 'phone'}`, {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': activeCsrfToken },
            body: JSON.stringify(isEmail ? { newEmail: value } : { newPhone: value }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setProfileMsg(messageId, data.error?.message || 'บันทึกข้อมูลไม่สำเร็จ', true);
            return;
        }
        clearOtpCooldown(channel);
        const otpInput = document.getElementById(isEmail ? 'profileEmailVerificationOtp' : 'profilePhoneVerificationOtp');
        if (otpInput) otpInput.value = '';
        setProfileMsg(isEmail ? 'profileEmailVerificationMsg' : 'profilePhoneVerificationMsg', 'ข้อมูลถูกเปลี่ยนแล้ว กรุณายืนยันอีกครั้ง', false);
        applyCurrentUser(data.data?.user || currentUser);
        closeVerificationTargetModal(channel);
    } catch (error) {
        setProfileMsg(messageId, 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่', true);
    }
}

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeVerificationTargetModal('email');
    closeVerificationTargetModal('phone');
});

async function changePasswordFromProfile() {
    const currentPassword = document.getElementById('profileCurrentPassword')?.value || '';
    const newPassword     = document.getElementById('profileNewPassword')?.value     || '';
    const confirmPassword = document.getElementById('profileConfirmPassword')?.value || '';
    setProfileMsg('profilePasswordMsg', '', false);

    if (!currentPassword || !newPassword || !confirmPassword) {
        setProfileMsg('profilePasswordMsg', 'กรุณากรอกข้อมูลให้ครบ', true);
        return;
    }
    if (newPassword !== confirmPassword) {
        setProfileMsg('profilePasswordMsg', 'รหัสผ่านใหม่ไม่ตรงกัน', true);
        return;
    }

    // Client-side password policy — mirrors backend Zod changePasswordSchema
    if (newPassword.length < 8) {
        setProfileMsg('profilePasswordMsg', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', true);
        return;
    }
    if (newPassword.length > 72) {
        setProfileMsg('profilePasswordMsg', 'รหัสผ่านใหม่ต้องไม่เกิน 72 ตัวอักษร', true);
        return;
    }
    if (!/[a-z]/.test(newPassword)) {
        setProfileMsg('profilePasswordMsg', 'รหัสผ่านใหม่ต้องมีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว', true);
        return;
    }
    if (!/[A-Z]/.test(newPassword)) {
        setProfileMsg('profilePasswordMsg', 'รหัสผ่านใหม่ต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว', true);
        return;
    }
    if (!/[0-9]/.test(newPassword)) {
        setProfileMsg('profilePasswordMsg', 'รหัสผ่านใหม่ต้องมีตัวเลขอย่างน้อย 1 ตัว', true);
        return;
    }

    try {
        const res  = await fetch('/api/v1/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken || '' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json();

        if (!res.ok) {
            let msg;
            if (data.error?.code === 'INVALID_CREDENTIALS') {
                msg = 'รหัสผ่านเดิมไม่ถูกต้อง';
            } else if (data.error?.fields) {
                const firstField = Object.values(data.error.fields)[0];
                msg = firstField || data.error.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
            } else {
                msg = data.error?.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
            }
            setProfileMsg('profilePasswordMsg', msg, true);
            return;
        }

        // Backend revokes all sessions on password change — log out client immediately.
        clearClientAuthState();
        goPage('login');

    } catch (err) {
        console.error('changePasswordFromProfile failed:', err);
        setProfileMsg('profilePasswordMsg', 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่', true);
    }
}

// ===================== FORGOT PASSWORD =====================
async function forgotPassword() {
    const email = document.getElementById('forgotEmail').value.trim();
    const msgEl = document.getElementById('forgotMessage');

    // Clear previous message
    if (msgEl) { msgEl.textContent = ''; msgEl.className = 'forgot-msg'; }

    if (!email) {
        if (msgEl) { msgEl.textContent = 'กรุณากรอกอีเมล'; msgEl.className = 'forgot-msg forgot-msg--error'; }
        return;
    }

    try {
        const response = await fetch('/api/v1/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const data = await response.json().catch(() => ({}));

        // 200: always show neutral message regardless of account existence
        if (response.status === 200) {
            if (msgEl) {
                msgEl.textContent = 'หากอีเมลนี้มีบัญชีในระบบ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณ กรุณาตรวจสอบกล่องจดหมาย';
                msgEl.className = 'forgot-msg forgot-msg--success';
            }
            const emailEl = document.getElementById('forgotEmail');
            if (emailEl) emailEl.value = '';
            return;
        }

        if (response.status === 429) {
            if (msgEl) {
                msgEl.textContent = 'คุณส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
                msgEl.className = 'forgot-msg forgot-msg--error';
            }
            return;
        }

        if (response.status === 422 && data.error?.fields) {
            const message = Object.values(data.error.fields)[0];
            if (msgEl) { msgEl.textContent = `อีเมลไม่ถูกต้อง: ${message}`; msgEl.className = 'forgot-msg forgot-msg--error'; }
            return;
        }

        // Fallback server error — still show neutral message to avoid info leak
        if (msgEl) {
            msgEl.textContent = 'หากอีเมลนี้มีบัญชีในระบบ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณ กรุณาตรวจสอบกล่องจดหมาย';
            msgEl.className = 'forgot-msg forgot-msg--success';
        }
    } catch (error) {
        console.error('Forgot password request failed:', error);
        if (msgEl) { msgEl.textContent = 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง'; msgEl.className = 'forgot-msg forgot-msg--error'; }
    }
}

// ===================== RESET PASSWORD =====================
async function resetPassword() {
    if (!resetToken) {
        alert('ไม่พบลิงก์รีเซ็ตรหัสผ่าน กรุณาคลิกลิงก์จากอีเมลอีกครั้ง หากลิงก์หมดอายุ กรุณาขอลิงก์ใหม่');
        return;
    }

    const newPassword = document.getElementById('resetNewPassword').value;
    const confirmPassword = document.getElementById('resetConfirmPassword').value;

    if (!newPassword || !confirmPassword) {
        alert('กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่านให้ครบถ้วน');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
        return;
    }

    try {
        const response = await fetch('/api/v1/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: resetToken, newPassword }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 200) {
            resetToken = null;
            const newPwEl = document.getElementById('resetNewPassword');
            const confirmPwEl = document.getElementById('resetConfirmPassword');
            if (newPwEl) newPwEl.value = '';
            if (confirmPwEl) confirmPwEl.value = '';
            goPage('reset-success');
            return;
        }

        if (response.status === 400 && data.error?.code === 'INVALID_RESET_TOKEN') {
            alert('ลิงก์รีเซ็ตรหัสผ่านหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่');
            resetToken = null;
            goPage('forgot');
            return;
        }

        if (response.status === 422 && data.error?.fields) {
            const message = Object.values(data.error.fields)[0];
            alert(`รหัสผ่านไม่ถูกต้อง: ${message}`);
            return;
        }

        alert(data.error?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } catch (error) {
        console.error('Reset password request failed:', error);
        alert('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง');
    }
}

// ===================== INIT =====================
renderListingCard('valorant');
renderListingCard('rov');
goPage('home');
restoreSession();

// Detect reset token from URL query string (Email Reset Link flow)
// Token is read into memory only — never stored in localStorage/sessionStorage
;(function detectResetToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) {
        resetToken = token;
        // Remove token from URL immediately after reading
        history.replaceState(null, '', '/');
        goPage('otp-reset');
    }
}());

// ===================== PUBLIC MARKETPLACE LISTINGS =====================
function publicListingEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function publicListingCard(product) {
  const image = product.primaryImageUrl
    ? `<img src="${publicListingEscape(product.primaryImageUrl)}" style="width:100%;height:180px;object-fit:cover;border-radius:10px;margin-bottom:12px"/>`
    : `<div class="game-img" style="height:180px;margin-bottom:12px;display:flex;align-items:center;justify-content:center">🎮</div>`;
  return `<div class="card card-hover" onclick="openProductDetail(${Number(product.id)})" style="cursor:pointer">
    ${image}<span class="badge badge-gray" style="margin-bottom:8px">${publicListingEscape(product.game?.name || '-')}</span>
    <div style="font-weight:600;font-size:14px;margin-bottom:4px">${publicListingEscape(product.title)}</div>
    <div style="color:var(--muted);font-size:12px;margin-bottom:10px">ผู้ขาย: ${publicListingEscape(product.seller?.username || '-')}</div>
    <div class="flex-between"><span class="kanit" style="font-size:18px;font-weight:800;color:var(--accent)">${Number(product.price || 0).toLocaleString('th-TH')} ฿</span><span style="font-size:12px;color:var(--muted)">ดูรายละเอียด →</span></div>
  </div>`;
}

async function loadMarketplaceListings(pageId) {
  const page = document.getElementById(`pg-${pageId}`);
  if (!page) return;
  const grids = page.querySelectorAll('.grid3');
  const target = grids[grids.length - 1];
  if (!target) return;
  target.innerHTML = '<div class="card" style="padding:28px;text-align:center;color:var(--muted);grid-column:1/-1">กำลังโหลดรายการสินค้า...</div>';
  try {
    const response = await fetch('/api/v1/products?pageSize=50', { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'โหลดรายการสินค้าไม่สำเร็จ');
    const data = body.data || body;
    const count = Array.from(page.querySelectorAll('span')).find(el => /^พบ \d+ รายการ$/.test(el.textContent.trim()));
    if (count) count.textContent = `พบ ${data.total || 0} รายการ`;
    target.innerHTML = data.items?.length
      ? data.items.map(publicListingCard).join('')
      : '<div class="card" style="padding:28px;text-align:center;color:var(--muted);grid-column:1/-1">ยังไม่มีสินค้าที่เปิดขาย</div>';
  } catch (error) {
    console.error('loadMarketplaceListings failed:', error);
    target.innerHTML = `<div class="notice danger" style="grid-column:1/-1">${publicListingEscape(error.message || 'โหลดรายการสินค้าไม่สำเร็จ')}</div>`;
  }
}

const originalGoPageForMarketplace = goPage;
goPage = function(pageId) {
  originalGoPageForMarketplace(pageId);
  const resolved = (pageId === 'seller-verify' && currentUser?.roles?.includes('SELLER')) ? 'add-listing' : pageId;
  if (resolved === 'listings' || resolved === 'listings-user') loadMarketplaceListings(resolved);
};
window.loadMarketplaceListings = loadMarketplaceListings;



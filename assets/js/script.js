// ===================== STATE =====================
let currentPage = 'home';
let isLoggedIn = false;
let isAdmin = false;

const adminPages = ['admin-dashboard','admin-games','admin-chat-log','admin-withdraw','admin-report','admin-suspended-users'];
const userPages = ['home-user','listings-user','product-user','profile','wallet','history','chat',
  'order-confirm','order-otp','order-success','order-info','review','user-report',
  'seller-verify','add-listing','edit-listing','my-listings'];
const guestPages = ['home','login','register','forgot','otp-reset','reset-success','listings','product'];

// ===================== NAVIGATION =====================
function goPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('pg-' + pageId);
  if (pg) { pg.classList.add('active'); currentPage = pageId; }
  updateNav();
  updateDevBtns();
  renderAdminSidebars();
  window.scrollTo(0,0);
}

function loginAndGo(pageId) {
  isLoggedIn = true; isAdmin = false;
  goPage(pageId);
}

function goAdmin(pageId) {
  isLoggedIn = true; isAdmin = true;
  goPage(pageId);
}

function updateNav() {
  const linksEl = document.getElementById('navLinks');
  const rightEl = document.getElementById('navRight');
  if (isAdmin) {
    linksEl.innerHTML = `
      <button class="nav-btn ${currentPage==='admin-dashboard'?'active':''}" onclick="goAdmin('admin-dashboard')">📊 Dashboard</button>
      <button class="nav-btn ${currentPage==='admin-games'?'active':''}" onclick="goAdmin('admin-games')">🎮 หมวดหมู่</button>
      <button class="nav-btn ${currentPage==='admin-chat-log'?'active':''}" onclick="goAdmin('admin-chat-log')">💬 ประวัติแชท</button>
      <button class="nav-btn ${currentPage==='admin-withdraw'?'active':''}" onclick="goAdmin('admin-withdraw')">💸 ถอนเงิน</button>
      <button class="nav-btn ${currentPage==='admin-report'?'active':''}" onclick="goAdmin('admin-report')">🚨 รายงาน</button>
      <button class="nav-btn ${currentPage==='admin-suspended-users'?'active':''}" onclick="goAdmin('admin-suspended-users')">⛔ ผู้ใช้ถูกระงับ</button>
    `;
    rightEl.innerHTML = `<span style="color:var(--muted);font-size:13px">Admin Panel</span><button class="btn btn-secondary btn-sm" onclick="logout()">ออกจากระบบ</button>`;
  } else if (isLoggedIn) {
    linksEl.innerHTML = `
      <button class="nav-btn ${currentPage==='home-user'?'active':''}" onclick="loginAndGo('home-user')">หน้าแรก</button>
      <button class="nav-btn ${currentPage==='listings-user'?'active':''}" onclick="loginAndGo('listings-user')">รายการสินค้า</button>
      <button class="nav-btn ${currentPage==='chat'?'active':''}" onclick="loginAndGo('chat')">💬 แชท</button>
      <button class="nav-btn ${currentPage==='history'?'active':''}" onclick="loginAndGo('history')">ประวัติ</button>
      <button class="nav-btn ${currentPage==='wallet'?'active':''}" onclick="loginAndGo('wallet')">💰 กระเป๋าตัง</button>
    `;
    rightEl.innerHTML = `
      <span style="color:var(--muted);font-size:13px">💰 5,420 pts</span>
      <div class="dropdown">
        <div class="avatar" style="width:38px;height:38px;background:var(--accent);font-size:18px;cursor:pointer" onclick="toggleDropdown()">G</div>
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

function logout() { isLoggedIn = false; isAdmin = false; renderListingCard('valorant');
renderListingCard('rov');
goPage('home'); }
function toggleDropdown() { document.getElementById('userDropdown').classList.toggle('open'); }
function closeDropdown() { document.getElementById('userDropdown').classList.remove('open'); }
document.addEventListener('click', function(e) { if (!e.target.closest('.dropdown')) closeDropdown(); });

// ===================== ADMIN SIDEBAR =====================
const adminNavItems = [
  ['admin-dashboard','📊','Dashboard'],
  ['admin-games','🎮','หมวดหมู่เกม'],
  ['admin-chat-log','💬','ประวัติแชท'],
  ['admin-withdraw','💸','อนุมัติถอนเงิน'],
  ['admin-report','🚨','รายงาน'],
  ['admin-suspended-users','⛔','รายชื่อผู้ใช้ที่ถูกระงับ'],
];
function renderAdminSidebars() {
  ['','2','3','4','5','6'].forEach(sfx => {
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
  tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tabContents = tabGroup.querySelectorAll('[id]');
  tabContents.forEach(tc => { tc.style.display = 'none'; });
  const target = document.getElementById(contentId);
  if (target) target.style.display = 'block';
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

// ===================== INIT =====================
renderListingCard('valorant');
renderListingCard('rov');
goPage('home');

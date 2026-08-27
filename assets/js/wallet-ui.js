function walletTypeLabel(type) {
  const labels = { TOP_UP: 'ฝากพ้อยท์', PURCHASE: 'ซื้อสินค้า', SALE: 'รายได้จากการขาย', REFUND: 'คืนเงิน', WITHDRAWAL: 'ถอนพ้อยท์' };
  return labels[type] || type || 'ธุรกรรม';
}

function walletTypeClass(type) {
  if (type === 'SALE' || type === 'REFUND') return 'badge-green';
  if (type === 'PURCHASE') return 'badge-blue';
  if (type === 'WITHDRAWAL') return 'badge-yellow';
  return 'badge-blue';
}

function withdrawalStatusMeta(status) {
  if (status === 'APPROVED') return { label: 'สำเร็จ', badge: 'badge-green', amountColor: 'var(--danger)', sign: '-' };
  if (status === 'REJECTED') return { label: 'ไม่อนุมัติ', badge: 'badge-red', amountColor: 'var(--danger)', sign: '+' };
  return { label: 'รอตรวจสอบ', badge: 'badge-yellow', amountColor: 'var(--warn)', sign: '-' };
}

function walletFormatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('th-TH');
}

function escapeWalletText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function renderWalletTransactions(transactions, requests = [], withdrawalRequests = [], targetId = null) {
  const target = targetId || (window.currentPage === 'history' ? 'histWalletTransactionList' : 'walletTransactionList');
  const list = document.getElementById(target);
  if (!list) return;
  const isHistory = target === 'histWalletTransactionList';
  const filteredTransactions = isHistory ? (transactions || []).filter((tx) => ['TOP_UP', 'WITHDRAWAL'].includes(tx.type)) : (transactions || []);
  const walletItems = filteredTransactions
    .filter((tx) => !(tx.type === 'WITHDRAWAL' && withdrawalRequests.some((r) => Number(r.id) === Number(tx.referenceId))))
    .map((tx) => ({ ...tx, _kind: 'wallet', _time: tx.createdAt }));
  const pendingItems = (requests || []).filter((request) => request.status !== 'APPROVED')
    .map((request) => ({ ...request, _kind: 'topup-request', _time: request.createdAt }));
  const withdrawalItems = isHistory ? (withdrawalRequests || [])
    .map((request) => ({ ...request, _kind: 'withdrawal-request', _time: request.createdAt })) : [];
  const items = [...walletItems, ...pendingItems, ...withdrawalItems]
    .sort((a, b) => new Date(b._time || 0) - new Date(a._time || 0));
  if (!items.length) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted)">ยังไม่มีรายการธุรกรรม</div>';
    return;
  }
  list.innerHTML = items.map((item) => {
    if (item._kind === 'withdrawal-request') {
      const meta = withdrawalStatusMeta(item.status);
      const method = typeof walletPaymentMethodLabel === 'function' ? walletPaymentMethodLabel(item.paymentMethod) : item.paymentMethod;
      const detail = item.status === 'REJECTED' && item.rejectionReason
        ? item.rejectionReason
        : `${method || '-'} • ${walletFormatDate(item.createdAt)}`;
      return `<div class="card" style="display:flex;align-items:center;gap:14px;padding:14px 18px;margin-bottom:10px">
        <div style="width:104px;flex:0 0 104px"><span class="badge ${meta.badge}">${meta.label}</span></div>
        <div style="flex:1;min-width:0;text-align:left"><div style="font-weight:600">${item.status === 'REJECTED' ? 'คืนพ้อยท์' : 'ถอนพ้อยท์'}</div>
        <div style="color:var(--muted);font-size:12px">${escapeWalletText(detail)}</div></div>
        <div class="kanit" style="font-weight:800;color:${meta.amountColor};min-width:80px;text-align:right">${meta.sign}${Number(item.amount || 0).toLocaleString('th-TH')} ฿</div>
      </div>`;
    }
    if (item._kind === 'topup-request') {
      const rejected = item.status === 'REJECTED';
      const statusLabel = rejected ? 'ไม่อนุมัติ' : 'รอตรวจสอบ';
      const badgeClass = rejected ? 'badge-red' : 'badge-yellow';
      const method = typeof walletPaymentMethodLabel === 'function' ? walletPaymentMethodLabel(item.paymentMethod) : item.paymentMethod;
      const detail = rejected && item.rejectionReason ? item.rejectionReason : method;
      const amountColor = rejected ? 'var(--danger)' : 'var(--warn)';
      return `<div class="card" style="display:flex;align-items:center;gap:14px;padding:14px 18px;margin-bottom:10px">
        <div style="width:104px;flex:0 0 104px"><span class="badge ${badgeClass}">${statusLabel}</span></div>
        <div style="flex:1;min-width:0;text-align:left"><div style="font-weight:600">ฝากพ้อยท์</div>
        <div style="color:var(--muted);font-size:12px">${escapeWalletText(detail)} • ${walletFormatDate(item.createdAt)}</div></div>
        <div class="kanit" style="font-weight:800;color:${amountColor};min-width:72px;text-align:right">+${Number(item.amount || 0).toLocaleString('th-TH')} ฿</div>
      </div>`;
    }
    const positive = ['TOP_UP', 'SALE', 'REFUND'].includes(item.type);
    const isTopUp = item.type === 'TOP_UP';
    const isWithdrawal = item.type === 'WITHDRAWAL';
    const sign = positive ? '+' : '-';
    const amount = Math.abs(Number(item.amount || 0)).toLocaleString('th-TH');    const statusLabel = (isTopUp || isWithdrawal) ? 'สำเร็จ' : walletTypeLabel(item.type);
    const badgeClass = (isTopUp || isWithdrawal) ? 'badge-green' : walletTypeClass(item.type);
    const title = isTopUp ? 'ฝากพ้อยท์' : escapeWalletText(item.note || walletTypeLabel(item.type));
    const method = isTopUp && item.paymentMethod ? item.paymentMethod : null;
    const detail = method && typeof walletPaymentMethodLabel === 'function'
      ? `${walletPaymentMethodLabel(method)} • ${walletFormatDate(item.createdAt)}`
      : walletFormatDate(item.createdAt);
    return `<div class="card" style="display:flex;align-items:center;gap:14px;padding:14px 18px;margin-bottom:10px">
      <div style="width:104px;flex:0 0 104px"><span class="badge ${badgeClass}">${statusLabel}</span></div>
      <div style="flex:1;min-width:0;text-align:left"><div style="font-weight:600">${title}</div>
      <div style="color:var(--muted);font-size:12px">${escapeWalletText(detail)}</div></div>
      <div style="text-align:right"><div class="kanit" style="font-weight:800;color:${positive ? 'var(--success)' : 'var(--danger)'}">${sign}${amount} ฿</div>
      <div style="font-size:11px;color:var(--muted)">คงเหลือ ${Number(item.balanceAfter || 0).toLocaleString('th-TH')} ฿</div></div>
    </div>`;
  }).join('');
}

async function loadWalletTopupRequestsForTransactions() {
  const response = await fetch('/api/v1/wallet/topup/requests', { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return [];
  return body.data?.requests || [];
}

async function loadWalletWithdrawalRequestsForTransactions() {
  const response = await fetch('/api/v1/wallet/withdrawals', { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return [];
  return body.data?.requests || body.requests || [];
}

async function loadWallet() {
  const balanceEl = document.getElementById('walletBalance');
  const transactionList = document.getElementById('walletTransactionList');
  if (balanceEl) balanceEl.textContent = 'กำลังโหลด...';  if (transactionList) transactionList.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted)">กำลังโหลดธุรกรรม...</div>';
  try {
    const [walletResponse, requests, withdrawalRequests] = await Promise.all([
      fetch('/api/v1/wallet', { credentials: 'include' }),
      loadWalletTopupRequestsForTransactions(),
      loadWalletWithdrawalRequestsForTransactions(),
    ]);
    const body = await walletResponse.json().catch(() => ({}));
    if (!walletResponse.ok) throw new Error(body.error?.message || 'โหลด Wallet ไม่สำเร็จ');
    const wallet = body.data?.wallet || body.wallet;
    if (!wallet) throw new Error('ไม่พบข้อมูล Wallet');
    const formattedBalance = Number(wallet.balance || 0).toLocaleString('th-TH');
    if (balanceEl) balanceEl.textContent = formattedBalance;
    const navBalanceEl = document.getElementById('walletNavBalance');
    if (navBalanceEl) navBalanceEl.textContent = `💰 ${formattedBalance} pts`;
    renderWalletTransactions(Array.isArray(wallet.transactions) ? wallet.transactions : [], requests, withdrawalRequests);
    const pendingEl = document.getElementById('walletPendingWithdrawalAmount');
    const pendingCard = document.getElementById('walletPendingWithdrawalCard');
    const pendingAmount = Number(wallet.withdrawal?.pendingAmount || 0);
    if (pendingEl) pendingEl.textContent = pendingAmount.toLocaleString('th-TH');
    if (pendingCard) pendingCard.style.display = pendingAmount > 0 ? '' : 'none';
  } catch (error) {
    console.error('loadWallet failed:', error);
    if (balanceEl) balanceEl.textContent = '-';
    if (transactionList) transactionList.innerHTML = `<div class="notice danger">${error.message || 'โหลด Wallet ไม่สำเร็จ'}</div>`;
  }
}
window.loadWallet = loadWallet;

async function loadHistoryWalletTransactions() {
  const list = document.getElementById('histWalletTransactionList');
  if (!list) return;
  list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted)">กำลังโหลดประวัติฝาก/ถอน...</div>';
  try {
    const [walletResponse, requests, withdrawalRequests] = await Promise.all([
      fetch('/api/v1/wallet', { credentials: 'include' }),
      loadWalletTopupRequestsForTransactions(),
      loadWalletWithdrawalRequestsForTransactions(),
    ]);
    const body = await walletResponse.json().catch(() => ({}));
    if (!walletResponse.ok) throw new Error(body.error?.message || 'โหลดประวัติฝาก/ถอนไม่สำเร็จ');
    const wallet = body.data?.wallet || body.wallet;
    renderWalletTransactions(Array.isArray(wallet?.transactions) ? wallet.transactions : [], requests, withdrawalRequests, 'histWalletTransactionList');
  } catch (error) {
    console.error('loadHistoryWalletTransactions failed:', error);
    list.innerHTML = `<div class="notice danger">${error.message || 'โหลดประวัติฝาก/ถอนไม่สำเร็จ'}</div>`;
  }
}
window.loadHistoryWalletTransactions = loadHistoryWalletTransactions;

async function refreshWalletNavBalance() {
  const navBalanceEl = document.getElementById('walletNavBalance');
  if (!navBalanceEl) return;
  try {
    const response = await fetch('/api/v1/wallet', { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return;
    const wallet = body.data?.wallet || body.wallet;
    if (wallet) {
      const balance = Number(wallet.balance || 0).toLocaleString('th-TH');
      const held = Number(wallet.held?.heldAmount || 0);
      const next = wallet.held?.nextReleaseAt ? new Date(wallet.held.nextReleaseAt).getTime() : 0;
      const pendingWithdrawal = Number(wallet.withdrawal?.pendingAmount || 0);
      navBalanceEl.innerHTML = `<span>💰 ${balance} pts</span>${held > 0 ? ` <span id="walletHeldBalance" style="color:#8b94a7;margin-left:8px;cursor:help">⏳ ${held.toLocaleString('th-TH')} pts</span>` : ''}${pendingWithdrawal > 0 ? ` <span id="walletPendingWithdrawal" style="color:#8b94a7;margin-left:8px;cursor:help">🔒 ${pendingWithdrawal.toLocaleString('th-TH')} pts</span>` : ''}`;
      if (held > 0 && next) startHeldCountdown(next);
      attachPendingWithdrawalTooltip(pendingWithdrawal);
    }
  } catch (error) {
    console.error('refreshWalletNavBalance failed:', error);
  }
}

function attachPendingWithdrawalTooltip(amount) {
  const el = document.getElementById('walletPendingWithdrawal');
  if (!el || !amount) return;
  el.title = `กำลังถอน ${Number(amount).toLocaleString('th-TH')} pts • รอ Admin ตรวจสอบ`;
}

window.refreshWalletNavBalance = refreshWalletNavBalance;

function startHeldCountdown(releaseAt) {
  const el = document.getElementById('walletHeldBalance');
  if (!el) return;
  if (window.__heldCountdownTimer) clearInterval(window.__heldCountdownTimer);
  const tooltipId = 'walletHeldTooltip';
  let tooltip = document.getElementById(tooltipId);
  if (!tooltip) {
    tooltip = document.createElement('span');
    tooltip.id = tooltipId;
    tooltip.style.cssText = 'position:fixed;display:none;z-index:99999;padding:8px 10px;border-radius:8px;background:#111827;color:#fff;border:1px solid #374151;font-size:12px;line-height:1.35;white-space:nowrap;box-shadow:0 8px 20px rgba(0,0,0,.25);pointer-events:none;';
    document.body.appendChild(tooltip);
  }
  const updateTooltip = () => {
    const rect = el.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, rect.left + rect.width / 2 - 70)}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
  };
  const tick = () => {
    const left = Math.max(0, releaseAt - Date.now());
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const sec = Math.floor((left % 60000) / 1000);
    const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    el.title = left > 0 ? `เงินพักไว้ • เหลือ ${time}` : 'กำลังโอนเข้าบัญชี';
    if (tooltip.style.display === 'block') {
      tooltip.textContent = left > 0 ? `เงินพักไว้ • เหลือ ${time}` : 'กำลังโอนเข้าบัญชี';
      updateTooltip();
    }
    if (!left) refreshWalletNavBalance();
  };
  el.onmouseenter = () => { tooltip.textContent = `เงินพักไว้ • เหลือ ${Math.max(0, releaseAt - Date.now()) > 0 ? 'กำลังคำนวณ...' : 'กำลังโอนเข้าบัญชี'}`; tooltip.style.display = 'block'; updateTooltip(); tick(); };
  el.onmouseleave = () => { tooltip.style.display = 'none'; };
  tick();
  window.__heldCountdownTimer = setInterval(tick, 1000);
}

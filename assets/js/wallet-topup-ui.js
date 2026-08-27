let selectedWalletPaymentMethod = 'CARD';

function walletPaymentMethodLabel(method) {
  return { CARD: 'บัตรเครดิต/เดบิต', BANK: 'โอนผ่านธนาคาร', PROMPTPAY: 'พร้อมเพย์', TRUEMONEY: 'TrueMoney' }[method] || method;
}

function selectWalletPaymentMethod(method, element) {
  selectedWalletPaymentMethod = method;
  document.querySelectorAll('[data-wallet-payment-method]').forEach((item) => item.style.borderColor = 'var(--border)');
  if (element) element.style.borderColor = 'var(--accent)';
}

function setWalletTopupAmount(amount) {
  const input = document.getElementById('walletTopupAmount');
  if (input) input.value = amount;
}

function topupStatusLabel(status) {
  if (status === 'APPROVED') return 'อนุมัติแล้ว';
  if (status === 'REJECTED') return 'ไม่อนุมัติ';
  return 'รอตรวจสอบ';
}

function topupStatusClass(status) {
  if (status === 'APPROVED') return 'badge-green';
  if (status === 'REJECTED') return 'badge-red';
  return 'badge-yellow';
}
async function createWalletTopupRequest() {
  const input = document.getElementById('walletTopupAmount');
  const message = document.getElementById('walletTopupMessage');
  const amount = Number(input?.value || 0);
  if (!Number.isFinite(amount) || amount < 10) {
    if (message) message.innerHTML = '<div class="notice danger">กรุณากรอกจำนวนอย่างน้อย 10 พ้อยท์</div>';
    return;
  }
  const activeCsrfToken = window.csrfToken || (typeof getCookieValue === 'function' ? getCookieValue('gm_csrf') : null);
  if (!activeCsrfToken) {
    if (message) message.innerHTML = '<div class="notice danger">ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่</div>';
    return;
  }
  try {
    const response = await fetch('/api/v1/wallet/topup/requests', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': activeCsrfToken },
      body: JSON.stringify({ paymentMethod: selectedWalletPaymentMethod, amount }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'สร้างคำขอเติมพ้อยท์ไม่สำเร็จ');
    if (message) message.innerHTML = '<div class="notice success">ส่งคำขอเรียบร้อยแล้ว • สถานะ: รอตรวจสอบ</div>';
    if (input) input.value = '';
    if (typeof loadWallet === 'function') await loadWallet();
  } catch (error) {
    if (message) message.innerHTML = `<div class="notice danger">${error.message || 'สร้างคำขอเติมพ้อยท์ไม่สำเร็จ'}</div>`;
  }
}
window.selectWalletPaymentMethod = selectWalletPaymentMethod;
window.setWalletTopupAmount = setWalletTopupAmount;
window.createWalletTopupRequest = createWalletTopupRequest;
window.topupStatusLabel = topupStatusLabel;
window.topupStatusClass = topupStatusClass;

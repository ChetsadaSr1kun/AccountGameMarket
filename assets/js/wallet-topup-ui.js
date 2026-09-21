let selectedWalletPaymentMethod = 'PROMPTPAY';
let currentWalletTopupRequestId = null;
const newWalletTopupPaymentMethods = new Set(['BANK', 'PROMPTPAY']);

function walletPaymentMethodLabel(method) {
  return { BANK: 'โอนผ่านธนาคาร', PROMPTPAY: 'พร้อมเพย์', TRUEMONEY: 'TrueMoney Wallet' }[method] || method;
}

function selectWalletPaymentMethod(method, element) {
  if (!newWalletTopupPaymentMethods.has(method)) return;
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
  if (typeof isLoggedIn === 'undefined' || !isLoggedIn) { goPage('login'); return; }
  if (!currentUser?.accountVerified) {
    alert('กรุณายืนยัน Email และเบอร์โทรศัพท์ให้ครบก่อนเติมพ้อยท์');
    goPage('profile');
    return;
  }
  const input = document.getElementById('walletTopupAmount');
  const message = document.getElementById('walletTopupMessage');
  const amount = Number(input?.value || 0);
  if (!newWalletTopupPaymentMethods.has(selectedWalletPaymentMethod)) {
    if (message) message.innerHTML = '<div class="notice danger">ช่องทางเติมพ้อยท์ไม่ถูกต้อง</div>';
    return;
  }
  if (!Number.isFinite(amount) || amount < 10) {
    if (message) message.innerHTML = '<div class="notice danger">กรุณากรอกจำนวนอย่างน้อย 10 พ้อยท์</div>';
    return;
  }
  const csrf = window.csrfToken || (typeof getCookieValue === 'function' ? getCookieValue('gm_csrf') : null);
  if (!csrf) {
    if (message) message.innerHTML = '<div class="notice danger">ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่</div>';
    return;
  }
  try {
    const response = await fetch('/api/v1/wallet/topup/requests', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ paymentMethod: selectedWalletPaymentMethod, amount }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'สร้างคำขอเติมพ้อยท์ไม่สำเร็จ');
    const request = body.data?.request || body.request;
    if (!request) throw new Error('ไม่พบข้อมูลคำขอเติมพ้อยท์');
    currentWalletTopupRequestId = Number(request.id);
    if (input) input.value = '';
    showWalletTopupSlip(request);
    if (message) message.innerHTML = '';
  } catch (error) {
    if (message) message.innerHTML = '<div class="notice danger">' + (error.message || 'สร้างคำขอเติมพ้อยท์ไม่สำเร็จ') + '</div>';
  }
}

function showWalletTopupSlip(request) {
  const existing = document.getElementById('walletTopupSlipModal');
  if (existing) existing.remove();
  const receiver = request.receiver || {};
  const paymentMethod = String(request.paymentMethod || '').toUpperCase();
  let receiverLines = [];
  if (paymentMethod === 'BANK') {
    receiverLines = [
      receiver.name && ('ชื่อผู้รับ: ' + receiver.name),
      receiver.bank && ('ธนาคาร: ' + receiver.bank),
      receiver.account && ('เลขบัญชี: ' + receiver.account),
    ];
  } else if (paymentMethod === 'PROMPTPAY') {
    receiverLines = [
      receiver.name && ('ชื่อผู้รับ: ' + receiver.name),
      receiver.promptPay && ('หมายเลขบัญชี: ' + receiver.promptPay),
    ];
  } else if (paymentMethod === 'TRUEMONEY') {
    receiverLines = [
      receiver.name && ('ชื่อผู้รับ: ' + receiver.name),
      receiver.trueMoney && ('หมายเลขบัญชี: ' + receiver.trueMoney),
    ];
  }
  receiverLines = receiverLines.filter(Boolean);
  const modal = document.createElement('div');
  modal.id = 'walletTopupSlipModal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = '<div class="modal-dialog" role="dialog" aria-modal="true" style="max-width:460px">' +
    '<h3 style="margin-bottom:8px">💸 เติมพ้อยท์ผ่าน SlipOK</h3>' +
    '<div class="notice info" style="margin-bottom:16px">จำนวนเงิน <strong>' + Number(request.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท</strong></div>' +
    '<div class="notice" style="margin-bottom:16px">' + (receiverLines.length ? receiverLines.join('<br>') : 'โอนเงินเข้าบัญชี/พร้อมเพย์ของ GameMarket ตามข้อมูลที่ผู้ดูแลระบบกำหนด') + '</div>' +
    '<div class="inp-group"><label class="inp-label">สลิปการโอนเงิน</label><input id="walletTopupSlipInput" class="inp" type="file" accept="image/jpeg,image/png,image/webp,image/jfif" /></div>' +
    '<div id="walletTopupSlipPreview" style="display:none;margin:12px 0 16px;padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.02)">' +
      '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">สลิปที่แนบ</div>' +
      '<img id="walletTopupSlipPreviewImage" alt="สลิปที่แนบ" style="display:block;width:100%;max-height:260px;object-fit:contain;border-radius:8px;background:#0b0f18" />' +
    '</div>' +
    '<div id="walletTopupSlipMessage" style="margin-bottom:12px;min-height:18px"></div>' +
    '<div class="flex gap-8"><button class="btn btn-secondary btn-md" type="button" onclick="closeWalletTopupSlip()">ยกเลิก</button><button class="btn btn-primary btn-md" type="button" onclick="uploadWalletTopupSlip()">🔎 ตรวจสอบสลิป</button></div>' +
    '</div>';
  modal.addEventListener('click', (event) => { if (event.target === modal) closeWalletTopupSlip(); });
  document.body.appendChild(modal);

  const slipInput = document.getElementById('walletTopupSlipInput');
  const preview = document.getElementById('walletTopupSlipPreview');
  const previewImage = document.getElementById('walletTopupSlipPreviewImage');
  slipInput?.addEventListener('change', () => {
    const file = slipInput.files?.[0];
    if (!file || !preview || !previewImage) {
      if (preview) preview.style.display = 'none';
      if (previewImage) previewImage.removeAttribute('src');
      return;
    }
    if (!String(file.type || '').toLowerCase().startsWith('image/')) {
      preview.style.display = 'none';
      previewImage.removeAttribute('src');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      previewImage.src = String(reader.result || '');
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });
}

async function uploadWalletTopupSlip() {
  const input = document.getElementById('walletTopupSlipInput');
  const message = document.getElementById('walletTopupSlipMessage');
  if (!currentWalletTopupRequestId) { if (message) message.innerHTML = '<div class="notice danger">ไม่พบคำขอเติมพ้อยท์</div>'; return; }
  if (!input?.files?.[0]) { if (message) message.innerHTML = '<div class="notice danger">กรุณาเลือกไฟล์สลิปก่อน</div>'; return; }
  const csrf = window.csrfToken || (typeof getCookieValue === 'function' ? getCookieValue('gm_csrf') : null);
  if (!csrf) { if (message) message.innerHTML = '<div class="notice danger">ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่</div>'; return; }
  const form = new FormData();
  form.append('slip', input.files[0]);
  try {
    const response = await fetch('/api/v1/wallet/topup/requests/' + currentWalletTopupRequestId + '/slip', {
      method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': csrf }, body: form,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'ตรวจสอบสลิปไม่สำเร็จ');
    if (message) message.innerHTML = '<div class="notice success">ตรวจสอบสลิปสำเร็จ พ้อยท์ถูกเติมเข้ากระเป๋าแล้ว</div>';
    setTimeout(closeWalletTopupSlip, 900);
  } catch (error) {
    if (message) message.innerHTML = '<div class="notice danger">' + (error.message || 'ตรวจสอบสลิปไม่สำเร็จ') + '</div>';
  }
}

function closeWalletTopupSlip() {
  const modal = document.getElementById('walletTopupSlipModal');
  if (modal) modal.remove();
  currentWalletTopupRequestId = null;
}

window.selectWalletPaymentMethod = selectWalletPaymentMethod;
window.setWalletTopupAmount = setWalletTopupAmount;
window.createWalletTopupRequest = createWalletTopupRequest;
window.topupStatusLabel = topupStatusLabel;
window.topupStatusClass = topupStatusClass;
window.showWalletTopupSlip = showWalletTopupSlip;
window.uploadWalletTopupSlip = uploadWalletTopupSlip;
window.closeWalletTopupSlip = closeWalletTopupSlip;

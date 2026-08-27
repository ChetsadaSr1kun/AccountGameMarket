function withdrawalMessage(message, type = 'danger') {
  const el = document.getElementById('withdrawMessage');
  if (!el) return;
  el.innerHTML = `<div class="notice ${type}">${message}</div>`;
}

function setWithdrawalAmount(value) {
  const input = document.getElementById('withdrawAmount');
  if (!input) return;
  if (value === 'max') {
    const balance = Number(document.getElementById('walletBalance')?.textContent.replace(/[^0-9.-]/g, '') || 0);
    input.value = Number.isFinite(balance) ? balance : '';
    return;
  }
  input.value = value;
}

async function createWithdrawalRequest() {
  const amount = Number(document.getElementById('withdrawAmount')?.value);
  const paymentMethod = document.getElementById('withdrawPaymentMethod')?.value;
  const accountName = document.getElementById('withdrawAccountName')?.value.trim();
  const accountNumber = document.getElementById('withdrawAccountNumber')?.value.trim();

  if (!Number.isFinite(amount) || amount < 100) return withdrawalMessage('จำนวนถอนขั้นต่ำคือ 100 พ้อยท์');
  if (!paymentMethod || !accountName || !accountNumber) return withdrawalMessage('กรุณากรอกข้อมูลรับเงินให้ครบถ้วน');

  const button = document.querySelector('#wallet-withdraw button.btn-primary');
  if (button) { button.disabled = true; button.textContent = 'กำลังส่งคำขอ...'; }
  try {
    const response = await fetch('/api/v1/wallet/withdrawals', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, paymentMethod, accountName, accountNumber }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'ส่งคำขอถอนพ้อยท์ไม่สำเร็จ');
    withdrawalMessage('ส่งคำขอถอนพ้อยท์เรียบร้อยแล้ว รอ Admin ตรวจสอบ', 'success');
    document.getElementById('withdrawAmount').value = '';
    if (typeof loadWallet === 'function') await loadWallet();
    if (typeof refreshWalletNavBalance === 'function') await refreshWalletNavBalance();
  } catch (error) {
    console.error('createWithdrawalRequest failed:', error);
    withdrawalMessage(error.message || 'ส่งคำขอถอนพ้อยท์ไม่สำเร็จ');
  } finally {
    if (button) { button.disabled = false; button.textContent = '📤 ส่งคำขอถอนพ้อยท์'; }
  }
}

window.setWithdrawalAmount = setWithdrawalAmount;
window.createWithdrawalRequest = createWithdrawalRequest;
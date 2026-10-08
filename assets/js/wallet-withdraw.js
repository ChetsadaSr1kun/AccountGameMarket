function getWithdrawalCsrfToken() {
  return typeof csrfToken !== 'undefined'
    ? (csrfToken || getCookieValue('gm_csrf'))
    : getCookieValue('gm_csrf');
}

async function withdrawalApiFetch(url, options = {}) {
  const token = getWithdrawalCsrfToken();

  if (!token) {
    throw new Error(
      'ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่'
    );
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    'X-CSRF-Token': token,
  };

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      body.error?.message || 'ไม่สามารถดำเนินการรายการถอนเงินได้'
    );

    error.code = body.error?.code;
    error.retryAfterSeconds =
      body.error?.retryAfterSeconds;

    throw error;
  }

  return body;
}

let withdrawalOtpState = {
  emailVerified: false,
  phoneVerified: false,
};

function updateWithdrawalStep(activeStep) {
  const page = document.getElementById('pg-withdraw-otp');
  if (!page) return;

  const circles = [
    ...page.querySelectorAll('.steps .step-circle')
  ];

  const lines = [
    ...page.querySelectorAll('.steps .step-line')
  ];

  circles.forEach((circle, index) => {
    const step = index + 1;

    if (step < activeStep) {
      circle.style.background = 'var(--success)';
      circle.style.color = '#fff';
      circle.textContent = String(step);
      return;
    }

    if (step === activeStep) {
      circle.style.background = 'var(--accent)';
      circle.style.color = '#fff';
      circle.textContent = String(step);
      return;
    }

    circle.style.background = 'var(--border)';
    circle.style.color = 'var(--muted)';
    circle.textContent = String(step);
  });

  lines.forEach((line, index) => {
    line.style.background =
      index < activeStep - 1
        ? 'var(--success)'
        : 'var(--border)';
  });
}

function withdrawalMessage(message, type = 'danger') {
  const el = document.getElementById('withdrawMessage');
  if (!el) return;
  el.innerHTML = `<div class="notice ${type}">${message}</div>`;
}

function withdrawalEmailOtpMessage(message, type = 'danger') {
  const el = document.getElementById('withdrawEmailOtpMessage');
  if (!el) return;

  el.innerHTML = `<div class="notice ${type}">${message}</div>`;
}
function startWithdrawalOtpCooldown(buttonId, seconds = 60) {
  const button = document.getElementById(buttonId);
  if (!button) return;

  if (button.dataset.cooldownTimer) {
    clearInterval(Number(button.dataset.cooldownTimer));
  }

  button.disabled = true;

  let remaining = seconds;

  button.textContent = `ส่งใหม่ได้ใน ${remaining} วินาที`;

  const timer = setInterval(() => {
    remaining -= 1;

    if (remaining <= 0) {
      clearInterval(timer);
      delete button.dataset.cooldownTimer;
      button.disabled = false;
      button.textContent = 'ส่งรหัส OTP';
      return;
    }

    button.textContent = `ส่งใหม่ได้ใน ${remaining} วินาที`;
  }, 1000);

  button.dataset.cooldownTimer = String(timer);
}

async function sendWithdrawalEmailOtp() {
  const button = document.getElementById(
    'withdrawEmailOtpSendButton'
  );

  const pendingWithdrawal =
    window.pendingWithdrawal;

  if (!pendingWithdrawal?.attemptId) {
    withdrawalEmailOtpMessage(
      'ไม่พบรายการถอน กรุณาเริ่มรายการใหม่'
    );
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'กำลังส่ง...';
  }

  try {
    const body = await withdrawalApiFetch(
      `/api/v1/wallet/withdrawal-attempts/${pendingWithdrawal.attemptId}/email/send`,
      {
        method: 'POST',
      }
    );

    withdrawalEmailOtpMessage(
      body.data?.message ||
        body.message ||
        'ส่งรหัส OTP ไปยังอีเมลเรียบร้อยแล้ว',
      'success'
    );

    startWithdrawalOtpCooldown(
      'withdrawEmailOtpSendButton'
    );

  } catch (error) {
    console.error(
      'sendWithdrawalEmailOtp failed:',
      error
    );

    withdrawalEmailOtpMessage(
      error.message ||
        'ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่อีกครั้ง'
    );
  } finally {
    if (button && !button.dataset.cooldownTimer) {
      button.disabled = false;
      button.textContent = 'ส่งรหัส OTP';
    }
  }
}

async function verifyWithdrawalEmailOtp() {
  const wrap = document.getElementById(
    'withdrawEmailOtpWrap'
  );

  if (!wrap) {
    withdrawalEmailOtpMessage(
      'ไม่พบช่องกรอก Email OTP'
    );
    return;
  }

  const pendingWithdrawal =
    window.pendingWithdrawal;

  if (!pendingWithdrawal?.attemptId) {
    withdrawalEmailOtpMessage(
      'ไม่พบรายการถอน กรุณาเริ่มรายการใหม่'
    );
    return;
  }

  const boxes = [
    ...wrap.querySelectorAll('.otp-box')
  ];

  const otp = boxes
    .map((box) => box.value.trim())
    .join('');

  if (!/^\d{6}$/.test(otp)) {
    withdrawalEmailOtpMessage(
      'กรุณากรอกรหัส OTP จำนวน 6 หลัก'
    );
    return;
  }

  const button = document.getElementById(
    'withdrawEmailOtpVerifyButton'
  );

  if (button) {
    button.disabled = true;
    button.textContent = 'กำลังตรวจสอบ...';
  }

  try {
    const body = await withdrawalApiFetch(
      `/api/v1/wallet/withdrawal-attempts/${pendingWithdrawal.attemptId}/email/verify`,
      {
        method: 'POST',
        body: JSON.stringify({
          otp,
        }),
      }
    );

    const attempt =
      body.data?.attempt || body.attempt;

    if (!attempt) {
      throw new Error(
        'ไม่พบข้อมูลรายการถอนหลังยืนยัน Email OTP'
      );
    }

    withdrawalOtpState.emailVerified = true;

    withdrawalEmailOtpMessage(
      'ยืนยัน Email OTP สำเร็จ',
      'success'
    );

    const emailSection =
      document.getElementById(
        'withdrawEmailOtpSection'
      );

    const phoneSection =
      document.getElementById(
        'withdrawPhoneOtpSection'
      );

    if (emailSection) {
      emailSection.style.display = 'none';
    }

    if (phoneSection) {
      phoneSection.style.display = '';
    }

    updateWithdrawalStep(2);
  } catch (error) {
    console.error(
      'verifyWithdrawalEmailOtp failed:',
      error
    );

    withdrawalEmailOtpMessage(
      error.message ||
        'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'ยืนยัน OTP';
    }
  }
}

function withdrawalPhoneOtpMessage(message, type = 'danger') {
  const el = document.getElementById('withdrawPhoneOtpMessage');
  if (!el) return;

  el.innerHTML = `<div class="notice ${type}">${message}</div>`;
}

async function sendWithdrawalPhoneOtp() {
  const button = document.getElementById(
    'withdrawPhoneOtpSendButton'
  );

  const pendingWithdrawal =
    window.pendingWithdrawal;

  if (!pendingWithdrawal?.attemptId) {
    withdrawalPhoneOtpMessage(
      'ไม่พบรายการถอน กรุณาเริ่มรายการใหม่'
    );
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'กำลังส่ง...';
  }
  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    12000
  );

  try {
    const body = await withdrawalApiFetch(
      `/api/v1/wallet/withdrawal-attempts/${pendingWithdrawal.attemptId}/phone/send`,
      {
        method: 'POST',
        signal: controller.signal,
      }
    );

    withdrawalPhoneOtpMessage(
      body.data?.message ||
        body.message ||
        'ส่งรหัส OTP ไปยังเบอร์โทรศัพท์เรียบร้อยแล้ว',
      'success'
    );

    startWithdrawalOtpCooldown(
      'withdrawPhoneOtpSendButton'
    );

  } catch (error) {
    console.error(
      'sendWithdrawalPhoneOtp failed:',
      error
    );

    if (error.name === 'AbortError') {
      withdrawalPhoneOtpMessage(
        'ระบบส่ง OTP ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง'
      );
    } else {
      withdrawalPhoneOtpMessage(
        error.message ||
          'ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่อีกครั้ง'
      );
    }
  } finally {
    clearTimeout(timeoutId);

    if (button && !button.dataset.cooldownTimer) {
      button.disabled = false;
      button.textContent = 'ส่งรหัส OTP';
    }
  }
}

async function verifyWithdrawalPhoneOtp() {
  const wrap = document.getElementById(
    'withdrawPhoneOtpWrap'
  );

  if (!wrap) {
    withdrawalPhoneOtpMessage(
      'ไม่พบช่องกรอก Phone OTP'
    );
    return;
  }

  const pendingWithdrawal =
    window.pendingWithdrawal;

  if (!pendingWithdrawal?.attemptId) {
    withdrawalPhoneOtpMessage(
      'ไม่พบรายการถอน กรุณาเริ่มรายการใหม่'
    );
    return;
  }

  const boxes = [
    ...wrap.querySelectorAll('.otp-box')
  ];

  const otp = boxes
    .map((box) => box.value.trim())
    .join('');

  if (!/^\d{6}$/.test(otp)) {
    withdrawalPhoneOtpMessage(
      'กรุณากรอกรหัส OTP จำนวน 6 หลัก'
    );
    return;
  }

  const button = document.getElementById(
    'withdrawPhoneOtpVerifyButton'
  );

  if (button) {
    button.disabled = true;
    button.textContent = 'กำลังตรวจสอบ...';
  }

  try {
    const body = await withdrawalApiFetch(
      `/api/v1/wallet/withdrawal-attempts/${pendingWithdrawal.attemptId}/phone/verify`,
      {
        method: 'POST',
        body: JSON.stringify({
          otp,
        }),
      }
    );

    const attempt =
      body.data?.attempt || body.attempt;

    if (!attempt) {
      throw new Error(
        'ไม่พบข้อมูลรายการถอนหลังยืนยัน Phone OTP'
      );
    }

    withdrawalOtpState.phoneVerified = true;

    const amountEl = document.getElementById(
      'withdrawSummaryAmount'
    );

    const methodEl = document.getElementById(
      'withdrawSummaryMethod'
    );

    const bankRow = document.getElementById(
      'withdrawSummaryBankRow'
    );

    const bankEl = document.getElementById(
      'withdrawSummaryBank'
    );

    const accountEl = document.getElementById(
      'withdrawSummaryAccount'
    );

    if (amountEl) {
      amountEl.textContent =
        pendingWithdrawal.amount.toLocaleString(
          'th-TH'
        );
    }

    if (methodEl) {
      if (pendingWithdrawal.paymentMethod === 'TRUEMONEY') {
        methodEl.innerHTML = pendingWithdrawal.paymentMethodLabel;
      } else {
        methodEl.textContent = pendingWithdrawal.paymentMethodLabel;
      }
    }

    const bankLabels = {
      KBANK: 'กสิกรไทย',
      KTB: 'กรุงไทย',
      GSB: 'ออมสิน',
      BBL: 'กรุงเทพ',
      SCB: 'ไทยพาณิชย์',
      BAY: 'กรุงศรีอยุธยา',
      TTB: 'ทีเอ็มบีธนชาต',
    };

    if (
      pendingWithdrawal.paymentMethod === 'BANK' &&
      pendingWithdrawal.bankCode
    ) {
      if (bankRow) {
        bankRow.style.display = '';
      }

      if (bankEl) {
        bankEl.textContent =
          bankLabels[pendingWithdrawal.bankCode] ||
          pendingWithdrawal.bankCode;
      }
    } else {
      if (bankRow) {
        bankRow.style.display = 'none';
      }
    }

    if (accountEl) {
      accountEl.textContent =
        pendingWithdrawal.accountNumber;
    }

    const phoneSection =
      document.getElementById(
        'withdrawPhoneOtpSection'
      );

    const summarySection =
      document.getElementById(
        'withdrawSummarySection'
      );

    if (phoneSection) {
      phoneSection.style.display = 'none';
    }

    if (summarySection) {
      summarySection.style.display = '';
    }
    updateWithdrawalStep(3);

    withdrawalPhoneOtpMessage(
      'ยืนยัน Phone OTP สำเร็จ',
      'success'
    );
  } catch (error) {
    console.error(
      'verifyWithdrawalPhoneOtp failed:',
      error
    );

    withdrawalPhoneOtpMessage(
      error.message ||
        'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'ยืนยัน OTP';
    }
  }
}

async function completeWithdrawalAttempt() {
  const pendingWithdrawal =
    window.pendingWithdrawal;

  if (!pendingWithdrawal?.attemptId) {
    withdrawalPhoneOtpMessage(
      'ไม่พบรายการถอน กรุณาเริ่มรายการใหม่'
    );
    return;
  }

  if (
    !withdrawalOtpState.emailVerified ||
    !withdrawalOtpState.phoneVerified
  ) {
    withdrawalPhoneOtpMessage(
      'กรุณายืนยัน Email OTP และ Phone OTP ให้ครบก่อน'
    );
    return;
  }

  const button = document.getElementById(
    'withdrawFinalConfirmButton'
  );

  if (button) {
    button.disabled = true;
    button.textContent = 'กำลังดำเนินการ...';
  }

  try {
    const body = await withdrawalApiFetch(
      `/api/v1/wallet/withdrawal-attempts/${pendingWithdrawal.attemptId}/complete`,
      {
        method: 'POST',
      }
    );

    const attempt =
      body.data?.attempt || body.attempt;

    if (!attempt) {
      throw new Error(
        'ไม่พบข้อมูลรายการถอนหลังยืนยันรายการ'
      );
    }

    withdrawalPhoneOtpMessage(
      'ส่งคำขอถอนพ้อยท์เรียบร้อยแล้ว รอ Admin ตรวจสอบ',
      'success'
    );

    window.pendingWithdrawal = null;

    withdrawalOtpState.emailVerified = false;
    withdrawalOtpState.phoneVerified = false;

    document.getElementById('withdrawAmount').value = '';

    if (typeof loadWallet === 'function') {
      await loadWallet();
    }

    if (typeof refreshWalletNavBalance === 'function') {
      await refreshWalletNavBalance();
    }

    goPage('wallet');
  } catch (error) {
    console.error(
      'completeWithdrawalAttempt failed:',
      error
    );

    withdrawalPhoneOtpMessage(
      error.message ||
        'ไม่สามารถยืนยันการถอนพ้อยท์ได้ กรุณาลองใหม่อีกครั้ง'
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '✅ ยืนยันการถอน';
    }
  }
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
  return startWithdrawalOtpFlow();
}

window.setWithdrawalAmount = setWithdrawalAmount;

const withdrawalPaymentMethodOptions = {
  BANK: { label: 'บัญชีธนาคาร', icon: '🏦' },
  PROMPTPAY: { label: 'พร้อมเพย์', icon: 'assets/images/promptpay-circle.png' },
};

function getWithdrawalPaymentMethodDropdown() {
  return {
    select: document.getElementById('withdrawPaymentMethod'),
    wrapper: document.getElementById('withdrawPaymentMethodDropdown'),
    control: document.getElementById('withdrawPaymentMethodControl'),
    menu: document.getElementById('withdrawPaymentMethodOptions'),
    selectedIcon: document.getElementById('withdrawPaymentMethodSelectedIcon'),
    selectedLabel: document.getElementById('withdrawPaymentMethodSelectedLabel'),
    options: Array.from(document.querySelectorAll('[data-withdraw-method]')),
  };
}

function closeWithdrawalPaymentMethodDropdown({ focusControl = false } = {}) {
  const { control, menu } = getWithdrawalPaymentMethodDropdown();
  if (!control || !menu) return;
  control.setAttribute('aria-expanded', 'false');
  menu.style.display = 'none';
  if (focusControl) control.focus();
}

function renderWithdrawalPaymentMethod(method) {
  const config = withdrawalPaymentMethodOptions[method];
  const { control, selectedIcon, selectedLabel, options } = getWithdrawalPaymentMethodDropdown();
  if (!config || !control || !selectedIcon || !selectedLabel) return;

  selectedIcon.replaceChildren();
  if (method === 'BANK') {
    selectedIcon.textContent = config.icon;
  } else {
    const image = document.createElement('img');
    image.src = config.icon;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.style.cssText = 'width:28px;height:28px;object-fit:contain';
    selectedIcon.appendChild(image);
  }
  selectedLabel.textContent = config.label;
  control.setAttribute('aria-activedescendant', `withdrawPaymentMethodOption${method === 'BANK' ? 'Bank' : 'PromptPay'}`);
  options.forEach((option) => option.setAttribute('aria-selected', String(option.dataset.withdrawMethod === method)));
}

function updateWithdrawalBankVisibility(method) {
  const bankGroup =
    document.getElementById(
      'withdrawBankGroup'
    );

  const bankSelect =
    document.getElementById(
      'withdrawBankCode'
    );

  if (!bankGroup) return;

  if (method === 'BANK') {
    bankGroup.style.display = '';
  } else {
    bankGroup.style.display = 'none';

    if (bankSelect) {
      bankSelect.value = '';
    }
  }
}

function setWithdrawalPaymentMethod(method) {
  if (!withdrawalPaymentMethodOptions[method]) {
    return;
  }

  const { select } =
    getWithdrawalPaymentMethodDropdown();

  if (select) {
    select.value = method;
  }

  renderWithdrawalPaymentMethod(method);

  updateWithdrawalBankVisibility(
    method
  );

  closeWithdrawalPaymentMethodDropdown();
}

function openWithdrawalPaymentMethodDropdown({ focusOption = false } = {}) {
  const { control, menu, options, select } = getWithdrawalPaymentMethodDropdown();
  if (!control || !menu) return;
  control.setAttribute('aria-expanded', 'true');
  menu.style.display = 'block';
  if (focusOption) {
    (options.find((option) => option.dataset.withdrawMethod === select?.value) || options[0])?.focus();
  }
}

function initializeWithdrawalPaymentMethodDropdown() {
  const { control, menu, options, wrapper, select } = getWithdrawalPaymentMethodDropdown();
  if (!control || !menu || !wrapper || !select) return;
  renderWithdrawalPaymentMethod(select.value);
  updateWithdrawalBankVisibility(
    select.value
  );

  control.addEventListener('click', () => {
    control.getAttribute('aria-expanded') === 'true'
      ? closeWithdrawalPaymentMethodDropdown()
      : openWithdrawalPaymentMethodDropdown();
  });
  control.addEventListener('focus', () => { control.style.outline = '2px solid var(--accent)'; control.style.outlineOffset = '2px'; });
  control.addEventListener('blur', () => { control.style.outline = ''; control.style.outlineOffset = ''; });
  control.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') return closeWithdrawalPaymentMethodDropdown();
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); return openWithdrawalPaymentMethodDropdown({ focusOption: true }); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); return openWithdrawalPaymentMethodDropdown({ focusOption: true }); }
  });
  options.forEach((option, index) => {
    option.addEventListener('click', () => setWithdrawalPaymentMethod(option.dataset.withdrawMethod));
    option.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') return closeWithdrawalPaymentMethodDropdown({ focusControl: true });
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        options[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length].focus();
      }
    });
  });
  document.addEventListener('click', (event) => { if (!wrapper.contains(event.target)) closeWithdrawalPaymentMethodDropdown(); });
}

initializeWithdrawalPaymentMethodDropdown();

async function startWithdrawalOtpFlow() {
  if (typeof isLoggedIn === 'undefined' || !isLoggedIn) {
    goPage('login');
    return;
  }

  if (!currentUser?.accountVerified) {
    alert(
      'กรุณายืนยัน Email และเบอร์โทรศัพท์ให้ครบก่อนถอนพ้อยท์'
    );
    goPage('profile');
    return;
  }

  const amount = Number(
    document.getElementById('withdrawAmount')?.value
  );
  const paymentMethod =
    document.getElementById('withdrawPaymentMethod')?.value;
  const accountName =
    document.getElementById('withdrawAccountName')?.value.trim();
  const accountNumber =
    document.getElementById('withdrawAccountNumber')?.value.trim();
  const bankCode =
  document.getElementById(
    'withdrawBankCode'
  )?.value || '';

  if (!['BANK', 'PROMPTPAY'].includes(paymentMethod)) {
    return withdrawalMessage(
      'ช่องทางถอนพ้อยท์ไม่ถูกต้อง'
    );
  }

  if (!Number.isFinite(amount) || amount < 100) {
    return withdrawalMessage(
      'จำนวนถอนขั้นต่ำคือ 100 พ้อยท์'
    );
  }

  if (amount > 100000) {
    return withdrawalMessage(
      'จำนวนถอนสูงสุดคือ 100,000 พ้อยท์'
    );
  }

  if (
  paymentMethod === 'BANK' &&
  !bankCode
) {
  return withdrawalMessage(
    'กรุณาเลือกธนาคาร'
  );
}

  if (!paymentMethod || !accountName || !accountNumber) {
    return withdrawalMessage(
      'กรุณากรอกข้อมูลรับเงินให้ครบถ้วน'
    );
  }

  const balance = Number(
    document
      .getElementById('walletBalance')
      ?.textContent.replace(/[^0-9.-]/g, '') || 0
  );

  if (!Number.isFinite(balance) || amount > balance) {
    return withdrawalMessage(
      'ยอดพ้อยท์ไม่เพียงพอสำหรับการถอน'
    );
  }

  const paymentMethodLabels = {
    BANK: '🏦 บัญชีธนาคาร',
    PROMPTPAY: '📱 พร้อมเพย์',
    TRUEMONEY: '<img class="ui-emoji" src="assets/icons/wallet.svg" alt=""> TrueMoney',
  };

  try {
    const body = await withdrawalApiFetch(
      '/api/v1/wallet/withdrawal-attempts',
      {
        method: 'POST',
        body: JSON.stringify({
          amount,
          paymentMethod,
          accountName,
          accountNumber,
          bankCode:
            paymentMethod === 'BANK'
              ? bankCode
              : null,
        }),
      }
    );

    const attempt =
      body.data?.attempt || body.attempt;

    if (!attempt?.id) {
      throw new Error(
        'ไม่สามารถสร้างรายการถอนสำหรับการยืนยัน OTP ได้'
      );
    }

    window.pendingWithdrawal = {
      attemptId: Number(attempt.id),
      amount,
      paymentMethod,
      paymentMethodLabel:
        paymentMethodLabels[paymentMethod] ||
        paymentMethod,
      bankCode:
        paymentMethod === 'BANK'
          ? bankCode
          : null,
      accountName,
      accountNumber,
    };

    const amountEl =
      document.getElementById('withdrawOtpAmount');
    const methodEl =
      document.getElementById(
        'withdrawOtpPaymentMethod'
      );

    if (amountEl) {
      amountEl.textContent =
        amount.toLocaleString('th-TH');
    }

    if (methodEl) {
      if (paymentMethod === 'TRUEMONEY') {
        methodEl.innerHTML = paymentMethodLabels[paymentMethod];
      } else {
        methodEl.textContent = paymentMethodLabels[paymentMethod] || paymentMethod;
      }
    }
    withdrawalOtpState.emailVerified = false;
    withdrawalOtpState.phoneVerified = false;

    const emailSection =
      document.getElementById('withdrawEmailOtpSection');

    const phoneSection =
      document.getElementById('withdrawPhoneOtpSection');

    const summarySection =
      document.getElementById('withdrawSummarySection');

    if (emailSection) {
      emailSection.style.display = '';
    }

    if (phoneSection) {
      phoneSection.style.display = 'none';
    }

    if (summarySection) {
      summarySection.style.display = 'none';
    }

    document
      .querySelectorAll('#withdrawEmailOtpWrap .otp-box, #withdrawPhoneOtpWrap .otp-box')
      .forEach((box) => {
        box.value = '';
      });

    const emailMessage =
      document.getElementById('withdrawEmailOtpMessage');

    const phoneMessage =
      document.getElementById('withdrawPhoneOtpMessage');

    if (emailMessage) {
      emailMessage.innerHTML = '';
    }

    if (phoneMessage) {
      phoneMessage.innerHTML = '';
    }
    updateWithdrawalStep(1);
    goPage('withdraw-otp');
  } catch (error) {
    console.error(
      'startWithdrawalOtpFlow failed:',
      error
    );

    withdrawalMessage(
      error.message ||
        'ไม่สามารถเริ่มรายการถอนได้'
    );
  }
}

window.setWithdrawalAmount = setWithdrawalAmount;
window.startWithdrawalOtpFlow = startWithdrawalOtpFlow;
window.sendWithdrawalEmailOtp = sendWithdrawalEmailOtp;
window.verifyWithdrawalEmailOtp = verifyWithdrawalEmailOtp;
window.createWithdrawalRequest = createWithdrawalRequest;
window.sendWithdrawalPhoneOtp = sendWithdrawalPhoneOtp;
window.verifyWithdrawalPhoneOtp = verifyWithdrawalPhoneOtp;

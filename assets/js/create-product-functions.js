// ===================== CREATE PRODUCT =====================
function setCreateProductFeedback(message, type = 'info') {
  const el = document.getElementById('create-product-feedback');
  if (!el) return;
  el.className = `notice ${type === 'error' ? 'warn' : 'info'}`;
  el.textContent = message;
  el.style.display = message ? 'block' : 'none';
}

function updateCreateProductVatPreview() {
  const input =
    document.getElementById(
      'create-product-price'
    );

  const preview =
    document.getElementById(
      'create-product-vat-preview'
    );

  if (!input || !preview) {
    return;
  }

  const rawPrice =
    input.value.trim();

  if (!rawPrice) {
    preview.textContent =
      'กรอกราคาสินค้าเพื่อดูยอดที่คุณจะได้รับ';

    return;
  }

  const price =
    Number(rawPrice);

  if (
    !Number.isFinite(price) ||
    price < 0
  ) {
    preview.textContent =
      'กรุณากรอกราคาที่ถูกต้อง';

    return;
  }

  /*
   * ต้องใช้กฎเดียวกับ Backend
   * backend/src/utils/marketplace-vat.js
   */
  const grossCents =
    Math.round(
      price * 100
    );

  const vatAmount =
    Math.floor(
      (
        grossCents * 7 +
        5000
      ) /
        10000
    );

  const sellerNetAmount =
    (
      grossCents -
      vatAmount * 100
    ) / 100;

  const formatPoints =
    (value) =>
      Number(value)
        .toLocaleString(
          'th-TH',
          {
            maximumFractionDigits: 2,
          }
        );

  preview.innerHTML =
    `
      <span style="
        color:var(--muted);
      ">
        Fee 7%:
        <strong style="
          color:var(--accent2);
          font-size:13px;
          font-weight:700;
        ">
          ${formatPoints(vatAmount)} pts
        </strong>
      </span>

      <span style="
        margin:0 8px;
        color:var(--muted);
      ">
        •
      </span>

      <span style="
        color:var(--text);
        font-weight:600;
      ">
        คุณจะได้รับ:
        <strong style="
          color:var(--success);
          font-size:15px;
          font-weight:800;
        ">
          ${formatPoints(
            sellerNetAmount
          )} pts
        </strong>
      </span>
    `;
}

function updateCreateProductValorantVerificationVisibility() {
  const gameSelect =
    document.getElementById(
      'create-product-game'
    );

  const verificationBox =
    document.getElementById(
      'create-product-valorant-verification'
    );

  if (!gameSelect || !verificationBox) {
    return;
  }

  const selectedOption =
    gameSelect.selectedOptions?.[0];

  const gameSlug =
    selectedOption?.dataset
      ?.gameSlug || '';

  const isValorant =
    gameSlug === 'valorant';

  verificationBox.hidden =
    !isValorant;

  if (!isValorant) {
  window.pendingValorantVerification =
    null;

  const feedback =
    document.getElementById(
      'create-product-valorant-verification-feedback'
    );

  if (feedback) {
      feedback.textContent = '';

      feedback.classList.remove(
        'is-success',
        'is-error'
      );
    }
  }
}

function updateValorantVerifyButtonState() {
  const gameName =
    document.getElementById(
      'create-product-riot-game-name'
    );

  const tagLine =
    document.getElementById(
      'create-product-riot-tag-line'
    );

  const button =
    document.getElementById(
      'create-product-valorant-verify-button'
    );

  if (!gameName || !tagLine || !button) {
    return;
  }

  button.disabled =
    !gameName.value.trim() ||
    !tagLine.value.trim();
}

function resetCreateProductValorantVerificationState() {
  const gameName =
    document.getElementById(
      'create-product-riot-game-name'
    );

  const tagLine =
    document.getElementById(
      'create-product-riot-tag-line'
    );

  const feedback =
    document.getElementById(
      'create-product-valorant-verification-feedback'
    );

  window.pendingValorantVerification =
    null;

  if (gameName) {
    gameName.value = '';
  }

  if (tagLine) {
    tagLine.value = '';
  }

  if (feedback) {
    feedback.textContent = '';

    feedback.classList.remove(
      'is-success',
      'is-error'
    );
  }

  updateValorantVerifyButtonState();
}

async function verifyCreateProductValorantAccount() {
  const gameName =
    document.getElementById(
      'create-product-riot-game-name'
    )?.value.trim();

  const tagLine =
    document.getElementById(
      'create-product-riot-tag-line'
    )?.value.trim();

  const button =
    document.getElementById(
      'create-product-valorant-verify-button'
    );

  const feedback =
    document.getElementById(
      'create-product-valorant-verification-feedback'
    );

  if (
    !gameName ||
    !tagLine ||
    !button ||
    !feedback
  ) {
    return;
  }

  const activeCsrfToken =
    csrfToken ||
    getCookieValue('gm_csrf');

  if (!activeCsrfToken) {
    feedback.textContent =
      'ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่';
    return;
  }

  button.disabled = true;
  button.textContent =
    'กำลังตรวจสอบ...';

  feedback.classList.remove(
    'is-success',
    'is-error'
  );

  feedback.textContent =
    'กำลังตรวจสอบ Riot ID กับ Riot...';

  try {
    const response =
      await fetch(
        '/api/v1/user/products/valorant/verify',
        {
          method: 'POST',

          credentials: 'include',

          headers: {
            'Content-Type':
              'application/json',

            'X-CSRF-Token':
              activeCsrfToken,
          },

          body: JSON.stringify({
            gameName,
            tagLine,
          }),
        }
      );

    const body =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.error?.message ||
        'ไม่สามารถตรวจสอบบัญชีได้'
      );
    }

    if (!body.data?.exists) {
      window.pendingValorantVerification =
        null;

      feedback.textContent =
        `ไม่พบบัญชี ${gameName}#${tagLine}`;

      feedback.classList.add(
        'is-error'
      );

      return;
    }

    window.pendingValorantVerification = {
      gameName:
        body.data.gameName,

      tagLine:
        body.data.tagLine,

      puuid:
        body.data.puuid,
    };

    feedback.textContent =
      `✓ พบบัญชี Valorant: ` +
      `${body.data.gameName}#${body.data.tagLine}`;

    feedback.classList.add(
      'is-success'
    );

  } catch (error) {
    window.pendingValorantVerification =
      null;

    feedback.textContent =
      error.message ||
      'ไม่สามารถตรวจสอบบัญชีได้';

    feedback.classList.add(
      'is-error'
    );

  } finally {
    button.innerHTML =
      '<img class="ui-emoji" src="assets/icons/magnifyingGlass.svg" alt=""> ตรวจสอบบัญชี Valorant';

    updateValorantVerifyButtonState();
  }
}

async function loadCreateProductGames() {
  const select = document.getElementById('create-product-game');
  if (!select) return;
  select.innerHTML = '<option value="">กำลังโหลดเกม...</option>';
  try {
    const response = await fetch('/api/v1/games', { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'โหลดเกมไม่สำเร็จ');
    const games = Array.isArray(data.data) ? data.data : [];
    select.innerHTML =
      '<option value="">เลือกเกม</option>' +
      games.map(
        (game) => `
          <option
            value="${Number(game.id)}"
            data-game-slug="${escapeHtml(
              game.slug || ''
            )}"
          >
            ${escapeHtml(game.name)}
          </option>
        `
      ).join('');

      select.onchange =
        updateCreateProductValorantVerificationVisibility;

      updateCreateProductValorantVerificationVisibility();

  } catch (error) {
    select.innerHTML = '<option value="">ไม่สามารถโหลดเกมได้</option>';
    setCreateProductFeedback(error.message || 'ไม่สามารถโหลดเกมได้', 'error');
  }
}

async function populateCreateProductForEdit(product) {
  const game = document.getElementById('create-product-game');
  const title = document.getElementById('create-product-title');
  const description = document.getElementById('create-product-description');
  const price = document.getElementById('create-product-price');
  const credentials = product.credentials || {};
  if (game) { game.value = String(product.gameId || product.game?.id || ''); game.disabled = true; }
  updateCreateProductValorantVerificationVisibility();
  const valorantVerification =
    product.valorantVerification || null;

  const riotGameName =
    document.getElementById(
      'create-product-riot-game-name'
    );

  const riotTagLine =
    document.getElementById(
      'create-product-riot-tag-line'
    );

  const riotFeedback =
    document.getElementById(
      'create-product-valorant-verification-feedback'
    );

  window.pendingValorantVerification =
    null;

  if (riotGameName) {
    riotGameName.value =
      valorantVerification?.gameName || '';
  }

  if (riotTagLine) {
    riotTagLine.value =
      valorantVerification?.tagLine || '';
  }

  if (riotFeedback) {
    riotFeedback.classList.remove(
      'is-success',
      'is-error'
    );

    if (valorantVerification) {
      riotFeedback.textContent =
        `✓ ตรวจสอบข้อมูลบัญชีเกมแล้ว: ` +
        `${valorantVerification.gameName}` +
        `#${valorantVerification.tagLine}`;

      riotFeedback.classList.add(
        'is-success'
      );
    } else {
      riotFeedback.textContent = '';
    }
  }

  updateValorantVerifyButtonState();
  if (title) title.value = product.title || product.name || '';
  if (description) description.value = product.description || '';
  if (price) price.value = product.price ?? '';
  updateCreateProductVatPreview();
  const credentialFields = { 'create-product-username': credentials.gameUsername, 'create-product-password': credentials.gamePassword, 'create-product-email': credentials.email, 'create-product-email-password': credentials.emailPassword };
  Object.entries(credentialFields).forEach(([id, value]) => { const input = document.getElementById(id); if (input) input.value = value || ''; });
  const heading = document.querySelector('#pg-add-listing .sec-title');
  const sub = document.querySelector('#pg-add-listing .sec-sub');
  const saveButton = document.getElementById('create-product-save-button');
  if (heading) heading.textContent = '✏️ แก้ไขประกาศขายบัญชีเกม';
  if (sub) sub.textContent = 'แก้ไขข้อมูลเดิมของประกาศนี้ แล้วบันทึกการเปลี่ยนแปลง';
  if (saveButton) saveButton.textContent = '💾 บันทึกการแก้ไข';
  await window.loadExistingProductImages?.(product.id);
}

function cancelCreateProductEditor() {
  window.editingProductId = null;
  window.editingProductData = null;
  resetCreateProductEditorMode();
  goPage('my-listings');
}

function resetCreateProductEditorMode() {
  if (window.editingProductId) return;
  const game = document.getElementById('create-product-game');
  if (game) game.disabled = false;
  ['create-product-title','create-product-description','create-product-price','create-product-username','create-product-password','create-product-email','create-product-email-password'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
  updateCreateProductVatPreview();
  resetCreateProductValorantVerificationState();
  window.resetProductImages?.();
  const heading = document.querySelector('#pg-add-listing .sec-title');
  const sub = document.querySelector('#pg-add-listing .sec-sub');
  const saveButton = document.getElementById('create-product-save-button');
  if (heading) heading.textContent = '➕ เพิ่มประกาศขายบัญชีเกม';
  if (sub) sub.textContent = 'กรอกรายละเอียดสินค้าที่ต้องการขาย';
  if (saveButton) saveButton.textContent = '💾 บันทึก';
}

async function createProductFromForm(status = 'DRAFT') {
  const gameId = Number(document.getElementById('create-product-game')?.value);
  const title = document.getElementById('create-product-title')?.value.trim();
  const description = document.getElementById('create-product-description')?.value.trim();
  const price = Number(document.getElementById('create-product-price')?.value);
  if (!gameId || !title || !description || !Number.isFinite(price) || price < 0) {
    setCreateProductFeedback('กรุณาเลือกเกม กรอกชื่อประกาศ รายละเอียด และราคาที่ถูกต้อง', 'error');
    return;
  }
  const activeCsrfToken = csrfToken || getCookieValue('gm_csrf');
  if (!activeCsrfToken) {
    setCreateProductFeedback('ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่', 'error');
    return;
  }
  const credentials = { gameUsername: document.getElementById('create-product-username')?.value.trim() || '', gamePassword: document.getElementById('create-product-password')?.value || '', email: document.getElementById('create-product-email')?.value.trim() || '', emailPassword: document.getElementById('create-product-email-password')?.value || '' };
  const hasCredentials = Object.values(credentials).some(Boolean);
  const gameSelect =
    document.getElementById(
      'create-product-game'
    );

  const selectedGameSlug =
    gameSelect
      ?.selectedOptions?.[0]
      ?.dataset?.gameSlug || '';

  const pendingVerification =
    window.pendingValorantVerification;

  const valorantVerification =
    selectedGameSlug === 'valorant' &&
    pendingVerification?.gameName &&
    pendingVerification?.tagLine
      ? {
          gameName:
            pendingVerification.gameName,

          tagLine:
            pendingVerification.tagLine,
        }
      : null;
  const payload = {
    gameId,
    title,
    description,
    price,
    status,

    ...(hasCredentials
      ? { credentials }
      : {}),

    ...(valorantVerification
      ? {
          valorantVerification,
        }
      : {}),
  };
  const editingId = Number(window.editingProductId || 0);
  try {
    const isEditing = Number.isInteger(editingId) && editingId > 0;
    const response = await fetch(isEditing ? `/api/v1/user/products/${editingId}` : '/api/v1/user/products', {
      method: isEditing ? 'PATCH' : 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': activeCsrfToken },
      body: JSON.stringify(
        isEditing
          ? {
              title,
              description,
              price,

              status:
                window.editingProductData?.status ||
                status,

              ...(hasCredentials
                ? { credentials }
                : {}),

              ...(valorantVerification
                ? {
                    valorantVerification,
                  }
                : {}),
            }
          : payload
      ),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || (isEditing ? 'แก้ไขสินค้าไม่สำเร็จ' : 'บันทึกสินค้าไม่สำเร็จ'));
    const productId = isEditing ? editingId : (data.data?.id || data.data?.product?.id);
    if (!productId) throw new Error('ไม่พบรหัสสินค้า');
    if (window.getSelectedProductImageCount?.()) {
      setCreateProductFeedback('กำลังอัปโหลดรูปภาพ...');
      await window.uploadProductImagesToProduct?.(productId);
      window.resetProductImages?.();
    }
    window.editingProductId = null;
    window.editingProductData = null;
    resetCreateProductEditorMode();
    setCreateProductFeedback(isEditing ? 'บันทึกการแก้ไขประกาศเรียบร้อยแล้ว' : 'บันทึกร่างสินค้าและรูปภาพเรียบร้อยแล้ว');
    setTimeout(() => goPage('my-listings'), 500);
  } catch (error) {
    console.error('createProductFromForm failed:', error);
    setCreateProductFeedback(error.message || 'บันทึกสินค้าไม่สำเร็จ', 'error');
  }
}

window.updateCreateProductVatPreview =
  updateCreateProductVatPreview;

window.verifyCreateProductValorantAccount =
  verifyCreateProductValorantAccount;

window.updateValorantVerifyButtonState =
  updateValorantVerifyButtonState;

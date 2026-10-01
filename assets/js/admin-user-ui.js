(() => {
  'use strict';

  let users = [];
  let currentView = 'ALL';

  let selectedUserId = null;
  let selectedUserDetail = null;
  let currentDetailTab = 'GENERAL';


  /* =========================
     Helpers
     ========================= */

  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]
    );

  const csrf = () =>
    window.csrfToken ||
    document.cookie.match(
      /(?:^|; )gm_csrf=([^;]+)/
    )?.[1] ||
    '';

  const hasRole = (user, role) =>
    Array.isArray(user.roles) &&
    user.roles.includes(role);

  const roleLabel = (roles = []) => {
    if (roles.includes('ADMIN')) return 'ADMIN';
    if (roles.includes('SELLER')) return 'SELLER';
    return 'USER';
  };

  const roleClass = (roles = []) => {
    const role = roleLabel(roles);

    if (role === 'ADMIN') {
      return 'role-admin';
    }

    if (role === 'SELLER') {
      return 'role-seller';
    }

    return 'role-user';
  };

  const statusLabel = status => ({
    ACTIVE: 'ใช้งาน',
    BANNED: 'แบนถาวร',
  })[status] || status;

  const statusClass = status => ({
    ACTIVE: 'status-active',
    BANNED: 'status-banned',
  })[status] || '';

  const formatNumber = value =>
    Number(value || 0).toLocaleString('th-TH');

  const formatDate = value => {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString('th-TH');
  };


  /* =========================
     Stats
     ========================= */

  function updateStats() {
    const total = users.length;

    const active = users.filter(
      user => user.status === 'ACTIVE'
    ).length;

    const sellers = users.filter(
      user => hasRole(user, 'SELLER')
    ).length;

    const banned = users.filter(
      user => user.status === 'BANNED'
    ).length;

    const stats = [
      ['adminUserTotal', total],
      ['adminUserActive', active],
      ['adminUserSeller', sellers],
      ['adminUserBanned', banned],
    ];

    stats.forEach(([id, value]) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent =
          Number(value).toLocaleString('th-TH');
      }
    });
  }


  /* =========================
     Filter
     ========================= */

  function getFilteredUsers() {
    const search = (
      document.getElementById('adminUserSearch')
        ?.value || ''
    )
      .trim()
      .toLowerCase();

    const role =
      document.getElementById('adminUserRole')
        ?.value || 'ALL';

    const status =
      document.getElementById('adminUserStatus')
        ?.value || 'ALL';

    const sort =
      document.getElementById('adminUserSort')
        ?.value || 'NEWEST';

    let rows = users.filter(user => {
      const searchable = [
        user.username,
        user.email,
        user.firstName,
        user.lastName,
        user.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (
        search &&
        !searchable.includes(search)
      ) {
        return false;
      }

      if (
        role !== 'ALL' &&
        roleLabel(user.roles) !== role
      ) {
        return false;
      }

      if (
        status !== 'ALL' &&
        user.status !== status
      ) {
        return false;
      }


      /* Tab filter */

      if (
        currentView === 'USER' &&
        roleLabel(user.roles) !== 'USER'
      ) {
        return false;
      }

      if (
        currentView === 'SELLER' &&
        !hasRole(user, 'SELLER')
      ) {
        return false;
      }

      if (
        currentView === 'BANNED' &&
        user.status !== 'BANNED'
      ) {
        return false;
      }

      return true;
    });


    /* Sort */

    rows = [...rows];

    if (sort === 'OLDEST') {
      rows.sort(
        (a, b) =>
          new Date(a.createdAt) -
          new Date(b.createdAt)
      );
    }

    else if (sort === 'USERNAME_ASC') {
      rows.sort((a, b) =>
        String(a.username || '')
          .localeCompare(
            String(b.username || ''),
            'th'
          )
      );
    }

    else if (sort === 'WALLET_DESC') {
      rows.sort(
        (a, b) =>
          Number(b.walletBalance || 0) -
          Number(a.walletBalance || 0)
      );
    }

    else {
      rows.sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      );
    }

    return rows;
  }


  /* =========================
     User row
     ========================= */

  function userRow(user) {
    const role = roleLabel(user.roles);

    const fullName =
      `${user.firstName || ''} ${user.lastName || ''}`
        .trim() || '-';

    const selectedClass =
      Number(selectedUserId) === Number(user.id)
        ? 'is-selected'
        : '';

    return `
      <div
        class="admin-user-row ${selectedClass}"
        onclick="adminOpenUser(${Number(user.id)})"
        role="button"
        tabindex="0"
        onkeydown="
          if(event.key === 'Enter' || event.key === ' '){
            event.preventDefault();
            adminOpenUser(${Number(user.id)});
          }
        "
      >

        <div class="admin-user-row-main">

          <div class="admin-user-row-title">

            <strong>
              ${esc(user.username)}
            </strong>

            <span
              class="admin-user-status-badge
                ${statusClass(user.status)}"
            >
              ${esc(statusLabel(user.status))}
            </span>

            <span
              class="admin-user-role-badge
                ${roleClass(user.roles)}"
            >
              ${esc(role)}
            </span>

          </div>


          <div class="admin-user-row-meta">

            <span>
              ${esc(user.email || '-')}
            </span>

            <span class="admin-user-meta-divider">
              •
            </span>

            <span>
              ${esc(fullName)}
            </span>

          </div>


          <div class="admin-user-row-stats">

            <span>
              Wallet
              <strong>
                ${formatNumber(user.walletBalance)}
              </strong>
              pts
            </span>

            <span>
              • ซื้อ
              <strong>
                ${formatNumber(user.boughtCount)}
              </strong>
            </span>

            <span>
              • ขาย
              <strong>
                ${formatNumber(user.soldCount)}
              </strong>
            </span>

          </div>

        </div>


        <div class="admin-user-row-action">

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick="
              event.stopPropagation();
              adminOpenUser(${Number(user.id)});
            "
          >
            ดูรายละเอียด
          </button>

        </div>

      </div>
    `;
  }


  /* =========================
     Render
     ========================= */

  function render() {
    const list =
      document.getElementById('adminUserList');

    if (!list) return;

    updateStats();

    const rows = getFilteredUsers();

    const resultCount =
      document.getElementById(
        'adminUserResultCount'
      );

    if (resultCount) {
      resultCount.textContent =
        `ทั้งหมด ${rows.length.toLocaleString('th-TH')} รายการ`;
    }

    list.innerHTML = rows.length
      ? rows.map(userRow).join('')
      : `
        <div class="admin-users-empty">
          ไม่พบผู้ใช้ตามเงื่อนไข
        </div>
      `;
  }


  /* =========================
     Tabs
     ========================= */

  window.adminSetUserView = view => {
    currentView = view;

    document
      .querySelectorAll('.admin-users-tab')
      .forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.adminUserView === view
        );
      });

    render();
  };


  /* =========================
     Load users
     ========================= */

  window.adminLoadUsers = async () => {
    const list =
      document.getElementById('adminUserList');

    if (list) {
      list.innerHTML = `
        <div class="admin-users-empty">
          กำลังโหลดข้อมูล...
        </div>
      `;
    }

    try {
      const response = await fetch(
        '/api/v1/admin/users',
        {
          credentials: 'include',
        }
      );

      const body =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          body.error?.message ||
          'โหลดผู้ใช้ไม่สำเร็จ'
        );
      }

      users = Array.isArray(body.data?.users)
        ? body.data.users
        : [];

      render();

    } catch (error) {
      if (list) {
        list.innerHTML = `
          <div class="notice danger">
            ${esc(error.message)}
          </div>
        `;
      }
    }
  };


  window.adminFilterUsers = render;

  function verificationLabel(status) {
  return ({
    DRAFT: 'ยังไม่ส่งตรวจ',
    PENDING: 'รอตรวจสอบ',
    APPROVED: 'ยืนยันแล้ว',
    REJECTED: 'ถูกปฏิเสธ',
  })[status] || 'ยังไม่มีข้อมูล';
}


function productStatusLabel(status) {
  return ({
    DRAFT: 'ฉบับร่าง',
    ACTIVE: 'กำลังขาย',
    PUBLISHED: 'กำลังขาย',
    PAUSED: 'ซ่อน',
    SOLD: 'ขายแล้ว',
    CANCELLED: 'ยกเลิก',
  })[status] || status;
}


function orderStatusLabel(status) {
  return ({
    PENDING: 'รอชำระ',
    PAID: 'ชำระแล้ว',
    COMPLETED: 'สำเร็จ',
    CANCELLED: 'ยกเลิก',
  })[status] || status;
}


function renderStars(rating) {
  const value = Math.max(
    0,
    Math.min(5, Number(rating || 0))
  );

  const rounded = Math.round(value);

  return `
    <span class="admin-user-detail-stars">
      ${'★'.repeat(rounded)}
      ${'☆'.repeat(5 - rounded)}
    </span>
  `;
}


function renderGeneralDetail(user) {
  const seller = user.sellerInfo || {};
  const wallet = user.walletSummary || {};

  const fullName =
    `${user.firstName || ''} ${user.lastName || ''}`
      .trim() || '-';

  return `
    <div class="admin-user-detail-section">

      <h3 class="admin-user-detail-section-title">
        ข้อมูลบัญชี
      </h3>

      <div class="admin-user-detail-info-grid">

        <div class="admin-user-detail-info-item">
          <span>ชื่อ-นามสกุล</span>
          <strong>${esc(fullName)}</strong>
        </div>

        <div class="admin-user-detail-info-item">
          <span>เบอร์โทร</span>
          <strong>${esc(user.phone || '-')}</strong>
        </div>

        <div class="admin-user-detail-info-item">
          <span>Email</span>
          <strong>${esc(user.email || '-')}</strong>
        </div>

        <div class="admin-user-detail-info-item">
          <span>วันเกิด</span>
          <strong>
            ${user.dateOfBirth
              ? formatDate(user.dateOfBirth)
              : '-'}
          </strong>
        </div>

        <div class="admin-user-detail-info-item">
          <span>ยืนยัน Email</span>
          <strong>
            ${user.emailVerified
              ? '✓ ยืนยันแล้ว'
              : 'ยังไม่ยืนยัน'}
          </strong>
        </div>

        <div class="admin-user-detail-info-item">
          <span>ยืนยันเบอร์โทร</span>
          <strong>
            ${user.phoneVerified
              ? '✓ ยืนยันแล้ว'
              : 'ยังไม่ยืนยัน'}
          </strong>
        </div>

        <div class="admin-user-detail-info-item">
          <span>เซสชันล่าสุด</span>
          <strong>
            ${user.lastSessionAt
              ? formatDate(user.lastSessionAt)
              : '-'}
          </strong>
        </div>

        <div class="admin-user-detail-info-item">
          <span>สถานะบัญชี</span>
          <strong>
            ${esc(statusLabel(user.status))}
          </strong>
        </div>

      </div>

    </div>


    <div class="admin-user-detail-section">

      <h3 class="admin-user-detail-section-title">
        กระเป๋าและการซื้อขาย
      </h3>

      <div class="admin-user-detail-metrics">

        <div class="admin-user-detail-metric">
          <span>Wallet ปัจจุบัน</span>
          <strong>
            ${formatNumber(wallet.balance)} pts
          </strong>
        </div>

        <div class="admin-user-detail-metric">
          <span>ซื้อสำเร็จ</span>
          <strong>
            ${formatNumber(user.boughtCount)}
          </strong>
        </div>

        <div class="admin-user-detail-metric">
          <span>ขายสำเร็จ</span>
          <strong>
            ${formatNumber(user.soldCount)}
          </strong>
        </div>

        <div class="admin-user-detail-metric">
          <span>ยอดถอนสำเร็จ</span>
          <strong>
            ${formatNumber(wallet.totalWithdrawal)} pts
          </strong>
        </div>

      </div>

    </div>


    ${
      seller.isSeller
        ? `
          <div class="admin-user-detail-section">

            <h3 class="admin-user-detail-section-title">
              ข้อมูลผู้ขาย
            </h3>

            <div class="admin-user-detail-seller-summary">

              <div class="admin-user-detail-info-grid">

                <div class="admin-user-detail-info-item">
                  <span>สถานะการยืนยัน</span>
                  <strong>
                    ${esc(
                      verificationLabel(
                        seller.verificationStatus
                      )
                    )}
                  </strong>
                </div>

                <div class="admin-user-detail-info-item">
                  <span>อนุมัติเมื่อ</span>
                  <strong>
                    ${
                      seller.verifiedAt
                        ? formatDate(
                            seller.verifiedAt
                          )
                        : '-'
                    }
                  </strong>
                </div>

              </div>


              <div class="admin-user-detail-metrics">

                <div class="admin-user-detail-metric">
                  <span>ยอดขายรวม</span>
                  <strong>
                    ${formatNumber(
                      seller.totalSalesAmount
                    )}
                    pts
                  </strong>
                </div>

                <div class="admin-user-detail-metric">
                  <span>รายได้จากการขาย</span>
                  <strong>
                    ${formatNumber(
                      wallet.saleIncome
                    )}
                    pts
                  </strong>
                </div>

                <div class="admin-user-detail-metric">
                  <span>รีวิวทั้งหมด</span>
                  <strong>
                    ${formatNumber(
                      seller.reviewCount
                    )}
                  </strong>
                </div>

                <div class="admin-user-detail-metric">
                  <span>คะแนนเฉลี่ย</span>

                  <strong>
                    ${Number(
                      seller.averageRating || 0
                    ).toFixed(1)}
                    / 5
                  </strong>

                  ${renderStars(
                    seller.averageRating
                  )}
                </div>

              </div>

            </div>

          </div>
        `
        : ''
    }


    ${
      user.status === 'BANNED' &&
      user.suspensionReason
        ? `
          <div class="admin-user-detail-section">

            <h3 class="admin-user-detail-section-title">
              การแบนบัญชี
            </h3>

            <div class="notice warn">
              <strong>เหตุผล</strong>

              <div style="margin-top:5px">
                ${esc(user.suspensionReason)}
              </div>
            </div>

          </div>
        `
        : ''
    }
  `;
}


function renderProductsDetail(user) {
  const products =
    Array.isArray(user.recentProducts)
      ? user.recentProducts
      : [];

  if (!products.length) {
    return `
      <div class="admin-user-detail-empty-list">
        ผู้ใช้รายนี้ยังไม่มีรายการสินค้า
      </div>
    `;
  }

  return `
    <div class="admin-user-detail-list">

      ${products.map(product => `
        <div
          class="admin-user-detail-list-row is-clickable"
          role="button"
          tabindex="0"
          onclick="adminOpenProduct(${Number(product.id)})"
          onkeydown="
            if(event.key === 'Enter' || event.key === ' '){
              event.preventDefault();
              adminOpenProduct(${Number(product.id)});
            }
          "
        >

          <div class="admin-user-detail-product-thumb">
            ${
              product.imageUrl
                ? `
                  <img
                    src="${esc(product.imageUrl)}"
                    alt="${esc(product.title)}"
                  >
                `
                : '🎮'
            }
          </div>

          <div class="admin-user-detail-list-main">

            <strong>
              ${esc(product.title)}
            </strong>

            <span>
              ${esc(product.gameName || '-')}
              •
              ${esc(
                productStatusLabel(
                  product.status
                )
              )}
            </span>

            <small>
              ${formatDate(product.createdAt)}
            </small>

          </div>

          <div class="admin-user-detail-list-value">
            ${formatNumber(product.price)}
            pts
          </div>

        </div>
      `).join('')}

    </div>
  `;
}


function renderPurchasesDetail(user) {
  const purchases =
    Array.isArray(user.recentPurchases)
      ? user.recentPurchases
      : [];

  if (!purchases.length) {
    return `
      <div class="admin-user-detail-empty-list">
        ผู้ใช้รายนี้ยังไม่มีรายการซื้อ
      </div>
    `;
  }

  return `
    <div class="admin-user-detail-list">

      ${purchases.map(order => `
        <div
          class="admin-user-detail-list-row is-clickable"
          role="button"
          tabindex="0"
          onclick="adminOpenProduct(${Number(order.productId)})"
          onkeydown="
            if(event.key === 'Enter' || event.key === ' '){
              event.preventDefault();
              adminOpenProduct(${Number(order.productId)});
            }
          "
        >

          <div class="admin-user-detail-product-thumb">
            ${
              order.imageUrl
                ? `
                  <img
                    src="${esc(order.imageUrl)}"
                    alt="${esc(order.productTitle || 'สินค้า')}"
                  >
                `
                : '🎮'
            }
          </div>

          <div class="admin-user-detail-list-main">

            <strong>
              ${esc(order.productTitle || '-')}
            </strong>

            <span>
              ${esc(order.gameName || '-')}
              • ผู้ขาย
              @${esc(
                order.sellerUsername || '-'
              )}
            </span>

            <small>
              Order #${Number(order.id)}
              •
              ${esc(
                orderStatusLabel(
                  order.status
                )
              )}
              •
              ${formatDate(order.createdAt)}
            </small>

          </div>

          <div class="admin-user-detail-list-value">
            ${formatNumber(order.amount)}
            pts
          </div>

        </div>
      `).join('')}

    </div>
  `;
}


function renderReviewsDetail(user) {
  const reviews =
    Array.isArray(user.recentReviews)
      ? user.recentReviews
      : [];

  if (!reviews.length) {
    return `
      <div class="admin-user-detail-empty-list">
        ผู้ใช้รายนี้ยังไม่มีรีวิวที่ได้รับ
      </div>
    `;
  }

  return `
    <div class="admin-user-detail-list">

      ${reviews.map(review => `
        <div class="admin-user-detail-review">

          <div class="admin-user-detail-review-head">

            <strong>
              @${esc(
                review.buyerUsername || '-'
              )}
            </strong>

            ${renderStars(review.rating)}

          </div>

          <p>
            ${
              review.comment
                ? esc(review.comment)
                : 'ไม่มีข้อความรีวิว'
            }
          </p>

          <small>
            ${formatDate(review.createdAt)}
          </small>

        </div>
      `).join('')}

    </div>
  `;
}


function renderUserDetailTab() {
  const body =
    document.getElementById(
      'adminUserDetailBody'
    );

  if (!body || !selectedUserDetail) {
    return;
  }

  if (currentDetailTab === 'PRODUCTS') {
    body.innerHTML =
      renderProductsDetail(
        selectedUserDetail
      );

    return;
  }

  if (currentDetailTab === 'PURCHASES') {
    body.innerHTML =
      renderPurchasesDetail(
        selectedUserDetail
      );

    return;
  }

  if (currentDetailTab === 'REVIEWS') {
    body.innerHTML =
      renderReviewsDetail(
        selectedUserDetail
      );

    return;
  }

  body.innerHTML =
    renderGeneralDetail(
      selectedUserDetail
    );
}


window.adminSetUserDetailTab = tab => {
  currentDetailTab = tab;

  document
    .querySelectorAll(
      '.admin-user-detail-tab'
    )
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.adminUserDetailTab === tab
      );
    });

  renderUserDetailTab();
};


  /* =========================
     User detail
     ========================= */

  window.adminOpenUser = async id => {
    try {
      selectedUserId = Number(id);

      const workspace =
        document.getElementById(
          'adminUsersWorkspace'
        );

      const detailPanel =
        document.getElementById(
          'adminUserDetailPanel'
        );

      if (workspace) {
        workspace.classList.add(
          'is-detail-open'
        );
      }

      if (detailPanel) {
        detailPanel.hidden = false;
      }

      render();

    const empty =
      document.getElementById(
        'adminUserDetailEmpty'
      );

    const content =
      document.getElementById(
        'adminUserDetailContent'
      );

    const detailBody =
      document.getElementById(
        'adminUserDetailBody'
      );

    if (empty) {
      empty.hidden = true;
    }

    if (content) {
      content.hidden = false;
    }

    if (detailBody) {
      detailBody.innerHTML = `
        <div class="admin-user-detail-loading">
          กำลังโหลดรายละเอียด...
        </div>
      `;
    }


    const response = await fetch(
      `/api/v1/admin/users/${id}`,
      {
        credentials: 'include',
      }
    );

    const body =
      await response.json().catch(
        () => ({})
      );

    if (!response.ok) {
      throw new Error(
        body.error?.message ||
        'โหลดรายละเอียดไม่สำเร็จ'
      );
    }

    const user = body.data?.user;

    if (!user) {
      return;
    }

    selectedUserDetail = user;
    selectedUserId = Number(user.id);
    currentDetailTab = 'GENERAL';


    /* Header */

    const username =
      document.getElementById(
        'adminUserDetailUsername'
      );

    const email =
      document.getElementById(
        'adminUserDetailEmail'
      );

    const joined =
      document.getElementById(
        'adminUserDetailJoined'
      );

    const avatar =
      document.getElementById(
        'adminUserDetailAvatar'
      );

    const status =
      document.getElementById(
        'adminUserDetailStatus'
      );

    const role =
      document.getElementById(
        'adminUserDetailRole'
      );

    const actions =
      document.getElementById(
        'adminUserDetailActions'
      );


    if (username) {
      username.textContent =
        user.username || '-';
    }

    if (email) {
      email.textContent =
        user.email || '-';
    }

    if (joined) {
      joined.textContent =
        `สมัครเมื่อ ${formatDate(
          user.createdAt
        )}`;
    }


    /* Avatar */

    if (avatar) {
      if (user.avatarUrl) {
        avatar.innerHTML = `
          <img
            src="${esc(user.avatarUrl)}"
            alt="${esc(
              user.username || 'User'
            )}"
          >
        `;
      }

      else {
        avatar.textContent =
          String(
            user.username || 'U'
          )
            .charAt(0)
            .toUpperCase();
      }
    }


    /* Status */

    if (status) {
      status.className =
        `admin-user-status-badge ${
          statusClass(user.status)
        }`;

      status.textContent =
        statusLabel(user.status);
    }


    /* Role */

    if (role) {
      role.className =
        `admin-user-role-badge ${
          roleClass(user.roles)
        }`;

      role.textContent =
        roleLabel(user.roles);
    }


    /* Moderation actions */

    if (actions) {

      if (user.status === 'ACTIVE') {
        actions.innerHTML = `
          <button
            type="button"
            class="btn btn-danger btn-sm"
            onclick="
              adminModerateFromDetail(
                ${user.id},
                'BANNED'
              )
            "
          >
            🚫 แบนถาวร
          </button>
        `;
      }

      else if (user.status === 'BANNED') {
        actions.innerHTML = `
          <button
            type="button"
            class="btn btn-success btn-sm"
            onclick="
              adminModerateFromDetail(
                ${user.id},
                'ACTIVE'
              )
            "
          >
            ✓ ปลดแบน
          </button>
        `;
      }

      else {
        actions.innerHTML = '';
      }
    }


    /* Reset detail tab */

    document
      .querySelectorAll(
        '.admin-user-detail-tab'
      )
      .forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.adminUserDetailTab ===
            'GENERAL'
        );
      });


    renderUserDetailTab();
    render();

  } catch (error) {
    alert(error.message);

    window.closeAdminUserDetail();
  }
};

window.closeAdminUserDetail = () => {
  selectedUserId = null;
  selectedUserDetail = null;
  currentDetailTab = 'GENERAL';

  const workspace =
    document.getElementById(
      'adminUsersWorkspace'
    );

  const detailPanel =
    document.getElementById(
      'adminUserDetailPanel'
    );

  const empty =
    document.getElementById(
      'adminUserDetailEmpty'
    );

  const content =
    document.getElementById(
      'adminUserDetailContent'
    );

  const body =
    document.getElementById(
      'adminUserDetailBody'
    );

  if (workspace) {
    workspace.classList.remove(
      'is-detail-open'
    );
  }

  if (detailPanel) {
    detailPanel.hidden = true;
  }

  if (empty) {
    empty.hidden = false;
  }

  if (content) {
    content.hidden = true;
  }

  if (body) {
    body.innerHTML = '';
  }

  render();
};

/*
  เก็บชื่อเก่าไว้เผื่อส่วนอื่นของระบบ
  ยังอ้างถึง function เดิม
*/
window.closeAdminUserModal =
  window.closeAdminUserDetail;


  /* =========================
     Moderation
     ========================= */

  window.adminModerateFromDetail =
    async (id, status) => {

      let reason = null;

      if (status === 'BANNED') {
        reason = prompt(
          'ระบุเหตุผลสำหรับการแบนบัญชีนี้'
        );

        if (
          reason === null ||
          !reason.trim()
        ) {
          return;
        }
      }

      try {
        const response = await fetch(
          `/api/v1/admin/moderation/users/${id}/status`,
          {
            method: 'PATCH',
            credentials: 'include',

            headers: {
              'Content-Type':
                'application/json',

              'X-CSRF-Token':
                csrf(),
            },

            body: JSON.stringify({
              status,
              reason,
            }),
          }
        );

        const body =
          await response.json().catch(
            () => ({})
          );

        if (!response.ok) {
          throw new Error(
            body.error?.message ||
            'ดำเนินการไม่สำเร็จ'
          );
        }

        await adminLoadUsers();

        await adminOpenUser(id);

      } catch (error) {
        alert(error.message);
      }
    };

})();
function userProfileEscape(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char])
  );
}

function userProfileAvatar(user) {
  const username =
    String(user?.username || 'U');

  if (user?.avatarUrl) {
    return `
      <img
        src="${userProfileEscape(
          user.avatarUrl
        )}"
        alt="รูปโปรไฟล์"
        style="
          width:86px;
          height:86px;
          object-fit:cover;
          border-radius:50%;
        "
      >
    `;
  }

  return `
    <div
      class="avatar"
      style="
        width:86px;
        height:86px;
        font-size:36px;
        background:var(--accent);
      "
    >
      ${userProfileEscape(
        username.charAt(0).toUpperCase()
      )}
    </div>
  `;
}

function renderUserProfileLoading() {
  const target =
    document.getElementById(
      'userProfileContent'
    );

  if (!target) return;

  target.innerHTML = `
    <div
      style="
        padding:28px;
        text-align:center;
        color:var(--muted);
      "
    >
      กำลังโหลดโปรไฟล์...
    </div>
  `;
}

function renderUserProfileOverview(
  user,
  completedPurchases
) {
  const target =
    document.getElementById(
      'userProfileContent'
    );

  if (!target) return;

  const verified =
    Boolean(
      user?.accountVerified ||
      (
        user?.emailVerified &&
        user?.phoneVerified
      )
    );

  target.className = '';
  target.removeAttribute('style');

  target.innerHTML = `
    <div
      class="card"
      style="
        padding:26px;
        margin-bottom:16px;
      "
    >
      <div
        style="
          display:flex;
          align-items:center;
          gap:18px;
          flex-wrap:wrap;
        "
      >
        ${userProfileAvatar(user)}

        <div
          style="
            flex:1;
            min-width:180px;
          "
        >
          <div
            style="
              font-family:'Kanit',sans-serif;
              font-size:24px;
              font-weight:800;
              margin-bottom:4px;
            "
          >
            ${userProfileEscape(
              user?.username || 'ผู้ใช้งาน'
            )}
          </div>

          <div
            style="
              color:var(--muted);
              font-size:13px;
              margin-bottom:10px;
            "
          >
            ${userProfileEscape(
              user?.email || ''
            )}
          </div>

          <span
            class="badge ${
              verified
                ? 'badge-green'
                : 'badge-blue'
            }"
          >
            ${
              verified
                ? '✓ ยืนยันตัวตนแล้ว'
                : 'ยังไม่ยืนยันตัวตน'
            }
          </span>
        </div>

        <button
          type="button"
          class="btn btn-secondary btn-sm"
          onclick="goPage('profile')"
        >
          ✏️ แก้ไขข้อมูล
        </button>
      </div>
    </div>

    <div
      class="card"
      style="
        padding:28px;
        margin-bottom:16px;
        text-align:center;
      "
    >
      <div
        style="
          color:var(--muted);
          font-size:14px;
          font-weight:600;
          margin-bottom:8px;
        "
      >
        รายการซื้อสำเร็จ
      </div>

      <div
        class="kanit"
        style="
          font-size:34px;
          font-weight:800;
          color:var(--accent);
          line-height:1;
        "
      >
        ${Number(
          completedPurchases || 0
        ).toLocaleString('th-TH')}
      </div>
    </div>
  `;
}

async function loadUserProfile() {
  const target =
    document.getElementById(
      'userProfileContent'
    );

  if (!target) return;

  renderUserProfileLoading();

  const user =
    typeof currentUser !== 'undefined'
      ? currentUser
      : window.currentUser;

  if (!user?.id) {
    target.innerHTML = `
      <div class="notice danger">
        ไม่พบข้อมูลผู้ใช้งาน
      </div>
    `;
    return;
  }

  try {
    const response =
      await fetch(
        '/api/v1/orders',
        {
          credentials: 'include',
        }
      );

    const body =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.error?.message ||
        'โหลดข้อมูลโปรไฟล์ไม่สำเร็จ'
      );
    }

    const orders =
      body.data?.orders ||
      body.orders ||
      [];

    const completedPurchases =
      (
        Array.isArray(orders)
          ? orders
          : []
      ).filter((order) => {
        const isBuyer =
          Number(order.buyerId) ===
          Number(user.id);

        const status =
          String(
            order.status || ''
          ).toUpperCase();

        return (
          isBuyer &&
          (
            status === 'COMPLETED' ||
            status === 'PAID'
          )
        );
      }).length;

    renderUserProfileOverview(
      user,
      completedPurchases
    );

  } catch (error) {
    console.error(
      'loadUserProfile failed:',
      error
    );

    target.innerHTML = `
      <div class="notice danger">
        ${userProfileEscape(
          error.message ||
          'โหลดข้อมูลโปรไฟล์ไม่สำเร็จ'
        )}
      </div>
    `;
  }
}

window.loadUserProfile =
  loadUserProfile;
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
    const [
    ordersResponse,
    walletResponse,
    ] = await Promise.all([
    fetch(
        '/api/v1/orders',
        {
        credentials: 'include',
        }
    ),
    fetch(
        '/api/v1/wallet',
        {
        credentials: 'include',
        }
    ),
    ]);

    const ordersBody =
    await ordersResponse
        .json()
        .catch(() => ({}));

    const walletBody =
    await walletResponse
        .json()
        .catch(() => ({}));

    if (!ordersResponse.ok) {
    throw new Error(
        ordersBody.error?.message ||
        'โหลดข้อมูลคำสั่งซื้อไม่สำเร็จ'
    );
    }

    if (!walletResponse.ok) {
    throw new Error(
        walletBody.error?.message ||
        'โหลดข้อมูลกระเป๋าไม่สำเร็จ'
    );
    }

    const orders =
    ordersBody.data?.orders ||
    ordersBody.orders ||
    [];

    const wallet =
    walletBody.data?.wallet ||
    walletBody.data ||
    walletBody.wallet ||
    {};

    const walletTransactions =
    Array.isArray(wallet.transactions)
        ? wallet.transactions
        : [];

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

function userProfileActivityTime(value) {
  if (!value) return 0;

  const time =
    new Date(value).getTime();

  return Number.isNaN(time)
    ? 0
    : time;
}

function userProfileActivityDate(value) {
  if (!value) return '-';

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString(
    'th-TH',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  );
}

function buildUserProfileActivities(
  orders,
  walletTransactions,
  userId
) {
  const activities = [];

  (
    Array.isArray(orders)
      ? orders
      : []
  ).forEach((order) => {
    const isBuyer =
      Number(order.buyerId) ===
      Number(userId);

    const status =
      String(
        order.status || ''
      ).toUpperCase();

    if (
      isBuyer &&
      (
        status === 'COMPLETED' ||
        status === 'PAID'
      )
    ) {
      const occurredAt =
        order.completedAt ||
        order.updatedAt ||
        order.createdAt;

      activities.push({
        type: 'PURCHASE',
        icon: '🛒',
        title: 'ซื้อสินค้าสำเร็จ',
        detail:
          order.product?.title ||
          'สินค้า',
        occurredAt,
      });
    }
  });

  (
    Array.isArray(walletTransactions)
      ? walletTransactions
      : []
  ).forEach((transaction) => {
    const type =
      String(
        transaction.type || ''
      ).toUpperCase();

    const occurredAt =
      transaction.createdAt;

    if (type === 'TOP_UP') {
      activities.push({
        type,
        icon: '💰',
        title: 'ฝากพ้อยท์',
        detail:
          `+${Number(
            transaction.amount || 0
          ).toLocaleString('th-TH')} pts`,
        occurredAt,
      });
    }

    if (type === 'WITHDRAWAL') {
      activities.push({
        type,
        icon: '📤',
        title: 'ถอนพ้อยท์',
        detail:
          `-${Math.abs(
            Number(
              transaction.amount || 0
            )
          ).toLocaleString('th-TH')} pts`,
        occurredAt,
      });
    }

    if (type === 'REFUND') {
      activities.push({
        type,
        icon: '↩️',
        title: 'คืนพ้อยท์',
        detail:
          `+${Math.abs(
            Number(
              transaction.amount || 0
            )
          ).toLocaleString('th-TH')} pts`,
        occurredAt,
      });
    }
  });

  return activities
    .sort(
      (a, b) =>
        userProfileActivityTime(
          b.occurredAt
        ) -
        userProfileActivityTime(
          a.occurredAt
        )
    )
    .slice(0, 5);
}
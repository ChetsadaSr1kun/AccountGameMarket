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
  user
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
        padding:26px;
        margin-bottom:16px;
      "
    >
      <div
        style="
          font-family:'Kanit',sans-serif;
          font-size:18px;
          font-weight:800;
          margin-bottom:22px;
        "
      >
        👤 ข้อมูลส่วนตัว
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(2,minmax(0,1fr));
          gap:20px 32px;
        "
      >
        <div>
          <div
            style="
              color:var(--muted);
              font-size:12px;
              margin-bottom:5px;
            "
          >
            ชื่อจริง
          </div>

          <div style="font-weight:700">
            ${userProfileEscape(
              user?.firstName || 'ยังไม่ได้ระบุ'
            )}
          </div>
        </div>

        <div>
          <div
            style="
              color:var(--muted);
              font-size:12px;
              margin-bottom:5px;
            "
          >
            นามสกุล
          </div>

          <div style="font-weight:700">
            ${userProfileEscape(
              user?.lastName || 'ยังไม่ได้ระบุ'
            )}
          </div>
        </div>

        <div>
          <div
            style="
              color:var(--muted);
              font-size:12px;
              margin-bottom:5px;
            "
          >
            อีเมล
          </div>

          <div style="font-weight:700">
            ${userProfileEscape(
              user?.email || '-'
            )}
          </div>
        </div>

        <div>
          <div
            style="
              color:var(--muted);
              font-size:12px;
              margin-bottom:5px;
            "
          >
            เบอร์โทรศัพท์
          </div>

          <div style="font-weight:700">
            ${userProfileEscape(
              user?.phone || 'ยังไม่ได้ระบุ'
            )}
          </div>
        </div>

        <div>
          <div
            style="
              color:var(--muted);
              font-size:12px;
              margin-bottom:5px;
            "
          >
            วันเกิด
          </div>

          <div style="font-weight:700">
            ${
              user?.dateOfBirth
                ? new Date(
                    user.dateOfBirth
                  ).toLocaleDateString(
                    'th-TH'
                  )
                : 'ยังไม่ได้ระบุ'
            }
          </div>
        </div>

        <div>
          <div
            style="
              color:var(--muted);
              font-size:12px;
              margin-bottom:5px;
            "
          >
            สถานะบัญชี
          </div>

          <div style="font-weight:700">
            ${
              verified
                ? '✓ ยืนยันตัวตนแล้ว'
                : 'ยังไม่ยืนยันตัวตน'
            }
          </div>
        </div>
      </div>
    </div>

  `;
}

function renderUserProfileSellerStats(
  sellerProfile
) {
  const target =
    document.getElementById(
      'userProfileContent'
    );

  if (!target || !sellerProfile) return;

  const rating =
    sellerProfile.rating || {};

  const averageRating =
    Number(
      rating.averageRating || 0
    );

  const reviewCount =
    Number(
      rating.reviewCount || 0
    );

  const completedSales =
    Number(
      sellerProfile.completedSales || 0
    );

  target.insertAdjacentHTML(
    'beforeend',
    `
      <div
        class="card"
        style="
          padding:26px;
          margin-bottom:16px;
        "
      >
        <div
          style="
            font-family:'Kanit',sans-serif;
            font-size:18px;
            font-weight:800;
            margin-bottom:20px;
          "
        >
          🏪 ภาพรวมผู้ขาย
        </div>

        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(3,minmax(0,1fr));
            gap:14px;
          "
        >
          <div
            style="
              padding:20px;
              background:var(--bg3);
              border-radius:12px;
              text-align:center;
            "
          >
            <div
              style="
                color:var(--muted);
                font-size:12px;
                margin-bottom:8px;
              "
            >
              ⭐ คะแนนผู้ขาย
            </div>

            <div
              class="kanit"
              style="
                font-size:26px;
                font-weight:800;
              "
            >
              ${averageRating.toFixed(1)}
            </div>

            <div
              style="
                color:var(--muted);
                font-size:12px;
                margin-top:4px;
              "
            >
              จาก 5 คะแนน
            </div>
          </div>

          <div
            style="
              padding:20px;
              background:var(--bg3);
              border-radius:12px;
              text-align:center;
            "
          >
            <div
              style="
                color:var(--muted);
                font-size:12px;
                margin-bottom:8px;
              "
            >
              ✅ ขายสำเร็จ
            </div>

            <div
              class="kanit"
              style="
                font-size:26px;
                font-weight:800;
              "
            >
              ${completedSales.toLocaleString(
                'th-TH'
              )}
            </div>

            <div
              style="
                color:var(--muted);
                font-size:12px;
                margin-top:4px;
              "
            >
              รายการ
            </div>
          </div>

          <div
            style="
              padding:20px;
              background:var(--bg3);
              border-radius:12px;
              text-align:center;
            "
          >
            <div
              style="
                color:var(--muted);
                font-size:12px;
                margin-bottom:8px;
              "
            >
              💬 รีวิวทั้งหมด
            </div>

            <div
              class="kanit"
              style="
                font-size:26px;
                font-weight:800;
              "
            >
              ${reviewCount.toLocaleString(
                'th-TH'
              )}
            </div>

            <div
              style="
                color:var(--muted);
                font-size:12px;
                margin-top:4px;
              "
            >
              รีวิว
            </div>
          </div>
        </div>
      </div>
    `
  );
}

function renderUserProfileSellerCta(
  user
) {
  const target =
    document.getElementById(
      'userProfileContent'
    );

  if (!target) return;

  const roles =
    Array.isArray(user?.roles)
      ? user.roles
      : [];

  const isSeller =
    roles.includes('SELLER');

  if (isSeller) return;

  target.insertAdjacentHTML(
    'beforeend',
    `
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
            justify-content:space-between;
            gap:20px;
            flex-wrap:wrap;
          "
        >
          <div>
            <div
              style="
                font-family:'Kanit',sans-serif;
                font-size:18px;
                font-weight:800;
                margin-bottom:6px;
              "
            >
              🏪 เริ่มขายบน GameMarket
            </div>

            <div
              style="
                color:var(--muted);
                font-size:13px;
              "
            >
              สมัครเป็นผู้ขายเพื่อเริ่มลงสินค้า
            </div>
          </div>

          <button
            type="button"
            class="btn btn-primary btn-sm"
            onclick="goPage('seller-verify')"
          >
            สมัครเป็นผู้ขาย
          </button>
        </div>
      </div>
    `
  );
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

  const roles =
  Array.isArray(user?.roles)
    ? user.roles
    : [];

    const isSeller =
    roles.includes('SELLER');

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
    walletBody.wallet ||
    {};

    const walletTransactions =
    Array.isArray(wallet.transactions)
        ? wallet.transactions
        : [];

    let sellerProfile = null;

    if (isSeller) {
    const sellerResponse =
        await fetch(
        `/api/v1/sellers/${user.id}`,
        {
            credentials: 'include',
        }
        );

    const sellerBody =
        await sellerResponse
        .json()
        .catch(() => ({}));

    if (!sellerResponse.ok) {
        throw new Error(
        sellerBody.error?.message ||
        'โหลดข้อมูลผู้ขายไม่สำเร็จ'
        );
    }

    sellerProfile =
        sellerBody.data || null;
    }

    renderUserProfileOverview(
    user
    );

    renderUserProfileSellerStats(
    sellerProfile
    );

    const activities =
    buildUserProfileActivities(
        orders,
        walletTransactions,
        user.id
    );

    renderUserProfileActivities(
    activities
    );

    renderUserProfileSellerCta(
    user
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
    status === 'COMPLETED'
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

    const amount =
        Math.abs(
        Number(
            transaction.amount || 0
        )
        ).toLocaleString('th-TH');

    if (type === 'TOP_UP') {
        activities.push({
        type,
        icon: '💰',
        title: 'ฝากพ้อยท์',
        detail: `+${amount} pts`,
        occurredAt,
        });
    }

    if (type === 'WITHDRAWAL') {
        activities.push({
        type,
        icon: '📤',
        title: 'ถอนพ้อยท์',
        detail: `-${amount} pts`,
        occurredAt,
        });
    }

    if (type === 'REFUND') {
        activities.push({
        type,
        icon: '↩️',
        title: 'คืนพ้อยท์',
        detail: `+${amount} pts`,
        occurredAt,
        });
    }

    if (type === 'SALE') {
        activities.push({
        type,
        icon: '💵',
        title: 'รายได้จากการขาย',
        detail: `+${amount} pts`,
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

function renderUserProfileActivities(
  activities
) {
  const target =
    document.getElementById(
      'userProfileContent'
    );

  if (!target) return;

  const items =
    Array.isArray(activities)
      ? activities
      : [];

  const listHtml =
    items.length
      ? items.map((activity) => `
          <div
            style="
              display:flex;
              align-items:center;
              gap:14px;
              padding:14px 0;
              border-bottom:
                1px solid var(--border);
            "
          >
            <div
              style="
                width:38px;
                height:38px;
                border-radius:10px;
                background:var(--bg3);
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:18px;
                flex-shrink:0;
              "
            >
              ${activity.icon}
            </div>

            <div
              style="
                flex:1;
                min-width:0;
              "
            >
              <div
                style="
                  font-weight:700;
                  margin-bottom:3px;
                "
              >
                ${userProfileEscape(
                  activity.title
                )}
              </div>

              <div
                style="
                  color:var(--muted);
                  font-size:13px;
                "
              >
                ${userProfileEscape(
                  activity.detail
                )}
              </div>
            </div>

            <div
              style="
                color:var(--muted);
                font-size:12px;
                white-space:nowrap;
              "
            >
              ${userProfileEscape(
                userProfileActivityDate(
                  activity.occurredAt
                )
              )}
            </div>
          </div>
        `).join('')
      : `
        <div
          style="
            padding:24px 0;
            text-align:center;
            color:var(--muted);
          "
        >
          ยังไม่มีกิจกรรมล่าสุด
        </div>
      `;

  target.insertAdjacentHTML(
    'beforeend',
    `
      <div
        class="card"
        style="
          padding:24px;
          margin-bottom:16px;
        "
      >
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:16px;
            margin-bottom:8px;
          "
        >
          <div
            style="
              font-family:'Kanit',sans-serif;
              font-size:18px;
              font-weight:800;
            "
          >
            🧾 กิจกรรมล่าสุด
          </div>
        </div>

        <div>
          ${listHtml}
        </div>

        <div
          style="
            text-align:right;
            margin-top:16px;
          "
        >
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onclick="goPage('history')"
          >
            ดูประวัติทั้งหมด →
          </button>
        </div>
      </div>
    `
  );
}
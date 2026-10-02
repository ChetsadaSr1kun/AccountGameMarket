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
    const ordersResponse =
        await fetch(
            '/api/v1/orders',
            {
            credentials: 'include',
            }
        );

    const ordersBody =
    await ordersResponse
        .json()
        .catch(() => ({}));

    if (!ordersResponse.ok) {
    throw new Error(
        ordersBody.error?.message ||
        'โหลดข้อมูลคำสั่งซื้อไม่สำเร็จ'
    );
    }

    const orders =
    ordersBody.data?.orders ||
    ordersBody.orders ||
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
        status === 'COMPLETED'
        );
      }).length;

    renderUserProfileOverview(
      user,
      completedPurchases
    );

    const activities =
    buildUserProfileActivities(
        orders,
        user.id
    );

    renderUserProfileActivities(
    activities
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
            🧾 กิจกรรมของฉัน
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
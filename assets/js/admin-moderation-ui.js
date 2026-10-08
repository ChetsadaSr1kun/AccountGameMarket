(() => {
  let users = [];

  const esc = value =>
    String(value ?? '')
      .replace(
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
    document.cookie
      .match(
        /(?:^|; )gm_csrf=([^;]+)/
      )?.[1];


  const render = () => {
    const box =
      document.getElementById(
        'adminSuspendedList'
      );

    const query =
      (
        document.getElementById(
          'adminSuspendedSearch'
        )?.value || ''
      )
        .trim()
        .toLowerCase();

    if (!box) return;

    const rows =
      users.filter(user => {
        if (!query) return true;

        return (
          `${user.username} ${user.email}`
            .toLowerCase()
            .includes(query)
        );
      });

    if (!rows.length) {
      box.innerHTML = `
        <div class="report-empty">
          ไม่มีบัญชีที่ถูกแบน
        </div>
      `;

      return;
    }

    box.innerHTML =
      rows.map(user => `
        <div
          class="card"
          style="padding:16px"
        >
          <div
            class="flex-between"
            style="
              gap:12px;
              flex-wrap:wrap;
            "
          >

            <div>
              <strong>
                ${esc(user.username)}
              </strong>

              <span class="badge badge-red">
                แบนถาวร
              </span>

              <div
                style="
                  font-size:12px;
                  color:var(--muted);
                  margin-top:5px;
                "
              >
                ${esc(user.email)}
                •
                ${esc(user.accountMode)}
              </div>

              <div
                style="
                  font-size:13px;
                  margin-top:8px;
                "
              >
                เหตุผล:
                ${esc(
                  user.suspensionReason ||
                  'ไม่ระบุเหตุผล'
                )}
              </div>
            </div>

            <div class="flex gap-8">

              <button
                class="btn btn-success btn-sm"
                type="button"
                onclick="
                  adminUnbanUser(
                    ${Number(user.id)}
                  )
                "
              >
                ✓ ปลดแบน
              </button>

            </div>

          </div>
        </div>
      `).join('');
  };


  window.adminLoadSuspendedUsers =
    async () => {

      const box =
        document.getElementById(
          'adminSuspendedList'
        );

      if (box) {
        box.innerHTML = `
          <div class="report-empty">
            กำลังโหลด...
          </div>
        `;
      }

      try {
        const response = await fetch(
          '/api/v1/admin/moderation/suspended',
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
            'โหลดไม่สำเร็จ'
          );
        }

        users =
          body.data?.users || [];

        const count =
          document.getElementById(
            'adminSuspendedCount'
          );

        if (count) {
          count.textContent =
            users.length.toLocaleString(
              'th-TH'
            );
        }

        render();

      } catch (error) {
        if (box) {
          box.innerHTML = `
            <div class="notice danger">
              ${esc(error.message)}
            </div>
          `;
        }
      }
    };


  window.adminFilterSuspendedUsers =
    render;


  window.adminUnbanUser =
    async userId => {

      const confirmed = confirm(
        'ยืนยันปลดแบนบัญชีนี้หรือไม่?'
      );

      if (!confirmed) return;

      try {
        const response = await fetch(
          `/api/v1/admin/moderation/users/${Number(userId)}/status`,
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
              status: 'ACTIVE',
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
            'ปลดแบนไม่สำเร็จ'
          );
        }

        await window
          .adminLoadSuspendedUsers();

        if (
          typeof showToast ===
          'function'
        ) {
          showToast(
            'ปลดแบนบัญชีแล้ว',
            'success'
          );
        }

      } catch (error) {
        alert(
          error.message ||
          'ปลดแบนไม่สำเร็จ'
        );
      }
    };
})();
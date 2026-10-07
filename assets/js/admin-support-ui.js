(function () {
  let supportConversations = [];
    let activeSupportConversationId = null;

    let adminSupportPollingTimer = null;
    let adminSupportPollingBusy = false;

  const escapeHtml = (value) =>
    String(value ?? '').replace(
      /[&<>'"]/g,
      (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      }[char])
    );


  function formatSupportTime(value) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString(
      'th-TH',
      {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  }


  function renderAdminSupportShell() {
    const root =
      document.getElementById(
        'adminSupportApp'
      );

    if (!root) return;

    root.innerHTML = `
      <div class="admin-support-layout">

        <aside class="admin-support-inbox">

          <div class="admin-support-search">
            <input
              id="adminSupportSearch"
              class="inp"
              placeholder="ค้นหาผู้ใช้..."
              oninput="window.filterAdminSupport()"
            >
          </div>

          <div
            id="adminSupportConversationList"
            class="admin-support-conversation-list"
          ></div>

        </aside>

        <section class="admin-support-chat">

          <div
            id="adminSupportChatEmpty"
            class="admin-support-empty"
          >
            <div class="admin-support-empty-icon">
              GM
            </div>

            <strong>
              GameMarket Support
            </strong>

            <span>
              เลือกผู้ใช้จากรายการด้านซ้าย
              เพื่อดูข้อความ
            </span>
          </div>

          <div
            id="adminSupportChatContent"
            class="admin-support-chat-content"
            hidden
            ></div>

        </section>

      </div>
    `;
  }


  function renderAdminSupportList() {
    const list =
      document.getElementById(
        'adminSupportConversationList'
      );

    if (!list) return;

    const query =
      String(
        document.getElementById(
          'adminSupportSearch'
        )?.value || ''
      )
        .trim()
        .toLowerCase();

    const rows =
      supportConversations.filter(
        (conversation) =>
          String(
            conversation.userUsername ||
            ''
          )
            .toLowerCase()
            .includes(query)
      );

    if (!rows.length) {
      list.innerHTML = `
        <div class="admin-support-list-empty">
          ไม่พบข้อความจากผู้ใช้
        </div>
      `;

      return;
    }

    list.innerHTML =
      rows.map((conversation) => {
        const username =
          conversation.userUsername ||
          'ผู้ใช้';

        const initial =
          username
            .charAt(0)
            .toUpperCase();

        const unreadCount =
          Number(
            conversation.unreadCount ||
            0
          );

        return `
          <button
            type="button"
            class="
                admin-support-conversation
                ${
                    Number(conversation.id) ===
                    Number(activeSupportConversationId)
                    ? 'active'
                    : ''
                }
                "
            onclick="
              window.openAdminSupportConversation?.(
                ${Number(conversation.id)}
              )
            "
          >
            <span
              class="admin-support-user-avatar"
            >
              ${escapeHtml(initial)}
            </span>

            <span
              class="admin-support-conversation-body"
            >
              <span
                class="admin-support-conversation-top"
              >
                <strong>
                  ${escapeHtml(username)}
                </strong>

                <small>
                  ${escapeHtml(
                    formatSupportTime(
                      conversation.lastMessageAt
                    )
                  )}
                </small>
              </span>

              <span
                class="admin-support-preview"
              >
                ${escapeHtml(
                  conversation.lastMessage ||
                  'ยังไม่มีข้อความ'
                )}
              </span>
            </span>

            ${
              unreadCount > 0
                ? `
                  <span
                    class="admin-support-unread"
                  >
                    ${
                      unreadCount > 99
                        ? '99+'
                        : unreadCount
                    }
                  </span>
                `
                : ''
            }
          </button>
        `;
      }).join('');
  }

  function updateAdminSupportSidebarBadge(
    conversations = []
    ) {
    const unreadCount =
        conversations.reduce(
        (total, conversation) =>
            total +
            Number(
            conversation.unreadCount || 0
            ),
        0
        );

    document
        .querySelectorAll(
        '[data-admin-nav-badge="support"]'
        )
        .forEach((badge) => {
        badge.textContent =
            unreadCount > 99
            ? '99+'
            : unreadCount.toLocaleString(
                'th-TH'
                );

        badge.hidden =
            unreadCount <= 0;
        });
    }


    async function loadAdminSupportSidebarCount() {
    try {
        const response =
        await fetch(
            '/api/v1/support-chat/admin',
            {
            credentials: 'include',
            }
        );

        const body =
        await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
        return;
        }

        const conversations =
        body.data?.conversations || [];

        updateAdminSupportSidebarBadge(
        conversations
        );

    } catch (error) {
        console.error(
        'loadAdminSupportSidebarCount failed:',
        error
        );
    }
    }


  async function loadAdminSupport() {
    activeSupportConversationId = null;

    renderAdminSupportShell();

    const list =
      document.getElementById(
        'adminSupportConversationList'
      );

    if (!list) return;

    list.innerHTML = `
      <div class="admin-support-list-empty">
        กำลังโหลดข้อความ...
      </div>
    `;

    try {
      const response =
        await fetch(
          '/api/v1/support-chat/admin',
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
          'ไม่สามารถโหลดข้อความได้'
        );
      }

      supportConversations =
        body.data?.conversations ||
        [];

        updateAdminSupportSidebarBadge(
        supportConversations
        );

        renderAdminSupportList();

    } catch (error) {
      list.innerHTML = `
        <div
          class="notice danger"
          style="margin:14px"
        >
          ${escapeHtml(error.message)}
        </div>
      `;
    }
  }

  async function openAdminSupportConversation(
    conversationId
    ) {
    const id =
        Number(conversationId);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return;
    }

    activeSupportConversationId = id;

    renderAdminSupportList();

    const empty =
        document.getElementById(
        'adminSupportChatEmpty'
        );

    const content =
        document.getElementById(
        'adminSupportChatContent'
        );

    if (!empty || !content) return;

    empty.hidden = true;
    content.hidden = false;

    content.innerHTML = `
        <div class="admin-support-chat-loading">
        กำลังโหลดข้อความ...
        </div>
    `;

    try {
        const response =
        await fetch(
            `/api/v1/support-chat/admin/${id}`,
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
            'ไม่สามารถโหลดการสนทนาได้'
        );
        }

        const conversation =
        body.data?.conversation;

        const messages =
        body.data?.messages || [];

        if (!conversation) {
        throw new Error(
            'ไม่พบข้อมูลการสนทนา'
        );
        }

        const username =
        conversation.userUsername ||
        'ผู้ใช้';

        const initial =
        username
            .charAt(0)
            .toUpperCase();

        /*
        * GET ห้องนี้จะ markAdminRead()
        * ที่ backend แล้ว
        * จึงเคลียร์ unread ฝั่ง UI ทันที
        */
        const row =
        supportConversations.find(
            (item) =>
            Number(item.id) === id
        );

        if (row) {
        row.unreadCount = 0;
        }

        updateAdminSupportSidebarBadge(
        supportConversations
        );

        renderAdminSupportList();

        content.innerHTML = `
        <div class="admin-support-chat-view">

            <div class="admin-support-chat-header">
            <span
                class="admin-support-user-avatar"
            >
                ${escapeHtml(initial)}
            </span>

            <div>
                <strong>
                ${escapeHtml(username)}
                </strong>

                <small>
                สมาชิก GameMarket
                </small>
            </div>
            </div>

            <div
            id="adminSupportMessages"
            class="admin-support-messages"
            >
            ${
                messages.length
                ? messages.map(
                    (message) => {
                        const fromUser =
                        Number(
                            message.senderId
                        ) ===
                        Number(
                            conversation.userId
                        );

                        return `
                        <div
                            class="
                            admin-support-message-row
                            ${
                                fromUser
                                ? 'user'
                                : 'admin'
                            }
                            "
                        >
                            <div
                            class="
                                admin-support-message
                                ${
                                fromUser
                                    ? 'user'
                                    : 'admin'
                                }
                            "
                            >
                            ${escapeHtml(
                                message.body
                            )}

                            <div
                                class="
                                admin-support-message-time
                                "
                            >
                                ${escapeHtml(
                                formatSupportTime(
                                    message.createdAt
                                )
                                )}
                            </div>
                            </div>
                        </div>
                        `;
                    }
                    ).join('')
                : `
                    <div
                    class="
                        admin-support-list-empty
                    "
                    >
                    ยังไม่มีข้อความ
                    </div>
                `
            }
            </div>

            <div class="admin-support-composer">
            <input
                id="adminSupportComposer"
                class="inp"
                placeholder="พิมพ์ข้อความตอบกลับ..."
                onkeydown="
                if (event.key === 'Enter') {
                    window.sendAdminSupportMessage?.()
                }
                "
            >

            <button
                type="button"
                class="btn btn-primary btn-md"
                onclick="window.sendAdminSupportMessage?.()"
            >
                ส่ง
            </button>
            </div>

        </div>
        `;


        const messagesBox =
        document.getElementById(
            'adminSupportMessages'
        );

        if (messagesBox) {
        messagesBox.scrollTop =
            messagesBox.scrollHeight;
        }

    } catch (error) {
        content.innerHTML = `
        <div
            class="notice danger"
            style="margin:16px"
        >
            ${escapeHtml(error.message)}
        </div>
        `;
    }
    }

    async function sendAdminSupportMessage() {
  const id =
    Number(
      activeSupportConversationId
    );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return;
  }

  const input =
    document.getElementById(
      'adminSupportComposer'
    );

  const body =
    input?.value.trim();

  if (!body) return;

  const csrfToken =
    typeof getCookieValue === 'function'
      ? getCookieValue('gm_csrf')
      : '';

  if (!csrfToken) {
    alert(
      'ไม่พบ CSRF Token กรุณารีเฟรชหน้า'
    );
    return;
  }

  try {
    const response =
      await fetch(
        `/api/v1/support-chat/admin/${id}/messages`,
        {
          method: 'POST',

          credentials: 'include',

          headers: {
            'Content-Type':
              'application/json',

            'X-CSRF-Token':
              csrfToken,
          },

          body:
            JSON.stringify({
              body,
            }),
        }
      );

    const result =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error?.message ||
        'ไม่สามารถส่งข้อความได้'
      );
    }

    input.value = '';

    await openAdminSupportConversation(
      id
    );

    /*
     * Refresh list so last message
     * and ordering are updated.
     */
    const listResponse =
      await fetch(
        '/api/v1/support-chat/admin',
        {
          credentials: 'include',
        }
      );

    const listBody =
      await listResponse
        .json()
        .catch(() => ({}));

    if (listResponse.ok) {
      supportConversations =
        listBody.data?.conversations ||
        [];

        updateAdminSupportSidebarBadge(
        supportConversations
        );

        renderAdminSupportList();
    }

  } catch (error) {
    alert(
      error.message ||
      'ไม่สามารถส่งข้อความได้'
    );
  }
}

async function pollAdminSupport() {
  if (adminSupportPollingBusy) {
    return;
  }

  adminSupportPollingBusy = true;

  try {
    const response =
      await fetch(
        '/api/v1/support-chat/admin',
        {
          credentials: 'include',
        }
      );

    const body =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      return;
    }

    const nextConversations =
      body.data?.conversations || [];

    const activeId =
      Number(
        activeSupportConversationId
      );

    const previousActive =
      supportConversations.find(
        (conversation) =>
          Number(conversation.id) ===
          activeId
      );

    const nextActive =
      nextConversations.find(
        (conversation) =>
          Number(conversation.id) ===
          activeId
      );

    const previousSignature =
      previousActive
        ? [
            previousActive.lastMessageAt,
            previousActive.lastMessage,
            previousActive.unreadCount,
          ].join('|')
        : '';

    const nextSignature =
      nextActive
        ? [
            nextActive.lastMessageAt,
            nextActive.lastMessage,
            nextActive.unreadCount,
          ].join('|')
        : '';

    const activeConversationChanged =
      activeId > 0 &&
      previousSignature !== nextSignature;

    supportConversations =
      nextConversations;

    updateAdminSupportSidebarBadge(
      supportConversations
    );

    const supportPage =
      document.getElementById(
        'pg-admin-support'
      );

    const supportPageActive =
      supportPage?.classList.contains(
        'active'
      );

    if (!supportPageActive) {
      return;
    }

    renderAdminSupportList();

    /*
     * Reload the open room only when
     * its latest message changed.
     */
    if (
      activeConversationChanged &&
      nextActive
    ) {
      const draft =
        document.getElementById(
          'adminSupportComposer'
        )?.value || '';

      await openAdminSupportConversation(
        activeId
      );

      const input =
        document.getElementById(
          'adminSupportComposer'
        );

      if (input && draft) {
        input.value = draft;
      }
    }

  } catch (error) {
    console.error(
      'pollAdminSupport failed:',
      error
    );

  } finally {
    adminSupportPollingBusy = false;
  }
}


function startAdminSupportPolling() {
  if (adminSupportPollingTimer) {
    return;
  }

  adminSupportPollingTimer =
    window.setInterval(
      () => {
        void pollAdminSupport();
      },
      15000
    );
}


function stopAdminSupportPolling() {
  if (!adminSupportPollingTimer) {
    return;
  }

  window.clearInterval(
    adminSupportPollingTimer
  );

  adminSupportPollingTimer = null;
  adminSupportPollingBusy = false;
}

  function filterAdminSupport() {
    renderAdminSupportList();
  }


  window.loadAdminSupport =
  loadAdminSupport;

  window.loadAdminSupportSidebarCount =
  loadAdminSupportSidebarCount;

    window.filterAdminSupport =
    filterAdminSupport;

    window.openAdminSupportConversation =
    openAdminSupportConversation;

  window.sendAdminSupportMessage =
  sendAdminSupportMessage;

  window.startAdminSupportPolling =
  startAdminSupportPolling;

window.stopAdminSupportPolling =
  stopAdminSupportPolling;

})();
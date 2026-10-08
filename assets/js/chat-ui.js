(function(){
  let conversations=[];
  let activeConversationId=null;
  let supportActive=false;
  let supportPollingTimer = null;
  let supportPollingBusy = false;
  let chatPollingBusy = false;
  let chatNavBadgePollingTimer = null;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));
  async function api(url,options={}){const r=await fetch(url,{credentials:'include',...options});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'เกิดข้อผิดพลาด');return b;}
  function csrf(){return typeof getCookieValue==='function'?getCookieValue('gm_csrf'):'';}
  function renderShell() {
    const root =
      document.getElementById('chatApp');

    if (!root) return;

    root.innerHTML = `
      <aside class="chat-sidebar">
        <div class="chat-search-wrap">
          <input
            id="chatSearch"
            class="inp"
            placeholder="ค้นหาแชท..."
            oninput="window.filterChats()"
          >
        </div>

        <div
          id="chatConversationList"
          class="chat-conversation-list"
        ></div>

        <button
          type="button"
          id="chatSupportEntry"
          class="chat-support-entry"
          onclick="window.openSupportChat?.()"
        >
          <span class="chat-support-avatar">
            GM
          </span>

          <span class="chat-support-info">
            <strong>
              GameMarket Support
            </strong>

            <small>
              ติดต่อผู้ดูแลระบบ
            </small>
          </span>

          <span
            id="chatSupportUnread"
            class="chat-support-unread"
            hidden
          >
            0
          </span>
        </button>
      </aside>

      <section
        class="chat-main"
      >
        <div id="chatHeader"></div>

        <div
          id="chatMessages"
          class="chat-messages"
        >
          <div
            style="
              margin:auto;
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:center;
              gap:10px;
              color:var(--muted);
              text-align:center
            "
          >
            <div
              id="chatEmptyAvatar"
              class="chat-support-avatar"
              style="
                width:64px;
                height:64px;
                flex:0 0 64px;
                overflow:hidden
              "
            >
              ?
            </div>

            <strong
              id="chatEmptyTitle"
              style="color:var(--text)"
            >
              Chat
            </strong>

            <span>
              เลือกผู้ใช้จากรายการด้านซ้าย
              เพื่อดูข้อความ
            </span>
          </div>
        </div>

        <div
          id="chatComposerWrap"
          class="chat-composer"
          hidden
        >
          <input
            id="chatComposer"
            class="inp"
            placeholder="พิมพ์ข้อความ..."
            onkeydown="
              if (event.key === 'Enter') {
                window.sendChatMessage()
              }
            "
          >

          <button
            class="btn btn-primary btn-md"
            onclick="window.sendChatMessage()"
          >
            ส่ง
          </button>
        </div>
      </section>
      `;
    }

  function setSupportMode(active) {
    supportActive =
      Boolean(active);

    const supportEntry =
      document.getElementById(
        'chatSupportEntry'
      );

    supportEntry?.classList.toggle(
      'active',
      supportActive
    );
  }

  async function refreshChatNavBadge() {
    const badge =
      document.getElementById(
        'chatNavUnread'
      );

    if (!badge) return;

    try {
      const result =
        await api(
          '/api/v1/chat/unread-count'
        );

      const count =
        Number(
          result.data?.count || 0
        );

      badge.textContent =
        count > 99
          ? '99+'
          : String(count);

      badge.hidden =
        count <= 0;

    } catch (error) {
      badge.hidden = true;

      console.error(
        'refreshChatNavBadge failed:',
        error
      );
    }
  }

  function startChatNavBadgePolling() {
    if (chatNavBadgePollingTimer) {
      return;
    }

    void refreshChatNavBadge();

    chatNavBadgePollingTimer =
      window.setInterval(
        () => {
          void refreshChatNavBadge();
        },
        15000
      );
  }


  function stopChatNavBadgePolling() {
    if (!chatNavBadgePollingTimer) {
      return;
    }

    window.clearInterval(
      chatNavBadgePollingTimer
    );

    chatNavBadgePollingTimer = null;
  }

  async function loadSupportUnread() {
    const badge =
      document.getElementById(
        'chatSupportUnread'
      );

    if (!badge) return;

    try {
      const result =
        await api(
          '/api/v1/support-chat/me/unread'
        );

      const count =
        Number(
          result.data?.unreadCount ||
          0
        );

      badge.textContent =
        count > 99
          ? '99+'
          : String(count);

      badge.hidden =
        count <= 0;

    } catch (error) {
      badge.hidden = true;
    }
  }


  async function openSupportChat() {
    setSupportMode(true);

    const composer =
      document.getElementById(
        'chatComposerWrap'
      );

    if (composer) {
      composer.hidden = false;
    }

    activeConversationId = null;

    renderList();

    const box =
      document.getElementById(
        'chatMessages'
      );

    const header =
      document.getElementById(
        'chatHeader'
      );

    if (!box || !header) return;

    header.innerHTML = `
      <div
        style="
          padding:13px 20px;
          border-bottom:1px solid var(--border);
          display:flex;
          align-items:center;
          gap:12px
        "
      >
        <div class="chat-support-avatar">
          GM
        </div>

        <div>
          <div style="font-weight:700">
            GameMarket Support
          </div>

          <div
            style="
              font-size:12px;
              color:var(--muted)
            "
          >
            ทีมผู้ดูแล GameMarket
          </div>
        </div>
      </div>
    `;

    box.innerHTML = `
      <div class="report-empty">
        กำลังโหลดข้อความ...
      </div>
    `;

    try {
      const result =
        await api(
          '/api/v1/support-chat/me'
        );

      const messages =
        result.data?.messages || [];

      box.innerHTML =
        messages.length
          ? messages.map(
              (message) => `
                <div
                  style="
                    display:flex;
                    gap:8px;
                    align-items:flex-end;
                    justify-content:${
                      Number(message.senderId) ===
                      Number(window.currentUserId)
                        ? 'flex-end'
                        : 'flex-start'
                    }
                  "
                >
                  <div
                    class="
                      chat-bubble
                      ${
                        Number(message.senderId) ===
                        Number(window.currentUserId)
                          ? 'me'
                          : 'them'
                      }
                    "
                  >
                    ${esc(message.body)}

                    <div
                      style="
                        font-size:11px;
                        color:var(--dim);
                        margin-top:4px;
                        text-align:right
                      "
                    >
                      ${
                        new Date(
                          message.createdAt
                        ).toLocaleString(
                          'th-TH',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )
                      }
                    </div>
                  </div>
                </div>
              `
            ).join('')
          : `
            <div class="report-empty">
              ยังไม่มีข้อความ
              เริ่มติดต่อผู้ดูแลได้เลย
            </div>
          `;

      box.scrollTop =
        box.scrollHeight;

      await loadSupportUnread();

    } catch (error) {
      box.innerHTML = `
        <div class="notice danger">
          ${esc(error.message)}
        </div>
      `;
    }
  }

  function renderList() {
    const list =
      document.getElementById(
        'chatConversationList'
      );

    if (!list) return;

    const query =
      (
        document.getElementById(
          'chatSearch'
        )?.value || ''
      ).toLowerCase();

    const rows =
      conversations.filter(
        (conversation) =>
          String(
            conversation.other_username ||
            ''
          )
            .toLowerCase()
            .includes(query)
      );

    list.innerHTML =
      rows.length
        ? rows
            .map((conversation) => {
              const unreadCount =
                Number(
                  conversation.unread_count ||
                  0
                );

              const isActive =
                Number(conversation.id) ===
                Number(
                  activeConversationId
                );

              return `
                <div
                  data-chat-id="${Number(
                    conversation.id
                  )}"
                  onclick="window.openChat(${Number(
                    conversation.id
                  )})"
                  style="
                    padding:12px 16px;
                    display:flex;
                    gap:10px;
                    align-items:center;
                    cursor:pointer;
                    border-left:3px solid ${
                      isActive
                        ? 'var(--accent)'
                        : 'transparent'
                    };
                    background:${
                      isActive
                        ? 'rgba(59,130,246,0.1)'
                        : 'transparent'
                    }
                  "
                >
                  <div
                    class="avatar"
                    style="
                      width:38px;
                      height:38px;
                      background:var(--accent);
                      font-size:16px
                    "
                  >
                    ${esc(
                      String(
                        conversation.other_username ||
                        '?'
                      )
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>

                  <div
                    style="
                      flex:1;
                      min-width:0
                    "
                  >
                    <div
                      style="
                        display:flex;
                        align-items:center;
                        gap:7px
                      "
                    >
                      <div
                        style="
                          font-weight:600;
                          font-size:14px;
                          min-width:0;
                          overflow:hidden;
                          text-overflow:ellipsis;
                          white-space:nowrap
                        "
                      >
                        ${esc(
                          conversation.other_username ||
                          'ผู้ใช้'
                        )}
                      </div>

                      ${
                        unreadCount > 0
                          ? `
                            <span
                              class="chat-support-unread"
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
                    </div>

                    <div
                      style="
                        font-size:12px;
                        color:var(--muted);
                        overflow:hidden;
                        text-overflow:ellipsis;
                        white-space:nowrap
                      "
                    >
                      ${esc(
                        conversation.last_message ||
                        'ยังไม่มีข้อความ'
                      )}
                    </div>
                  </div>
                </div>
              `;
            })
            .join('')
        : `
          <div
            class="report-empty"
            style="margin:14px"
          >
            ยังไม่มีการสนทนา
          </div>
        `;
  }
  async function openChat(id) {
    setSupportMode(false);

    const composer =
      document.getElementById(
        'chatComposerWrap'
      );

    if (composer) {
      composer.hidden = false;
    }

    activeConversationId =
      Number(id);

    renderList();

    const box =
      document.getElementById(
        'chatMessages'
      );

    const header =
      document.getElementById(
        'chatHeader'
      );

    if (!box || !header) return;

    box.innerHTML = `
      <div class="report-empty">
        กำลังโหลดข้อความ...
      </div>
    `;

    try {
      /*
      * GET ห้องนี้จะ mark read
      * ที่ backend ด้วย
      */
      const result =
        await api(
          '/api/v1/chat/' +
          activeConversationId
        );

      const conversation =
        result.data.conversation;

      const messages =
        result.data.messages || [];

      const otherUsername =
        conversation.buyer_username ===
        window.currentUserUsername
          ? conversation.seller_username
          : conversation.buyer_username;

      header.innerHTML = `
        <div
          style="
            padding:13px 20px;
            border-bottom:1px solid var(--border);
            display:flex;
            align-items:center;
            gap:12px
          "
        >
          <div
            class="avatar"
            style="
              width:38px;
              height:38px;
              background:var(--accent);
              font-size:16px
            "
          >
            ${esc(
              String(
                otherUsername || '?'
              )
                .charAt(0)
                .toUpperCase()
            )}
          </div>

          <div>
            <div style="font-weight:700">
              ${
                conversation.product_title
                  ? esc(
                      conversation.product_title +
                      ' • '
                    )
                  : ''
              }
              ${esc(
                conversation.buyer_username
              )}
              ↔
              ${esc(
                conversation.seller_username
              )}
            </div>

            <div
              style="
                font-size:12px;
                color:var(--muted)
              "
            >
              การสนทนา #${Number(
                conversation.id
              )}
            </div>
          </div>
        </div>
      `;

      box.innerHTML =
        messages.length
          ? messages
              .map(
                (message) => `
                  <div
                    style="
                      display:flex;
                      gap:8px;
                      align-items:flex-end;
                      justify-content:${
                        Number(
                          message.sender_id
                        ) ===
                        Number(
                          window.currentUserId
                        )
                          ? 'flex-end'
                          : 'flex-start'
                      }
                    "
                  >
                    <div
                      class="
                        chat-bubble
                        ${
                          Number(
                            message.sender_id
                          ) ===
                          Number(
                            window.currentUserId
                          )
                            ? 'me'
                            : 'them'
                        }
                      "
                    >
                      ${esc(
                        message.body
                      )}

                      <div
                        style="
                          font-size:11px;
                          color:var(--dim);
                          margin-top:4px;
                          text-align:right
                        "
                      >
                        ${
                          new Date(
                            message.created_at
                          ).toLocaleString(
                            'th-TH',
                            {
                              hour:
                                '2-digit',
                              minute:
                                '2-digit',
                            }
                          )
                        }
                      </div>
                    </div>
                  </div>
                `
              )
              .join('')
          : `
            <div class="report-empty">
              ยังไม่มีข้อความ
              เริ่มการสนทนาได้เลย
            </div>
          `;

      box.scrollTop =
        box.scrollHeight;

      /*
      * Backend mark ห้องนี้ว่าอ่านแล้วเรียบร้อย
      * โหลด conversation list ใหม่
      * เพื่อให้ unread badge หายทันที
      */
      const chatListResult =
        await api(
          '/api/v1/chat'
        );

      conversations =
        chatListResult.data
          ?.conversations || [];

      renderList();

      await window.refreshNotificationBadge?.();
      await window.refreshChatNavBadge?.();

    } catch (error) {
      box.innerHTML = `
        <div class="notice danger">
          ${esc(error.message)}
        </div>
      `;
    }
  }
  async function loadChats() {
    activeConversationId = null;
    supportActive = false;

    renderShell();

    try {
      const me =
        await api(
          '/api/v1/auth/me'
        );

      window.currentUserId =
        me.data?.user?.id;

      window.currentUserUsername =
        me.data?.user?.username;

      window.currentUserAvatarUrl =
      me.data?.user?.avatarUrl || null;

    const emptyAvatar =
      document.getElementById(
        'chatEmptyAvatar'
      );

    const emptyTitle =
      document.getElementById(
        'chatEmptyTitle'
      );

    const username =
      window.currentUserUsername ||
      'User';

    if (emptyAvatar) {
      if (
        typeof avatarContent ===
        'function'
      ) {
        emptyAvatar.innerHTML =
          avatarContent(
            username,
            window.currentUserAvatarUrl
          );
      } else {
        emptyAvatar.textContent =
          username
            .charAt(0)
            .toUpperCase();
      }
    }

    if (emptyTitle) {
      emptyTitle.textContent =
        `${username} Chat`;
    }

      const result =
        await api(
          '/api/v1/chat'
        );

      conversations =
        result.data?.conversations || [];

      renderList();

      const pendingConversationId =
        Number(
          window.pendingChatConversationId ||
          0
        );

      window.pendingChatConversationId =
        null;

      if (
        Number.isInteger(
          pendingConversationId
        ) &&
        pendingConversationId > 0
      ) {
        await openChat(
          pendingConversationId
        );
      }

      await loadSupportUnread();

    } catch (error) {
      const list =
        document.getElementById(
          'chatConversationList'
        );

      if (list) {
        list.innerHTML = `
          <div
            class="notice danger"
            style="margin:12px"
          >
            ${esc(error.message)}
          </div>
        `;
      }
    }
  }

  async function pollUserSupport() {
    if (supportPollingBusy) {
      return;
    }

    supportPollingBusy = true;

    try {
      const result =
        await api(
          '/api/v1/support-chat/me/unread'
        );

      const unreadCount =
        Number(
          result.data?.unreadCount ||
          0
        );

      const badge =
        document.getElementById(
          'chatSupportUnread'
        );

      if (badge) {
        badge.textContent =
          unreadCount > 99
            ? '99+'
            : String(unreadCount);

        badge.hidden =
          unreadCount <= 0;
      }

      /*
      * ถ้า User กำลังเปิดห้อง Support
      * และมีข้อความใหม่จาก Admin
      * ให้ reload ห้องอัตโนมัติ
      */
      if (
        supportActive &&
        unreadCount > 0
      ) {
        const draft =
          document.getElementById(
            'chatComposer'
          )?.value || '';

        await openSupportChat();

        const input =
          document.getElementById(
            'chatComposer'
          );

        if (input && draft) {
          input.value = draft;
        }
      }

    } catch (error) {
      console.error(
        'pollUserSupport failed:',
        error
      );

    } finally {
      supportPollingBusy = false;
    }
  }


  function startUserSupportPolling() {
    if (supportPollingTimer) {
      return;
    }

    supportPollingTimer =
      window.setInterval(
        () => {
          void pollUserSupport();
          void pollUserChats();
        },
        10000
      );
  }

  async function pollUserChats() {
    if (chatPollingBusy) {
      return;
    }

    chatPollingBusy = true;

    try {
      const result =
        await api(
          '/api/v1/chat'
        );

      const nextConversations =
        result.data?.conversations || [];

      const activeRow =
        nextConversations.find(
          (conversation) =>
            Number(conversation.id) ===
            Number(activeConversationId)
        );

      /*
      * แทน list ปัจจุบันด้วยข้อมูลล่าสุด
      *
      * Backend เรียงจาก last_message_at DESC
      * อยู่แล้ว ดังนั้นห้องที่มีข้อความล่าสุด
      * จะเด้งขึ้นบนสุดอัตโนมัติ
      */
      conversations =
        nextConversations;

      renderList();

      /*
      * ถ้ากำลังเปิด User Chat ห้องนี้อยู่
      * และมีข้อความใหม่เข้ามา
      * ให้ reload ข้อความในห้องทันที
      *
      * openChat() จะ mark read ให้อัตโนมัติ
      */
      if (
        !supportActive &&
        activeConversationId &&
        Number(
          activeRow?.unread_count || 0
        ) > 0
      ) {
        const draft =
          document.getElementById(
            'chatComposer'
          )?.value || '';

        await openChat(
          activeConversationId
        );

        const input =
          document.getElementById(
            'chatComposer'
          );

        /*
        * รักษาข้อความที่ User กำลังพิมพ์ไว้
        */
        if (input && draft) {
          input.value = draft;
        }
      }

    } catch (error) {
      console.error(
        'pollUserChats failed:',
        error
      );

    } finally {
      chatPollingBusy = false;
    }
  }


  function stopUserSupportPolling() {
    if (!supportPollingTimer) {
      return;
    }

    window.clearInterval(
      supportPollingTimer
    );

    supportPollingTimer = null;
    supportPollingBusy = false;
    chatPollingBusy = false;
  }

  async function sendChatMessage() {
    const input =
      document.getElementById(
        'chatComposer'
      );

    const body =
      input?.value.trim();

    if (!body) return;

    const token = csrf();

    if (!token) {
      alert(
        'ไม่พบ CSRF Token กรุณารีเฟรชหน้า'
      );
      return;
    }

    try {
      /*
      * GameMarket Support
      */
      if (supportActive) {
        await api(
          '/api/v1/support-chat/me/messages',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              'X-CSRF-Token':
                token,
            },

            body:
              JSON.stringify({
                body,
              }),
          }
        );

        input.value = '';

        await openSupportChat();

        return;
      }


      /*
      * Buyer / Seller Chat
      */
      if (!activeConversationId) {
        alert(
          'กรุณาเลือกการสนทนา'
        );
        return;
      }

      await api(
        '/api/v1/chat/' +
          activeConversationId +
          '/messages',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'X-CSRF-Token':
              token,
          },

          body:
            JSON.stringify({
              body,
            }),
        }
      );

      input.value = '';

      await openChat(
        activeConversationId
      );

      const result =
        await api('/api/v1/chat');

      conversations =
        result.data?.conversations ||
        [];

      renderList();

    } catch (error) {
      alert(
        error.message ||
        'ไม่สามารถส่งข้อความได้'
      );
    }
  }
  window.filterChats=renderList;
  window.openChat=openChat;
  window.openSupportChat=openSupportChat;
  window.sendChatMessage=sendChatMessage;
  window.loadChatPage=loadChats;
  window.refreshChatNavBadge =
    refreshChatNavBadge;

  window.startChatNavBadgePolling =
    startChatNavBadgePolling;

  window.stopChatNavBadgePolling =
    stopChatNavBadgePolling;

  window.startUserSupportPolling =
    startUserSupportPolling;

  window.stopUserSupportPolling =
    stopUserSupportPolling;

})();

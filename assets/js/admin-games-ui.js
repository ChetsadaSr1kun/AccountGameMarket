(() => {
  let games = [];
  let editingId = null;
  let selectedGameId = null;
  let previewObjectUrl = null;

  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) =>
        ({
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
    )?.[1];

  const msg = (text, ok = true) => {
    const element =
      document.getElementById(
        'adminGameMessage'
      );

    if (!element) return;

    element.textContent = text;
    element.style.display = 'block';
    element.className =
      `notice ${ok ? 'success' : 'danger'}`;
  };

  function clearPreviewObjectUrl() {
    if (!previewObjectUrl) return;

    URL.revokeObjectURL(
      previewObjectUrl
    );

    previewObjectUrl = null;
  }

  const render = () => {
    const query =
      (
        document.getElementById(
          'adminGameSearch'
        )?.value || ''
      )
        .trim()
        .toLowerCase();

    const status =
      document.getElementById(
        'adminGameStatusFilter'
      )?.value || 'ALL';

    const box =
      document.getElementById(
        'adminGameList'
      );

    if (!box) return;

    const rows = games.filter(
      (game) =>
        (
          status === 'ALL' ||
          game.status === status
        ) &&
        (
          !query ||
          `${game.name} ${game.slug || ''}`
            .toLowerCase()
            .includes(query)
        )
    );

    box.innerHTML = rows.length
      ? rows
          .map(
            (game) => `
              <div
                class="card"
                onclick="adminOpenGameProducts(${Number(game.id)})"
                title="คลิกเพื่อดูสินค้าที่กำลังขาย"
                style="
                  padding:16px;
                  display:flex;
                  gap:12px;
                  align-items:center;
                  cursor:pointer;
                  border:${
                    Number(selectedGameId) ===
                    Number(game.id)
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)'
                  };
                  box-shadow:${
                    Number(selectedGameId) ===
                    Number(game.id)
                      ? '0 0 0 3px var(--accentDim)'
                      : 'none'
                  };
                "
              >
                <div
                  style="
                    width:42px;
                    height:42px;
                    flex:0 0 42px;
                    border-radius:10px;
                    background:var(--surface);
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    overflow:hidden;
                  "
                >
                  ${
                    game.imageUrl
                      ? `
                        <img
                          src="${esc(game.imageUrl)}"
                          alt="${esc(game.name)}"
                          style="
                            width:100%;
                            height:100%;
                            object-fit:cover;
                            display:block;
                          "
                        >
                      `
                      : '<img class="ui-emoji" src="assets/icons/game.svg" alt="">'
                  }
                </div>

                <div style="flex:1;min-width:0">
                  <div style="font-weight:700">
                    ${esc(game.name)}

                    <span
                      class="badge ${
                        game.status === 'ACTIVE'
                          ? 'badge-green'
                          : 'badge-gray'
                      }"
                    >
                      ${
                        game.status === 'ACTIVE'
                          ? 'เปิดใช้งาน'
                          : 'ปิดใช้งาน'
                      }
                    </span>
                  </div>

                  <div
                    style="
                      font-size:12px;
                      color:var(--muted);
                    "
                  >
                    ${esc(game.slug || '')}
                    •
                    ${Number(
                      game.activeProductCount || 0
                    ).toLocaleString('th-TH')}
                    รายการกำลังขาย
                  </div>
                </div>

                <div class="flex gap-6">
                  <button
                    class="btn btn-secondary btn-sm"
                    onclick="event.stopPropagation(); adminEditGame(${Number(game.id)})"
                    title="แก้ไขเกม"
                  >
                    ✏️
                  </button>

                  ${
                    game.status === 'ACTIVE'
                      ? `
                        <button
                          class="btn btn-danger btn-sm"
                          onclick="event.stopPropagation(); adminDeactivateGame(${Number(game.id)})"
                        >
                          ปิดใช้งาน
                        </button>
                      `
                      : `
                        <button
                          class="btn btn-success btn-sm"
                          onclick="event.stopPropagation(); adminActivateGame(${Number(game.id)})"
                        >
                          เปิดใช้งาน
                        </button>
                      `
                  }

                </div>
              </div>
            `
          )
          .join('')
      : `
          <div
            class="report-empty"
            style="grid-column:1/-1"
          >
            ไม่พบเกมตามเงื่อนไข
          </div>
        `;
  };

  window.adminOpenGameProducts =
  async (id) => {
    const game =
      games.find(
        (item) =>
          Number(item.id) ===
          Number(id)
      );

    if (!game) {
      msg(
        'ไม่พบข้อมูลเกม',
        false
      );
      return;
    }

    selectedGameId =
      Number(game.id);

    render();

    const panel =
      document.getElementById(
        'adminGameProductsPanel'
      );

    const title =
      document.getElementById(
        'adminGameProductsTitle'
      );

    const subtitle =
      document.getElementById(
        'adminGameProductsSubtitle'
      );

    const list =
      document.getElementById(
        'adminGameProductsList'
      );

    if (
      !panel ||
      !title ||
      !subtitle ||
      !list
    ) {
      return;
    }

    panel.hidden = false;

    title.textContent =
      `📦 สินค้า ${game.name}`;

    subtitle.textContent =
      'กำลังโหลดสินค้าที่มีขายอยู่...';

    list.innerHTML = `
      <div
        class="report-empty"
        style="grid-column:1/-1"
      >
        กำลังโหลดสินค้า...
      </div>
    `;

    try {
      const response =
        await fetch(
          `/api/v1/products?gameId=${encodeURIComponent(
            game.id
          )}&pageSize=50&sort=newest`,
          {
            credentials:
              'include',
          }
        );

      const body =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          body.error?.message ||
            'โหลดสินค้าไม่สำเร็จ'
        );
      }

      const products =
        body.data?.items || [];

      const total =
        Number(
          body.data?.total ||
          products.length
        );

      subtitle.textContent =
        `สินค้าที่กำลังขายอยู่ ${total.toLocaleString(
          'th-TH'
        )} รายการ`;

      if (!products.length) {
        list.innerHTML = `
          <div
            class="report-empty"
            style="grid-column:1/-1"
          >
            ยังไม่มีสินค้าที่กำลังขายอยู่ในหมวดนี้
          </div>
        `;

        return;
      }

      list.innerHTML =
        products
          .map(
            (product) => `
              <div
                class="card"
                style="
                  padding:12px;
                  overflow:hidden;
                "
              >
                <div
                  style="
                    width:100%;
                    aspect-ratio:16/10;
                    border-radius:10px;
                    overflow:hidden;
                    background:var(--surface);
                    margin-bottom:10px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                  "
                >
                  ${
                    product.primaryImageUrl
                      ? `
                        <img
                          src="${esc(
                            product.primaryImageUrl
                          )}"
                          alt="${esc(
                            product.title
                          )}"
                          style="
                            width:100%;
                            height:100%;
                            object-fit:cover;
                            display:block;
                          "
                        >
                      `
                      : `
                        <span
                          style="
                            font-size:32px;
                            opacity:.7;
                          "
                        >
                          <img class="ui-emoji" src="assets/icons/game.svg" alt="">
                        </span>
                      `
                  }
                </div>

                <div
                  style="
                    font-weight:700;
                    font-size:14px;
                    margin-bottom:6px;
                    white-space:nowrap;
                    overflow:hidden;
                    text-overflow:ellipsis;
                  "
                  title="${esc(
                    product.title
                  )}"
                >
                  ${esc(product.title)}
                </div>

                <div
                  style="
                    font-size:12px;
                    color:var(--muted);
                    margin-bottom:10px;
                  "
                >
                  ผู้ขาย:
                  ${esc(
                    product.seller
                      ?.username ||
                      '-'
                  )}
                </div>

                <div
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:8px;
                  "
                >
                  <strong
                    style="
                      font-size:16px;
                      color:var(--accent);
                    "
                  >
                    ฿${Number(
                      product.price || 0
                    ).toLocaleString(
                      'th-TH',
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}
                  </strong>

                  <span
                    class="badge badge-green"
                  >
                    กำลังขาย
                  </span>
                </div>
              </div>
            `
          )
          .join('');
    } catch (error) {
      console.error(
        'adminOpenGameProducts failed:',
        error
      );

      subtitle.textContent =
        'ไม่สามารถโหลดสินค้าได้';

      list.innerHTML = `
        <div
          class="notice danger"
          style="grid-column:1/-1"
        >
          ${esc(
            error.message ||
              'โหลดสินค้าไม่สำเร็จ'
          )}
        </div>
      `;
    }
  };

window.adminCloseGameProducts =
  () => {
    selectedGameId = null;

    render();

    const panel =
      document.getElementById(
        'adminGameProductsPanel'
      );

    const list =
      document.getElementById(
        'adminGameProductsList'
      );

    if (panel) {
      panel.hidden = true;
    }

    if (list) {
      list.innerHTML = '';
    }
  };

  const openEditor = (game) => {
    editingId = game?.id || null;

    clearPreviewObjectUrl();

    const box =
      document.getElementById(
        'adminGameEditor'
      );

    if (!box) return;

    box.style.display = 'block';

    box.innerHTML = `
      <h4 style="margin:0 0 16px">
        ${game ? 'แก้ไขเกม' : 'เพิ่มเกม'}
      </h4>

      <div class="grid2">
        <div class="inp-group">
          <label class="inp-label">
            ชื่อเกม
          </label>

          <input
            id="adminGameName"
            class="inp"
            maxlength="100"
            value="${esc(game?.name || '')}"
            placeholder="เช่น Valorant"
          >
        </div>

        <div class="inp-group">
          <label class="inp-label">
            สถานะ
          </label>

          <select
            id="adminGameStatus"
            class="inp"
          >
            <option value="ACTIVE">
              เปิดใช้งาน
            </option>

            <option value="INACTIVE">
              ปิดใช้งาน
            </option>
          </select>
        </div>
      </div>

      <div class="inp-group">
        <label class="inp-label">
          รูปเกม
        </label>

        <input
          id="adminGameImageFile"
          class="inp"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onchange="adminPreviewGameImage(this)"
        >

        <div
          style="
            font-size:12px;
            color:var(--muted);
            margin-top:7px;
          "
        >
          รองรับ JPG, PNG และ WebP
        </div>

        <div
          id="adminGameImagePreview"
          style="
            margin-top:12px;
            min-height:${game?.imageUrl ? '84px' : '0'};
          "
        >
          ${
            game?.imageUrl
              ? `
                <img
                  src="${esc(game.imageUrl)}"
                  alt="${esc(game.name)}"
                  style="
                    width:84px;
                    height:84px;
                    object-fit:cover;
                    border-radius:14px;
                    border:1px solid var(--border);
                    display:block;
                  "
                >
              `
              : ''
          }
        </div>
      </div>

      <div
        class="flex gap-8"
        style="justify-content:flex-end"
      >
        <button
          class="btn btn-secondary btn-sm"
          onclick="adminCloseGameEditor()"
        >
          ยกเลิก
        </button>

        <button
          class="btn btn-primary btn-sm"
          onclick="adminSaveGame()"
        >
          💾 บันทึก
        </button>
      </div>
    `;

    if (game) {
      document.getElementById(
        'adminGameStatus'
      ).value = game.status;
    }
  };

  window.adminPreviewGameImage = (
    input
  ) => {
    const file = input?.files?.[0];

    const box =
      document.getElementById(
        'adminGameImagePreview'
      );

    if (!box) return;

    clearPreviewObjectUrl();

    if (!file) {
      box.innerHTML = '';
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      input.value = '';

      box.innerHTML = `
        <div class="notice danger">
          กรุณาเลือกไฟล์ JPG, PNG หรือ WebP
        </div>
      `;

      return;
    }

    const maxBytes =
      5 * 1024 * 1024;

    if (file.size > maxBytes) {
      input.value = '';

      box.innerHTML = `
        <div class="notice danger">
          รูปเกมต้องมีขนาดไม่เกิน 5 MB
        </div>
      `;

      return;
    }

    previewObjectUrl =
      URL.createObjectURL(file);

    box.innerHTML = `
      <img
        src="${previewObjectUrl}"
        alt="ตัวอย่างรูปเกม"
        style="
          width:84px;
          height:84px;
          object-fit:cover;
          border-radius:14px;
          border:1px solid var(--border);
          display:block;
        "
      >
    `;
  };

  window.adminLoadGames =
    async () => {
      const box =
        document.getElementById(
          'adminGameList'
        );

      if (box) {
        box.innerHTML = `
          <div
            class="report-empty"
            style="grid-column:1/-1"
          >
            กำลังโหลดข้อมูลเกม...
          </div>
        `;
      }

      try {
        const response =
          await fetch(
            '/api/v1/games/admin',
            {
              credentials:
                'include',
            }
          );

        const body =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            body.error?.message ||
              'โหลดเกมไม่สำเร็จ'
          );
        }

        games =
          body.data?.games || [];

        render();
      } catch (error) {
        if (box) {
          box.innerHTML = `
            <div
              class="notice danger"
              style="grid-column:1/-1"
            >
              ${esc(error.message)}
            </div>
          `;
        }
      }
    };

  window.adminOpenGameEditor =
    () => {
      openEditor();
    };

  window.adminCloseGameEditor =
    () => {
      editingId = null;

      clearPreviewObjectUrl();

      const element =
        document.getElementById(
          'adminGameEditor'
        );

      if (element) {
        element.style.display =
          'none';
      }
    };

  window.adminEditGame = (id) => {
    const game =
      games.find(
        (item) =>
          Number(item.id) ===
          Number(id)
      );

    if (game) {
      openEditor(game);
    }
  };

  window.adminFilterGames =
    render;

  window.adminSaveGame =
    async () => {
      const name =
        document
          .getElementById(
            'adminGameName'
          )
          ?.value.trim() || '';

      const status =
        document.getElementById(
          'adminGameStatus'
        )?.value || 'ACTIVE';

      const imageInput =
        document.getElementById(
          'adminGameImageFile'
        );

      const imageFile =
        imageInput?.files?.[0] ||
        null;

      const isCreating =
        !editingId;

      if (!name) {
        msg(
          'กรุณาระบุชื่อเกม',
          false
        );

        return;
      }

      /*
      * เกมใหม่ต้องมีรูป
      * ส่วนการแก้ไขเกมเดิม
      * สามารถไม่เลือกรูปใหม่ได้
      */
      if (
        isCreating &&
        !imageFile
      ) {
        msg(
          'กรุณาเลือกรูปเกม',
          false
        );

        return;
      }

      try {
        /*
        * ขั้นแรก:
        * บันทึกชื่อ + สถานะ
        */
        const saveResponse =
          await fetch(
            editingId
              ? `/api/v1/games/admin/${editingId}`
              : '/api/v1/games/admin',
            {
              method:
                editingId
                  ? 'PATCH'
                  : 'POST',

              credentials:
                'include',

              headers: {
                'Content-Type':
                  'application/json',

                'X-CSRF-Token':
                  csrf(),
              },

              body:
                JSON.stringify({
                  name,
                  status,
                }),
            }
          );

        const saveBody =
          await saveResponse
            .json()
            .catch(() => ({}));

        if (!saveResponse.ok) {
          msg(
            saveBody.error?.message ||
              'บันทึกข้อมูลเกมไม่สำเร็จ',
            false
          );

          return;
        }

        const savedGame =
          saveBody.data?.game;

        const gameId =
          editingId ||
          savedGame?.id;

        if (!gameId) {
          throw new Error(
            'ไม่พบ Game ID หลังจากบันทึกข้อมูล'
          );
        }

        /*
        * สำคัญ:
        * ถ้าเพิ่งสร้างเกมใหม่สำเร็จ
        * ให้เปลี่ยนเป็น edit mode ทันที
        *
        * หาก upload รูปล้มเหลวแล้ว
        * กดบันทึกซ้ำ จะไม่สร้างเกมซ้ำ
        */
        if (isCreating) {
          editingId =
            Number(gameId);
        }

        /*
        * ขั้นสอง:
        * ถ้ามีการเลือกรูป
        * ให้อัปโหลดรูป
        */
        if (imageFile) {
          const formData =
            new FormData();

          formData.append(
            'image',
            imageFile
          );

          const imageResponse =
            await fetch(
              `/api/v1/games/admin/${gameId}/image`,
              {
                method: 'POST',

                credentials:
                  'include',

                headers: {
                  /*
                  * ห้ามใส่ Content-Type เอง
                  * Browser จะสร้าง
                  * multipart boundary ให้
                  */
                  'X-CSRF-Token':
                    csrf(),
                },

                body:
                  formData,
              }
            );

          const imageBody =
            await imageResponse
              .json()
              .catch(() => ({}));

          if (!imageResponse.ok) {
            msg(
              imageBody.error?.message ||
                'บันทึกข้อมูลเกมแล้ว แต่อัปโหลดรูปไม่สำเร็จ',
              false
            );

            return;
          }
        }

        msg(
          isCreating
            ? 'เพิ่มเกมเรียบร้อยแล้ว'
            : 'บันทึกข้อมูลเกมแล้ว'
        );

        window.adminCloseGameEditor();

        await window.adminLoadGames();
      } catch (error) {
        console.error(
          'adminSaveGame failed:',
          error
        );

        msg(
          error.message ||
            'ไม่สามารถบันทึกข้อมูลเกมได้',
          false
        );
      }
    };

  const setStatus = async (
    id,
    status
  ) => {
    const confirmed =
      confirm(
        status === 'ACTIVE'
          ? 'เปิดใช้งานเกมนี้หรือไม่?'
          : 'ปิดใช้งานเกมนี้หรือไม่?'
      );

    if (!confirmed) return;

    try {
      const response =
        await fetch(
          `/api/v1/games/admin/${id}`,
          {
            method: 'PATCH',

            credentials:
              'include',

            headers: {
              'Content-Type':
                'application/json',

              'X-CSRF-Token':
                csrf(),
            },

            body:
              JSON.stringify({
                status,
              }),
          }
        );

      const body =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        msg(
          body.error?.message ||
            'เปลี่ยนสถานะไม่สำเร็จ',
          false
        );

        return;
      }

      await window.adminLoadGames();
    } catch (error) {
      console.error(
        'set game status failed:',
        error
      );

      msg(
        'ไม่สามารถเปลี่ยนสถานะเกมได้',
        false
      );
    }
  };

  window.adminActivateGame = (
    id
  ) =>
    setStatus(
      id,
      'ACTIVE'
    );

  window.adminDeactivateGame = (
    id
  ) =>
    setStatus(
      id,
      'INACTIVE'
    );

  window.adminInitGames = () =>
    window.adminLoadGames();
})();
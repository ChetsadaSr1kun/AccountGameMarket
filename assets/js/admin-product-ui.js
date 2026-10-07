(() => {
  let products = [];
  let currentProductDetail = null;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const csrf = () => window.csrfToken || document.cookie.match(/(?:^|; )gm_csrf=([^;]+)/)?.[1];
  const statusLabel = s => ({ACTIVE:'กำลังขาย',PAUSED:'ซ่อนสินค้า',SOLD:'ขายแล้ว',DRAFT:'ฉบับร่าง',CANCELLED:'ยกเลิก'}[s] || s);
  const statusClass = s => ({ACTIVE:'badge-green',PAUSED:'badge-yellow',SOLD:'badge-blue',DRAFT:'badge-gray',CANCELLED:'badge-red'}[s] || 'badge-gray');
  const orderStatusLabel = status => ({
  PENDING: 'รอดำเนินการ',
  PAID: 'ชำระเงินแล้ว',
  COMPLETED: 'เสร็จสิ้น',
  CANCELLED: 'ยกเลิก',
}[status] || status || '-');
  const formatProductDate = value => {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('th-TH');
};

  const render = () => {
    const box=document.getElementById('adminProductList'); if(!box)return;
    const q=(document.getElementById('adminProductSearch')?.value||'').toLowerCase(); const s=document.getElementById('adminProductStatus')?.value||'ALL'; const g=document.getElementById('adminProductGame')?.value||'ALL';
    const rows=products.filter(p=>(!q||`${p.title} ${p.sellerUsername} ${p.gameName}`.toLowerCase().includes(q))&&(s==='ALL'||p.status===s)&&(g==='ALL'||String(p.gameId)===g));
    const count=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=val;}; count('adminProductTotal',products.length);count('adminProductActive',products.filter(p=>p.status==='ACTIVE').length);count('adminProductPaused',products.filter(p=>p.status==='PAUSED').length);count('adminProductSold',products.filter(p=>p.status==='SOLD').length);
    box.innerHTML=rows.length?rows.map(p=>`<div class="card" style="padding:16px 18px"><div class="flex-between" style="gap:14px;flex-wrap:wrap"><div style="min-width:240px;flex:1"><div><strong>${esc(p.title)}</strong> <span class="badge ${statusClass(p.status)}">${statusLabel(p.status)}</span></div><div style="font-size:13px;color:var(--muted);margin-top:6px">🎮 ${esc(p.gameName)} • ผู้ขาย: ${esc(p.sellerUsername)}</div><div style="font-size:12px;color:var(--muted);margin-top:5px">${p.price.toLocaleString('th-TH')} ฿ • รูป ${p.imageCount} • Report ${p.reportCount}</div></div><div class="flex gap-8"><button class="btn btn-secondary btn-sm" onclick="adminOpenProduct(${p.id})">ดูรายละเอียด</button>${p.status==='ACTIVE'?`<button class="btn btn-warning btn-sm" onclick="adminModerateProduct(${p.id},'PAUSED')">ซ่อน</button>`:p.status==='PAUSED'?`<button class="btn btn-success btn-sm" onclick="adminModerateProduct(${p.id},'ACTIVE')">แสดง</button>`:''}</div></div></div>`).join(''):'<div class="report-empty">ไม่พบสินค้าตามเงื่อนไข</div>';
  };
  window.adminLoadProducts=async()=>{const box=document.getElementById('adminProductList');if(box)box.innerHTML='<div class="report-empty">กำลังโหลดสินค้า...</div>';try{const r=await fetch('/api/v1/admin/products',{credentials:'include'}),b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error?.message||'โหลดสินค้าไม่สำเร็จ');products=b.data?.products||[];buildGames();render();}catch(e){if(box)box.innerHTML=`<div class="notice danger">${esc(e.message)}</div>`;}};
  const buildGames=()=>{const sel=document.getElementById('adminProductGame');if(!sel)return;const values=[...new Map(products.map(p=>[p.gameId,p.gameName])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));sel.innerHTML='<option value="ALL">ทุกเกม</option>'+values.map(([id,n])=>`<option value="${id}">${esc(n)}</option>`).join('');};
  window.adminFilterProducts=render;
  window.adminOpenProduct = async id => {
  const modal =
    document.getElementById(
      'adminProductModal'
    );

  const body =
    document.getElementById(
      'adminProductModalBody'
    );

  if (!modal || !body) {
    return;
  }

  modal.hidden = false;

  body.innerHTML = `
    <div class="admin-user-product-loading">
      กำลังโหลดรายละเอียดสินค้า...
    </div>
  `;

  try {
    const response = await fetch(
      `/api/v1/admin/products/${id}`,
      {
        credentials: 'include',
      }
    );

    const result =
      await response.json().catch(
        () => ({})
      );

    if (!response.ok) {
      throw new Error(
        result.error?.message ||
        'โหลดรายละเอียดไม่สำเร็จ'
      );
    }

    const product =
      result.data?.product;

    if (!product) {
      throw new Error(
        'ไม่พบข้อมูลสินค้า'
      );
    }

    currentProductDetail = product;

    const images =
      Array.isArray(product.images)
        ? product.images
        : [];
    
    const order =
      product.order || null;

    const primaryImageIndex =
      Math.max(
        0,
        images.findIndex(
          image => image.isPrimary
        )
      );

    const primaryImage =
      images[primaryImageIndex] ||
      images[0] ||
      null;

    body.innerHTML = `
      <div class="admin-user-product-layout">

        <div class="admin-user-product-gallery">

          <div class="admin-user-product-main-image">

            ${
              primaryImage
                ? `
                  <img
                    id="adminUserProductMainImage"
                    src="${esc(primaryImage.imageUrl)}"
                    alt="${esc(product.title)}"
                  >
                `
                : `
                  <div class="admin-user-product-no-image">
                    <span>🎮</span>
                    <strong>ไม่มีรูปสินค้า</strong>
                  </div>
                `
            }

          </div>

          ${
            images.length > 1
              ? `
                <div class="admin-user-product-thumbs">

                  ${images.map(
                    (image, index) => `
                      <button
                        type="button"
                        class="
                          admin-user-product-thumb
                          ${
                            index === primaryImageIndex
                              ? 'is-active'
                              : ''
                          }
                        "
                        data-product-image-index="${index}"
                        onclick="
                          adminSelectProductImage(
                            ${index}
                          )
                        "
                      >
                        <img
                          src="${esc(image.imageUrl)}"
                          alt="รูปสินค้า ${index + 1}"
                        >
                      </button>
                    `
                  ).join('')}

                </div>
              `
              : ''
          }

        </div>


        <div class="admin-user-product-summary">

          <div class="admin-user-product-topline">

            <span class="admin-user-product-game">
              🎮 ${esc(
                product.gameName || '-'
              )}
            </span>

            <span
              class="
                badge
                ${statusClass(product.status)}
              "
            >
              ${esc(
                statusLabel(product.status)
              )}
            </span>

          </div>

          <h2 class="admin-user-product-name">
            ${esc(product.title || '-')}
          </h2>

          <div class="admin-user-product-price">
            ${Number(
              product.price || 0
            ).toLocaleString('th-TH')}
            <span>pts</span>
          </div>

          <div class="admin-user-product-summary-grid">

            <div>
              <span>ผู้ขาย</span>
              <strong>
                @${esc(
                  product.sellerUsername || '-'
                )}
              </strong>
            </div>

            <div>
              <span>รหัสสินค้า</span>
              <strong>
                #${Number(product.id)}
              </strong>
            </div>

            <div>
              <span>จำนวนรูป</span>
              <strong>
                ${images.length}
              </strong>
            </div>

            <div>
              <span>Report</span>
              <strong>
                ${Number(
                  product.reportCount || 0
                )} ครั้ง
              </strong>
            </div>

          </div>

        </div>

      </div>


      <div class="admin-user-product-section">

        <h3>
          รายละเอียดสินค้า
        </h3>

        <div class="admin-user-product-description">
          ${
            product.description
              ? esc(product.description)
              : 'ไม่มีรายละเอียดสินค้า'
          }
        </div>

      </div>

      <div class="admin-user-product-section">

        <h3>
          ข้อมูลรายการ
        </h3>

        <div class="admin-user-product-meta-grid">

          <div>
            <span>สถานะสินค้า</span>
            <strong>
              ${esc(
                statusLabel(product.status)
              )}
            </strong>
          </div>

          <div>
            <span>ลงขายเมื่อ</span>
            <strong>
              ${formatProductDate(
                product.createdAt
              )}
            </strong>
          </div>

          <div>
            <span>แก้ไขล่าสุด</span>
            <strong>
              ${formatProductDate(
                product.updatedAt
              )}
            </strong>
          </div>

          <div>
            <span>ผู้ขาย</span>
            <strong>
              @${esc(
                product.sellerUsername || '-'
              )}
            </strong>
          </div>

        </div>

      </div>

            <div class="admin-user-product-section">

        <h3>
          ข้อมูลการซื้อ
        </h3>

        ${
          order
            ? `
              <div class="admin-user-product-meta-grid">

                <div>
                  <span>ผู้ซื้อ</span>
                  <strong>
                    @${esc(
                      order.buyerUsername || '-'
                    )}
                  </strong>
                </div>

                <div>
                  <span>Order</span>
                  <strong>
                    #${Number(order.id)}
                  </strong>
                </div>

                <div>
                  <span>ยอดซื้อ</span>
                  <strong>
                    ${Number(
                      order.amount || 0
                    ).toLocaleString('th-TH')}
                    pts
                  </strong>
                </div>

                <div>
                  <span>สถานะ Order</span>
                  <strong>
                    ${esc(
                      orderStatusLabel(
                        order.status
                      )
                    )}
                  </strong>
                </div>

                <div>
                  <span>สั่งซื้อเมื่อ</span>
                  <strong>
                    ${formatProductDate(
                      order.createdAt
                    )}
                  </strong>
                </div>

                <div>
                  <span>เสร็จสิ้นเมื่อ</span>
                  <strong>
                    ${
                      order.completedAt
                        ? formatProductDate(
                            order.completedAt
                          )
                        : '-'
                    }
                  </strong>
                </div>

              </div>
            `
            : `
              <div class="admin-user-product-empty">
                สินค้านี้ยังไม่มีผู้ซื้อ
              </div>
            `
        }

      </div>

      ${
        product.moderationReason
          ? `
            <div
              class="
                admin-user-product-section
                admin-user-product-warning
              "
            >
              <h3>
                การจัดการโดย Admin
              </h3>

              <div>
                ${esc(
                  product.moderationReason
                )}
              </div>
            </div>
          `
          : ''
      }


      <div
        id="adminProductModalAction"
        class="admin-user-product-actions"
      ></div>
    `;


    const action =
      document.getElementById(
        'adminProductModalAction'
      );

    if (action) {
      if (product.status === 'ACTIVE') {
        action.innerHTML = `
          <button
            type="button"
            class="btn btn-warning btn-sm"
            onclick="
              adminModerateProduct(
                ${Number(product.id)},
                'PAUSED'
              );
              closeAdminProductModal();
            "
          >
            ซ่อนสินค้า
          </button>
        `;
      }

      else if (
        product.status === 'PAUSED'
      ) {
        action.innerHTML = `
          <button
            type="button"
            class="btn btn-success btn-sm"
            onclick="
              adminModerateProduct(
                ${Number(product.id)},
                'ACTIVE'
              );
              closeAdminProductModal();
            "
          >
            แสดงสินค้า
          </button>
        `;
      }
    }

  } catch (error) {
    currentProductDetail = null;

    body.innerHTML = `
      <div class="notice danger">
        ${esc(error.message)}
      </div>
    `;
  }
};
window.adminSelectProductImage =
  index => {

    const images =
      Array.isArray(
        currentProductDetail?.images
      )
        ? currentProductDetail.images
        : [];

    const image =
      images[Number(index)];

    if (!image) {
      return;
    }

    const mainImage =
      document.getElementById(
        'adminUserProductMainImage'
      );

    if (mainImage) {
      mainImage.src =
        image.imageUrl;

      mainImage.alt =
        currentProductDetail?.title ||
        'รูปสินค้า';
    }

    document
      .querySelectorAll(
        '.admin-user-product-thumb'
      )
      .forEach(button => {
        button.classList.toggle(
          'is-active',
          Number(
            button.dataset
              .productImageIndex
          ) === Number(index)
        );
      });
  };
  window.closeAdminProductModal = () => {
  const modal =
    document.getElementById(
      'adminProductModal'
    );

  if (modal) {
    modal.hidden = true;
  }

  currentProductDetail = null;
};
  window.adminModerateProduct=async(id,status)=>{let reason=null;if(status==='PAUSED'){reason=prompt('ระบุเหตุผลที่ซ่อนสินค้า');if(reason===null||!reason.trim())return;}try{const r=await fetch(`/api/v1/admin/products/${id}/moderation`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf()},body:JSON.stringify({status,reason})}),b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error?.message||'ดำเนินการไม่สำเร็จ');await adminLoadProducts();}catch(e){alert(e.message);}};
})();

function reviewProductEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function reviewStars(rating) {
  const value = Math.round(Number(rating) || 0);
  return '★★★★★'.split('').map((star, index) => `<span class="product-review-star ${index < value ? 'is-filled' : ''}">${star}</span>`).join('');
}

function renderProductReviews(
  payload,
  sellerUsername = ''
) {
  const target =
    document.getElementById(
      'product-review-content'
    );

  if (!target) return;

  const reviews =
    Array.isArray(payload?.reviews)
      ? payload.reviews
      : [];

  const summary =
    payload?.summary || {};

  const average =
    Number(
      summary.averageRating ??
      summary.avgRating ??
      0
    );

  const count =
    Number(
      summary.reviewCount ??
      summary.totalReviews ??
      summary.count ??
      reviews.length
    );

  if (!reviews.length) {
    target.innerHTML =
      sellerUsername
        ? '<div class="product-review-empty">ยังไม่มีรีวิวสำหรับผู้ขายรายนี้</div>'
        : '<div class="product-review-empty">ยังไม่มีรีวิวสำหรับสินค้านี้</div>';

    return;
  }

  const distribution =
    summary.distribution ||
    reviews.reduce(
      (result, review) => {
        const rating =
          Number(review.rating);

        if (
          Number.isInteger(rating) &&
          rating >= 1 &&
          rating <= 5
        ) {
          result[rating] =
            Number(
              result[rating] || 0
            ) + 1;
        }

        return result;
      },
      {}
    );

  target.innerHTML = `
    <div class="product-review-summary">

      <div class="product-review-score">
        <strong>
          ${average.toFixed(1)}
        </strong>

        <div class="product-review-score-stars">
          ${reviewStars(average)}
        </div>

        <span>
          ${count.toLocaleString('th-TH')} รีวิว
        </span>
      </div>

      <div class="product-review-distribution">
        ${[5, 4, 3, 2, 1]
          .map((star) => `
            <div class="product-review-bar-row">

              <span>
                ${star} ★
              </span>

              <div class="product-review-bar">
                <span
                  style="
                    width:${
                      count
                        ? Math.min(
                            100,
                            (
                              Number(
                                distribution[star] || 0
                              ) /
                              count
                            ) * 100
                          )
                        : 0
                    }%
                  "
                ></span>
              </div>

              <small>
                ${Number(
                  distribution[star] || 0
                )}
              </small>

            </div>
          `)
          .join('')}
      </div>

    </div>

    <div class="product-review-list">

      ${reviews
        .map((review) => `
          <article class="product-review-item">

            <div class="product-review-item-head">

              <div>
                <strong>
                  ${reviewProductEscape(
                    review.buyerUsername ||
                    review.username ||
                    'ผู้ซื้อ'
                  )}
                </strong>

                <div class="product-review-stars">
                  ${reviewStars(
                    review.rating
                  )}
                </div>
              </div>

              <time>
                ${
                  review.createdAt
                    ? new Date(
                        review.createdAt
                      ).toLocaleDateString(
                        'th-TH'
                      )
                    : '-'
                }
              </time>

            </div>

            ${
              review.comment
                ? `
                  <p>
                    ${reviewProductEscape(
                      review.comment
                    )}
                  </p>
                `
                : `
                  <p class="product-review-no-comment">
                    ไม่ได้เขียนความคิดเห็น
                  </p>
                `
            }

            ${
              review.sellerReply
                ? `
                  <div class="seller-public-reply">

                    <strong>
                      ↪ ${reviewProductEscape(
                        sellerUsername ||
                        'ผู้ขาย'
                      )}
                    </strong>

                    <p>
                      ${reviewProductEscape(
                        review.sellerReply
                      )}
                    </p>

                    <time>
                      ${
                        review.sellerReplyAt
                          ? new Date(
                              review.sellerReplyAt
                            ).toLocaleDateString(
                              'th-TH'
                            )
                          : ''
                      }
                    </time>

                  </div>
                `
                : ''
            }

          </article>
        `)
        .join('')}

    </div>
  `;
}

async function loadProductReviews(productId) {
  const target = document.getElementById('product-review-content');
  if (!target) return;
  try {
    const response = await fetch(`/api/v1/reviews/products/${Number(productId)}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || 'โหลดรีวิวไม่สำเร็จ');
    renderProductReviews(body.data || body);
  } catch (error) {
    console.error('loadProductReviews failed:', error);
    target.innerHTML = `<div class="notice danger">${reviewProductEscape(error.message || 'โหลดรีวิวไม่สำเร็จ')}</div>`;
  }
}

async function loadSellerReviewsForProduct(
  sellerId,
  sellerUsername = 'ผู้ขาย'
) {
  const target =
    document.getElementById(
      'product-review-content'
    );

  if (!target) return;

  const id = Number(sellerId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    target.innerHTML =
      '<div class="product-review-empty">ไม่พบข้อมูลผู้ขาย</div>';

    return;
  }

  try {
    const response = await fetch(
      `/api/v1/reviews/sellers/${id}`,
      {
        credentials: 'include'
      }
    );

    const body =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.error?.message ||
        'โหลดรีวิวผู้ขายไม่สำเร็จ'
      );
    }

    renderProductReviews(
      body.data || body,
      sellerUsername
    );

  } catch (error) {
    console.error(
      'loadSellerReviewsForProduct failed:',
      error
    );

    target.innerHTML = `
      <div class="notice danger">
        ${reviewProductEscape(
          error.message ||
          'โหลดรีวิวผู้ขายไม่สำเร็จ'
        )}
      </div>
    `;
  }
}

window.loadProductReviews = loadProductReviews;
window.loadSellerReviewsForProduct =
  loadSellerReviewsForProduct;

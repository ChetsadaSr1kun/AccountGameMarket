const { reviewReports } = require('../../backend/src/repositories/report-storage');
const {
  before,
  after,
  test,
} = require('node:test');

const assert =
  require('node:assert/strict');

const crypto =
  require('crypto');

const request =
  require('supertest');

const {
  pool,
} = require(
  '../../backend/src/config/database'
);

const {
  hashPassword,
} = require(
  '../../backend/src/utils/password'
);

const userRepository =
  require(
    '../../backend/src/repositories/user.repository'
  );


const app =
  require('../../backend/src/app');

const {
  cleanupTestUsers,
  closeTestDatabasePool,
  prepareTestDatabase,
} = require(
  '../helpers/test-database'
);

if (
  process.env.NODE_ENV !== 'test' ||
  process.env.DB_NAME !== require('../helpers/database-name')
) {
  throw new Error(
    'Run report chat review tests with the test database guard active.'
  );
}

const api = request(app);

const runId =
  crypto.randomUUID()
    .replaceAll('-', '');

const emailPrefix =
  `reviewchat_${runId}_`;

const password =
  'TestPassword123';

const buyerEmail =
  `${emailPrefix}buyer@example.test`;

const sellerEmail =
  `${emailPrefix}seller@example.test`;

const noChatBuyerEmail =
  `${emailPrefix}nochat@example.test`;

const adminEmail =
  `${emailPrefix}admin@example.test`;

const buyerUsername =
  `rvbuyer_${runId.slice(0, 16)}`;

const sellerUsername =
  `rvseller_${runId.slice(0, 16)}`;

const noChatBuyerUsername =
  `rvnochat_${runId.slice(0, 16)}`;

const adminUsername =
  `rvadmin_${runId.slice(0, 16)}`;

let buyer = null;
let seller = null;
let noChatBuyer = null;
let adminAuth = null;

let noChatProductId = null;
let noChatOrderId = null;
let noChatReviewId = null;
let noChatReportId = null;

let productId = null;
let orderId = null;
let reviewId = null;
let reportId = null;
let conversationId = null;

function cookieHeader(response) {
  return (
    response.headers['set-cookie'] || []
  )
    .map(
      (value) =>
        value.split(';', 1)[0]
    )
    .join('; ');
}

async function registerCustomer(
  email,
  username,
  phone
) {
  const response =
    await api
      .post('/api/v1/auth/register')
      .send({
        email,
        username,
        password,

        firstName:
          'Report',

        lastName:
          'Chat',

        phone,

        dateOfBirth:
          '2000-01-01',

        accountType:
          'CUSTOMER',
      });

  assert.equal(
    response.status,
    201
  );

  return {
    id:
      Number(
        response.body.data.user.id
      ),

    auth:
      response,
  };
}

async function createAdmin() {
  const passwordHash =
    await hashPassword(
      password
    );

  const adminId =
    await userRepository.create(
      pool,
      {
        email:
          adminEmail,

        username:
          adminUsername,

        firstName:
          'Report',

        lastName:
          'Admin',

        phone:
          '0891234567',

        dateOfBirth:
          '1990-01-01',

        passwordHash,

        accountMode:
          'ADMIN',
      }
    );

  const login =
    await api
      .post('/api/v1/auth/login')
      .send({
        username:
          adminUsername,

        password,
      });

  assert.equal(
    login.status,
    200
  );

  return login;
}

before(async () => {
  await prepareTestDatabase();

  await cleanupTestUsers(
    emailPrefix
  );

  buyer =
    await registerCustomer(
      buyerEmail,
      buyerUsername,
      '0812345678'
    );

  seller =
    await registerCustomer(
      sellerEmail,
      sellerUsername,
      '0823456789'
    );

  noChatBuyer =
  await registerCustomer(
    noChatBuyerEmail,
    noChatBuyerUsername,
    '0834567890'
  );
    

  adminAuth =
    await createAdmin();

  const [games] =
    await pool.execute(
      `
        SELECT id
        FROM games
        WHERE slug = 'genshin-impact'
        LIMIT 1
      `
    );

  assert.equal(
    games.length,
    1
  );

  const [productResult] =
    await pool.execute(
      `
        INSERT INTO products (
          seller_id,
          game_id,
          title,
          description,
          price,
          status
        )
        VALUES (
          ?, ?, ?, ?, ?, 'SOLD'
        )
      `,
      [
        seller.id,
        games[0].id,
        'Report Chat Test',
        'Admin report chat review test',
        100,
      ]
    );

  productId =
    Number(
      productResult.insertId
    );

  const [orderResult] =
    await pool.execute(
      `
        INSERT INTO orders (
          product_id,
          buyer_id,
          seller_id,
          amount,
          status
        )
        VALUES (
          ?, ?, ?, ?, 'PAID'
        )
      `,
      [
        productId,
        buyer.id,
        seller.id,
        100,
      ]
    );

  orderId =
    Number(
      orderResult.insertId
    );

  const [reviewResult] =
  await pool.execute(
    `
      INSERT INTO reviews (
        order_id,
        product_id,
        buyer_id,
        seller_id,
        rating,
        comment
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      orderId,
      productId,
      buyer.id,
      seller.id,
      1,
      'รีวิวทดสอบสำหรับตรวจสอบแชท',
    ]
  );

reviewId =
  Number(
    reviewResult.insertId
  );

const [reportResult] =
  await pool.execute(
    `
      INSERT INTO reports (report_type,
        review_id,
        reporter_id,
        reason,
        description
      ) VALUES ('REVIEW',?, ?, ?, ?)
    `,
    [
      reviewId,
      seller.id,
      'ABUSE',
      'ตรวจสอบข้อความแชทระหว่างผู้ขายและผู้รีวิว',
    ]
  );

reportId =
  Number(
    reportResult.insertId
  );

  const [noChatProductResult] =
  await pool.execute(
    `
      INSERT INTO products (
        seller_id,
        game_id,
        title,
        description,
        price,
        status
      )
      VALUES (
        ?, ?, ?, ?, ?, 'SOLD'
      )
    `,
    [
      seller.id,
      games[0].id,
      'Review No Chat Test',
      'Review report without conversation',
      200,
    ]
  );

noChatProductId =
  Number(
    noChatProductResult.insertId
  );

const [noChatOrderResult] =
  await pool.execute(
    `
      INSERT INTO orders (
        product_id,
        buyer_id,
        seller_id,
        amount,
        status
      )
      VALUES (
        ?, ?, ?, ?, 'PAID'
      )
    `,
    [
      noChatProductId,
      noChatBuyer.id,
      seller.id,
      200,
    ]
  );

noChatOrderId =
  Number(
    noChatOrderResult.insertId
  );

const [noChatReviewResult] =
  await pool.execute(
    `
      INSERT INTO reviews (
        order_id,
        product_id,
        buyer_id,
        seller_id,
        rating,
        comment
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      noChatOrderId,
      noChatProductId,
      noChatBuyer.id,
      seller.id,
      2,
      'รีวิวสำหรับทดสอบกรณีไม่มีแชท',
    ]
  );

noChatReviewId =
  Number(
    noChatReviewResult.insertId
  );

const [noChatReportResult] =
  await pool.execute(
    `
      INSERT INTO reports (report_type,
        review_id,
        reporter_id,
        reason,
        description
      ) VALUES ('REVIEW',?, ?, ?, ?)
    `,
    [
      noChatReviewId,
      seller.id,
      'FALSE_REVIEW',
      'คู่ผู้ใช้นี้ไม่มีประวัติแชท',
    ]
  );

noChatReportId =
  Number(
    noChatReportResult.insertId
  );

  const [conversationResult] =
    await pool.execute(
      `
        INSERT INTO conversations (
          buyer_id,
          seller_id,
          product_id
        )
        VALUES (?, ?, ?)
      `,
      [
        buyer.id,
        seller.id,
        productId,
      ]
    );

  conversationId =
    Number(
      conversationResult.insertId
    );

  await pool.execute(
    `
      INSERT INTO messages (
        conversation_id,
        sender_id,
        body
      )
      VALUES
        (?, ?, ?),
        (?, ?, ?),
        (?, ?, ?)
    `,
    [
      conversationId,
      seller.id,
      'ข้อความจากผู้รายงาน 1',

      conversationId,
      buyer.id,
      'ข้อความจากผู้รีวิว',

      conversationId,
      seller.id,
      'ข้อความจากผู้รายงาน 2',
    ]
  );
});

after(async () => {
  if (conversationId) {
    await pool.execute(
      `
        DELETE FROM conversations
        WHERE id = ?
      `,
      [conversationId]
    );
  }

  if (reportId) {
    await pool.execute(
      `
        DELETE FROM reports WHERE report_type='REVIEW' AND id = ?
      `,
      [reportId]
    );
  }

  if (noChatReportId) {
    await pool.execute(
      `
        DELETE FROM reports WHERE report_type='REVIEW' AND id = ?
      `,
      [noChatReportId]
    );
  }

  if (reviewId) {
    await pool.execute(
      `
        DELETE FROM reviews
        WHERE id = ?
      `,
      [reviewId]
    );
  }

  if (noChatReviewId) {
    await pool.execute(
      `
        DELETE FROM reviews
        WHERE id = ?
      `,
      [noChatReviewId]
    );
  }

  if (orderId) {
    await pool.execute(
      `
        DELETE FROM orders
        WHERE id = ?
      `,
      [orderId]
    );
  }

  if (noChatOrderId) {
    await pool.execute(
      `
        DELETE FROM orders
        WHERE id = ?
      `,
      [noChatOrderId]
    );
  }

  if (productId) {
    await pool.execute(
      `
        DELETE FROM products
        WHERE id = ?
      `,
      [productId]
    );
  }

  if (noChatProductId) {
    await pool.execute(
      `
        DELETE FROM products
        WHERE id = ?
      `,
      [noChatProductId]
    );
  }

  await cleanupTestUsers(
    emailPrefix
  );

  await closeTestDatabasePool();
});

test(
  'allows an admin to review the chat between the review reporter and reviewer',
  async () => {
    const response =
      await api
        .get(
          `/api/v1/review-reports/${reportId}/chat`
        )
        .set(
          'Cookie',
          cookieHeader(adminAuth)
        );

    assert.equal(
      response.status,
      200
    );

    const data =
      response.body.data;

    assert.equal(
      data.reportId,
      reportId
    );

    assert.equal(
      data.reviewId,
      reviewId
    );

    assert.equal(
      data.reporter.id,
      seller.id
    );

    assert.equal(
      data.reported.id,
      buyer.id
    );

    assert.equal(
      data.conversation.id,
      conversationId
    );

    assert.equal(
      data.messages.length,
      3
    );

    assert.deepEqual(
      data.messages.map(
        (message) =>
          message.senderId
      ),
      [
        seller.id,
        buyer.id,
        seller.id,
      ]
    );

    assert.deepEqual(
      data.messages.map(
        (message) =>
          message.body
      ),
      [
        'ข้อความจากผู้รายงาน 1',
        'ข้อความจากผู้รีวิว',
        'ข้อความจากผู้รายงาน 2',
      ]
    );
  }
);

test(
  'returns an empty chat without creating a conversation when the review participants never chatted',
  async () => {
    const participantLowId =
      Math.min(
        seller.id,
        noChatBuyer.id
      );

    const participantHighId =
      Math.max(
        seller.id,
        noChatBuyer.id
      );

    const [beforeRows] =
      await pool.execute(
        `
          SELECT id
          FROM conversations
          WHERE
            participant_low_id = ?
            AND participant_high_id = ?
        `,
        [
          participantLowId,
          participantHighId,
        ]
      );

    assert.equal(
      beforeRows.length,
      0
    );

    const response =
      await api
        .get(
          `/api/v1/review-reports/${noChatReportId}/chat`
        )
        .set(
          'Cookie',
          cookieHeader(adminAuth)
        );

    assert.equal(
      response.status,
      200
    );

    const data =
      response.body.data;

    assert.equal(
      data.reportId,
      noChatReportId
    );

    assert.equal(
      data.reviewId,
      noChatReviewId
    );

    assert.equal(
      data.reporter.id,
      seller.id
    );

    assert.equal(
      data.reported.id,
      noChatBuyer.id
    );

    assert.equal(
      data.conversation,
      null
    );

    assert.deepEqual(
      data.messages,
      []
    );

    const [afterRows] =
      await pool.execute(
        `
          SELECT id
          FROM conversations
          WHERE
            participant_low_id = ?
            AND participant_high_id = ?
        `,
        [
          participantLowId,
          participantHighId,
        ]
      );

    assert.equal(
      afterRows.length,
      0
    );
  }
);
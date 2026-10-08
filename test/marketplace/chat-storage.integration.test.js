const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../backend/src/app');
const { pool } = require('../../backend/src/config/database');
const users = require('../../backend/src/repositories/user.repository');
const chat = require('../../backend/src/repositories/chat.repository');
const support = require('../../backend/src/repositories/support-chat.repository');
const { hashPassword } = require('../../backend/src/utils/password');
const { prepareTestDatabase, cleanupTestUsers, closeTestDatabasePool } = require('../helpers/test-database');
const prefix = `chatschema_${crypto.randomUUID().replaceAll('-', '')}`;
const api = request(app);
const password = 'TestPassword123';
let alice, bob, admin, normal, internalSupportId, legacyId;

async function makeUser(label, accountMode) {
  const username = `${label}_${prefix.slice(-20)}`;
  const id = await users.create(pool, { email: `${prefix}_${label}@example.test`, username,
    firstName: 'Chat', lastName: 'Fixture', phone: null, dateOfBirth: '2000-01-01',
    passwordHash: await hashPassword(password), accountMode });
  const login = await api.post('/api/v1/auth/login').send({ username, password });
  assert.equal(login.status, 200);
  const cookies = login.headers['set-cookie'].map((value) => value.split(';')[0]);
  return { id, cookie: cookies.join('; '), csrf: cookies.find((value) => value.startsWith('gm_csrf=')).slice(8) };
}

before(async () => {
  await prepareTestDatabase();
  alice = await makeUser('alice', 'CUSTOMER_ONLY');
  bob = await makeUser('bob', 'SELLER_ONLY');
  admin = await makeUser('admin', 'ADMIN');
  normal = await chat.findOrCreateConversation(alice.id, bob.id);
  const normalMessage = await chat.createMessage(normal.id, alice.id, 'marketplace-only');
  const room = await support.findOrCreateForUser(alice.id);
  internalSupportId = room.id;
  const message = await support.createMessage(room.id, alice.id, 'support-private');
  // Reproduce a migrated support namespace whose old IDs collide with normal chat.
  legacyId = normal.id;
  await pool.execute('UPDATE conversations SET legacy_support_id=?,assigned_admin_id=? WHERE id=?', [legacyId, admin.id, internalSupportId]);
  await pool.execute('UPDATE messages SET legacy_support_id=? WHERE id=?', [normalMessage.id, message.id]);
});
after(async () => {
  if (alice && bob && admin) {
    const ids = [alice.id, bob.id, admin.id];
    await pool.execute('DELETE FROM conversations WHERE support_user_id IN (?,?,?) OR buyer_id IN (?,?,?) OR seller_id IN (?,?,?)', [...ids, ...ids, ...ids]);
    await pool.execute('DELETE FROM notifications WHERE user_id IN (?,?,?)', ids);
  }
  await cleanupTestUsers(prefix);
  await closeTestDatabasePool();
});

test('legacy support IDs preserve messages, participants and independent unread states', async () => {
  const inbox = await api.get('/api/v1/support-chat/admin').set('Cookie', admin.cookie);
  assert.equal(inbox.status, 200);
  assert.equal(inbox.body.data.conversations.find((c) => c.id === legacyId).unreadCount, 1);
  const detail = await api.get(`/api/v1/support-chat/admin/${legacyId}`).set('Cookie', admin.cookie);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.conversation.id, legacyId);
  assert.equal(detail.body.data.conversation.assignedAdminId, admin.id);
  assert.deepEqual(detail.body.data.messages.map((m) => m.body), ['support-private']);
  const sent = await api.post(`/api/v1/support-chat/admin/${legacyId}/messages`)
    .set('Cookie', admin.cookie).set('X-CSRF-Token', admin.csrf).send({ body: 'support-reply' });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.data.message.conversationId, legacyId);
  assert.equal(await support.getUserUnreadCount(alice.id), 1);
  const mine = await api.get('/api/v1/support-chat/me').set('Cookie', alice.cookie);
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.data.messages.map((m) => m.body), ['support-private', 'support-reply']);
  assert.equal(await support.getUserUnreadCount(alice.id), 0);
  assert.equal((await support.listForAdmin()).find((c) => c.id === legacyId).unread_count, 0);
});

test('normal chat and support keep authorization, CSRF and message separation', async () => {
  assert.equal((await api.get('/api/v1/support-chat/me')).status, 401);
  assert.equal((await api.get('/api/v1/support-chat/admin').set('Cookie', alice.cookie)).status, 403);
  assert.equal((await api.post('/api/v1/support-chat/me/messages').set('Cookie', alice.cookie).send({ body: 'blocked' })).status, 403);
  assert.equal((await api.get(`/api/v1/chat/${internalSupportId}`).set('Cookie', alice.cookie)).status, 404);
  const normalMessages = await chat.listMessages(normal.id);
  assert.deepEqual(normalMessages.map((m) => m.body), ['marketplace-only']);
  assert.equal((await chat.listForUser(alice.id)).length, 1);
  const adminMessages = await chat.listAdmin();
  assert.ok(adminMessages.every((m) => !m.body.startsWith('support-')));
  const other = await api.get('/api/v1/support-chat/me').set('Cookie', bob.cookie);
  assert.equal(other.status, 200);
  assert.deepEqual(other.body.data.messages, []);
});

test('participant uniqueness and support ownership remain stable under concurrent opens', async () => {
  assert.equal((await chat.findOrCreateConversation(bob.id, alice.id)).id, normal.id);
  const rooms = await Promise.all([support.findOrCreateForUser(bob.id), support.findOrCreateForUser(bob.id)]);
  assert.equal(rooms[0].id, rooms[1].id);
  await pool.execute("UPDATE conversations SET support_status='CLOSED',closed_at=UTC_TIMESTAMP(3) WHERE id=?", [internalSupportId]);
  const closed = await support.findById(legacyId);
  assert.equal(closed.status, 'CLOSED');
  assert.ok(closed.closed_at);
});

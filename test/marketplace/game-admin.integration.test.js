const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { pool } = require('../../backend/src/config/database');
const { hashPassword } = require('../../backend/src/utils/password');
const userRepository = require('../../backend/src/repositories/user.repository');
const roleRepository = require('../../backend/src/repositories/role.repository');
const app = require('../../backend/src/app');
const { cleanupTestUsers, closeTestDatabasePool, prepareTestDatabase } = require('../helpers/test-database');
if (process.env.NODE_ENV !== 'test' || process.env.DB_NAME !== 'gamemarket_test') throw new Error('Test database guard failed.');
const api=request(app), runId=crypto.randomUUID().replaceAll('-',''), email=`gameadmin_${runId}@example.test`, username=`gameadmin_${runId.slice(0,12)}`, password='TestPassword123', slug=`game-admin-${runId.slice(0,10)}`;let auth;
const cookies=r=>(r.headers['set-cookie']||[]).map(v=>v.split(';',1)[0]).join('; ');const csrf=r=>(r.headers['set-cookie']||[]).find(v=>v.startsWith('gm_csrf='))?.split(';',1)[0].slice(8);
before(async()=>{await prepareTestDatabase();await cleanupTestUsers('gameadmin_');const id=await userRepository.create(pool,{email,username,firstName:'Game',lastName:'Admin',phone:'0891234567',dateOfBirth:'1990-01-01',passwordHash:await hashPassword(password),accountMode:'ADMIN'});const [roleId]=await roleRepository.findIdsByCodes(pool,['ADMIN']);await userRepository.assignRoles(pool,id,[roleId]);auth=await api.post('/api/v1/auth/login').send({username,password});assert.equal(auth.status,200);});
after(async()=>{await pool.execute('DELETE FROM games WHERE slug LIKE ?',[`${slug}%`]);await cleanupTestUsers('gameadmin_');await closeTestDatabasePool();});
test('rejects unauthenticated admin game list',async()=>{const r=await api.get('/api/v1/games/admin');assert.equal(r.status,401);});
test('allows admin to list games with product counts',async()=>{const r=await api.get('/api/v1/games/admin').set('Cookie',cookies(auth));assert.equal(r.status,200);assert.ok(Array.isArray(r.body.data.games));assert.ok('productCount' in r.body.data.games[0]);});
test('rejects admin game create without CSRF',async()=>{const r=await api.post('/api/v1/games/admin').set('Cookie',cookies(auth)).send({name:`Test ${runId}`,slug});assert.equal(r.status,403);assert.equal(r.body.error.code,'CSRF_INVALID');});
test('creates, updates and deactivates a game',async()=>{const create=await api.post('/api/v1/games/admin').set('Cookie',cookies(auth)).set('X-CSRF-Token',csrf(auth)).send({name:`Test Game ${runId}`,slug,description:'Admin test'});assert.equal(create.status,201);const id=create.body.data.game.id;const update=await api.patch(`/api/v1/games/admin/${id}`).set('Cookie',cookies(auth)).set('X-CSRF-Token',csrf(auth)).send({description:'Updated',status:'INACTIVE'});assert.equal(update.status,200);assert.equal(update.body.data.game.status,'INACTIVE');const active=await api.get('/api/v1/games');assert.ok(!active.body.data.some(g=>Number(g.id)===Number(id)));const del=await api.delete(`/api/v1/games/admin/${id}`).set('Cookie',cookies(auth)).set('X-CSRF-Token',csrf(auth));assert.equal(del.status,200);});
test('rejects invalid game status',async()=>{const r=await api.post('/api/v1/games/admin').set('Cookie',cookies(auth)).set('X-CSRF-Token',csrf(auth)).send({name:`Bad ${runId}`,slug:`bad-${runId.slice(0,8)}`,status:'BROKEN'});assert.equal(r.status,400);assert.equal(r.body.error.code,'INVALID_GAME_STATUS');});


test('allows admin to read dashboard summary',async()=>{const r=await api.get('/api/v1/admin/dashboard').set('Cookie',cookies(auth));assert.equal(r.status,200);assert.ok(Number.isInteger(r.body.data.summary.totals.users));assert.ok(Array.isArray(r.body.data.summary.recentTransactions));});
test('rejects unauthenticated dashboard summary',async()=>{const r=await api.get('/api/v1/admin/dashboard');assert.equal(r.status,401);});

test('allows admin to list suspended users',async()=>{const r=await api.get('/api/v1/admin/moderation/suspended').set('Cookie',cookies(auth));assert.equal(r.status,200);assert.ok(Array.isArray(r.body.data.users));});
test('rejects moderation without CSRF',async()=>{const r=await api.patch('/api/v1/admin/moderation/users/1/status').set('Cookie',cookies(auth)).send({status:'ACTIVE'});assert.equal(r.status,403);assert.equal(r.body.error.code,'CSRF_INVALID');});

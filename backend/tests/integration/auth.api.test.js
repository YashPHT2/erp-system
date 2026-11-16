const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../app');
const { auth, signToken, connectTestDb, clearTestDb, userId, PASSWORD } = require('../helpers');
const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const PasswordResetToken = require('../../models/PasswordResetToken');
const { SystemMeta } = require('../../models/System');
const config = require('../../config/env');
const { SMTPServer } = require('smtp-server');
const app = createApp();
beforeAll(connectTestDb);
beforeEach(clearTestDb);
const credentials = { email: 'accountant@test.edu', password: PASSWORD };
const cookie = response => response.headers['set-cookie'][0].split(';')[0];
const token = response => response.body.data.accessToken;
const login = () => request(app).post('/api/v1/auth/login').send(credentials);
describe('database account authentication', () => {
  test('metadata never exposes credentials or demo accounts; old login is removed', async () => {
    const meta = await request(app).get('/api/v1/meta');
    expect(meta.status).toBe(200);
    expect(meta.body.data).toMatchObject({ authMode: 'jwt', setupRequired: false, passwordResetAvailable: false });
    expect(JSON.stringify(meta.body)).not.toMatch(/demoAccounts|passwordHash|DEV_USER_PASSWORD|setupToken/);
    expect((await request(app).post('/api/v1/dev-auth/login').send(credentials)).status).toBe(404);
  });
  test('signs in, protects routes, and rejects tampering, expiry, missing token and wrong password', async () => {
    const signed = await login(); expect(signed.status).toBe(200);
    expect(signed.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(signed.headers['set-cookie'][0]).toMatch(/Path=\/api\/v1\/auth/);
    expect((await request(app).get('/api/v1/auth/me').auth(token(signed), { type: 'bearer' })).body.data.role).toBe('ACCOUNTANT');
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').auth(token(signed)+'x', { type: 'bearer' })).status).toBe(401);
    const payload = jwt.decode(token(signed)); delete payload.iat; delete payload.exp;
    const expired = jwt.sign(payload, config.jwtSecret, { expiresIn: -1 });
    expect((await request(app).get('/api/v1/auth/me').auth(expired, { type: 'bearer' })).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ ...credentials, password: 'wrong' })).status).toBe(401);
    const permissions = await request(app).get('/api/v1/auth/me').set({ Authorization: `Bearer ${signToken({ role: 'TEACHER', permissions: ['users.manage'] })}` });
    expect(permissions.body.data.permissions).toEqual(['teaching.self','library.read','library.self']);
  });
  test('refresh rotates once and concurrent consumption produces just one new token', async () => {
    const signed = await login(); const oldCookie = cookie(signed);
    const responses = await Promise.all([request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie), request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie)]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,401]);
    const success = responses.find(r=>r.status === 200);
    expect(cookie(success)).not.toBe(oldCookie);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie(success))).status).toBe(200);
  });
  test('browser cookie logout revokes both refresh and outstanding access tokens', async () => {
    const agent = request.agent(app);
    const signed = await agent.post('/api/v1/auth/login').send(credentials);
    expect((await agent.post('/api/v1/auth/logout')).status).toBe(200);
    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').auth(token(signed), { type: 'bearer' })).status).toBe(401);
  });
  test('password change invalidates every session and requires the new password', async () => {
    const signed = await login(); const other = await login();
    const changed = await request(app).post('/api/v1/auth/change-password').auth(token(signed), { type: 'bearer' }).send({ currentPassword: PASSWORD, newPassword: 'New-password-2026' });
    expect(changed.status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').auth(token(other), { type: 'bearer' })).status).toBe(401);
    expect((await login()).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ ...credentials, password: 'New-password-2026' })).status).toBe(200);
  });
  test('disabling users revokes sessions and prevents future login; permissions come from database', async () => {
    const signed = await login();
    expect((await request(app).get('/api/v1/users').auth(token(signed), { type: 'bearer' })).status).toBe(403);
    const updated = await request(app).patch(`/api/v1/users/${userId('ACCOUNTANT')}`).set(auth('SUPER_ADMIN')).send({ active: false });
    expect(updated.status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').auth(token(signed), { type: 'bearer' })).status).toBe(401);
    expect((await login()).status).toBe(401);
    expect((await request(app).patch(`/api/v1/users/${userId('SUPER_ADMIN')}`).set(auth('SUPER_ADMIN')).send({ role: 'TEACHER' })).status).toBe(400);
  });
  test('creates a real user without leaking a password hash and rejects duplicate email', async () => {
    const body = { name: 'New Clerk', email: 'newclerk@test.edu', role: 'FEE_CLERK', password: PASSWORD };
    const created = await request(app).post('/api/v1/users').set(auth('SUPER_ADMIN')).send(body);
    expect(created.status).toBe(201); expect(created.body.data.passwordHash).toBeUndefined();
    expect((await request(app).post('/api/v1/users').set(auth('SUPER_ADMIN')).send(body)).status).toBe(409);
    expect((await request(app).post('/api/v1/auth/login').send({ email: body.email, password: body.password })).status).toBe(200);
    expect(JSON.stringify((await request(app).get('/api/v1/users').set(auth('SUPER_ADMIN'))).body)).not.toContain('passwordHash');
  });
  test('setup requires the secret and creates exactly one initial administrator', async () => {
    await User.deleteMany({}); await RefreshToken.deleteMany({}); await SystemMeta.deleteMany({});
    const body = { name: 'Institution Admin', email: 'admin@test.edu', password: PASSWORD, setupToken: process.env.SETUP_TOKEN };
    expect((await request(app).post('/api/v1/auth/setup').send({ ...body, setupToken: 'bad' })).status).toBe(403);
    const attempts = await Promise.all([request(app).post('/api/v1/auth/setup').send(body), request(app).post('/api/v1/auth/setup').send(body)]);
    expect(attempts.filter(r=>r.status===201)).toHaveLength(1);
    expect(await User.countDocuments()).toBe(1);
    expect((await request(app).get('/api/v1/meta')).body.data.setupRequired).toBe(false);
    expect((await request(app).post('/api/v1/auth/login').send({ email: body.email, password: PASSWORD })).status).toBe(200);
  });
  test('missing SMTP is explicit, and foreign origins cannot use cookie authentication', async () => {
    expect((await request(app).post('/api/v1/auth/forgot-password').send({ email: credentials.email })).status).toBe(503);
    expect((await request(app).post('/api/v1/auth/login').set('Origin','https://other.example').send(credentials)).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ newPassword: PASSWORD })).status).toBe(400);
  });
  test('sends a real SMTP reset message, consumes the link once and revokes old sessions', async () => {
    let mail = '';
    const server = new SMTPServer({ authOptional: true, disabledCommands: ['STARTTLS'], onData(stream, session, callback) {
      stream.on('data', chunk => { mail += chunk.toString(); }); stream.on('end', callback);
    } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const previous = { smtpHost: config.smtpHost, smtpPort: config.smtpPort, smtpFrom: config.smtpFrom };
    Object.assign(config, { smtpHost: '127.0.0.1', smtpPort: server.server.address().port, smtpFrom: 'Finance <finance@test.edu>' });
    try {
      const signed = await login();
      const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email: credentials.email });
      expect(forgot.status).toBe(200);
      const linkToken = mail.replace(/=\r?\n/g, '').match(/token(?:=3D|=)([a-f0-9]{64})/)[1];
      expect(await PasswordResetToken.findOne({ tokenHash: require('crypto').createHash('sha256').update(linkToken).digest('hex') })).toBeTruthy();
      const reset = await request(app).post('/api/v1/auth/reset-password').send({ token: linkToken, newPassword: 'Reset-password-2026' });
      expect(reset.status).toBe(200);
      expect((await request(app).post('/api/v1/auth/reset-password').send({ token: linkToken, newPassword: PASSWORD })).status).toBe(400);
      expect((await request(app).get('/api/v1/auth/me').auth(token(signed), { type: 'bearer' })).status).toBe(401);
      expect((await request(app).post('/api/v1/auth/login').send({ ...credentials, password: 'Reset-password-2026' })).status).toBe(200);
    } finally { Object.assign(config, previous); await new Promise(resolve => server.close(resolve)); }
  });
});

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../app');
const { connectTestDb, clearTestDb } = require('../helpers');
const { DevUser } = require('../../models/System');

const app = createApp();

beforeAll(connectTestDb);
beforeEach(clearTestDb);

describe('authentication', () => {
  test('publishes module metadata and settings without trusting the client role', async () => {
    const meta = await request(app).get('/api/v1/meta');
    expect(meta.status).toBe(200);
    expect(meta.body.data.currency).toBe('INR');
    expect(meta.body.data.paymentModes.map((mode) => mode.value)).toEqual(['cash', 'bank_transfer', 'cheque']);

    const settings = await request(app).get('/api/v1/settings').set({
      Authorization: `Bearer ${require('jsonwebtoken').sign({
        sub: 'accountant-1',
        name: 'Vikram Joshi',
        email: 'accountant@edufinance.local',
        role: 'ACCOUNTANT',
      }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })}`,
    });
    expect(settings.status).toBe(200);
    expect(settings.body.data.permissions.some((item) => item.key === 'fees.collect')).toBe(true);
    expect(settings.body.data.demoAccounts).toBeUndefined();
  });

  test('signs in a development user and rejects a wrong password', async () => {
    await DevUser.create({
      email: 'accountant@edufinance.local',
      name: 'Vikram Joshi',
      role: 'ACCOUNTANT',
      passwordHash: bcrypt.hashSync('correct-password', 10),
    });

    const success = await request(app).post('/api/v1/dev-auth/login').send({
      email: 'accountant@edufinance.local',
      password: 'correct-password',
    });
    expect(success.status).toBe(200);
    expect(success.body.data.user.role).toBe('ACCOUNTANT');
    expect(success.body.data.token).toBeTruthy();

    const failure = await request(app).post('/api/v1/dev-auth/login').send({
      email: 'accountant@edufinance.local',
      password: 'wrong-password',
    });
    expect(failure.status).toBe(401);
    expect(failure.body.message).toBe('Invalid email or password.');
  });

  test('requires a token and ignores permissions stuffed into the token', async () => {
    const missing = await request(app).get('/api/v1/auth/me');
    expect(missing.status).toBe(401);

    const token = jwt.sign({
      sub: 'teacher-1',
      name: 'Meera Iyer',
      email: 'teacher@edufinance.local',
      role: 'TEACHER',
      permissions: ['fees.collect', 'feeStructure.write'],
    }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.role).toBe('TEACHER');
    expect(me.body.data.permissions).not.toContain('fees.collect');

    const forged = jwt.sign({ sub: 'x', name: 'X', role: 'ACCOUNTANT' }, 'another-secret-value', {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
    const rejected = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(rejected.status).toBe(401);
  });

  test('accepts a fee clerk role written with a space', async () => {
    const token = jwt.sign({
      sub: 'clerk-1',
      name: 'Lavanya Rao',
      email: 'clerk@edufinance.local',
      role: 'Fee Clerk',
    }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.data.role).toBe('FEE_CLERK');
    expect(me.body.data.permissions).toContain('fees.collect');
  });

  test('does not mount development login when auth mode is jwt', async () => {
    process.env.AUTH_MODE = 'jwt';
    const jwtApp = createApp();
    const response = await request(jwtApp).post('/api/v1/dev-auth/login').send({
      email: 'accountant@edufinance.local',
      password: 'correct-password',
    });
    expect(response.status).toBe(404);
    process.env.AUTH_MODE = 'mock';
  });
});

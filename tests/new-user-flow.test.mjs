import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000/api';

describe('New User Flow & SRM Lockout Prevention Tests', () => {
  let isBackendLive = false;

  before(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (res.ok) {
        const body = await res.json();
        isBackendLive = body.status === 'ok';
      }
    } catch {
      isBackendLive = false;
    }
  });

  test('Backend is running and healthy', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running at ' + BACKEND_URL);
      return;
    }
    const res = await fetch(`${BACKEND_URL}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  test('POST /api/attendance/login without password for new user returns 401 and does not lock out SRM', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    const res = await fetch(`${BACKEND_URL}/attendance/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent_new_user_test@srmist.edu.in' })
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /invalid password/i);
  });

  test('POST /api/calendar/login without password for new user returns 401 and avoids scraping', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    const res = await fetch(`${BACKEND_URL}/calendar/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent_new_user_test@srmist.edu.in' })
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /invalid password/i);
  });

  test('POST /api/grades/login without password for new user returns 401 and avoids scraping', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    const res = await fetch(`${BACKEND_URL}/grades/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent_new_user_test@srmist.edu.in' })
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /invalid password/i);
  });

  test('POST /api/internal-marks/login without password for new user returns 401 and avoids scraping', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    const res = await fetch(`${BACKEND_URL}/internal-marks/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent_new_user_test@srmist.edu.in' })
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /invalid password/i);
  });
});

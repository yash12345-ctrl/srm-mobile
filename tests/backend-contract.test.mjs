import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000/api';

describe('Backend Connection & API Contract Tests', () => {
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

  test('GET /api/health responds with 200 OK and expected structure', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running at ' + BACKEND_URL);
      return;
    }
    const res = await fetch(`${BACKEND_URL}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.ok(data.message);
  });

  test('POST /api/academia/login rejects missing credentials with 400 Bad Request', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    const res = await fetch(`${BACKEND_URL}/academia/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error);
  });

  test('POST /api/attendance/login rejects missing username with 400 Bad Request', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    const res = await fetch(`${BACKEND_URL}/attendance/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error);
  });

  test('POST /api/calendar/login rejects missing username with 400 Bad Request', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    const res = await fetch(`${BACKEND_URL}/calendar/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('POST /api/internal-marks/login rejects missing username with 400 Bad Request', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    const res = await fetch(`${BACKEND_URL}/internal-marks/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('POST /api/grades/login rejects missing username with 400 Bad Request', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    const res = await fetch(`${BACKEND_URL}/grades/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('Verifies cached attendance endpoint returns contract matching mobile app', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    // Attempt cache fetch for existing user (cached data does not trigger captcha)
    const res = await fetch(`${BACKEND_URL}/attendance/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'yt7643@srmist.edu.in', forceSync: false })
    });
    // Can be 200 (if in cache/db) or 401
    if (res.status === 200) {
      const data = await res.json();
      if (data.success) {
        assert.ok(Array.isArray(data.attendance), 'attendance should be an array');
        if (data.attendance.length > 0) {
          const item = data.attendance[0];
          assert.ok('code' in item, 'Subject must have code');
          assert.ok('percentage' in item, 'Subject must have percentage');
        }
      }
    }
  });

  test('Verifies calendar endpoint contract matching mobile app', async (t) => {
    if (!isBackendLive) {
      t.skip('Backend server is not running');
      return;
    }
    const res = await fetch(`${BACKEND_URL}/calendar/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'yt7643@srmist.edu.in', forceSync: false })
    });
    if (res.status === 200) {
      const data = await res.json();
      if (data.success) {
        assert.ok(Array.isArray(data.rows), 'calendar should have rows array');
        if (data.rows.length > 0) {
          const row = data.rows[0];
          assert.ok('date' in row, 'Row must have date');
          assert.ok('dayOrder' in row, 'Row must have dayOrder');
        }
      }
    }
  });
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const sharp = require('sharp');
const { nasImageUrl, allowedImageUrl } = require('./security');

test('NAS paths cannot leave the photo directory', () => {
  assert.equal(nasImageUrl('https://nas.example/photos', 'portraits/a b.jpg'), 'https://nas.example/photos/portraits/a%20b.jpg');
  for (const value of ['../private.jpg', '%2e%2e/private.jpg', '/private.jpg', 'a/../../private.jpg', 'a\\..\\private.jpg', 'a.jpg?x=1', 'a.svg', 'https://evil.example/a.jpg']) {
    assert.throws(() => nasImageUrl('https://nas.example/photos', value));
  }
  assert.equal(allowedImageUrl('javascript:alert(1)'), false);
  assert.equal(allowedImageUrl('https://user:password@example.com/a.jpg'), false);
  assert.equal(allowedImageUrl('https://example.com/a.jpg'), true);
});

test('production refuses missing security configuration', () => {
  const env = { ...process.env, NODE_ENV: 'production', SESSION_SECRET: '', GOOGLE_ALLOWED_EMAILS: '' };
  const result = spawnSync(process.execPath, ['server/index.js'], { cwd: path.resolve(__dirname, '..'), env, encoding: 'utf8', timeout: 5000 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SESSION_SECRET/);
  const missingAllowlist = spawnSync(process.execPath, ['server/index.js'], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000,
    env: { ...env, SESSION_SECRET: crypto.randomBytes(32).toString('hex'), FRONTEND_URL: 'https://site.example', BACKEND_URL: 'https://api.example', GOOGLE_CALLBACK_URL: 'https://api.example/auth/google/callback', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret' }
  });
  assert.notEqual(missingAllowlist.status, 0);
  assert.match(missingAllowlist.stderr, /GOOGLE_ALLOWED_EMAILS/);
});

test('HTTP security and authenticated gallery workflows', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photography-security-'));
  const secret = crypto.randomBytes(32).toString('hex');
  Object.assign(process.env, {
    NODE_ENV: 'test', SESSION_SECRET: secret, GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_ALLOWED_EMAILS: 'admin@example.com', FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:4000', GOOGLE_CALLBACK_URL: 'http://localhost:4000/auth/google/callback',
    DATA_DIR: path.join(tempRoot, 'data'), UPLOADS_DIR: path.join(tempRoot, 'uploads'), NAS_BASE_URL: 'https://nas.example/photos'
  });
  const { app, sessionStore } = require('./index');
  await t.test('Google login rejects unlisted or unverified accounts', async () => {
    const verify = require('passport')._strategy('google')._verify;
    const check = (email, verified) => new Promise((resolve, reject) => verify('', '', {
      id: 'google-test', emails: [{ value: email }], _json: { email_verified: verified }
    }, (error, user) => error ? reject(error) : resolve(user)));
    assert.equal(await check('stranger@example.com', true), false);
    assert.equal(await check('admin@example.com', false), false);
    assert.equal((await check('admin@example.com', true)).email, 'admin@example.com');
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    // Only remove the isolated, randomly-created test directory in the OS temp root.
    const resolved = path.resolve(tempRoot);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('photography-security-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const csrfResponse = await fetch(`${base}/api/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  const anonymousCookie = csrfResponse.headers.get('set-cookie').split(';')[0];
  const sessionId = crypto.randomBytes(24).toString('hex');
  const adminToken = crypto.randomBytes(32).toString('hex');
  await new Promise((resolve, reject) => sessionStore.set(sessionId, {
    cookie: { originalMaxAge: 28800000, expires: new Date(Date.now() + 28800000), httpOnly: true, path: '/' },
    passport: { user: { id: 'test-admin', email: 'admin@example.com' } }, csrfToken: adminToken
  }, (error) => error ? reject(error) : resolve()));
  const signature = crypto.createHmac('sha256', secret).update(sessionId).digest('base64').replace(/=+$/, '');
  const adminCookie = `connect.sid=${encodeURIComponent(`s:${sessionId}.${signature}`)}`;
  const headers = { Origin: 'http://localhost:5173', Cookie: adminCookie, 'X-CSRF-Token': adminToken };
  const project = { id: 'security-test', name: 'Test', category: 'portraits', description: '', images: [], coverImage: '' };

  await t.test('public gallery works; anonymous users are never admins', async () => {
    assert.equal((await fetch(`${base}/api/profiles`)).status, 200);
    assert.equal((await (await fetch(`${base}/api/auth/user`)).json()).user, null);
    assert.equal((await fetch(`${base}/api/admin/profiles`)).status, 401);
    assert.equal((await fetch(`${base}/api/admin/profiles`, { method: 'POST', headers: { Origin: headers.Origin, Cookie: anonymousCookie, 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' }, body: JSON.stringify(project) })).status, 401);
  });
  await t.test('CSRF checks reject foreign origins, missing tokens, and another session token', async () => {
    for (const overrides of [{ Origin: 'https://evil.example' }, { 'X-CSRF-Token': '' }, { 'X-CSRF-Token': csrfToken }, { 'X-CSRF-Token': 'é'.repeat(64) }, { Origin: '' }]) {
      const response = await fetch(`${base}/api/admin/profiles`, { method: 'POST', headers: { ...headers, ...overrides, 'Content-Type': 'application/json' }, body: JSON.stringify(project) });
      assert.equal(response.status, 403);
    }
  });
  await t.test('allowed admin can create a project but cannot overwrite it', async () => {
    const options = { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(project) };
    assert.equal((await fetch(`${base}/api/admin/profiles`, options)).status, 200);
    assert.equal((await fetch(`${base}/api/admin/profiles`, options)).status, 409);
    assert.equal((await fetch(`${base}/api/admin/profiles`, { ...options, body: JSON.stringify({ ...project, id: '../escape' }) })).status, 400);
  });
  await t.test('unknown projects reject uploads before writing files', async () => {
    const form = new FormData();
    form.append('images', new Blob(['fake'], { type: 'image/jpeg' }), 'fake.jpg');
    assert.equal((await fetch(`${base}/api/admin/upload/missing`, { method: 'POST', headers, body: form })).status, 404);
    assert.equal(fs.existsSync(process.env.UPLOADS_DIR), false);
  });
  await t.test('forged images and unsafe URLs leave no uploaded files', async () => {
    const form = new FormData();
    form.append('images', new Blob(['<html>not a photo</html>'], { type: 'image/jpeg' }), 'fake.html');
    assert.equal((await fetch(`${base}/api/admin/upload/security-test`, { method: 'POST', headers, body: form })).status, 400);
    assert.deepEqual(fs.readdirSync(path.join(process.env.UPLOADS_DIR, '.pending')), []);
    const urls = new FormData();
    urls.append('urls', JSON.stringify(['javascript:alert(1)']));
    assert.equal((await fetch(`${base}/api/admin/upload/security-test`, { method: 'POST', headers, body: urls })).status, 400);
  });
  await t.test('valid photos preserve bytes and support cover selection', async () => {
    const bytes = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const form = new FormData();
    form.append('images', new Blob([bytes], { type: 'image/png' }), 'misleading.html');
    const uploaded = await fetch(`${base}/api/admin/upload/security-test`, { method: 'POST', headers, body: form });
    assert.equal(uploaded.status, 200, await uploaded.text());
    const profile = await (await fetch(`${base}/api/profiles/security-test`)).json();
    const url = new URL(profile.images[0].path);
    assert.match(url.pathname, /\.png$/);
    const image = await fetch(`${base}${url.pathname}`);
    assert.equal(image.status, 200);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
    const setCover = await fetch(`${base}/api/admin/profiles/security-test/cover`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ imagePath: profile.images[0].path }) });
    assert.equal(setCover.status, 200);
  });
  await t.test('OAuth uses state and private responses are not cached', async () => {
    const response = await fetch(`${base}/auth/google`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.ok(new URL(response.headers.get('location')).searchParams.get('state'));
    const forgedCallback = await fetch(`${base}/auth/google/callback?code=untrusted`, { redirect: 'manual' });
    assert.equal(forgedCallback.status, 302);
    assert.match(forgedCallback.headers.get('location'), /auth=failed/);
    assert.equal((await fetch(`${base}/api/auth/user`)).headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(`${base}/images/%2e%2e%2fprivate.jpg`)).status, 400);
  });
  await t.test('admin can delete its test project and logout invalidates the session', async () => {
    assert.equal((await fetch(`${base}/api/admin/profiles/security-test`, { method: 'DELETE', headers })).status, 200);
    assert.equal(fs.existsSync(path.join(process.env.UPLOADS_DIR, 'security-test')), false);
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers })).status, 200);
    assert.equal((await fetch(`${base}/api/admin/profiles`, { headers: { Cookie: adminCookie } })).status, 401);
  });
});

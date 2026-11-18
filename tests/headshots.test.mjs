import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import ts from 'typescript';
import { prepareHeadshot, HEADSHOT_MAX_BYTES } from '../src/lib/headshotImage.ts';

function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; }, crypto: { randomUUID }, Buffer, File, Response, console });
  return exports;
}
const presentation = load('lib/headshotPresentation.ts', { '../content/site': { practitioners: [{ slug: 'virginie', image: '/virginie.jpg' }] } });
const userId = randomUUID(), oldPath = `${userId}/${randomUUID()}.webp`;

function storageFixture({ uploadFails = false, metadataFails = false, bucketMissing = false, publicBucket = false } = {}) {
  const calls = [], metadata = { existing: 'kept', headshot_path: oldPath };
  let exists = !bucketMissing;
  const client = {
    auth: { admin: {
      getUserById: async id => { calls.push(['getUser', id]); return { data: { user: { app_metadata: metadata } } }; },
      updateUserById: async (id, value) => { calls.push(['update', id, value]); return { error: metadataFails ? new Error('failed') : null }; },
    } },
    storage: {
      getBucket: async () => ({ data: exists ? { public: publicBucket } : null }),
      createBucket: async (bucket, options) => { calls.push(['createBucket', bucket, options]); exists = true; return { data: { name: bucket } }; },
      from: () => ({
        upload: async (path, image, options) => { calls.push(['upload', path, options]); return { error: uploadFails ? new Error('failed') : null }; },
        remove: async paths => { calls.push(['remove', paths]); return { error: null }; },
      }),
    },
  };
  const service = load('lib/headshots.ts', { './supabase/server': { getSupabaseAdmin: () => client }, './headshotPresentation': presentation });
  return { service, calls };
}

test('valid photos are decoded, cropped and stripped of EXIF metadata', async () => {
  const source = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#ddbbaa' } }).jpeg().withMetadata().toBuffer();
  const result = await prepareHeadshot(new File([source], 'portrait.jpg', { type: 'image/jpeg' }));
  const info = await sharp(result).metadata();
  assert.equal(info.width, 512); assert.equal(info.height, 512); assert.equal(info.format, 'webp'); assert.equal(info.exif, undefined);
  assert.equal(await prepareHeadshot(null), null);
});

test('oversized, corrupt, disguised and extremely large photos are rejected', async () => {
  await assert.rejects(prepareHeadshot(new File([new Uint8Array(HEADSHOT_MAX_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' })), /headshot_size/);
  await assert.rejects(prepareHeadshot(new File(['not a photo'], 'fake.jpg', { type: 'image/jpeg' })), /headshot_type/);
  await assert.rejects(prepareHeadshot(new File(['<svg/>'], 'bad.svg', { type: 'image/svg\+xml' })), /headshot_type/);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80"/></svg>');
  await assert.rejects(prepareHeadshot(new File([svg], 'disguised.png', { type: 'image/png' })), /headshot_type/);
  const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#ffffff' } }).png().toBuffer();
  await assert.rejects(prepareHeadshot(new File([huge], 'huge.png', { type: 'image/png' })), /headshot_dimensions/);
});

test('only a stored object owned by this user can become the displayed headshot', () => {
  assert.equal(presentation.ownHeadshotPath(oldPath, userId), oldPath);
  for (const value of [`other/${randomUUID()}.webp`, `${userId}/../other.webp`, 'https://evil.test/x', `${userId}/nested/${randomUUID()}.webp`]) assert.equal(presentation.ownHeadshotPath(value, userId), null);
  const user = { sub: userId, name: 'Virginie', roles: ['super_admin'] };
  assert.equal(presentation.userPortrait(user).src, '/virginie.jpg');
  assert.match(presentation.userPortrait({ ...user, headshotPath: oldPath }).src, /^\/api\/profile\/headshot\?v=/);
  assert.equal(presentation.userPortrait({ ...user, roles: ['customer'] }), null);
});

test('replacement stores the new object before updating metadata and removing the old object', async () => {
  const { service, calls } = storageFixture({ bucketMissing: true });
  const path = await service.saveHeadshot(userId, Buffer.from('processed photo'));
  assert.ok(path.startsWith(`${userId}/`));
  const bucket = calls.find(call => call[0] === 'createBucket');
  assert.equal(bucket[2].public, false);
  const update = calls.find(call => call[0] === 'update');
  assert.equal(update[2].app_metadata.existing, 'kept'); assert.equal(update[2].app_metadata.headshot_path, path);
  assert.ok(calls.findIndex(call => call[0] === 'upload') < calls.indexOf(update));
  assert.ok(calls.findIndex(call => call[0] === 'remove') > calls.indexOf(update));
  assert.equal(calls.at(-1)[1][0], oldPath);
});

test('a failed metadata save cleans the new upload and preserves the existing image', async () => {
  const { service, calls } = storageFixture({ metadataFails: true });
  await assert.rejects(service.saveHeadshot(userId, Buffer.from('photo')), /headshot_failed/);
  const uploaded = calls.find(call => call[0] === 'upload')[1];
  assert.equal(calls.at(-1)[1][0], uploaded); assert.notEqual(uploaded, oldPath);
});

test('a failed upload never changes the current photo; a public bucket is refused', async () => {
  const { service, calls } = storageFixture({ uploadFails: true });
  await assert.rejects(service.saveHeadshot(userId, Buffer.from('photo')), /headshot_failed/);
  assert.ok(!calls.some(call => call[0] === 'update'));
  await assert.rejects(storageFixture({ publicBucket: true }).service.saveHeadshot(userId, Buffer.from('photo')), /headshot_failed/);
});

test('removing a headshot clears the reference before deleting the owned object', async () => {
  const { service, calls } = storageFixture();
  assert.equal(await service.saveHeadshot(userId, null), null);
  assert.equal(calls.find(call => call[0] === 'update')[2].app_metadata.headshot_path, null);
  assert.equal(calls.at(-1)[1][0], oldPath);
  assert.ok(!calls.some(call => call[0] === 'upload'));
});

test('the photo API requires authentication and never accepts a target user ID', async () => {
  const saved = [];
  const api = load('pages/api/profile/headshot.ts', {
    '../../../lib/adminAuth': { isTrustedFormOrigin: () => true },
    '../../../lib/headshotImage': { HEADSHOT_ERRORS: {}, prepareHeadshot: async () => Buffer.from('photo') },
    '../../../lib/headshots': { HEADSHOT_BUCKET: 'user-headshots', saveHeadshot: async (...args) => saved.push(args) },
    '../../../lib/headshotPresentation': presentation,
    '../../../lib/supabase/server': { getSupabaseAdmin: () => { throw new Error('unexpected'); } },
  });
  assert.equal((await api.GET({ locals: {} })).status, 401);
  assert.equal((await api.POST({ locals: {} })).status, 401);
  const form = new FormData(); form.set('user_id', 'someone-else'); form.set('return_to', 'https://evil.test');
  const response = await api.POST({ locals: { currentUser: { sub: userId, roles: ['employee'] } }, request: new Request('http://localhost/api/profile/headshot', { method: 'POST', body: form }) });
  assert.equal(saved[0][0], userId); assert.equal(response.headers.get('location'), '/admin/account?headshot=saved#headshot');
});

test('creating a staff account attaches the photo, and rolls back the account if saving fails', async () => {
  for (const fails of [false, true]) {
    const calls = [];
    const query = { delete: () => query, eq: () => query, upsert: async () => ({ error: null }), then: resolve => Promise.resolve({ error: null }).then(resolve) };
    const users = load('lib/adminUsers.ts', {
      './supabase/server': { getSupabaseAdmin: () => ({ from: () => query, auth: { admin: {
        createUser: async () => ({ data: { user: { id: userId } } }),
        deleteUser: async id => { calls.push(['delete', id]); return {}; },
      } } }) },
      './securityAudit': { writeSecurityAudit: async () => calls.push(['audit']) },
      './headshots': { saveHeadshot: async id => { calls.push(['save', id]); if (fails) throw new Error('headshot_failed'); return oldPath; }, removeHeadshotObject: async () => {} },
    });
    const create = users.createStaffUser({ email: 'staff@example.test', fullName: 'Test medewerker', temporaryPassword: 'test-password-123', role: 'employee', headshot: Buffer.from('photo') }, { userId: randomUUID(), email: 'owner@example.test' });
    if (fails) { await assert.rejects(create, /headshot_failed/); assert.equal(calls.at(-1)[0], 'delete'); }
    else { assert.equal(await create, userId); assert.equal(calls.at(-1)[0], 'audit'); }
  }
});

test('all staff can edit their own account without gaining organisation settings or user management', () => {
  const permissions = load('lib/adminPermissions.ts');
  assert.equal(permissions.requiredAdminPermission('/admin/account'), 'account.manage');
  for (const role of ['super_admin', 'support', 'employee', 'practitioner']) assert.equal(permissions.hasAdminPermission([role], 'account.manage'), true);
  for (const role of ['support', 'employee', 'practitioner', 'customer']) {
    assert.equal(permissions.hasAdminPermission([role], 'integrations.read'), false);
    assert.equal(permissions.hasAdminPermission([role], 'users.manage'), false);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load = (file, deps = {}) => {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (n) => {
        if (!Object.hasOwn(deps, n)) throw Error(n);
        return deps[n];
      },
      URL,
      Request,
      Response,
      Map,
      Set,
      Intl,
      Date,
    },
  );
  return exports;
};
const permissions = load('../src/lib/adminPermissions.ts'),
  types = load('../src/lib/platformUpdateTypes.ts');
const id = '11111111-1111-4111-8111-111111111111';
const user = (role) => ({ sub: id, name: 'Virginie', roles: [role] });
function setup(role = 'super_admin', trusted = true, mailFails = false) {
  const calls = [];
  const route = load('../src/pages/api/admin/updates/index.ts', {
    '../../../../lib/updateFeedbackMail': {
      deliverUpdateFeedbackMail: async () => {
        if (mailFails) throw Error('offline');
        return { sent: 1, failed: 0, configured: true };
      },
    },
    '../../../../lib/adminAuth': {
      hasPermission: (u, p) => !!u && permissions.hasAdminPermission(u.roles, p),
      isTrustedFormOrigin: () => trusted,
    },
    '../../../../lib/supabase/server': {
      getSupabaseAdmin: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: id, error: null };
        },
        from: () => {
          throw Error('unexpected read');
        },
      }),
    },
    '../../../../lib/platformUpdateTypes': types,
  });
  return {
    route,
    calls,
    ctx: (body) => ({
      locals: { adminUser: role ? user(role) : null },
      request: new Request('http://localhost/api/admin/updates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      url: new URL('http://localhost/api/admin/updates'),
    }),
  };
}
test('updates are exclusively available to superadmins across page and API paths', () => {
  for (const role of ['support', 'employee', 'practitioner', 'customer'])
    for (const path of ['/admin/updates', '/admin/updates/test', '/api/admin/updates'])
      assert.equal(
        permissions.hasAdminPermission([role], permissions.requiredAdminPermission(path)),
        false,
      );
  assert.equal(permissions.hasAdminPermission(['super_admin'], 'updates.manage'), true);
  assert.equal(permissions.requiredAdminPermission('/admin/updates-other'), null);
});
test('anonymous, staff and cross-origin writes stop before storage', async () => {
  for (const role of [null, 'support', 'employee', 'practitioner', 'customer']) {
    const s = setup(role);
    assert.equal(
      (await s.route.POST(s.ctx({ action: 'comment', id, data: { body: 'Hallo', token: id } })))
        .status,
      403,
    );
    assert.equal(s.calls.length, 0);
  }
  const s = setup('super_admin', false);
  assert.equal(
    (await s.route.POST(s.ctx({ action: 'comment', id, data: { body: 'Hallo', token: id } })))
      .status,
    403,
  );
  assert.equal(s.calls.length, 0);
});
test('comments enforce identity, size, retry tokens and reply references', async () => {
  const s = setup();
  for (const data of [
    { body: '', token: id },
    { body: 'x'.repeat(4001), token: id },
    { body: 'Vraag', token: 'bad' },
    { body: 'Vraag', token: id, reply_to: 'bad' },
  ])
    assert.equal((await s.route.POST(s.ctx({ action: 'comment', id, data }))).status, 400);
  assert.equal(s.calls.length, 0);
  assert.equal(
    (
      await s.route.POST(
        s.ctx({
          action: 'comment',
          id,
          data: { body: 'Mijn vraag', token: id, author_id: 'forged' },
        }),
      )
    ).status,
    200,
  );
  assert.equal(s.calls[0].args.p_actor, id);
  assert.equal(s.calls[0].args.p_name, 'Virginie');
});
test('editor rejects unsafe links, malformed revisions and status values', async () => {
  const s = setup();
  const data = {
    title: 'Titel',
    summary: 'De samenvatting',
    body: 'De uitleg',
    next_step: '',
    category: 'Werkruimte',
    published: false,
    action_path: 'https://evil.invalid',
    action_label: 'Open',
    revision: 1,
    notify: false,
  };
  assert.equal((await s.route.POST(s.ctx({ action: 'edit', id, data }))).status, 400);
  assert.equal(
    (
      await s.route.POST(
        s.ctx({
          action: 'event',
          id,
          data: {
            title: 'Titel',
            body: 'Een mijlpaal',
            status: 'unknown',
            revision: 1,
            next_step: '',
          },
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await s.route.POST(s.ctx({ action: 'read', id, data: { revision: -1 } }))).status,
    400,
  );
  assert.equal(s.calls.length, 0);
  assert.equal(types.validUpdatePath('//evil.invalid'), false);
  assert.equal(types.validUpdatePath('/admin/agenda'), true);
  assert.equal(types.validUpdatePath('/admin/../api/admin/users'), false);
});
test('feedback cannot be called answered without a visible reply', async () => {
  const s = setup();
  assert.equal(
    (
      await s.route.POST(
        s.ctx({ action: 'feedback', id, data: { comment_id: id, feedback_status: 'answered' } }),
      )
    ).status,
    400,
  );
  assert.equal(s.calls.length, 0);
});

test('a mail outage keeps saved feedback successful and reports pending notification', async () => {
  const s = setup('super_admin', true, true);
  const response = await s.route.POST(
    s.ctx({ action: 'comment', id, data: { body: 'Mijn feedback', token: id } }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).notification, 'pending');
  assert.equal(s.calls.length, 1);
});

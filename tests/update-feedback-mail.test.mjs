import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
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
      Date,
      Intl,
      Promise,
    },
  );
  return exports;
};
const template = load('../src/lib/emailTemplate.ts'),
  types = load('../src/lib/platformUpdateTypes.ts');
const content = load('../src/lib/updateFeedbackMailContent.ts', {
  './emailTemplate': template,
  './platformUpdateTypes': types,
  './site': { SITE_ORIGIN: 'https://www.mygrowise.be' },
});
const payload = {
  comment_id: 'id',
  slug: 'afspraken-makkelijker',
  title: 'Afspraken vinden',
  summary: 'Afspraken bij de juiste cliënt.',
  status: 'in_progress',
  next_step: 'De telefoonweergave nakijken.',
  category: 'Agenda & cliënten',
  audience: 'dashboard',
  author_name: 'Virginie',
  author_email: 'fixture@example.invalid',
  body: 'Kan dit ook op telefoon?\n<script>alert(1)</script>',
  created_at: '2026-11-18T13:00:00Z',
  parent_body: 'Een eerdere vraag.',
  milestone_title: 'De eerste weergave',
};
test('feedback mail includes the reaction, context, lifecycle, earlier message, milestone and protected deep link in HTML and text', () => {
  const mail = content.updateFeedbackMailContent(payload);
  for (const text of [
    'Virginie',
    'Afspraken vinden',
    'Dashboard',
    'In uitvoering',
    'Kan dit ook op telefoon?',
    'Een eerdere vraag.',
    'De eerste weergave',
    'https://www.mygrowise.be/admin/updates/afspraken-makkelijker#feedback-title',
  ]) {
    assert.ok(mail.html.includes(text), text);
    assert.ok(mail.text.includes(text), text);
  }
  assert.ok(!mail.html.includes('<script>'));
  assert.ok(mail.html.includes('&lt;script&gt;'));
  assert.match(mail.subject, /Feedback van Virginie/);
  assert.ok(mail.html.includes('role="presentation"'));
});
function worker({ failure = false, ready = true } = {}) {
  let claims = 0;
  const messages = [],
    writes = [];
  const db = {
    rpc: async () => {
      claims++;
      return {
        data: [
          {
            id: 'job-1',
            comment_id: 'comment-1',
            lease_token: 'lease-1',
            attempts: 1,
            recipient: 'forged@example.invalid',
            payload,
          },
        ],
        error: null,
      };
    },
    from: () => {
      const q = {
        update: (data) => {
          writes.push({ data, filters: [] });
          return q;
        },
        eq: (key, value) => {
          writes.at(-1).filters.push([key, value]);
          return q;
        },
        select: () => q,
        then: (r) => Promise.resolve({ data: [{ id: 'job-1' }], error: null }).then(r),
      };
      return q;
    },
  };
  const service = load('../src/lib/updateFeedbackMail.ts', {
    './supabase/server': { getSupabaseAdmin: () => db },
    './commerce/websiteMail': {
      websiteMailReady: () => ready,
      sendWebsiteEmail: async (...args) => {
        messages.push(args);
        if (failure) throw Error('SMTP unavailable');
      },
    },
    './updateFeedbackMailContent': content,
  });
  return {
    service,
    messages,
    writes,
    get claims() {
      return claims;
    },
  };
}
test('worker sends only to the configured designer with a stable Message-ID and records SMTP acceptance under its lease', async () => {
  const s = worker();
  const result = await s.service.deliverUpdateFeedbackMail(1, 'comment-1');
  assert.equal(result.sent, 1);
  assert.equal(s.messages[0][0], 'bourguignonphotography@gmail.com');
  assert.equal(
    s.messages[0][7],
    587,
    'feedback uses authenticated STARTTLS; other queues keep their defaults',
  );
  assert.equal(s.messages[0][4], '<update-feedback-comment-1@mygrowise.be>');
  assert.equal(s.writes[0].data.status, 'sent');
  assert.ok(s.writes[0].filters.some(([k, v]) => k === 'lease_token' && v === 'lease-1'));
});
test('SMTP failure preserves a retryable job and never reports success', async () => {
  const s = worker({ failure: true });
  const result = await s.service.deliverUpdateFeedbackMail();
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 1);
  assert.equal(s.writes[0].data.status, 'pending');
  assert.ok(s.writes[0].data.next_attempt_at);
});
test('unconfigured mail leaves queued feedback untouched for later delivery', async () => {
  const s = worker({ ready: false });
  const result = await s.service.deliverUpdateFeedbackMail();
  assert.equal(result.configured, false);
  assert.equal(s.claims, 0);
  assert.equal(s.writes.length, 0);
});

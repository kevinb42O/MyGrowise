// Preview by default; --send sends one clearly labelled test to the approved designer.
import 'dotenv/config';
import { build } from 'esbuild';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import assert from 'node:assert/strict';
const send = process.argv.includes('--send');
const runtime = new URL('./.update-feedback-test-runtime.mjs', import.meta.url);
let db, updateId, commentId;
try {
  const compiled = await build({
    stdin: {
      contents:
        "export {deliverUpdateFeedbackMail} from './src/lib/updateFeedbackMail'; export {updateFeedbackMailContent} from './src/lib/updateFeedbackMailContent';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    write: false,
    define: { 'import.meta.env': 'process.env' },
  });
  await writeFile(runtime, compiled.outputFiles[0].text, { flag: 'wx' });
  const { deliverUpdateFeedbackMail, updateFeedbackMailContent } = await import(runtime.href);
  const payload = {
    comment_id: randomUUID(),
    slug: 'updates-samen-verder',
    title: '[TEST] Feedbackmeldingen voor de webdesigner',
    summary:
      'Virginie kan verbeteringen lezen, opvolgen en feedback geven in de nieuwe Updates-sectie.',
    status: 'review',
    next_step: 'De laatste controles en de uitrol van de applicatie.',
    category: 'Werkruimte',
    audience: 'dashboard',
    author_name: 'Kevin (technische test)',
    author_email: null,
    body: 'Dit is de afgesproken test van de automatische feedbackmail.\n\nBij nieuwe feedback ontvang je voortaan de reactie, het onderwerp, de voortgang en een directe link. Je hoeft het dashboard niet voortdurend te controleren.\n\nDit is een testbericht; er is geen echte feedback van Virginie aangemaakt.',
    created_at: new Date().toISOString(),
    parent_body: null,
    milestone_title: null,
  };
  const content = updateFeedbackMailContent(payload);
  await mkdir('output/updates', { recursive: true });
  await writeFile('output/updates/feedback-email.html', content.html);
  await writeFile('output/updates/feedback-email.txt', content.text);
  if (!send) {
    console.log(
      'Feedbackmail preview written to output/updates/feedback-email.html; no email sent.',
    );
  } else {
    db = new pg.Client({
      connectionString: process.env.SUPABASE_DB_URL,
      connectionTimeoutMillis: 10000,
    });
    await db.connect();
    const actor = (
      await db.query(
        "select p.id from profiles p join user_roles r on r.user_id=p.id where r.role::text='super_admin' order by p.id limit 1",
      )
    ).rows[0];
    assert.ok(actor, 'No superadmin profile available for a synthetic test.');
    updateId = randomUUID();
    commentId = payload.comment_id;
    await db.query('begin');
    try {
      await db.query(
        "insert into platform_updates(id,slug,title,summary,body,next_step,status,category,published) values($1,$2,$3,$4,$4,'Geen actie nodig.','review','Werkruimte',false)",
        [updateId, 'test-feedback-' + updateId, payload.title, payload.summary],
      );
      await db.query(
        'insert into platform_update_comments(id,update_id,author_id,author_name,body,revision) values($1,$2,$3,$4,$5,1)',
        [commentId, updateId, actor.id, payload.author_name, payload.body],
      );
      await db.query(
        'insert into platform_update_mail_jobs(comment_id,payload) values($1,$2) on conflict(comment_id) do update set payload=excluded.payload',
        [commentId, JSON.stringify(payload)],
      );
      await db.query('commit');
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
    const result = await deliverUpdateFeedbackMail(1, commentId);
    console.log('Feedback mail test outcome:', JSON.stringify(result));
    assert.equal(result.sent, 1, 'The real worker must record SMTP acceptance.');
    const job = (
      await db.query(
        'select status,sent_at,attempts from platform_update_mail_jobs where comment_id=$1',
        [commentId],
      )
    ).rows[0];
    assert.equal(job.status, 'sent');
    assert.ok(job.sent_at);
    console.log(
      JSON.stringify(
        {
          recipient: 'bourguignonphotography@gmail.com',
          subject: content.subject,
          result,
          recordedDelivery: job,
          meaning: 'SMTP accepted; inbox placement must be checked by the recipient.',
        },
        null,
        2,
      ),
    );
  }
} finally {
  if (db) {
    try {
      await db.query('begin');
      if (commentId) {
        await db.query('delete from platform_update_mail_jobs where comment_id=$1', [commentId]);
        await db.query('delete from platform_update_comments where id=$1', [commentId]);
      }
      if (updateId) await db.query('delete from platform_updates where id=$1', [updateId]);
      await db.query('commit');
    } finally {
      await db.end();
    }
  }
  await unlink(runtime).catch(() => {});
}

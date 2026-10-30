import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {renderEmail,renderTextEmail,emailUrl} from '../src/lib/emailTemplate.ts';
import {bookingMailContent} from '../src/lib/bookingMailContent.ts';
import {captureEmail} from '../src/lib/commerce/captureMail.ts';

test('email text and attributes escape hostile content and reject unsafe action URLs',()=>{
 const html=renderEmail({title:'<script>alert(1)</script>',preheader:'"preview"',paragraphs:['<img src=x onerror=alert(1)>'],details:[['Naam','<svg onload=alert(1)>']],action:{label:'Open',url:'javascript:alert(1)'},sections:[{title:'<test>',body:'<iframe src=x>'}]});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('<iframe'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;svg'));
 for(const url of ['data:text/html,test','https://user:secret@example.com','http://example.com','//example.com'])assert.equal(emailUrl(url),'');
 assert.equal(emailUrl('https://example.com/a?x=1&y=2'),'https://example.com/a?x=1&y=2');
});
test('appointment mail has Belgian time, matching end time and a real account action',()=>{
 const p={name:'Anne & Els',appointment:'Sessie',practitioner:'Margot',startsAt:'2026-11-12T09:00Z',endsAt:'2026-11-12T09:50Z',channel:'online',instructions:'Persoonlijke online-instructies'};
 const confirmed=bookingMailContent('confirmation',p,'https://mygrowise.vercel.app');
 assert.match(confirmed.html,/10:00 – 10:50/);assert.match(confirmed.html,/Anne &amp; Els/);assert.match(confirmed.html,/href="https:\/\/mygrowise.vercel.app\/account\/begeleiding"/);
 assert.match(bookingMailContent('rescheduled',p).html,/eerdere tijdstip is vervallen/);
 const cancelled=bookingMailContent('cancelled',p);assert.ok(!cancelled.html.includes(p.instructions));assert.ok(!cancelled.text.includes(p.instructions));assert.match(cancelled.html,/geannuleerd/);
});
test('Supabase templates retain executable provider placeholders and have no injected browser markup',()=>{
 for(const name of ['confirmation','recovery','invite','magic_link','email_change','reauthentication']){
  const html=readFileSync(new URL(`../supabase/templates/${name}.html`,import.meta.url),'utf8');
  assert.ok(html.includes(name==='reauthentication'?'{{ .Token }}':'href="{{ .ConfirmationURL }}"'),name);
  assert.ok(!html.includes('codex-browser'));assert.ok(!html.includes('Â·'));assert.ok(!html.includes('<script'));assert.match(html,/<html lang="nl">/);
 }
});
test('the development mailbox captures multipart HTML and plain text without sending',async()=>{
 const cwd=process.cwd(),dir=mkdtempSync(join(tmpdir(),'mygrowise-email-'));
 try{process.chdir(dir);await captureEmail('test@example.invalid','Testmail','Leesbare tekst','info@mygrowise.be','<synthetic@example.invalid>',renderTextEmail('Testmail','Leesbare tekst'));
 const record=JSON.parse(readFileSync(join(dir,'output/mail-test/messages.jsonl'),'utf8').trim());
 assert.match(record.mime,/multipart\/alternative/);assert.match(record.mime,/Content-Type: text\/plain/);assert.match(record.mime,/Content-Type: text\/html/);assert.match(record.mime,/Leesbare tekst/);
 }finally{process.chdir(cwd);rmSync(dir,{recursive:true,force:true});}
});
test('the production sender sends both alternatives and always closes its connection',async()=>{
 let message,closed=0,fail=false;
 const deps={nodemailer:{default:{createTransport:()=>({sendMail:async value=>{message=value;if(fail)throw Error('SMTP offline');},close:()=>closed++})}},'../supabase/server':{},'../supportMail':{supportMailReady:()=>true},'./purchases':{},'../emailTemplate':{renderEmail,renderTextEmail}};
 const source=readFileSync(new URL('../src/lib/commerce/websiteMail.ts',import.meta.url),'utf8').replaceAll('import.meta.env','__env');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:name=>{assert.ok(deps[name],name);return deps[name];},__env:{PROD:true,SUPPORT_FROM_EMAIL:'info@mygrowise.be'},Error});
 await exports.sendWebsiteEmail('test@example.invalid','Onderwerp','Volledige tekst');assert.equal(message.text,'Volledige tekst');assert.ok(message.html.includes('<html lang="nl">'));assert.equal(closed,1);
 fail=true;await assert.rejects(exports.sendWebsiteEmail('test@example.invalid','Onderwerp','Tekst'),/SMTP offline/);assert.equal(closed,2);
});

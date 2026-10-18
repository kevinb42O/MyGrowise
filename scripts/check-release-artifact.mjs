import 'dotenv/config';
import {readdirSync,readFileSync} from 'node:fs';import {join} from 'node:path';import assert from 'node:assert/strict';
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
const files=walk('.vercel/output');
const forbidden=files.filter(f=>/\/(?:output\/(?:mail-test|modules|questionnaires|agenda|practice-dashboard)|tests)\//.test(f.replace(/^\.vercel\/output\//,''))||/\/\.env(?:\.|$)|\.sqlite(?:-wal|-shm)?$|\/messages\.jsonl$/.test(f));
assert.deepEqual(forbidden,[],'Local captures, tests and environment files must not be bundled.');
const secrets=['SUPABASE_SECRET_KEY','SUPABASE_DB_URL','SUPPORT_SMTP_PASSWORD','CRON_SECRET','MIJNDIAD_ICAL_URL'].map(k=>process.env[k]).filter(v=>v&&v.length>=12);
for(const file of files.filter(f=>f.startsWith('.vercel/output/static/')&&/\.(?:js|html|json|css)$/.test(f))){const body=readFileSync(file,'utf8');assert.ok(!secrets.some(value=>body.includes(value)),`Private configuration present in public artifact: ${file}`);}
const crons=JSON.parse(readFileSync('vercel.json','utf8')).crons;
for(const cron of crons)assert.match(cron.schedule,/^\d{1,2} \d{1,2} \* \* \*$/,'Vercel Hobby cron must run at most once per day.');
console.log(`Release artifact checked: ${files.length} files, no local mailbox/environment data, no configured secrets in public assets, daily-only cron.`);

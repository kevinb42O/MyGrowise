import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function route({trusted=true,mailError=false}={}) {
 const sent=[];
 const dependencies={isTrustedFormOrigin:()=>trusted,requestSupabasePasswordReset:async(email,url)=>{sent.push({email,url});if(mailError)throw new Error('SMTP');},sanitizeAppRedirect:value=>typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')?value:''};
 const source=readFileSync(new URL('../src/pages/api/account/password-reset.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:()=>dependencies,Response,URL,Date,Map,Error});
 const run=form=>exports.POST({request:new Request('https://mygrowise.be/api/account/password-reset',{method:'POST',headers:{'x-forwarded-for':'192.0.2.211'},body:new URLSearchParams(form)})});
 return {sent,run};
}
test('password recovery keeps the requested purchase destination in the mail and confirmation',async()=>{
 const {sent,run}=route();const result=await run({email:'test@example.invalid',next:'/aankopen/afnames/example'});
 assert.equal(result.status,303);assert.equal(new URL(result.headers.get('location')).searchParams.get('next'),'/aankopen/afnames/example');
 assert.equal(new URL(sent[0].url).pathname,'/account/wachtwoord-herstellen');assert.equal(new URL(sent[0].url).searchParams.get('next'),'/aankopen/afnames/example');
});
test('password recovery rejects cross-origin requests before sending and sanitizes external return paths',async()=>{
 const denied=route({trusted:false});assert.equal((await denied.run({email:'test@example.invalid'})).status,403);assert.equal(denied.sent.length,0);
 const allowed=route();const response=await allowed.run({email:'test@example.invalid',next:'https://attacker.invalid'});assert.equal(new URL(response.headers.get('location')).searchParams.get('next'),'/account');assert.equal(new URL(allowed.sent[0].url).searchParams.get('next'),'/account');
});
test('recovery mail failure remains neutral and repeated failures retain the return destination',async()=>{
 const {run}=route({mailError:true});for(let i=0;i<5;i++){const response=await run({email:'test@example.invalid',next:'/aankopen'});assert.equal(new URL(response.headers.get('location')).searchParams.get('sent'),'1');}
 const limited=await run({email:'test@example.invalid',next:'/aankopen'});const url=new URL(limited.headers.get('location'));assert.equal(url.searchParams.get('error'),'rate_limited');assert.equal(url.searchParams.get('next'),'/aankopen');
});

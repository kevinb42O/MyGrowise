import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const customer={sub:'customer',emailConfirmed:true,roles:['customer']};
const id='12345678-1234-1234-1234-123456789abc';
const previous='2026-12-01T09:00:00Z',starts='2026-12-02T10:00:00Z';
function load({booking={id,practitioner_id:'therapist',status:'confirmed'},rpcError=null,freshError=null}={}){
 const calls=[];
 const db={from:table=>{calls.push(['from',table]);const query={select:()=>query,eq:(...args)=>{calls.push(['eq',...args]);return query;},maybeSingle:async()=>({data:booking})};return query;},rpc:async(...args)=>{calls.push(['rpc',...args]);return {error:rpcError};}};
 const deps={
  './supabase/server':{getSupabaseAdmin:()=>db},
  './adminAuth':{isCustomerAccount:u=>u.roles.length===1&&u.roles[0]==='customer'},
  './mijndiadSync':{ensurePracticeCalendarFresh:async(...args)=>{calls.push(['fresh',...args]);if(freshError)throw freshError;},ExternalCalendarUnavailableError:class extends Error{}},
 };
 const code=ts.transpileModule(readFileSync(new URL('../src/lib/customerRescheduling.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:name=>{assert.ok(deps[name],name);return deps[name];},Error,Date});
 const form=new FormData();form.set('starts_at',starts);form.set('previous_starts_at',previous);
 return {service:exports,calls,form};
}
test('rescheduling requires a verified customer before reading any appointment',async()=>{
 for(const user of [{...customer,emailConfirmed:false},{...customer,roles:['practitioner']}]){
  const {service,calls,form}=load();await assert.rejects(service.rescheduleCustomerAppointment(user,id,form),/bevestigd cliëntaccount/);assert.equal(calls.length,0);
 }
});
test('ownership-scoped lookup prevents changing another customer appointment',async()=>{
 const {service,calls,form}=load({booking:null});await assert.rejects(service.rescheduleCustomerAppointment(customer,id,form),/niet worden verplaatst/);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='customer_user_id'&&c[2]===customer.sub));assert.ok(!calls.some(c=>c[0]==='rpc'||c[0]==='fresh'));
});
test('calendar verification failure leaves the original appointment untouched',async()=>{
 const {service,calls,form}=load({freshError:new Error('calendar offline')});await assert.rejects(service.rescheduleCustomerAppointment(customer,id,form),/calendar offline/);assert.ok(!calls.some(c=>c[0]==='rpc'));
});
test('a successful reschedule uses the existing booking and carries optimistic concurrency data',async()=>{
 const {service,calls,form}=load();await service.rescheduleCustomerAppointment(customer,id,form,'request');
 const rpc=calls.find(c=>c[0]==='rpc');assert.equal(rpc[1],'reschedule_customer_appointment');
 assert.equal(rpc[2].p_booking,id);assert.equal(rpc[2].p_customer,customer.sub);assert.equal(rpc[2].p_starts,starts);assert.equal(rpc[2].p_previous,previous);assert.equal(rpc[2].p_request,'request');
 assert.ok(calls.findIndex(c=>c[0]==='fresh')<calls.findIndex(c=>c[0]==='rpc'));
});
test('occupied slots and stale forms give safe recovery messages',async()=>{
 for(const [rpcError,expected] of [[{code:'23P01',message:'slot_unavailable'},/intussen bezet.*bestaande afspraak blijft behouden/],[{code:'40001',message:'booking_changed'},/intussen gewijzigd.*Herlaad/],[{code:'40P01',message:'deadlock detected'},/intussen gewijzigd.*Herlaad/],[{message:'reschedule_too_late'},/te dichtbij/]]){
  const {service,form}=load({rpcError});await assert.rejects(service.rescheduleCustomerAppointment(customer,id,form),expected);
 }
});
test('invalid selection and nonconfirmed bookings cannot enter the rescheduling RPC',async()=>{
 const invalid=load();invalid.form.set('previous_starts_at','invalid');await assert.rejects(invalid.service.rescheduleCustomerAppointment(customer,id,invalid.form),/beschikbaar moment/);assert.equal(invalid.calls.length,0);
 const cancelled=load({booking:{id,status:'cancelled'}});await assert.rejects(cancelled.service.rescheduleCustomerAppointment(customer,id,cancelled.form),/niet worden verplaatst/);assert.ok(!cancelled.calls.some(c=>c[0]==='rpc'));
});

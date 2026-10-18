// Run the isolated 4323 dev instance with an intentionally unreachable DB API.
import assert from 'node:assert/strict';
for(const path of ['/begeleiding','/begeleiding/virginie','/afspraak','/afspraak/00000000-0000-4000-8000-000000000001','/api/availability/virginie']){
 const response=await fetch('http://localhost:4323'+path);assert.equal(response.status,503,path);const body=await response.text();assert.match(body,/tijdelijk niet bereikbaar/);assert.doesNotMatch(body,/astro-error|Stack trace|at getSupabaseAdmin|TypeError/);
}
console.log('5 outage checks passed: public guidance, therapist, appointment list, booking page and availability API show a recoverable error without a stack trace.');

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agendaRefreshDelay} from '../src/lib/agendaRefresh.ts';

test('external practice calendar follows the relative server deadline with a small safety margin',()=>{
 assert.equal(agendaRefreshDelay(true,true,{enabled:true,retryAfterSeconds:42}),42500);
 assert.equal(agendaRefreshDelay(true,true),60500);
});
test('outage backoff is respected and due checks cannot create a tight polling loop',()=>{
 assert.equal(agendaRefreshDelay(true,true,{enabled:true,retryAfterSeconds:900}),900500);
 for(const value of [0,-100])assert.equal(agendaRefreshDelay(true,true,{enabled:true,retryAfterSeconds:value}),5000);
 for(const value of [NaN,Infinity])assert.equal(agendaRefreshDelay(true,true,{enabled:true,retryAfterSeconds:value}),60500);
});
test('other calendars and inactive integrations keep the existing slower refresh rate',()=>{
 assert.equal(agendaRefreshDelay(false,true,{enabled:true,retryAfterSeconds:1}),600000);
 assert.equal(agendaRefreshDelay(true,false),300000);
 assert.equal(agendaRefreshDelay(true,true,{enabled:false,retryAfterSeconds:1}),300000);
});

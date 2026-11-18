import { test } from 'node:test';
import assert from 'node:assert/strict';
import {parseNoteDocument,plainNoteDocument,noteDocumentText,noteDocumentHtml,validatedNoteContent} from '../src/lib/noteDocument.ts';

test('legacy text round-trips single, empty and consecutive lines without changes',()=>{
 for(const text of ['', 'Eerste regel\nTweede regel','Een\n\nTwee','Een\n\n\nDrie','\nBegin\n','Zoë & <tekst>'])assert.equal(noteDocumentText(parseNoteDocument(plainNoteDocument(text))!),text);
});
test('supported rich structure round-trips and escapes text in every mark',()=>{
 const doc={type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Opvolging'}]},{type:'paragraph',content:[{type:'text',text:'<img src=x onerror=alert(1)>',marks:[{type:'bold'},{type:'italic'}]}]},{type:'orderedList',attrs:{start:1},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Rust'}]}]}]}]};
 const text=noteDocumentText(doc);
 assert.deepEqual(validatedNoteContent(text,JSON.stringify(doc)),{body:text,document:doc});
 const html=noteDocumentHtml(doc,text);
 assert.match(html,/<h4>Opvolging<\/h4>/);assert.match(html,/<em><strong>&lt;img/);assert.match(html,/<ol><li><p>Rust/);assert.ok(!html.includes('<img'));
});
test('rejects hostile, oversized and unsupported document structures',()=>{
 for(const doc of [[],{}, {type:'doc',content:[]},{type:'doc',content:[{type:'script'}]}, {type:'doc',content:[{type:'paragraph',attrs:{onclick:'x'}}]}, {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'x',marks:[{type:'link',attrs:{href:'javascript:x'}}]}]}]}, plainNoteDocument('x'.repeat(20001))])assert.throws(()=>parseNoteDocument(doc));
 assert.throws(()=>parseNoteDocument('{invalid'));
 assert.throws(()=>validatedNoteContent('anders',plainNoteDocument('origineel')),/mismatch/);
 assert.equal(noteDocumentHtml({type:'script'},'<script>\n&'), '&lt;script&gt;<br>&amp;');
 assert.equal(noteDocumentHtml(plainNoteDocument('afwijkend'),'juiste tekst'),'juiste tekst');
 assert.deepEqual(validatedNoteContent('  bestaand  ',null),{body:'bestaand',document:null});
});

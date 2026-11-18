/** A deliberately small, versionable document vocabulary. Never render submitted HTML. */
export type NoteNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: {type:string}[]; content?: NoteNode[] };
export type NoteDocument = { type:'doc'; content: NoteNode[] };
export const NOTE_TEXT_LIMIT = 20_000;
export const NOTE_DOCUMENT_BYTES = 200_000;
const object = (value:unknown): value is Record<string,unknown> => Boolean(value) && typeof value==='object' && !Array.isArray(value);

export function parseNoteDocument(input:unknown): NoteDocument | null {
  if(input===null || input===undefined || input==='') return null;
  let value:unknown=input;
  if(typeof input==='string') {
    if(input.length>NOTE_DOCUMENT_BYTES) throw new Error('invalid_note_document');
    try { value=JSON.parse(input); } catch { throw new Error('invalid_note_document'); }
  }
  let nodes=0;
  const visit=(node:unknown,parent:string,depth:number):NoteNode=>{
    if(!object(node)||++nodes>3000||depth>12||typeof node.type!=='string') throw new Error('invalid_note_document');
    const type=node.type;
    const allowed:Record<string,string[]>={root:['doc'],doc:['paragraph','heading','bulletList','orderedList'],paragraph:['text','hardBreak'],heading:['text','hardBreak'],bulletList:['listItem'],orderedList:['listItem'],listItem:['paragraph','bulletList','orderedList']};
    if(!allowed[parent]?.includes(type)||Object.keys(node).some(key=>!['type','text','attrs','marks','content'].includes(key))) throw new Error('invalid_note_document');
    const result:NoteNode={type};
    if(type==='text') {
      if(typeof node.text!=='string'||!node.text.length||node.content||node.attrs)throw new Error('invalid_note_document');
      result.text=node.text;
      if(node.marks!==undefined){
        if(!Array.isArray(node.marks)||node.marks.length>2)throw new Error('invalid_note_document');
        const marks=node.marks.map(mark=>{if(!object(mark)||Object.keys(mark).length!==1||!['bold','italic'].includes(String(mark.type)))throw new Error('invalid_note_document');return {type:String(mark.type)};});
        if(new Set(marks.map(mark=>mark.type)).size!==marks.length)throw new Error('invalid_note_document');
        if(marks.length)result.marks=marks;
      }
      return result;
    }
    if(node.text!==undefined||node.marks!==undefined)throw new Error('invalid_note_document');
    if(type==='heading'){
      if(!object(node.attrs)||node.attrs.level!==2||Object.keys(node.attrs).some(key=>key!=='level'))throw new Error('invalid_note_document');
      result.attrs={level:2};
    } else if(type==='orderedList') {
      if(node.attrs!==undefined && (!object(node.attrs)||Object.keys(node.attrs).some(key=>!['start','type'].includes(key))||node.attrs.type!=null||(node.attrs.start!==undefined&&node.attrs.start!==1)))throw new Error('invalid_note_document');
      result.attrs={start:1};
    } else if(node.attrs!==undefined && (!object(node.attrs)||Object.keys(node.attrs).length))throw new Error('invalid_note_document');
    if(type==='hardBreak') {if(node.content!==undefined)throw new Error('invalid_note_document');return result;}
    if(node.content!==undefined&&!Array.isArray(node.content))throw new Error('invalid_note_document');
    const content=(node.content as unknown[]|undefined||[]).map(child=>visit(child,type,depth+1));
    if(['doc','bulletList','orderedList','listItem'].includes(type)&&!content.length)throw new Error('invalid_note_document');
    if(type==='listItem'&&content[0]?.type!=='paragraph')throw new Error('invalid_note_document');
    if(content.length)result.content=content;
    return result;
  };
  const doc=visit(value,'root',0) as NoteDocument;
  if(noteDocumentText(doc).length>NOTE_TEXT_LIMIT||new TextEncoder().encode(JSON.stringify(doc)).length>NOTE_DOCUMENT_BYTES)throw new Error('note_document_too_long');
  return doc;
}

export function noteDocumentText(node:NoteNode):string {
  if(node.type==='text')return node.text||'';
  if(node.type==='hardBreak')return '\n';
  const separator=node.type==='doc'?'\n\n':['listItem','bulletList','orderedList'].includes(node.type)?'\n':'';
  return (node.content||[]).map(noteDocumentText).join(separator);
}
export function plainNoteDocument(text:string):NoteDocument {
  return {type:'doc',content:text.replace(/\r\n/g,'\n').split('\n\n').map(paragraph=>({type:'paragraph',content:paragraph.split('\n').flatMap((line,index)=>[...(index?[{type:'hardBreak'}]:[]),...(line?[{type:'text',text:line}]:[])])}))};
}
export function validatedNoteContent(body:unknown,document:unknown) {
  const text=typeof body==='string'?body.trim():'';
  const parsed=parseNoteDocument(document);
  if(parsed && noteDocumentText(parsed).trim()!==text)throw new Error('note_document_mismatch');
  return {body:text,document:parsed};
}
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function noteDocumentHtml(document:unknown,fallback:string):string {
  let doc:NoteDocument|null;
  try {doc=parseNoteDocument(document);}catch {doc=null;}
  if(doc && noteDocumentText(doc).trim()!==fallback.trim())doc=null;
  if(!doc)return escape(fallback).replace(/\r?\n/g,'<br>');
  const render=(node:NoteNode):string=>{
    if(node.type==='text')return (node.marks||[]).reduce((text,mark)=>mark.type==='bold'?`<strong>${text}</strong>`:`<em>${text}</em>`,escape(node.text||''));
    if(node.type==='hardBreak')return '<br>';
    const children=(node.content||[]).map(render).join('');
    const tag:Record<string,string>={paragraph:'p',heading:'h4',bulletList:'ul',orderedList:'ol',listItem:'li'};
    return node.type==='doc'?children:`<${tag[node.type]}>${children||'<br>'}</${tag[node.type]}>`;
  };
  return render(doc);
}

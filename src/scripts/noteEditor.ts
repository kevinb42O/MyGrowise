import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { closeHistory } from '@tiptap/pm/history';
import { Plugin } from '@tiptap/pm/state';
import { NOTE_TEXT_LIMIT, noteDocumentText, parseNoteDocument, plainNoteDocument } from '../lib/noteDocument';

// No browser persistence: the document lives only in the open, protected form.
document.querySelectorAll<HTMLElement>('[data-note-editor]').forEach(root => {
  if (root.dataset.editorReady) return;
  const fallback=root.querySelector<HTMLTextAreaElement>('[data-editor-fallback]')!;
  const field=root.querySelector<HTMLInputElement>('[data-editor-document]')!;
  const mount=root.querySelector<HTMLElement>('[data-editor-mount]')!;
  const toolbar=root.querySelector<HTMLElement>('[data-editor-toolbar]')!;
  const count=root.querySelector<HTMLElement>('[data-editor-count]')!;
  const error=root.querySelector<HTMLElement>('[data-editor-error]')!;
  const form=root.closest('form')!;
  const buttons=[...toolbar.querySelectorAll<HTMLButtonElement>('button')];
  const message=(text='')=>{error.textContent=text;error.hidden=!text;};
  let busy=false;
  let initial=plainNoteDocument(fallback.value);
  try {
    const stored=parseNoteDocument(field.value);
    if(stored && noteDocumentText(stored).trim()===fallback.value.trim())initial=stored;
  } catch { /* The existing plain text remains available. */ }
  const limits=Extension.create({
    name:'noteLimits',
    addProseMirrorPlugins() {
      return [new Plugin({filterTransaction(transaction) {
        if(!transaction.docChanged)return true;
        try {parseNoteDocument(transaction.doc.toJSON());return true;}
        catch {message('Deze wijziging is te groot. Gebruik maximaal 20.000 tekens en een eenvoudige structuur.');return false;}
      }})];
    },
  });
  const commands=(editor:Editor)=>({
    bold:()=>editor.chain().focus().toggleBold().run(),
    italic:()=>editor.chain().focus().toggleItalic().run(),
    paragraph:()=>editor.chain().focus().setParagraph().run(),
    heading:()=>editor.chain().focus().toggleHeading({level:2}).run(),
    bulletList:()=>editor.chain().focus().toggleBulletList().run(),
    orderedList:()=>editor.chain().focus().toggleOrderedList().run(),
    undo:()=>editor.chain().focus().undo().run(),
    redo:()=>editor.chain().focus().redo().run(),
  });
  const updateTools=(editor:Editor)=>{
    buttons.forEach(button=>{
      const name=button.dataset.editorCommand!;
      button.disabled=busy||(name==='undo'&&!editor.can().undo())||(name==='redo'&&!editor.can().redo());
      if(button.hasAttribute('aria-pressed'))button.setAttribute('aria-pressed',String(name==='heading'?editor.isActive('heading',{level:2}):editor.isActive(name)));
    });
    if(!buttons.some(button=>!button.disabled&&button.tabIndex===0)){
      buttons.forEach(button=>button.tabIndex=-1);
      const first=buttons.find(button=>!button.disabled);if(first)first.tabIndex=0;
    }
  };
  let editor:Editor;
  try {
    editor=new Editor({
      element:mount,content:initial,
      extensions:[StarterKit.configure({heading:{levels:[2]},blockquote:false,code:false,codeBlock:false,horizontalRule:false,strike:false,underline:false,link:false,trailingNode:false}),limits],
      editorProps:{
        attributes:{role:'textbox','aria-multiline':'true','aria-required':'true','aria-labelledby':`${fallback.id}-label`,'aria-describedby':`${fallback.id}-hint ${fallback.id}-count`,spellcheck:'true',lang:'nl','data-placeholder':fallback.placeholder,class:'record-editor__document'},
        // Ordered lists deliberately always start at one, including pasted content.
        transformPastedHTML:html=>html.replace(/\sstart\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,''),
      },
      onUpdate:({editor})=>{
        const doc=parseNoteDocument(editor.getJSON())!;
        fallback.value=noteDocumentText(doc);
        field.value=JSON.stringify(doc);
        count.textContent=`${fallback.value.length.toLocaleString('nl-BE')} / 20.000`;
        message();root.removeAttribute('data-editor-invalid');
        editor.view.dom.removeAttribute('aria-invalid');
        fallback.dispatchEvent(new Event('input',{bubbles:true}));
      },
      onTransaction:({editor})=>updateTools(editor),
    });
    // Validate once before replacing the working native fallback.
    const doc=parseNoteDocument(editor.getJSON())!;
    fallback.value=noteDocumentText(doc);field.value=JSON.stringify(doc);
  } catch {
    mount.replaceChildren();message('Tekstopmaak is niet beschikbaar. Je kunt je verslag als gewone tekst schrijven en bewaren.');return;
  }
  root.dataset.editorReady='true';fallback.hidden=true;fallback.required=false;
  mount.hidden=false;toolbar.hidden=false;field.disabled=false;
  count.textContent=`${fallback.value.length.toLocaleString('nl-BE')} / ${NOTE_TEXT_LIMIT.toLocaleString('nl-BE')}`;
  root.querySelector('label')!.addEventListener('click',event=>{event.preventDefault();editor.commands.focus();});
  updateTools(editor);
  buttons.forEach(button=>{
    button.addEventListener('mousedown',event=>event.preventDefault());
    button.addEventListener('click',()=>{
      if(busy)return;
      if(!['undo','redo'].includes(button.dataset.editorCommand!))editor.view.dispatch(closeHistory(editor.state.tr));
      commands(editor)[button.dataset.editorCommand as keyof ReturnType<typeof commands>]?.();
    });
    button.addEventListener('focus',()=>buttons.forEach(item=>item.tabIndex=item===button?0:-1));
  });
  toolbar.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const enabled=buttons.filter(button=>!button.disabled);
    const current=enabled.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?enabled.length-1:(current+(event.key==='ArrowRight'?1:-1)+enabled.length)%enabled.length;
    enabled[next]?.focus();
  });
  // Capture before the async save handler so empty rich documents cannot be submitted.
  form.addEventListener('submit',event=>{
    if(!fallback.value.trim()){
      event.preventDefault();root.dataset.editorInvalid='true';
      editor.view.dom.setAttribute('aria-invalid','true');
      message('Schrijf eerst de inhoud van je verslag.');editor.commands.focus();
    }
  },true);
  form.addEventListener('note-saving',()=>{busy=true;editor.setEditable(false,false);updateTools(editor);});
  form.addEventListener('note-save-failed',()=>{busy=false;editor.setEditable(true,false);updateTools(editor);});
  window.addEventListener('pagehide',event=>{if(!event.persisted)editor.destroy();});
});

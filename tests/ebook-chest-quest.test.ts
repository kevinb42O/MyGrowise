import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeChestQuest} from '../src/lib/ebooks/reader/chestQuest.ts';

// Exercise the real event handlers and cancellation; only browser primitives
// and animation clocks are replaced. Rendering is verified in the browser.
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function setup(savedValue?:string){
  const pending=new Set<{finish:()=>void;cancel:()=>void}>();
  const callbacks=new Map<number,FrameRequestCallback>();
  let drawCalls=0,frames=0,opens=0;
  class Element {
    hidden=false;disabled=false;textContent='';src='';className='';
    style:Record<string,string>={};parent:Element|undefined;
    children:Element[]=[];listeners=new Map<string,()=>void>();attributes=new Set<string>();
    addEventListener(event:string,callback:()=>void){this.listeners.set(event,callback);}
    emit(event:string){this.listeners.get(event)?.();}
    hasAttribute(name:string){return this.attributes.has(name);}
    append(child:Element){this.children.push(child);child.parent=this;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
    getBoundingClientRect(){return {x:10,y:10,width:50,height:100};}

    getContext(){return new Proxy({},{get:(_,name)=>()=>{if(name==='drawImage')drawCalls++;}});}
    animate(){
      let resolve:()=>void=()=>{},reject:(error:Error)=>void=()=>{};
      const finished=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
      const animation={finished,finish:()=>{pending.delete(animation);resolve();},cancel:()=>{pending.delete(animation);reject(Error('cancelled'));}};
      pending.add(animation);return animation;
    }
  }
  const elements=new Map<string,Element>();
  const get=(selector:string)=>{if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector)!;};
  const root=Object.assign(new Element(),{querySelector:get});
  const saved=new Map<string,string>();if(savedValue)saved.set('test-key',savedValue);
  const sounds:string[]=[];
  Object.assign(globalThis,{
    Path2D:class {},Image:Element,window:new Element(),
    document:{createElement:()=>new Element()},
    requestAnimationFrame:(callback:FrameRequestCallback)=>{frames++;callbacks.set(frames,callback);return frames;},cancelAnimationFrame:(id:number)=>callbacks.delete(id),
    localStorage:{getItem:(key:string)=>saved.get(key)||null,setItem:(key:string,value:string)=>saved.set(key,value)},
  });
  const quest=makeChestQuest(root as any,{storageKey:'test',page:()=>new Element() as any,calm:()=>false,sound:name=>sounds.push(name),interact:()=>{},open:()=>opens++});
  quest.setPage(10);
  return {quest,get,root,saved,sounds,pending,callbacks,opens:()=>opens,frames:()=>frames,drawCalls:()=>drawCalls,
    finish:async()=>{for(const animation of [...pending])animation.finish();await flush();},
  };
}

test('locked chest cannot open until the key is collected and used, even under repeated activation',async()=>{
  const app=setup();
  const locked=app.quest.activate();await app.quest.activate();
  assert.equal(app.opens(),0);assert.deepEqual(app.sounds,['locked']);
  await app.finish();await locked;
  app.get('[data-chest-key]').emit('click');
  assert.equal(JSON.parse(app.saved.get('test-key')!).collected,true);
  await app.finish();await app.finish();
  assert.equal(app.get('[data-chest-key]').hidden,true);
  const opening=app.quest.activate();await app.quest.activate();
  assert.equal(app.opens(),0,'the key must reach the lock first');
  await app.finish();await app.finish();await opening;
  assert.equal(app.opens(),1);assert.equal(app.sounds.filter(name=>name==='unlock').length,1);
  assert.equal(JSON.parse(app.saved.get('test-key')!).unlocked,true);
  await app.quest.activate();assert.equal(app.opens(),2,'replaying does not require collecting a second key');
});

test('leaving during collection keeps the key and removes the flying sprite',async()=>{
  const app=setup();app.get('[data-chest-key]').emit('click');
  assert.equal(app.root.children.length,1);
  app.quest.setPage(5);await flush();
  assert.equal(app.root.children.length,0);assert.equal(app.pending.size,0);
  assert.equal(app.get('[data-key-item]').hidden,false);
  assert.equal(app.get('[data-key-item]').style.opacity,'');
  app.quest.setPage(10);
  assert.equal(app.get('[data-chest-key]').hidden,true);
  assert.equal(app.opens(),0);
});

test('leaving during a rattle cancels its canvas frame and does not paint on the next page',async()=>{
  const app=setup();const locked=app.quest.activate();
  assert.equal(app.callbacks.size,1);
  const previousFrame=[...app.callbacks.values()][0];
  app.quest.setPage(5);await flush();await locked;
  const before=app.drawCalls();previousFrame(performance.now()+100);
  assert.equal(app.callbacks.size,0);assert.equal(app.drawCalls(),before);
  assert.equal(app.opens(),0);
});

test('restoring an inventory cannot unlock a chest without possession of the key',async()=>{
  for(const saved of ['{"collected":false,"unlocked":true}','{"collected":"true","unlocked":true}','broken-json']){
    const app=setup(saved);const locked=app.quest.activate();
    assert.equal(app.opens(),0);assert.equal(app.get('[data-chest-key]').hidden,false);
    await app.finish();await locked;
  }
  const restored=setup('{"collected":true,"unlocked":true}');
  assert.equal(restored.get('[data-chest-key]').hidden,true);
  await restored.quest.activate();assert.equal(restored.opens(),1);
});


test('replaying returns the key to Fien and locks the chest again',async()=>{
  const app=setup('{"collected":true,"unlocked":true}');
  app.quest.reset();
  assert.equal(app.get('[data-chest-key]').hidden,false);
  assert.equal(app.get('[data-key-item]').hidden,true);
  assert.deepEqual(JSON.parse(app.saved.get('test-key')!),{collected:false,unlocked:false});
  const locked=app.quest.activate();await app.finish();await locked;
  assert.equal(app.opens(),0);assert.equal(app.sounds[0],'locked');
});

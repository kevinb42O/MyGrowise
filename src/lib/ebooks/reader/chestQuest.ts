const keyUrl='/images/books/animation/fien-key.png';


export function makeChestQuest(root:HTMLElement,options:{
  storageKey:string;page:()=>HTMLImageElement;calm:()=>boolean;
  sound:(name:string)=>void;interact:()=>void;open:()=>void;
}){
  const lockOutline=new Path2D('M622 458 Q638 456 639 475 Q665 482 668 509 L668 580 Q664 608 628 632 Q599 618 591 591 L589 527 Q589 501 610 487 L614 478 Q611 462 622 458 Z');
  const ringHole=new Path2D('M610 516 Q608 496 628 496 Q649 496 650 520 Z');
  const hand=root.querySelector<HTMLButtonElement>('[data-chest-key]')!;
  const item=root.querySelector<HTMLButtonElement>('[data-key-item]')!;
  const reset=root.querySelector<HTMLButtonElement>('[data-key-reset]')!;
  const lock=root.querySelector<HTMLCanvasElement>('[data-lock-effects]')!;
  const status=root.querySelector<HTMLElement>('[data-status]')!;
  const hotspot=root.querySelector<HTMLButtonElement>('[data-hotspot]')!;
  const ctx=lock.getContext('2d')!;
  let collected=false,unlocked=false,onPage=false,busy=false,epoch=0,frame=0;
  let flight:HTMLImageElement|undefined;
  const animations=new Set<Animation>();
  try{const saved=JSON.parse(localStorage.getItem(options.storageKey+'-key')||'null');collected=saved?.collected===true;unlocked=collected&&saved?.unlocked===true;}catch{}
  function save(){try{localStorage.setItem(options.storageKey+'-key',JSON.stringify({collected,unlocked}));}catch{}}
  function sync(){reset.hidden=!onPage||!collected;hand.hidden=!onPage||collected;item.hidden=!collected;item.disabled=busy;hand.disabled=busy;}
  function clear(){++epoch;cancelAnimationFrame(frame);for(const animation of animations)animation.cancel();animations.clear();flight?.remove();flight=undefined;item.style.opacity='';hand.style.opacity='';ctx.clearRect(0,0,1200,849);busy=false;sync();}
  async function animate(element:Element,frames:Keyframe[],duration:number){
    const animation=element.animate(options.calm()?[{opacity:0},{opacity:1}]:frames,{duration:options.calm()?Math.min(duration,180):duration,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'});
    animations.add(animation);
    try{await animation.finished;return true;}catch{return false;}finally{animations.delete(animation);animation.cancel();}
  }
  async function fly(from:HTMLElement,to:HTMLElement,unlock=false){
    const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
    const width=unlock?46:a.width,height=unlock?110:a.height;
    const x=a.x+a.width/2-width/2,y=a.y+a.height/2-height/2;
    const dx=b.x+b.width/2-(x+width/2)-(unlock?27:0),dy=b.y+b.height/2-(y+height/2)-(unlock?7:0);
    const image=new Image();image.src=keyUrl;image.className='reader-key-flight';
    Object.assign(image.style,{left:x+'px',top:y+'px',width:width+'px',height:height+'px'});
    root.append(image);flight=image;
    const scale=unlock ? .58 : Math.min(b.width/width,b.height/height)*.78;
    const done=await animate(image,[
      {transform:'translate(0,0) rotate(-18deg) scale(1)',opacity:1},
      {transform:`translate(${dx*.4}px,${dy*.4-(options.calm()?0:60)}px) rotate(12deg) scale(1.15)`,offset:.46,opacity:1},
      {transform:`translate(${dx}px,${dy}px) rotate(${unlock?-75:22}deg) scale(${scale})`,opacity:1},
    ],unlock?650:850);
    image.remove();if(flight===image)flight=undefined;
    return done;
  }
  async function collect(){
    if(busy||collected||!onPage)return;
    const restoreFocus=document.activeElement===hand;
    options.interact();busy=true;sync();const ticket=epoch;
    // Commit before flight so leaving the page mid-flight cannot lose the key.
    collected=true;save();item.hidden=false;item.style.opacity='0';
    hand.hidden=false;hand.style.opacity='0';
    options.sound('star');
    const done=await fly(hand,item);
    item.style.opacity='';hand.style.opacity='';
    if(ticket!==epoch)return;
    busy=false;sync();
    if(done){if(restoreFocus)item.focus({preventScroll:true});status.textContent='Je hebt de sleutel gevonden.';void animate(item,[{transform:'scale(.8)'},{transform:'scale(1.16)',offset:.55},{transform:'scale(1)'}],380);}
  }
  function wiggle(){
    const ticket=epoch,source=options.page();
    const start=performance.now();
    const wood=document.createElement('canvas');wood.width=1200;wood.height=849;
    const paint=wood.getContext('2d')!;
    // Borrow nearby original painted wood, following the same sloping
    // plank seams. The original page outside the lock remains untouched.
    paint.transform(2,.14,0,1,-495,-69.3);
    paint.drawImage(source,0,0,1200,849);
    // Sample the real painted padlock; no replacement icon is introduced.
    const cutout=document.createElement('canvas');cutout.width=1200;cutout.height=849;
    const ink=cutout.getContext('2d')!;ink.clip(lockOutline);ink.drawImage(source,0,0,1200,849);
    ink.globalCompositeOperation='destination-out';ink.fill(ringHole);
    const run=(now:number)=>{
      if(ticket!==epoch)return;
      const t=Math.min(1,(now-start)/780),angle=options.calm()?0:Math.sin(t*Math.PI*7)*.13*(1-t);
      ctx.clearRect(0,0,1200,849);ctx.save();ctx.clip(lockOutline);ctx.drawImage(wood,0,0);ctx.restore();
      ctx.save();ctx.translate(626,474);ctx.rotate(angle);ctx.translate(-626,-474);ctx.drawImage(cutout,0,0);ctx.restore();
      if(t<1)frame=requestAnimationFrame(run);else ctx.clearRect(0,0,1200,849);
    };
    frame=requestAnimationFrame(run);
  }
  async function activate(){
    if(busy||!onPage||hotspot.hasAttribute('data-playing'))return;
    options.interact();
    if(!collected){
      busy=true;sync();const ticket=epoch;options.sound('locked');void wiggle();
      status.textContent='De kist zit op slot. Fien heeft iets in haar hand.';
      await animate(hand,[{transform:'translate(-50%,-12%) rotate(-18deg)'},{transform:'translate(-50%,-25%) rotate(-6deg)',offset:.35},{transform:'translate(-50%,-12%) rotate(-18deg)'}],820);
      if(ticket===epoch){busy=false;sync();}
      return;
    }
    if(unlocked){options.open();return;}
    busy=true;sync();const ticket=epoch;
    item.style.opacity='0';
    const done=await fly(item,hotspot,true);
    item.style.opacity='';
    if(!done||ticket!==epoch)return;
    options.sound('unlock');
    // Let the physical click finish before the reader takes over its audio.
    await animate(item,[{transform:'scale(1)'},{transform:'scale(1.12)',offset:.45},{transform:'scale(1)'}],280);
    if(ticket!==epoch)return;
    unlocked=true;save();busy=false;sync();
    status.textContent='Het slot is open.';
    options.open();
  }
  hand.addEventListener('click',()=>void collect());
  item.addEventListener('click',()=>{if(onPage)void activate();else void animate(item,[{transform:'rotate(0)'},{transform:'rotate(-12deg)',offset:.35},{transform:'rotate(0)'}],350);});
  window.addEventListener('pagehide',clear);
  return {
    setPage(page:number){clear();onPage=page===10;item.style.opacity='';hand.style.opacity='';sync();},
    activate,
    reset(){clear();collected=false;unlocked=false;save();sync();status.textContent='De sleutel ligt weer in Fiens hand.';},
    cancel:clear,
  };
}

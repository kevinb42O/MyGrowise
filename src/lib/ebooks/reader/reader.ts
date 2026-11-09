import {makePaper} from './paper';
import {makeColoring} from './coloring';
import {makeWriting} from './writing';

import {balloonDuration,chestDuration,heartCycle,moments,paintIllustration,type Moment} from './illustration';
import {paintStar,starDuration} from './star';

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export function startBookReader(root:HTMLElement){
  const get=<T extends HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const urls=JSON.parse(root.dataset.pages!) as string[];
  const preview=root.dataset.preview==='yes';
  const stage=get('[data-stage]'),book=get('[data-book]');
  let page=get<HTMLImageElement>('[data-page]');
  const canvas=get<HTMLCanvasElement>('[data-paper]');
  const audio=get<HTMLAudioElement>('[data-page-audio]');
  const effectSounds=new Map(Array.from(root.querySelectorAll<HTMLAudioElement>('[data-effect-audio]'),
    clip=>[clip.dataset.effectAudio,clip]));
  let effectAudio:HTMLAudioElement|undefined;
  const soundButton=get<HTMLButtonElement>('[data-page-sound]');
  const shadow=get('[data-shadow]'),hint=get('[data-hint]'),error=get('[data-error]'),status=get('[data-status]');
  const menu=get<HTMLDialogElement>('[data-menu]');
  const main=get('.reader-main'),whisper=get('[data-whisper]');
  const fullscreenButton=get<HTMLButtonElement>('[data-fullscreen]');
  const effects=get<HTMLCanvasElement>('[data-effects]');
  const hotspot=get<HTMLButtonElement>('[data-hotspot]');
  const next=get<HTMLButtonElement>('[data-next]'),prev=get<HTMLButtonElement>('[data-prev]');
  const pageNumber=get<HTMLInputElement>('#reader-page-number');
  const calmButton=get<HTMLButtonElement>('[data-motion]'),zoomButton=get<HTMLButtonElement>('[data-zoom]');
  const storageKey=preview?'mygrowise-fien-inkijk-v1':'mygrowise-fien-reader-v1';
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const cached=new Map<number,Promise<HTMLImageElement>>();
  const ready=new Map<number,HTMLImageElement>();
  let index=0, frame=0, chromeTimer=0, hintTimer=0, navigation=0;
  let calm=false, fill=false, scale=1, panX=0, panY=0;
  let effectFrame=0, effectTimer=0;
  let scene:{moment:Moment; start:number; released:number; x:number; y:number; vx:number; vy:number}|null=null;
  let grip:{id:number; x:number; y:number; t:number; moved:boolean}|null=null;
  let hasInteracted=false;
  let renderer:ReturnType<typeof makePaper>|undefined;
  let turn:{sounded?:boolean; target:number; side:number; grip:number; value:number; image:HTMLImageElement; previous:HTMLImageElement; gpu:boolean}|null=null;
  let pointer:{id:number;x:number;y:number;lastX:number;lastTime:number;velocity:number;dragged:boolean;initial:number}|null=null;
  const touches=new Map<number,{x:number;y:number}>();
  let pinch:{distance:number;scale:number;x:number;y:number;panX:number;panY:number}|null=null;

  const writing=makeWriting(root,()=>{
    ++navigation;
    if(turn)complete(false);
    coloring.close();
    clearEffect();
    interact();
    showControls(false);
  });
  const coloring=makeColoring(root,()=>{
    writing.close();
    ++navigation;
    if(turn)complete(false);
    clearEffect();
    interact();
    showControls(false);
  });
  const bookPage=(number=index)=>preview?[1,5,10][number]:number+1;

  const prefs=(key:string,value?:string)=>{
    try{if(value!==undefined)localStorage.setItem(key,value);else return localStorage.getItem(key);}catch{}
  };
  const soundKey='mygrowise-fien-page-sound';
  let sound=prefs(soundKey)!=='no';
  soundButton.setAttribute('aria-pressed',String(sound));
  soundButton.addEventListener('click',()=>{
    sound=!sound;
    prefs(soundKey,sound?'yes':'no');
    soundButton.setAttribute('aria-pressed',String(sound));
    if(!sound){audio.pause();effectAudio?.pause();}
  });
  function playTurn(){
    if(!sound)return;
    audio.currentTime=0;
    void audio.play().catch(()=>{});
  }

  function playEffectSound(name:string,loop=false){
    if(!sound)return;
    const clip=effectSounds.get(name);
    if(!clip)return;
    effectAudio?.pause();
    effectAudio=clip;
    clip.loop=loop;
    clip.currentTime=0;
    void clip.play().catch(()=>{});
  }

  calm=prefs(storageKey+'-calm')==='yes';
  function applyCalm(){
    const quiet=calm||media.matches;
    root.dataset.calm=quiet?'yes':'no';
    calmButton.setAttribute('aria-pressed',String(quiet));
  }
  applyCalm();
  media.addEventListener('change',()=>{applyCalm();if(media.matches){if(turn)complete(false);if(scene)finishEffect();}});

  function showControls(autohide=true){
    root.dataset.quiet='no';
    clearTimeout(chromeTimer);
    if(autohide&&hasInteracted)chromeTimer=window.setTimeout(()=>{
      if(!menu.open&&!pointer&&root.dataset.coloring!=='yes'&&root.dataset.writing!=='yes')root.dataset.quiet='yes';
    },2800);
  }
  function interact(){
    hasInteracted=true;
    clearTimeout(hintTimer);
    hint.hidden=true;
    showControls();
  }
  hintTimer=window.setTimeout(()=>{hint.hidden=true;},4600);

  function cachePage(number:number,existing?:HTMLImageElement){
    if(number<0||number>=urls.length)return Promise.reject(new Error('invalid_page'));
    if(cached.has(number))return cached.get(number)!;
    const image=existing||new Image();
    const result=new Promise<HTMLImageElement>((resolve,reject)=>{
      const loaded=()=>{if(cached.has(number)||existing)ready.set(number,image);resolve(image);};
      if(existing&&image.complete&&image.naturalWidth){loaded();return;}
      image.addEventListener('load',loaded,{once:true});
      image.addEventListener('error',()=>reject(new Error('page_unavailable')),{once:true});
      if(!existing||image.complete){image.crossOrigin='anonymous';image.src=urls[number];}
    }).catch(reason=>{cached.delete(number);ready.delete(number);throw reason;});
    cached.set(number,result);
    return result;
  }

  function renderPage(image:HTMLImageElement,number:number){
    image.className='reader-page';
    image.alt=number===0?'De originele geïllustreerde omslag':`Geïllustreerde boekpagina ${number+1}`;
    image.draggable=false;
    if(image!==page){page.replaceWith(image);page=image;}
  }
  function getMoment():Moment|undefined{return (moments as Partial<Record<number,Moment>>)[bookPage()];}
  function update(){
    get('[data-count]').replaceChildren(String(index+1),Object.assign(document.createElement('span'),{textContent:'/'}),String(urls.length));
    prev.disabled=index===0;
    next.disabled=index===urls.length-1;
    pageNumber.value=String(index+1);
    coloring.setPage(bookPage());
    writing.setPage(bookPage());
    status.textContent=`Pagina ${index+1} van ${urls.length}`;
    const spot=getMoment();
    clearEffect();
    hotspot.hidden=!spot;
    if(spot){
      hotspot.style.setProperty('--spot-x',spot.x*100+'%');
      hotspot.style.setProperty('--spot-y',spot.y*100+'%');
      hotspot.style.setProperty('--spot-size',spot.size);
      hotspot.setAttribute('aria-label',spot.label);
      hotspot.querySelector('span')!.textContent=spot.label;
      hotspot.dataset.kind=spot.kind;
    }
    if(!preview)prefs(storageKey+'-page',String(index));
    for(const neighbor of [index-1,index+1]){
      if(neighbor>=0&&neighbor<urls.length)void cachePage(neighbor).catch(()=>{});
    }
    for(const number of cached.keys()){
      if(Math.abs(number-index)>2){cached.delete(number);ready.delete(number);}
    }
  }

  const fillScale=()=>Math.max(1,main.clientWidth/stage.clientWidth,main.clientHeight/stage.clientHeight);
  const canPan=()=>scale>1.005;
  function transform(){
    const cropX=Math.max(0,(stage.clientWidth*scale-main.clientWidth)/2);
    const cropY=Math.max(0,(stage.clientHeight*scale-main.clientHeight)/2);
    panX=clamp(panX,-cropX,cropX);panY=clamp(panY,-cropY,cropY);
    book.style.transform=scale===1?'':`translate(${panX}px,${panY}px) scale(${scale})`;
    const rail=(main.clientWidth-stage.clientWidth*scale)/2;
    const safeLeft=parseFloat(getComputedStyle(root).getPropertyValue('--reader-safe-left'))||0;
    const safeRight=parseFloat(getComputedStyle(root).getPropertyValue('--reader-safe-right'))||0;
    root.dataset.rails=rail>=64+2*Math.max(safeLeft,safeRight)?'yes':'no';
    root.style.setProperty('--rail-width',rail+'px');
    zoomButton.setAttribute('aria-pressed',String(fill));
    zoomButton.textContent=fill?'Toon de hele pagina':'Vul het scherm';
  }
  function resetZoom(){scale=fill?fillScale():1;panX=panY=0;transform();}

  function clearEffect(){
    clearTimeout(effectTimer);
    cancelAnimationFrame(effectFrame);
    const pointerId=grip?.id;
    grip=null;
    if(pointerId!==undefined&&hotspot.hasPointerCapture(pointerId))hotspot.releasePointerCapture(pointerId);
    effectAudio?.pause();
    effectAudio=undefined;
    scene=null;
    effects.getContext('2d')?.clearRect(0,0,effects.width,effects.height);
    hotspot.removeAttribute('data-playing');
    whisper.hidden=true;
  }

  function finishEffect(){
    clearEffect();
    showControls(false);
  }

  function showMomentText(text:string){
    if(whisper.textContent!==text)whisper.textContent=text;
    if(status.textContent!==text)status.textContent=text;
  }

  function startEffect(moment:Moment, held:boolean){
    clearEffect();
    clearTimeout(chromeTimer);
    hint.hidden=true;
    hasInteracted=true;
    root.dataset.quiet='yes';
    hotspot.setAttribute('data-playing','');
    showMomentText(moment.kind==='balloon'&&!held?'Kijk hoe je ballon wegzweeft.':moment.text);
    whisper.dataset.kind=moment.kind;
    whisper.hidden=false;
    const start=performance.now();
    const state={moment,start,released:held?0:start,x:0,y:0,vx:0,vy:0};
    scene=state;
    const quiet=root.dataset.calm==='yes';
    if(moment.kind==='star'){
      playEffectSound('star');
      const animateStar=(now:number)=>{
        const elapsed=Math.max(0,(now-start)/1000);
        paintStar(effects,moment.x,moment.y,elapsed,quiet);
        if(elapsed<(quiet?1.28:2.35))effectFrame=requestAnimationFrame(animateStar);
      };
      animateStar(start);
      effectTimer=window.setTimeout(finishEffect,(quiet?3.8:starDuration)*1000);
      return;
    }
    if(moment.kind==='balloon')playEffectSound(held?'balloon-grab':'balloon-fly');
    else playEffectSound(moment.kind,moment.kind==='heart'&&held);

    let last=start;
    const animate=(now:number)=>{
      const elapsed=Math.max(0,(now-start)/1000);
      const dt=clamp((now-last)/1000,0,.032);
      last=now;
      const free=state.released?Math.max(0,(now-state.released)/1000):null;
      if(moment.kind==='chest'&&elapsed>=chestDuration){finishEffect();return;}
      if(moment.kind==='heart'){
        const cycleEnd=heartCycle*Math.max(1,Math.ceil((state.released-start)/1000/heartCycle));
        if(free!==null&&elapsed>=cycleEnd){finishEffect();return;}
        showMomentText(elapsed%heartCycle<heartCycle/2?'Adem rustig in…':'Adem rustig uit…');
      }
      if(moment.kind==='balloon'&&free!==null){
        if(free>=balloonDuration){finishEffect();return;}
        if(!quiet){
          const lift=-65-440*clamp(free/.96,0,1)**2;
          state.vx+=(90-state.vx)*(1-Math.exp(-2.5*dt));
          state.vy+=(lift-state.vy)*dt*3.5;
          state.x+=state.vx*dt;
          state.y+=state.vy*dt;
        }
      }
      paintIllustration(effects,moment,elapsed,quiet,free,state.x,state.y,state.vx);
      effectFrame=requestAnimationFrame(animate);
    };
    animate(start);
  }

  function draw(value:number){
    if(!turn)return;
    turn.value=clamp(value,0,1);
    const position=clamp(100-134*turn.value,0,100);
    if(turn.gpu){
      renderer!.draw(turn.value,turn.side,turn.grip);
      const from=turn.side>0?'left':'right';
      shadow.style.background=`linear-gradient(to ${from},transparent 0%, transparent ${100-position-6}%, #35271e55 ${100-position}%, transparent ${100-position+9}%)`;
      shadow.style.opacity=String(Math.sin(turn.value*Math.PI));
    }else if(root.dataset.calm!=='yes'){
      turn.previous.style.opacity=String(1-turn.value);
    }
  }
  function begin(target:number,grip:number){
    const image=ready.get(target);
    if(!image||target===index||!page.complete||!page.naturalWidth)return false;
    const previous=page;
    if(renderer===undefined&&root.dataset.calm!=='yes'){
      try{renderer=makePaper(canvas);}catch{renderer=null;}
    }
    const gpu=root.dataset.calm!=='yes'&&!!renderer?.use(writing.snapshot(coloring.snapshot(previous)));
    turn={target,side:Math.sign(target-index),grip,value:0,image,previous,gpu};
    renderPage(image,target);
    coloring.setPage(bookPage(target));
    writing.setPage(bookPage(target));
    if(gpu)canvas.hidden=false;
    else if(root.dataset.calm!=='yes'){page.after(previous);}
    clearEffect();
    hotspot.hidden=true;
    draw(0);
    return true;
  }
  function complete(commit:boolean){
    cancelAnimationFrame(frame);
    if(!turn)return;
    const old=turn;turn=null;
    old.previous.style.opacity='';
    canvas.hidden=true;
    shadow.style.opacity='0';
    if(commit){old.previous.remove();index=old.target;}
    else{old.previous.remove();renderPage(old.previous,index);}
    update();
  }
  function settle(commit:boolean,velocity=0){
    if(!turn)return;
    if(commit&&!turn.sounded){playTurn();turn.sounded=true;}
    cancelAnimationFrame(frame);
    if(root.dataset.calm==='yes'){complete(commit);return;}
    const destination=commit?1:0;
    let value=turn.value,speed=velocity;
    let last=performance.now();
    const spring=(now:number)=>{
      if(!turn)return;
      const dt=clamp((now-last)/1000,.001,.03);
      last=now;
      speed+=((destination-value)*335-speed*35)*dt;
      value+=speed*dt;
      draw(value);
      if(Math.abs(destination-value)<.004&&Math.abs(speed)<.04)complete(commit);
      else frame=requestAnimationFrame(spring);
    };
    frame=requestAnimationFrame(spring);
  }

  async function go(target:number,animated=true){
    if(target<0||target>=urls.length||target===index)return;
    const ticket=++navigation;
    coloring.close();
    interact();error.hidden=true;
    if(turn)complete(false);
    resetZoom();
    const adjacent=animated&&Math.abs(target-index)===1;
    try{
      const image=ready.get(target)??await cachePage(target);
      if(ticket!==navigation)return;
      if(adjacent&&root.dataset.calm!=='yes'&&begin(target,.72)){settle(true,2.4);return;}
      if(adjacent)playTurn();
      renderPage(image,target);index=target;update();
    }catch{if(ticket===navigation){error.hidden=false;error.dataset.retry=String(target);}}
  }
  function advance(side:number){
    if(turn&&turn.side===side){settle(true,2);return;}
    void go(index+side);
  }

  stage.addEventListener('pointerdown',event=>{
    if(root.dataset.coloring==='yes'||(event.target as HTMLElement).closest('[data-writing-fields]')||event.button!==0||event.target===hotspot||hotspot.contains(event.target as Node))return;
    ++navigation;
    interact();
    stage.setPointerCapture(event.pointerId);
    touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(touches.size===2){
      if(turn)complete(false);
      const [a,b]=[...touches.values()];
      pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale,x:(a.x+b.x)/2,y:(a.y+b.y)/2,panX,panY};
      pointer=null;return;
    }
    if(touches.size!==1)return;
    cancelAnimationFrame(frame);
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastTime:event.timeStamp,velocity:0,dragged:!!turn,initial:turn?.value||0};
  });
  stage.addEventListener('pointermove',event=>{
    const previous=touches.get(event.pointerId);
    if(!previous)return;
    touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch&&touches.size===2){
      const [a,b]=[...touches.values()];
      scale=clamp(pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,fill?fillScale():1,Math.max(3.5,fillScale()));
      const bounds=stage.getBoundingClientRect();
      const centerX=bounds.left+bounds.width/2,centerY=bounds.top+bounds.height/2;
      const ratio=scale/pinch.scale;
      panX=(a.x+b.x)/2-centerX-(pinch.x-centerX-pinch.panX)*ratio;
      panY=(a.y+b.y)/2-centerY-(pinch.y-centerY-pinch.panY)*ratio;
      transform();return;
    }
    if(!pointer||pointer.id!==event.pointerId)return;
    const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
    const dt=Math.max(1,event.timeStamp-pointer.lastTime);
    pointer.velocity=.35*pointer.velocity+.65*((event.clientX-pointer.lastX)/dt);
    pointer.lastX=event.clientX;pointer.lastTime=event.timeStamp;
    if(Math.abs(dx)>8||Math.abs(dy)>8)pointer.dragged=true;
    if(canPan()){panX+=event.clientX-previous.x;panY+=event.clientY-previous.y;transform();return;}
    if(!turn&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){
      const rect=stage.getBoundingClientRect();
      begin(index-Math.sign(dx),clamp((pointer.y-rect.top)/rect.height,0,1));
    }
    if(turn)draw(pointer.initial-dx*turn.side/stage.clientWidth*1.25);
  });
  function release(event:PointerEvent,cancelled=false){
    touches.delete(event.pointerId);
    if(pinch){if(touches.size===0)pinch=null;return;}
    if(!pointer||pointer.id!==event.pointerId)return;
    const released=pointer;pointer=null;
    if(turn){
      const speed=event.timeStamp-released.lastTime<110?-released.velocity*turn.side*1000/stage.clientWidth:0;
      settle(!cancelled&&(turn.value+speed*.12>.39),clamp(speed,-5,5));
      return;
    }
    if(cancelled)return;
    if(canPan()){if(!released.dragged)showControls();return;}
    const dx=event.clientX-released.x,dy=event.clientY-released.y;
    if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)){advance(-Math.sign(dx));return;}
    if(released.dragged)return;
    const rect=stage.getBoundingClientRect();
    const position=(event.clientX-rect.left)/rect.width;
    if(position>.64||index===0&&position>.36)advance(1);
    else if(position<.36)advance(-1);
    else showControls();
  }
  stage.addEventListener('pointerup',event=>release(event));
  stage.addEventListener('pointercancel',event=>release(event,true));
  stage.addEventListener('lostpointercapture',event=>{if(touches.has(event.pointerId))release(event,true);});
  main.addEventListener('pointerup',event=>{if(event.target===main)interact();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();complete(false);renderer=null;});
  window.addEventListener('resize',()=>{if(fill)resetZoom();else transform();if(turn)draw(turn.value);});
  fullscreenButton.hidden=!document.fullscreenEnabled;
  document.addEventListener('fullscreenchange',()=>{
    const active=document.fullscreenElement===root;
    fullscreenButton.setAttribute('aria-pressed',String(active));
    const label=active?'Verlaat volledig scherm':'Volledig scherm';
    fullscreenButton.setAttribute('aria-label',label);
    fullscreenButton.title=label;
    showControls();
  });
  async function toggleFullscreen(){
    if(fullscreenButton.hidden)return;
    try{
      if(document.fullscreenElement===root)await document.exitFullscreen();
      else await root.requestFullscreen();
    }catch{
      if(scene)finishEffect();
      delete whisper.dataset.kind;
      whisper.textContent='Je browser kon volledig scherm niet openen.';
      whisper.hidden=false;
      clearTimeout(effectTimer);
      effectTimer=window.setTimeout(()=>{whisper.hidden=true;},3800);
    }
  }
  fullscreenButton.addEventListener('click',()=>void toggleFullscreen());
  window.addEventListener('keydown',event=>{
    if(menu.open||event.altKey||event.metaKey||event.ctrlKey||/INPUT|TEXTAREA/.test((event.target as HTMLElement)?.tagName||''))return;
    if(event.key.toLowerCase()==='f'){void toggleFullscreen();return;}
    if(['ArrowLeft','ArrowRight','PageUp','PageDown','Home','End'].includes(event.key)){
      event.preventDefault();
      if(event.key==='Home')void go(0,false);
      else if(event.key==='End')void go(urls.length-1,false);
      else advance(['ArrowLeft','PageUp'].includes(event.key)?-1:1);
    }
  });
  const openMenu=()=>{coloring.close();interact();menu.showModal();};
  get('[data-open-menu]').addEventListener('click',openMenu);
  get('[data-count]').addEventListener('click',openMenu);
  prev.addEventListener('click',()=>advance(-1));
  next.addEventListener('click',()=>advance(1));
  root.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(button=>button.addEventListener('click',()=>{menu.close();void go(Number(button.dataset.go)-1,false);}));
  get<HTMLFormElement>('[data-jump]').addEventListener('submit',event=>{event.preventDefault();menu.close();void go(Number(pageNumber.value)-1,false);});
  zoomButton.addEventListener('click',()=>{menu.close();fill=!fill;resetZoom();showControls();});
  calmButton.addEventListener('click',()=>{
    calm=!calm;prefs(storageKey+'-calm',calm?'yes':'no');applyCalm();
    if(scene)finishEffect();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&scene)finishEffect();});
  get('[data-retry]').addEventListener('click',()=>{
    const target=Number(error.dataset.retry);
    if(target===index)location.reload();else void go(target,false);
  });
  hotspot.addEventListener('pointerdown',event=>{
    const moment=getMoment();
    if(event.button!==0||!event.isPrimary||grip||!moment||(moment.kind!=='heart'&&moment.kind!=='balloon'))return;
    startEffect(moment,true);
    hotspot.setPointerCapture(event.pointerId);
    grip={id:event.pointerId,x:event.clientX,y:event.clientY,t:event.timeStamp,moved:false};
  });
  hotspot.addEventListener('pointermove',event=>{
    if(grip?.id!==event.pointerId||scene?.moment.kind!=='balloon')return;
    const bounds=book.getBoundingClientRect();
    const x=clamp((event.clientX-grip.x)*effects.width/bounds.width,-485,485);
    const y=clamp((event.clientY-grip.y)*effects.height/bounds.height,-40,580);
    if(!grip.moved&&Math.hypot(event.clientX-grip.x,event.clientY-grip.y)<4)return;
    grip.moved=true;
    const dt=Math.max(.012,(event.timeStamp-grip.t)/1000);
    scene.vx=clamp((x-scene.x)/dt,-1700,1700);
    scene.vy=clamp((y-scene.y)/dt,-1700,1700);
    scene.x=x;scene.y=y;grip.t=event.timeStamp;
  });
  function releaseEffect(event:PointerEvent){
    if(grip?.id!==event.pointerId||!scene)return;
    const released=grip;
    grip=null;
    if(event.type!=='pointerup'){finishEffect();return;}
    scene.released=performance.now();
    if(scene.moment.kind==='heart'){
      if(effectAudio)effectAudio.loop=false;
    }else if(scene.moment.kind==='balloon'){
      if(!released.moved||event.timeStamp-released.t>85){scene.vx=0;scene.vy=0;}
      scene.vx=clamp(scene.vx,-420,420);
      scene.vy=clamp(scene.vy,-320,160);
      showMomentText('Daar gaat je ballon!');
      playEffectSound('balloon-fly');
    }
  }
  for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)hotspot.addEventListener(name,releaseEffect);
  hotspot.addEventListener('click',event=>{
    const moment=getMoment();
    if(moment&&(event.detail===0||(moment.kind!=='heart'&&moment.kind!=='balloon')))startEffect(moment,false);
  });
  menu.addEventListener('close',()=>showControls());

  transform();
  const saved=preview?0:Number(prefs(storageKey+'-page')||0);
  if(Number.isInteger(saved)&&saved>0&&saved<urls.length){
    const ticket=navigation;
    void cachePage(saved).then(image=>{if(ticket===navigation){renderPage(image,saved);index=saved;update();}}).catch(()=>{});
  }
  void cachePage(0,page).catch(()=>{if(index===0){error.hidden=false;error.dataset.retry='0';}});
  if(!saved)update();
  else void cachePage(1).catch(()=>{});
}

(() => {
 'use strict';
 const root=document.querySelector('[data-home-experience]');
 if (!root) return;
 const $=s=>root.querySelector(s), $$=s=>[...root.querySelectorAll(s)];
 const heroTrack=$('[data-hero-track]'), heroStage=$('.hero-stage');
 const experience=$('.experience');
 const stage=$('.experience-stage'), story=$('.story-track'), storyStage=$('.story-stage');
 const layer=Object.fromEntries($$('[data-layer]').map(e=>[e.dataset.layer,e]));
 const heroPortrait=$('.hero-introduction');
 const heroWorld=$('.hero-world'), heroCopy=$('.hero-copy');
 const heroLandscape=heroWorld.querySelector('img');
 const heroShade=$('.hero-shade');
 const heroBrand=$('.hero-brand');
 const heroPortal=$('.hero-portal'), portalImage=heroPortal.querySelector('img');
 const heroTitle=$('#hero-title'), heroSupporting=$('.hero-supporting'), heroDetails=[...heroSupporting.children];
 const heroTitleLines=[...heroTitle.children];
 const heroSkip=$('[data-hero-skip]');
 let portalEnabled=false, portalLayout;
 let initialized=false;
 const hero=$('[data-hero]'), recognition=$('.recognition'), recognitionInner=$('.recognition-inner'), heroCue=$('.scroll-cue');
 const recognitionSurface=$('.recognition-surface'), recognitionLandscape=$('.recognition-landscape'), recognitionCaption=recognitionLandscape.querySelector('figcaption'), recognitionScenery=recognitionLandscape.querySelector('img'), recognitionLines=$$('.recognition-lines li'), recognitionClosing=$('.recognition-closing');
 const recognitionLogo=$('.recognition-logo'), recognitionTitle=$('#recognition-title');
 const insightImage=$('.insight-image'), insightPaper=$('.insight-paper'), insightCopy=$('.insight-copy');
 const insightHeading=$('.insight-heading');
 const insightTitleLines=[...insightHeading.querySelectorAll('[data-insight-line]')];
 const insightDetails=[...insightCopy.children].filter(child=>child!==insightHeading);

 const modulePapers=$$('.module-paper'), moduleCopies=$$('.module-copy'), moduleButtons=$$('.module-nav button');
 const routeSelf=$('.route-self'), routeCare=$('.route-care'), storyCurtain=$('.story-curtain'), storyPortrait=$('.story-portrait'), storyFilm=$('.story-film');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'), button=$('[data-motion-toggle]');
 // Read the same small-viewport height used by CSS, including mobile browser chrome.
 const viewportMeasure=document.createElement('div');
 viewportMeasure.setAttribute('aria-hidden','true');
 viewportMeasure.style.cssText='position:absolute;top:0;left:0;width:0;height:var(--stage);visibility:hidden;pointer-events:none';
 root.append(viewportMeasure);
 // Distances are in visible stages. One score drives rendering, track height and links.
 let manualOff=false, enabled=false, heroEnabled=false, storyEnabled=false, frame=0, current='hero';
 let score, stageSize=1;
 // Let the full photograph settle before the curtain moves; retain the reading
 // space for the portrait and film after the longer opening.
 const storyScore={curtain:{start:.45,end:.95},film:{start:1.6,end:2},total:2.35};
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const ease=x=>{const t=clamp(x);return t*t*t*(t*(t*6-15)+10);};
 const phase=(x,a,b)=>ease((x-a)/(b-a));
 const easeArrival=x=>1-Math.pow(1-clamp(x),3);
 const set=(e,props)=>Object.assign(e.style,props);
 const semantic=(e,active)=>{e.inert=!active;e.setAttribute('aria-hidden',String(!active));};
 function composeScore(){
  let cursor=0;
  const beat=length=>{const start=cursor;cursor+=length;return {start,end:cursor};};
  const intro=beat(portalEnabled?1.2:0);
  // Native sections need no reading holds or invisible handoff distance.
  const openingEnd=cursor;
  // Insight is already readable while entering through the native document.
  // Once it reaches the stage, the very next scroll must move modules.
  const insightRead=beat(0);
  const modulesEnter=beat(.4),modules=[];
  for(let i=0;i<Math.max(1,modulePapers.length);i++){
   const read=beat(.65),change=i<modulePapers.length-1?beat(.3):null;
   modules.push({read,change});
  }
  const routesEnter=beat(.45),routesRead=beat(.75);
  return {intro,openingEnd,insightRead,modulesEnter,modules,routesEnter,routesRead,total:cursor};
 }
 const progress=(position,beat)=>phase(position,beat.start,beat.end);
 const portalTravel=()=>score.intro.end*stageSize;
 const journeyOrigin=()=>heroTrack.getBoundingClientRect().top+scrollY-parseFloat(root.style.getPropertyValue('--top'));
 const experienceOrigin=()=>experience.getBoundingClientRect().top+scrollY-parseFloat(root.style.getPropertyValue('--top'));
 // Only the portal intro can autoplay, ending at the hero copy and portrait.
 // Input never extends the release deadline; later chapters have no lock state.
 let heroPlayback=null,heroAnimation=0,heroDeadline=0,touchStart=null;
 function releaseHero(commit=true){
  if(!heroPlayback)return;
  const position=heroPlayback.position;
  heroPlayback=null;
  cancelAnimationFrame(heroAnimation);clearTimeout(heroDeadline);
  if(commit)scrollTo({top:position,behavior:'instant'});
  schedule();
 }
 function startHero(direction){
  if(!initialized||!portalEnabled||reduced.matches||manualOff||document.documentElement.classList.contains('home-booting'))return false;
  const origin=journeyOrigin(),position=(scrollY-origin)/stageSize,tolerance=1/stageSize;
  const segments=[{start:0,end:score.intro.end,visualStart:0,duration:4000}];
  const segment=(direction>0?segments:[...segments].reverse()).find(({start,end})=>direction>0
   ?position>=start-tolerance&&position<end-tolerance
   :position>start+tolerance&&position<=end+tolerance);
  if(!segment)return false;
  const {start,end,visualStart,duration}=segment;
  const from=Math.max(visualStart,Math.min(end,position)),to=direction>0?end:visualStart;
  const destination=origin+(direction>0?end:start)*stageSize;
  const started=performance.now();
  heroPlayback={anchor:scrollY,position:scrollY,destination};
  const finish=()=>{
   if(!heroPlayback)return;
   heroPlayback.position=destination;releaseHero();
  };
  // A separate deadline also releases control when frames are delayed.
  heroDeadline=setTimeout(finish,duration);
  const tick=now=>{
   if(!heroPlayback)return;
   const elapsed=clamp((now-started)/duration);
   heroPlayback.position=origin+(from+(to-from)*ease(elapsed))*stageSize;
   update();
   if(elapsed>=1)finish();else heroAnimation=requestAnimationFrame(tick);
  };
  heroAnimation=requestAnimationFrame(tick);
  return true;
 }
 const nativeScrollControl=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable],dialog,[role="dialog"]');
 window.addEventListener('wheel',event=>{
  if(event.ctrlKey||nativeScrollControl(event.target))return;
  if(heroPlayback||(event.deltaY!==0&&startHero(Math.sign(event.deltaY))))event.preventDefault();
 },{passive:false});
 window.addEventListener('touchstart',event=>{touchStart=event.touches.length===1?event.touches[0].clientY:null;},{passive:true});
 window.addEventListener('touchmove',event=>{
  if(event.touches.length!==1||nativeScrollControl(event.target))return;
  const delta=touchStart===null?0:touchStart-event.touches[0].clientY;
  if(heroPlayback||(delta!==0&&startHero(Math.sign(delta))))event.preventDefault();
 },{passive:false});
 window.addEventListener('touchend',()=>{touchStart=null;},{passive:true});
 window.addEventListener('touchcancel',()=>{touchStart=null;releaseHero();},{passive:true});
 window.addEventListener('keydown',event=>{
  if(event.key==='Escape'){releaseHero();return;}
  if(nativeScrollControl(event.target)||event.target instanceof Element&&event.target.closest('a,button')||event.ctrlKey||event.metaKey||event.altKey)return;
  const down=['ArrowDown','PageDown'].includes(event.key)||(event.key===' '&&!event.shiftKey);
  const up=['ArrowUp','PageUp'].includes(event.key)||(event.key===' '&&event.shiftKey);
  if((down||up)&&(heroPlayback||startHero(down?1:-1)))event.preventDefault();
 });
 window.addEventListener('pagehide',()=>releaseHero(false));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseHero();});
 function frameRecognition(){
  // Recognition is a normal document section; its full composition is always visible.
  set(recognitionLandscape,{clipPath:'none',opacity:.34});
  set(recognitionLogo,{opacity:1});
  set(recognitionScenery,{transform:'none'});
 }
 function measure(){
  if(!initialized)return;
  const bar=0;
  const header=document.querySelector('.site-header')?.getBoundingClientRect().height ?? 80;
  root.style.setProperty('--bar',`${bar}px`);root.style.setProperty('--top',`${bar+header}px`);
  const mobile=innerWidth<=600, available=viewportMeasure.clientHeight;
  enabled=!manualOff&&!reduced.matches&&available>=(mobile?650:650)&&innerWidth>=350;
  // Safari's expanded bars leave compact phones less than 600px below the
  // header. The opening has a compact composition independent of later scenes.
  heroEnabled=!manualOff&&!reduced.matches&&available>=(mobile?520:600);
  root.classList.toggle('compact-opening',mobile&&available<650);
  // Always measure one clean candidate layout. Previous animation classes and
  // inline transforms must never decide whether the next measurement fits.
  [heroStage,stage,recognitionInner,recognitionTitle,recognitionClosing,...recognitionLines,heroSupporting,heroPortrait,insightCopy,insightHeading,...moduleCopies].forEach(e=>e.removeAttribute('style'));
  root.classList.toggle('hero-enhanced',heroEnabled);
  root.classList.toggle('enhanced',enabled);
  root.classList.toggle('portal-enhanced',heroEnabled&&portalImage.complete&&portalImage.naturalWidth>0);
  if(heroEnabled){
   heroEnabled=recognitionInner.scrollHeight<=recognitionInner.clientHeight+1;
  }
  if (enabled) {
   // Measure the real catalog copy: long titles and larger text must never be clipped.
   const moduleCopyTop=$('.module-copies').offsetTop;
   const moduleFits=moduleCopies.every(copy=>moduleCopyTop+copy.scrollHeight<=stage.clientHeight-60);
   const insightFits=insightCopy.offsetTop+insightCopy.scrollHeight<=stage.clientHeight-24;
   const heroFits=!mobile||heroSupporting.offsetTop+heroSupporting.scrollHeight<=heroPortrait.offsetTop-12;
   enabled=moduleFits&&insightFits&&heroFits&&heroEnabled;
  }
  root.classList.toggle('hero-enhanced',heroEnabled);
  root.classList.toggle('enhanced',enabled);
  root.classList.toggle('story-enhanced',enabled);
  storyEnabled=enabled&&$('.story-copy').offsetTop+$('.story-copy').scrollHeight<=storyStage.clientHeight-16;
  root.classList.toggle('story-enhanced',storyEnabled);
  portalEnabled=heroEnabled&&portalImage.complete&&portalImage.naturalWidth>0;
  root.classList.toggle('portal-enhanced',portalEnabled);
  stageSize=available;
  score=composeScore();
  root.style.setProperty('--journey-height',`${stageSize*(1+score.total-score.openingEnd)}px`);
  root.style.setProperty('--opening-height',`${stageSize*(1+score.intro.end)}px`);
  root.style.setProperty('--story-height',`${stageSize*(1+storyScore.total)}px`);
  heroSkip.hidden=!portalEnabled;
  button.hidden=false;
  button.querySelector('[data-motion-label]').textContent=enabled||heroEnabled?'Rustige weergave':'Scrollervaring aanzetten';
  button.setAttribute('aria-label',enabled||heroEnabled?'Rustige weergave zonder scrollanimaties inschakelen':'Scrollervaring met animaties inschakelen');
  button.setAttribute('aria-pressed',String(!(enabled||heroEnabled)));
  button.disabled=false;
  if (reduced.matches || (!enabled && !heroEnabled && !manualOff)) {
   button.querySelector('[data-motion-label]').textContent='Rustige weergave';
   button.setAttribute('aria-label','Rustige weergave: alle inhoud blijft leesbaar op dit scherm');
   button.disabled=true;
  }
  if(!enabled){
   layer.modules.style.removeProperty('--module-background');
   [heroStage,stage,recognitionInner].forEach(e=>e.removeAttribute('style'));
   Object.values(layer).forEach(e=>{e.removeAttribute('style');e.inert=false;e.removeAttribute('aria-hidden');});
   [insightImage,insightPaper,insightCopy,insightHeading,...insightTitleLines,...insightDetails,routeSelf,routeCare,...modulePapers,...moduleCopies].forEach(e=>e.removeAttribute('style'));
   [...moduleCopies,...modulePapers].forEach(e=>{e.inert=false;e.removeAttribute('aria-hidden');});
   insightDetails.forEach(e=>{e.inert=false;e.removeAttribute('aria-hidden');});
   [storyPortrait,storyFilm,storyCurtain].forEach(e=>{e.removeAttribute('style');e.inert=false;e.removeAttribute('aria-hidden');});
  }
  if(!heroEnabled){
   [heroWorld,heroCopy,heroPortrait,heroCue,recognition,recognitionInner,recognitionSurface,recognitionLandscape,recognitionLogo,recognitionScenery,recognitionCaption,recognitionTitle,recognitionClosing,...recognitionLines].forEach(e=>e.removeAttribute('style'));
   [hero,heroPortrait,recognition,heroCue,recognitionClosing,...recognitionLines].forEach(e=>{e.inert=false;e.removeAttribute('aria-hidden');});
  }
  if(!portalEnabled){
   [heroPortal,heroLandscape,heroShade,heroBrand,heroTitle,...heroTitleLines,heroSupporting,...heroDetails].forEach(e=>e.removeAttribute('style'));
   [heroTitle,heroSupporting,...heroDetails].forEach(e=>{e.inert=false;e.removeAttribute('aria-hidden');});
  } else {
   // Cache the two opening lines before projecting them into a centered stack.
   const width=heroPortal.offsetWidth,height=heroPortal.offsetHeight;
   const centerX=heroPortal.offsetLeft,centerY=heroPortal.offsetTop;
   const endScale=Math.max(
    Math.hypot(centerX/(width*(mobile?.16:.145)),centerY/(height*(mobile?.08:.20))),
    Math.hypot((heroStage.clientWidth-centerX)/(width*(mobile?.16:.145)),(heroStage.clientHeight-centerY)/(height*(mobile?.08:.20)))
   )*1.25;
   const lines=heroTitleLines.map(line=>({x:line.offsetLeft+line.offsetWidth/2,y:line.offsetTop+line.offsetHeight/2,width:line.offsetWidth,height:line.offsetHeight}));
   const readingScale=Math.min(1,heroStage.clientWidth*.82/Math.max(...lines.map(line=>line.width)));
   portalLayout={endScale,centerX,centerY,stageWidth:heroStage.clientWidth,lines,readingScale};
   heroTitle.style.transformOrigin=`${centerX}px ${centerY}px`;
  }
  if (!storyEnabled) [storyPortrait,storyFilm,storyCurtain].forEach(e=>{e.removeAttribute('style');e.inert=false;e.removeAttribute('aria-hidden');});
  update();
 }
 function update(){
  frame=0;
  if(!initialized)return;
  const top=parseFloat(getComputedStyle(root).getPropertyValue('--top'));
  const mobile=innerWidth<=600;
  // Autoplay owns only the hero; every later scene uses native scroll position.
  const heroPosition=heroEnabled?((heroPlayback?.position??scrollY)-journeyOrigin())/stageSize:0;
  const position=enabled?(scrollY-experienceOrigin())/stageSize+score.openingEnd:0;
  const storyBounds=storyEnabled?story.getBoundingClientRect():null;
  if(heroEnabled){
   const intro=portalEnabled?clamp(heroPosition/score.intro.end):1;
   const exit=0;
   if(portalEnabled){
    const camera=phase(intro,.1,.80),land=phase(intro,.65,1);
    const scale=Math.exp(Math.log(portalLayout.endScale)*camera);
    // One camera, two depths: d = 1 - 1/scale at the foreground plane (z=1).
    // The distant landscape (z=8) advances gently instead of inheriting the head's huge zoom.
    const cameraAdvance=1-1/scale,landscapeScale=8/(8-cameraAdvance);
    set(heroPortal,{transform:`translate(${mobile?'-45.8%,-48.8%':'-46.6%,-46.6%'}) scale(${scale})`,visibility:intro<.82?'visible':'hidden'});
    set(heroLandscape,{transform:`scale(${landscapeScale})`});
    set(heroShade,{opacity:.3+.7*land});
    // Lettering sits between the near stone and the distant landscape (z=1.7).
    // The head overtakes it instead of stretching it like a print on the photograph.
    const textScale=1.7/(1.7-cameraAdvance);
    // The opening sentence fades as the supporting copy arrives;
    // the mark stays with this section until the handoff to recognition.
    const titleExit=phase(intro,.80,.98);
    const titleVisible=titleExit<1;
    // The navigation's original transparent mark shares the title's distant plane.
    const brandReveal=phase(intro,.3,.44);
    set(heroBrand,{opacity:.32*brandReveal*(1-exit),transform:`translate(-50%, -50%) scale(${1+.16*camera})`,visibility:brandReveal>0&&exit<1?'visible':'hidden'});
    const gather=phase(intro,0,.25);
    const {centerX,centerY,stageWidth,lines,readingScale}=portalLayout;
    // Grow after gathering, but keep phone lettering inside a real safe area.
    // The desktop camera's 65% growth otherwise pushes a fitted line offscreen.
    const readingLimit=mobile?stageWidth*.88/Math.max(...lines.map(line=>line.width)):Infinity;
    const readingSize=Math.min(readingScale*(1+.65*phase(intro,.38,.62)),readingLimit);
    const gap=lines[0].height*readingSize*.16;
    heroTitleLines.forEach((line,i)=>{
     const targetX=centerX+(stageWidth/2-centerX)/textScale;
     const stackY=i===0?-(lines[1].height*readingSize+gap)/2:(lines[0].height*readingSize+gap)/2;
     const targetY=centerY+stackY/textScale;
     const lineScale=1+(readingSize/textScale-1)*gather;
     set(line,{transform:`translate3d(${(targetX-lines[i].x)*gather}px,${(targetY-lines[i].y)*gather}px,0) scale(${lineScale})`});
    });
    const focus=titleExit;
    // Keep the title exit soft without extending the scroll distance.
    set(heroTitle,{zIndex:intro<.22?'4':'1',opacity:1-titleExit,transform:`scale(${textScale})`,filter:focus>0?`blur(${(focus*.75).toFixed(2)}px)`:'none',visibility:titleVisible?'visible':'hidden',willChange:titleVisible?'transform, opacity, filter':'auto'});
    semantic(heroTitle,titleVisible);
    set(heroSupporting,{visibility:intro>.76?'visible':'hidden'});
    semantic(heroSupporting,intro>.76&&exit<.98);
    heroDetails.forEach((detail,i)=>{
     const arrive=easeArrival((intro-.76-i*.025)/.16);
     set(detail,{opacity:arrive,transform:`translateY(${(1-arrive)*20}px)`});
     semantic(detail,arrive>.98&&exit<.98);
    });
    heroSkip.hidden=intro>.86;
   }
   // Keep the landscape anchored while the two sets of content exchange places.
   set(heroCopy,{opacity:1-exit,transform:portalEnabled?'none':`translateY(${-exit*24}px)`});
   const portraitArrive=portalEnabled?phase(intro,.82,1):1;
   set(heroPortrait,{opacity:(1-exit)*portraitArrive,transform:`translateY(${exit*18+(1-portraitArrive)*28}px)`});
   semantic(heroPortrait,portraitArrive>.98&&exit<.98);
   const cueOpacity=(1-exit)*(portalEnabled?phase(intro,.90,1):1);
   set(heroCue,{opacity:cueOpacity});
   semantic(heroCue,cueOpacity>.98);
   frameRecognition();
   // One composition: title, three recognisable experiences and next step.
   // Visibility follows the whole section, so every sentence is readable together.
   set(recognitionTitle,{transform:'none'});
   recognitionLines.forEach(line=>{
    set(line,{opacity:1,transform:'none',filter:'none'});
    semantic(line,true);
   });
   set(recognitionClosing,{opacity:1,transform:'none'});
   semantic(recognitionClosing,true);
   semantic(hero,true);semantic(recognition,true);
   current=recognition.getBoundingClientRect().top<innerHeight*.5?'recognition':'hero';
  }
  if(enabled){
   // The next photograph and heading are already painted as they enter the viewport.
   const titleReveal=1;
   set(stage,{opacity:1,pointerEvents:'auto'});
   // Follow the input directly: an eased start would feel like another hold.
   const moduleEnter=clamp((position-score.modulesEnter.start)/(score.modulesEnter.end-score.modulesEnter.start)),routeEnter=progress(position,score.routesEnter);
   set(layer.insight,{visibility:position<score.modulesEnter.end?'visible':'hidden'});
   const inset=mobile?[10,8,46,8]:[18,54,13,8];
   set(insightImage,{inset:inset.map(n=>`${n}%`).join(' '),transform:`scale(${1-moduleEnter*.045})`,boxShadow:'none'});
   const captionOpacity=1;
   insightImage.style.setProperty('--insight-caption-opacity',String(captionOpacity));
   set(insightPaper,{opacity:captionOpacity,transform:'none'});
   set(insightCopy,{opacity:1-moduleEnter,transform:'none'});
   set(insightHeading,{transform:'none'});
   set(insightHeading,{opacity:titleReveal});
   const detailOpacity=1;
   insightDetails.forEach(detail=>{set(detail,{opacity:detailOpacity,transform:`translateY(${(1-detailOpacity)*18}px)`});semantic(detail,detailOpacity>.98&&moduleEnter<.98);});
   set(layer.modules,{visibility:position>=score.modulesEnter.start&&routeEnter<1?'visible':'hidden',transform:`translateY(${(1-moduleEnter)*100}%) scale(${1-routeEnter*.04})`,transformOrigin:'50% 50%'});
   let paperPhase=0;
   score.modules.forEach(({change})=>{if(change)paperPhase+=progress(position,change);});
   // Match the sheets' reversible scroll score. OKLab keeps the pale brand
   // tints luminous through the blend, with no timer or trailing transition.
   const surfaceFrom=Math.floor(paperPhase),surfaceTo=Math.min(modulePapers.length-1,surfaceFrom+1);
   const surfaceToken=index=>`var(--module-surface-${index%3})`;
   layer.modules.style.setProperty('--module-background',`color-mix(in oklab, ${surfaceToken(surfaceFrom)} ${(100*(1-(paperPhase-surfaceFrom))).toFixed(3)}%, ${surfaceToken(Math.max(0,surfaceTo))})`);
   const nextModule=Math.min(moduleCopies.length-1,Math.floor(paperPhase+.32));
   modulePapers.forEach((e,i)=>{
    const incoming=clamp(i-paperPhase),depth=Math.max(0,paperPhase-i);
    const offset=depth*(mobile?14:18);
    // Earlier landscapes stay in the stack; future sheets remain fully hidden.
    // Clip the incoming sheet against its landing frame while it slides upward,
    // leaving the deck itself open so the previous images can peek out behind it.
    set(e,{zIndex:i+1,visibility:paperPhase>i-1?'visible':'hidden',
     clipPath:`inset(0 0 ${incoming*100}% 0)`,
     transform:`translate(calc(${-offset}px), calc(${incoming*100}% - ${offset}px)) scale(${1-depth*.018}) rotate(${-depth*.7}deg)`});
   });
   // The sheet carries the movement. Copy cuts as the incoming sheet takes
   // the foreground, remaining intact and readable throughout the handover.
   moduleCopies.forEach((e,i)=>{
    const visible=i===nextModule;
    set(e,{opacity:1,visibility:visible?'visible':'hidden',clipPath:'none',transform:'none'});
    semantic(e,visible&&moduleEnter>.98&&routeEnter<1);
   });
   moduleButtons.forEach((e,i)=>{if(i===nextModule)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');});
   set(layer.routes,{visibility:routeEnter>0?'visible':'hidden',clipPath:`inset(${(1-routeEnter)*100}% 0 0)`});
   if(mobile){set(routeSelf,{inset:`0 0 ${routeEnter*50}% 0`});set(routeCare,{inset:`${100-routeEnter*50}% 0 0`});}
   else {set(routeSelf,{inset:`0 ${routeEnter*50}% 0 0`});set(routeCare,{inset:`0 0 0 ${100-routeEnter*50}%`});}
   const active=routeEnter>=1?'routes':moduleEnter>=1?'modules':'insight';
   if(position>=score.openingEnd)current=active;
   semantic(layer.insight,titleReveal>.1&&moduleEnter<1);
   semantic(layer.modules,moduleEnter>=1&&routeEnter<1);
   semantic(layer.routes,routeEnter>=1);
  }
  $$('.chapter-nav a').forEach(e=>{if(e.dataset.chapter===current)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');});
  if(storyEnabled){
   const p=clamp((top-storyBounds.top)/stageSize,0,storyScore.total);
   const curtain=progress(p,storyScore.curtain),film=progress(p,storyScore.film);
   set(storyCurtain,{transform:`translateX(${-curtain*104}%)`,visibility:curtain<1?'visible':'hidden'});
   set(storyPortrait,{transform:`scale(${.96+curtain*.04})`,opacity:1-film});
   set(storyFilm,{clipPath:`inset(${(1-film)*100}% 0 0)`,visibility:film>0?'visible':'hidden'});
   semantic(storyPortrait,curtain>.98&&film<1);semantic(storyFilm,film>=1);

  }
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 function go(id,immediate=false){
  if(!initialized)return;
  const target=document.getElementById(id);if(!target)return;
  releaseHero();
  const anchors={welkom:0,inzicht:score.insightRead.start,modules:score.modules[0].read.start+.15,routes:score.routesRead.start+.1};
  if((id==='welkom'&&heroEnabled)||(enabled&&id!=='herkenning'&&Object.hasOwn(anchors,id))){
   const top=id==='welkom'?journeyOrigin():experienceOrigin()+(anchors[id]-score.openingEnd)*stageSize;
   scrollTo({top,behavior:immediate||reduced.matches?'instant':'smooth'});
  } else target.scrollIntoView({behavior:immediate||reduced.matches?'instant':'smooth',block:'start'});
 }

 $$('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const id=a.getAttribute('href').slice(1);if(!document.getElementById(id))return;
  e.preventDefault();history.pushState(null,'',`#${id}`);go(id);
 }));
 moduleButtons.forEach((e,i)=>e.addEventListener('click',()=>{
  if(!enabled)return;
  scrollTo({top:experienceOrigin()+(score.modules[i].read.start+.15-score.openingEnd)*stageSize,behavior:'smooth'});
 }));
 // Keep the view control above the privacy notice, including wrapped mobile copy.
 const consent=document.querySelector('[data-analytics-consent]');
 const positionViewControl=()=>{
  const overlap=consent&&!consent.hidden?innerHeight-consent.getBoundingClientRect().top+12:0;
  root.style.setProperty('--view-control-clearance',`${overlap}px`);
 };
 if(consent){
  new ResizeObserver(positionViewControl).observe(consent);
  new MutationObserver(positionViewControl).observe(consent,{attributes:true,attributeFilter:['hidden']});
 }
 window.addEventListener('resize',positionViewControl,{passive:true});
 positionViewControl();
 button.addEventListener('click',()=>{const anchor={hero:'welkom',recognition:'herkenning',insight:'inzicht',modules:'modules',routes:'routes'}[current];releaseHero();manualOff=!manualOff;measure();go(anchor,true);});
 heroSkip.addEventListener('click',()=>{
  releaseHero();
  scrollTo({top:journeyOrigin()+portalTravel(),behavior:'instant'});
  schedule();
  requestAnimationFrame(()=>{heroCopy.querySelector('.actions a').focus({preventScroll:true});});
 });
 portalImage.addEventListener('load',measure);
 portalImage.addEventListener('error',measure);
 window.addEventListener('scroll',()=>{
  if(heroPlayback&&scrollY!==heroPlayback.anchor)scrollTo({top:heroPlayback.anchor,behavior:'instant'});
  schedule();
 },{passive:true});
 let measuredWidth=innerWidth,measuredHeight=viewportMeasure.clientHeight;
 window.addEventListener('resize',()=>{
  const width=innerWidth,height=viewportMeasure.clientHeight;
  // Browser chrome and the soft keyboard do not change the CSS small viewport.
  if(width===measuredWidth&&height===measuredHeight)return;
  releaseHero();
  const previousSize=stageSize,origin=journeyOrigin();
  const position=(scrollY-origin)/previousSize;
  const wasHero=heroEnabled,wasEnabled=enabled;
  const inJourney=wasHero&&position>=0&&position<=score.intro.end;
  const animatedAnchor={hero:'welkom',recognition:'herkenning',insight:'inzicht',modules:'modules',routes:'routes'}[current];
  const readingLine=document.querySelector('.site-header').getBoundingClientRect().bottom+24;
  const documentAnchor=[['welkom',hero],['herkenning',recognition],['inzicht',layer.insight],['modules',layer.modules],['routes',layer.routes]].find(([,element])=>{
   const bounds=element.getBoundingClientRect();return bounds.top<=readingLine&&bounds.bottom>readingLine;
  })?.[0];
  const readAnchor=inJourney?animatedAnchor:documentAnchor;
  measuredWidth=width;measuredHeight=height;
  measure();
  if(inJourney&&heroEnabled&&wasEnabled===enabled){
   scrollTo({top:journeyOrigin()+position*stageSize,behavior:'instant'});schedule();
  } else if(readAnchor&&(wasHero!==heroEnabled||wasEnabled!==enabled)) {
   go(readAnchor,true);
  }
 },{passive:true});
 reduced.addEventListener('change',()=>{releaseHero();measure();});
 window.addEventListener('popstate',()=>go(location.hash.slice(1)||'welkom',true));
 window.addEventListener('hashchange',()=>go(location.hash.slice(1),true));
 $('.video-play').addEventListener('click',()=>{
  const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/UAvdvZ4gBFs?autoplay=1&rel=0';iframe.title='Brandingvideo MyGrowise';iframe.allow='autoplay; encrypted-media; picture-in-picture';iframe.allowFullscreen=true;$('.video-frame').replaceChildren(iframe);
 });
 // The first measurement must use the final assets. Measuring before the portal
 // loads briefly activates a different chapter and lets scroll anchoring jump.
 const decodeImage=image=>image.decode?image.decode().catch(()=>{}):image.complete?Promise.resolve():new Promise(resolve=>{
  image.addEventListener('load',resolve,{once:true});
  image.addEventListener('error',resolve,{once:true});
 });
 const openingAssets=Promise.allSettled([
  ...[heroLandscape,portalImage,heroBrand.querySelector('img')].map(decodeImage),
  document.fonts.ready,
 ]);
 let assetDeadline;
 const assetTimeout=new Promise(resolve=>{assetDeadline=setTimeout(()=>resolve('timeout'),3500);});
 const prepareOpening=async()=>{
  const result=await Promise.race([openingAssets,assetTimeout]);
  clearTimeout(assetDeadline);
  // Once the safety deadline exposes the static page, keep that layout stable.
  // A late image or module must not switch it into the portal afterwards.
  if(result==='timeout'||document.documentElement.dataset.homeOpening==='fallback')manualOff=true;
  initialized=true;
  measure();
  if(location.hash)go(location.hash.slice(1),true);
  // Allow layout/scroll restoration to settle, then paint the final scene under
  // the still-opaque loading layer before starting its exit.
  requestAnimationFrame(()=>{
   measure();
   requestAnimationFrame(()=>{
    measure();
    window.dispatchEvent(new Event('home:ready'));
   });
  });
 };
 prepareOpening();
 document.fonts.ready.then(()=>{if(initialized){measure();if(location.hash)go(location.hash.slice(1),true);}});
 // Re-evaluate restoration after images and fonts have settled.
 window.addEventListener('pageshow',()=>{measure();if(location.hash)go(location.hash.slice(1),true);});
})();

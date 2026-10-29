(() => {
 'use strict';
 const root=document.querySelector('[data-home-experience]');
 if (!root) return;
 const $=s=>root.querySelector(s), $$=s=>[...root.querySelectorAll(s)];
 const heroTrack=$('[data-hero-track]'), heroStage=$('.hero-stage');
 const journey=$('.journey-track');
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
 const recognitionSurface=$('.recognition-surface'), recognitionLandscape=$('.recognition-landscape'), recognitionCaption=recognitionLandscape.querySelector('figcaption'), recognitionScenery=recognitionLandscape.querySelector('img'), recognitionLines=$$('.recognition-lines p'), recognitionClosing=$('.recognition-closing');
 const recognitionLogo=$('.recognition-logo'), recognitionTitle=$('#recognition-title');
 let recognitionTitleOffset=0;
 let recognitionEntry=0;
 const insightImage=$('.insight-image'), insightPaper=$('.insight-paper'), insightCopy=$('.insight-copy');
 const insightHeading=$('.insight-heading'), insightShade=$('.insight-image-shade');
 const insightTitle=$('#insight-title'), lightTitle=insightTitle.cloneNode(true);
 lightTitle.removeAttribute('id');lightTitle.classList.add('insight-heading-light');lightTitle.setAttribute('aria-hidden','true');
 insightHeading.append(lightTitle);
 const insightTitleLines=[...insightHeading.querySelectorAll('[data-insight-line]')];
 const insightDetails=[...insightCopy.children].filter(child=>child!==insightHeading);
 let titleLayout;
 // Two paint layers share one position: white over the photograph, brand ink over paper.
 function positionInsightTitle(material, mobile) {
  const scaleStart=mobile?1.08:1.45;
  const {finalX,finalY,width,height,stageWidth,stageHeight}=titleLayout;
  const startX=(stageWidth-width*scaleStart)/2;
  const startY=stageHeight*.5-height*scaleStart/2;
  const x=(startX-finalX)*(1-material),y=(startY-finalY)*(1-material),scale=1+(scaleStart-1)*(1-material);
  insightHeading.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;
  titleLayout.lines.forEach(({element,width:lineWidth})=>{element.style.transform=`translateX(${(width-lineWidth)/2*(1-material)}px)`;});
  const inset=mobile?[10,8,46,8]:[18,54,13,8];
  const left=stageWidth*inset[3]*material/100,top=stageHeight*inset[0]*material/100;
  const right=stageWidth*(1-inset[1]*material/100),bottom=stageHeight*(1-inset[2]*material/100);
  const titleX=finalX+x,titleY=finalY+y;
  // Clip at the photograph, allowing glyphs (descenders and italic overhangs)
  // to paint outside the heading's line box while they are still over the image.
  const clip=[(top-titleY)/scale,(titleX+width*scale-right)/scale,(titleY+height*scale-bottom)/scale,(left-titleX)/scale];
  lightTitle.style.clipPath=`inset(${clip.map(value=>`${value}px`).join(' ')})`;
 }

 const modulePapers=$$('.module-paper'), moduleCopies=$$('.module-copy'), moduleButtons=$$('.module-nav button');
 const routeSelf=$('.route-self'), routeCare=$('.route-care'), storyCurtain=$('.story-curtain'), storyPortrait=$('.story-portrait'), storyFilm=$('.story-film');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'), button=$('[data-motion-toggle]');
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
  const intro=beat(portalEnabled?1.2:0),heroRead=beat(.65),recognitionEnter=beat(.35);
  const recognitionRead=beat(.25),recognitionLift=beat(.3);
  const thoughts=beat(1.35),recognitionClose=beat(.3);
  const openingEnd=cursor;
  const handoff=beat(.4),insightTitle=beat(.3),material=beat(.6),insightRead=beat(.8);
  const modulesEnter=beat(.4),modules=[];
  for(let i=0;i<Math.max(1,modulePapers.length);i++){
   const read=beat(.65),change=i<modulePapers.length-1?beat(.3):null;
   modules.push({read,change});
  }
  const routesEnter=beat(.45),routesRead=beat(.75);
  return {intro,heroRead,recognitionEnter,recognitionRead,recognitionLift,thoughts,recognitionClose,openingEnd,handoff,insightTitle,material,insightRead,modulesEnter,modules,routesEnter,routesRead,total:cursor};
 }
 const progress=(position,beat)=>phase(position,beat.start,beat.end);
 const portalTravel=()=>score.intro.end*stageSize;
 const journeyOrigin=()=> (enabled?journey:heroTrack).getBoundingClientRect().top+scrollY-parseFloat(root.style.getPropertyValue('--top'));
 function frameRecognition(entry,release=0){
  const frame=entry*(1-release);
  // Keep the landscape softly visible over the gradient; the lily reveals it at full opacity.
  set(recognitionLandscape,{clipPath:'none',opacity:1-.66*frame});
  set(recognitionLogo,{opacity:frame});
  set(recognitionCaption,{opacity:entry*(1-release)});
  const landscapeScale=portalLayout?8/(8-(1-1/portalLayout.endScale)):1.12;
  set(recognitionScenery,{transform:innerWidth<=760?`translateY(${-33*frame}%)`:`scale(${landscapeScale})`});
 }
 function measure(){
  if(!initialized)return;
  const bar=0;
  const header=document.querySelector('.site-header')?.getBoundingClientRect().height ?? 80;
  root.style.setProperty('--bar',`${bar}px`);root.style.setProperty('--top',`${bar+header}px`);
  const mobile=innerWidth<=600, available=innerHeight-bar-header;
  enabled=!manualOff&&!reduced.matches&&available>=(mobile?650:650)&&innerWidth>=350;
  heroEnabled=!manualOff&&!reduced.matches&&available>=600;
  root.classList.toggle('hero-enhanced',heroEnabled);
  if(heroEnabled){
   heroEnabled=recognitionInner.scrollHeight<=recognitionInner.clientHeight+1;
   root.classList.toggle('hero-enhanced',heroEnabled);
  }
  storyEnabled=enabled;
  root.classList.toggle('enhanced',enabled);root.classList.toggle('story-enhanced',storyEnabled);
  if (enabled) {
   // Measure the real catalog copy: long titles and larger text must never be clipped.
   const moduleCopyTop=$('.module-copies').offsetTop;
   const moduleFits=moduleCopies.every(copy=>moduleCopyTop+copy.scrollHeight<=stage.clientHeight-60);
   const insightFits=insightCopy.offsetTop+insightCopy.scrollHeight<=stage.clientHeight-24;
   const heroFits=!mobile||heroSupporting.offsetTop+heroSupporting.scrollHeight<=heroPortrait.offsetTop-12;
   enabled=moduleFits&&insightFits&&heroFits&&heroEnabled;
   root.classList.toggle('enhanced',enabled);
  }
  storyEnabled=enabled&&$('.story-copy').offsetTop+$('.story-copy').scrollHeight<=storyStage.clientHeight-16;
  root.classList.toggle('story-enhanced',storyEnabled);
  portalEnabled=heroEnabled&&portalImage.complete&&portalImage.naturalWidth>0;
  root.classList.toggle('portal-enhanced',portalEnabled);
  stageSize=available;
  // Measure the untransformed heading so its opening position is centered in the stage.
  recognitionTitleOffset=available*.5-(recognitionInner.offsetTop+recognitionTitle.offsetTop+recognitionTitle.offsetHeight/2);
  score=composeScore();
  root.style.setProperty('--journey-height',`${stageSize*(1+score.total)}px`);
  root.style.setProperty('--opening-height',`${stageSize*(1+score.openingEnd)}px`);
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
   [insightImage,insightPaper,insightCopy,insightHeading,insightShade,lightTitle,...insightTitleLines,...insightDetails,routeSelf,routeCare,...modulePapers,...moduleCopies].forEach(e=>e.removeAttribute('style'));
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
  if(enabled) titleLayout={finalX:insightCopy.offsetLeft+insightHeading.offsetLeft,finalY:insightCopy.offsetTop+insightHeading.offsetTop,width:insightHeading.offsetWidth,height:insightHeading.offsetHeight,lines:insightTitleLines.map(element=>({element,width:element.offsetWidth})),stageWidth:stage.clientWidth,stageHeight:stage.clientHeight};
  update();
 }
 function update(){
  frame=0;
  if(!initialized)return;
  const top=parseFloat(getComputedStyle(root).getPropertyValue('--top'));
  const mobile=innerWidth<=600;
  // Pure scroll position: stopping and reversing never starts a second clock.
  const position=heroEnabled?(scrollY-journeyOrigin())/stageSize:0;
  const storyBounds=storyEnabled?story.getBoundingClientRect():null;
  if(heroEnabled){
   const intro=portalEnabled?clamp(position/score.intro.end):1;
   const enter=progress(position,score.recognitionEnter);
   const exit=phase(position,score.recognitionEnter.start,score.recognitionEnter.start+.24);
   const reading=clamp(position-score.thoughts.start,0,score.thoughts.end-score.thoughts.start);
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
    // Grow only after the two lines have finished gathering, keeping their shared center.
    const readingSize=readingScale*(1+.65*phase(intro,.38,.62));
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
   recognitionEntry=enter;
   set(recognition,{opacity:phase(position,score.recognitionEnter.start,score.recognitionEnter.start+.20),visibility:enter>.001?'visible':'hidden',transform:'none'});
   set(recognitionSurface,{clipPath:'none'});
   frameRecognition(enter);
   set(recognitionInner,{opacity:phase(position,score.recognitionEnter.start+.10,score.recognitionEnter.end),transform:'none',clipPath:innerWidth<=760?'none':`inset(0 ${clamp((61-67*enter)/54)*100}% 0 0)`});
   const lift=progress(position,score.recognitionLift);
   set(recognitionTitle,{transform:`translateY(${recognitionTitleOffset*(1-lift)}px)`});
   const firstThought=phase(position,score.recognitionLift.start+.06,score.recognitionLift.end);
   const thoughtPosition=phase(reading,.32,.45)+phase(reading,.77,.90);
   recognitionLines.forEach((line,i)=>{
    const distance=i-thoughtPosition,focus=1-phase(Math.abs(distance),.05,.95);
    // One thought takes the stage at a time; its colored phrase follows the lead.
    line.style.setProperty('--phrase-offset',innerWidth<=760?'0px':`${(1-focus)*22}px`);
    set(line,{opacity:focus*firstThought,transform:`translateY(calc(-50% + ${distance*(innerWidth<=760?40:64)+(1-firstThought)*24}px))`,filter:'none'});
    semantic(line,focus*firstThought>.5);
   });
   const closing=phase(position,score.thoughts.end-.15,score.thoughts.end);
   set(recognitionClosing,{opacity:closing,transform:`translateY(${12*(1-closing)}px)`});
   semantic(recognitionClosing,closing>.98);
   semantic(hero,exit<.98);semantic(recognition,enter>.01);
   current=enter<.5?'hero':'recognition';
  }
  if(enabled){
   const handoff=progress(position,score.handoff);
   const recognitionFade=1-phase(handoff,0,.75);
   const landscapeReveal=phase(handoff,0,1);
   const titleReveal=phase(handoff,.25,1);
   set(recognitionInner,{opacity:recognitionFade*progress(position,score.recognitionEnter)});
   frameRecognition(recognitionEntry,landscapeReveal);
   set(stage,{opacity:landscapeReveal,pointerEvents:landscapeReveal>.98?'auto':'none'});
   semantic(recognition,recognitionFade>.05&&position>=score.recognitionEnter.start);
   const material=progress(position,score.material);
   const moduleEnter=progress(position,score.modulesEnter),routeEnter=progress(position,score.routesEnter);
   set(layer.insight,{visibility:position<score.modulesEnter.end?'visible':'hidden'});
   const inset=mobile?[10,8,46,8]:[18,54,13,8];
   set(insightImage,{inset:inset.map(n=>`${n*material}%`).join(' '),transform:`scale(${1-moduleEnter*.045})`,boxShadow:'none'});
   const captionOpacity=phase(material,.65,1);
   insightImage.style.setProperty('--insight-caption-opacity',String(captionOpacity));
   set(insightPaper,{opacity:captionOpacity,transform:'none'});
   set(insightCopy,{opacity:1-moduleEnter,transform:'none'});
   positionInsightTitle(material,mobile);
   set(insightHeading,{opacity:titleReveal});
   set(insightShade,{opacity:1-phase(material,.72,1)});
   const detailOpacity=phase(material,.58,.94);
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
   if(titleReveal>.1)current=active;
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
  const anchors={welkom:0,herkenning:score.recognitionRead.start,inzicht:score.insightRead.start+.15,modules:score.modules[0].read.start+.15,routes:score.routesRead.start+.1};
  if(heroEnabled&&(enabled||id==='welkom'||id==='herkenning')&&Object.hasOwn(anchors,id)){
   scrollTo({top:journeyOrigin()+anchors[id]*stageSize,behavior:immediate||reduced.matches?'instant':'smooth'});
  } else target.scrollIntoView({behavior:immediate||reduced.matches?'instant':'smooth',block:'start'});
 }

 $$('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const id=a.getAttribute('href').slice(1);if(!document.getElementById(id))return;
  e.preventDefault();history.pushState(null,'',`#${id}`);go(id);
 }));
 moduleButtons.forEach((e,i)=>e.addEventListener('click',()=>{
  if(!enabled)return;
  scrollTo({top:journeyOrigin()+(score.modules[i].read.start+.15)*stageSize,behavior:'smooth'});
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
 button.addEventListener('click',()=>{const anchor={hero:'welkom',recognition:'herkenning',insight:'inzicht',modules:'modules',routes:'routes'}[current];manualOff=!manualOff;measure();go(anchor,true);});
 heroSkip.addEventListener('click',()=>{
  scrollTo({top:journeyOrigin()+portalTravel(),behavior:'instant'});
  schedule();
  requestAnimationFrame(()=>{heroCopy.querySelector('.actions a').focus({preventScroll:true});});
 });
 portalImage.addEventListener('load',measure);
 portalImage.addEventListener('error',measure);
 window.addEventListener('scroll',schedule,{passive:true});
 window.addEventListener('resize',()=>{const anchor=location.hash.slice(1);measure();if(anchor&&['welkom','herkenning','inzicht','modules','routes'].includes(anchor))go(anchor,true);},{passive:true});
 reduced.addEventListener('change',measure);
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

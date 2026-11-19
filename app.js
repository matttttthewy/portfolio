import {createCard, coverURL, fitCardTitles, bendCard} from './cards.mjs';
import {startLoader} from './loader.mjs';
import {createPhoneRenderer} from './mobile-cards.mjs';
import {paintBackdrop} from './background.mjs';
import {achievements} from './achievements.js';
import {END,OPENING_END,SCROLL_END,clamp,mix,range,storyProgress,cardPose,focusState,openingPose,openingDrift,pickCard,transform,presentationDestination,presentationDuration} from './motion.mjs';

const $=id=>document.getElementById(id);
const root=document.documentElement, stage=$('viewport'), cards=$('cards');
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const coarseScreen=matchMedia('(any-pointer: coarse) and (max-width: 1024px)');
const webKitDesktop=/AppleWebKit/.test(navigator.userAgent)&&!/Chrom(?:e|ium)|Edg\//.test(navigator.userAgent);
const phoneCanvas=$('phone-cards');
const zone=$('gallery-zone');
const backdrop=$('backdrop');
const masthead=$('masthead');
const themeColor=document.querySelector('meta[name="theme-color"]');
const intro=$('intro'), focusCopy=$('focus'), gridCopy=$('grid-copy');
const focusTitle=$('focus-title'), focusDescription=$('focus-description');
const effectCopy=$('effect-copy'), skyLayer=$('sky'), flareLayer=$('flare');
const galleryCaption=$('gallery-caption'), galleryCurrent=$('gallery-current');
const thought=$('thought'), rail=$('rail').firstElementChild;
const thoughtHome=thought.parentElement;
const effectLabels=['Каждый опыт —\nновый взгляд.','Ближе\nк сути.','Замечать\nвозможности.','Менять\nперспективу.','Соединять\nлюдей.'];
const n=achievements.length;
const nodes=achievements.map(createCard);
const lights=nodes.map(()=>({strength:0,x:.5,y:.45}));
let pointer=null, drag=null;
let lastInteraction=-Infinity, lastScroll=-Infinity;
let idleSpeed=0, driftTime=0;
let lastEffect=-1, lastFocus=-1, lastGallery=-1;
let previousScene='';
let lastBackdrop=-Infinity, lastBackdropSize='', backdropWasLight=false;
let phoneStage=false, phoneRenderer=null, usePhoneCanvas=false;
let lastBendPaint=-Infinity;
let w=0,h=innerHeight,unit=500,sceneLength=SCROLL_END*unit;
let target=0,current=0,last=performance.now(),angle=0,angleTarget=0,ready=false;
const presentationQueue=[];
const presentationArrivalMargin=.018;
let presenting=false, presentationMove=null, presentationPauseUntil=0;
const scrollTarget=()=>scrollY>=sceneLength-.55 ? SCROLL_END : clamp(scrollY/unit,0,SCROLL_END);
cards.append(...nodes);
stage.addEventListener('load',()=>{previousScene=''},true);

function fitTitles() {
  const mobile=w<700;
  fitCardTitles(nodes,mobile?210:250,mobile?285:330,mobile);
  previousScene='';
}

function cancelPresentation() {
  presenting=false;
  presentationQueue.length=0;
  presentationMove=null;
  presentationPauseUntil=0;
}

function advancePresentation(now,reduced,frameMs) {
  if (presentationMove) {
    const {top,deadline,sequence}=presentationMove;
    if (sequence) {
      // Drive the existing scroll timeline through every scene in the sequence.
      sequence.elapsed+=Math.min(frameMs,120);
      const time=reduced?1:clamp(sequence.elapsed/sequence.duration);
      const eased=mix(time,range(time,0,1),sequence.easing);
      scrollTo({top:mix(sequence.from,top,eased),behavior:'instant'});
      current=target=scrollTarget();
      if (time<1) return;
      presentationMove.sequence=null;
    }
    const reachedScroll=Math.abs(scrollY-top)<=1.5;
    if (reachedScroll&&Math.abs(current-clamp(top/unit,0,SCROLL_END))<presentationArrivalMargin) {
      presentationMove=null;
      presentationPauseUntil=now+140;
    } else if (!reachedScroll&&now>=deadline) {
      cancelPresentation();
    }
    return;
  }
  if (!presentationQueue.length||now<presentationPauseUntil) return;
  const maxScroll=document.scrollingElement.scrollHeight-root.clientHeight;
  const top=presentationDestination(scrollY,presentationQueue.shift(),unit,maxScroll);
  if (top===null) return;
  const from=scrollY;
  const crossesFooter=Math.max(from,top)>sceneLength+1.5;
  const sequenceDuration=!reduced&&!crossesFooter?presentationDuration(from/unit,top/unit):0;
  const closeup=!reduced&&!crossesFooter&&sequenceDuration===0;
  // Add half a second to the former approach time for this scroll distance.
  const distance=Math.abs(top-from)/unit;
  const previousRate=(phoneStage?22:13)*.8;
  const duration=closeup
    ? 500+1000*Math.max(0,Math.log(distance/presentationArrivalMargin))/previousRate
    : sequenceDuration;
  presentationMove={
    top,
    deadline:now+duration+2400,
    sequence:duration>0?{from,duration,elapsed:0,easing:closeup?1:.45}:null,
  };
  if (presentationMove.sequence) return;
  scrollTo({top,behavior:!reduced&&crossesFooter?'smooth':'instant'});
}

function resize(){
  const oldWidth=w, oldUnit=unit, oldHeight=h, oldLength=sceneLength, oldScroll=scrollY;
  const nextPhone=innerWidth<700 || coarseScreen.matches;
  const modeChanged=nextPhone!==phoneStage;
  phoneStage=nextPhone;
  root.toggleAttribute('data-phone-stage',phoneStage);
  if (modeChanged) (phoneStage?stage:thoughtHome).append(thought);
  if (modeChanged&&!phoneStage) themeColor.content='#090608';
  if (phoneStage) {
    root.style.removeProperty('--view-height');
  } else {
    root.style.setProperty('--view-height',innerHeight+'px');
  }
  if ((phoneStage||webKitDesktop)&&!phoneRenderer) {
    phoneRenderer=createPhoneRenderer(phoneCanvas,$('phone-cards-fallback'),()=>{previousScene='';});
  }

  w=phoneStage?root.clientWidth:innerWidth;
  h=phoneStage?(stage.clientHeight||innerHeight):innerHeight;
  usePhoneCanvas=phoneStage && phoneRenderer!==null;
  root.toggleAttribute('data-phone-renderer',usePhoneCanvas);
  phoneRenderer?.resize(w,h,devicePixelRatio,phoneStage);

  if (!modeChanged && oldWidth===w && oldHeight===h) return;
  if (modeChanged||oldWidth!==w||!phoneStage) cancelPresentation();
  // Keep scroll progress stable when the mobile browser toolbar expands or collapses.
  if (!phoneStage||modeChanged||oldWidth!==w) {
    unit=Math.max(320,Math.min(600,h*(phoneStage?.62:.65)));
  }
  sceneLength=SCROLL_END*unit;
  root.style.setProperty('--unit',unit+'px');
  root.style.setProperty('--scene-length',sceneLength+'px');
  // The browser toolbar changes viewport height, but the card textures keep the same dimensions.
  if (oldWidth===0||(oldWidth<700)!==(w<700)) {
    root.style.setProperty('--card-w',w<700?'210px':'250px');
    root.style.setProperty('--card-h',w<700?'285px':'330px');
    fitTitles();
  }
  if (ready&&oldUnit!==unit) {
    const nextScroll=oldScroll<=oldLength ? oldScroll/oldUnit*unit
      : sceneLength+(oldScroll-oldLength)*h/oldHeight;
    scrollTo(0,nextScroll);
  }
  target=scrollTarget();
  previousScene='';
}

resize();
addEventListener('resize',resize,{passive:true});
new ResizeObserver(resize).observe(stage);
coarseScreen.addEventListener?.('change',resize);
addEventListener('pageshow',resize);
for (const event of ['wheel','pointerdown','touchstart']) {
  addEventListener(event,cancelPresentation,{capture:true,passive:true});
}
addEventListener('keydown',event=>{
  if (event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey) return;
  const space=event.key===' '||event.key==='Spacebar';
  if (event.shiftKey&&!space) return;
  let direction;
  if (space) direction=event.shiftKey?-1:1;
  else if (['PageDown','ArrowRight','ArrowDown'].includes(event.key)) direction=1;
  else if (['PageUp','ArrowLeft','ArrowUp'].includes(event.key)) direction=-1;
  else {
    if (['Home','End','Escape','Tab'].includes(event.key)) cancelPresentation();
    return;
  }
  const control=event.target instanceof Element?event.target:null;
  if (control?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  if (space&&control?.closest('a[href], button, summary, [role="button"]')) return;
  event.preventDefault();
  if (ready&&!event.repeat) {
    presenting=true;
    presentationQueue.push(direction);
  }
});
addEventListener('scroll',()=>{
  target=scrollTarget();
  if(target<SCROLL_END-.015)angleTarget=angle;
  lastScroll=performance.now();
},{passive:true});
stage.addEventListener('pointermove',e=>{
  if (e.pointerType==='mouse' || e.pointerType==='pen') pointer={x:e.clientX,y:e.clientY};
});
stage.addEventListener('pointerleave',()=>{pointer=null});
addEventListener('blur',()=>{pointer=null});

const displayTitle=item=>item.title.replace(/-\n/g,'-').replaceAll('\n',' ');
const easeOpacity=(el,v)=>{el.style.opacity=clamp(v).toFixed(4)};
function render(now){
  const frameMs=now-last;
  const dt=Math.min(frameMs/1000,phoneStage?.10:.05);
  last=now;
  const reduced=motionPreference.matches;
  const afterStage=scrollY>sceneLength+h*.035;
  const followStep=phoneStage||presentationMove?dt:Math.min(dt,.028);
  const follow=reduced || (afterStage && target===SCROLL_END && current<SCROLL_END-1.5) ? 1 : 1-Math.exp(-followStep*(phoneStage?22:13));
  current=Math.abs(target-current)<.00005 ? target : mix(current,target,follow);
  advancePresentation(now,reduced,frameMs);
  const atEnd=target===SCROLL_END;
  const p=storyProgress(current),arrival=range(p,18.8,20);
  // Keep the same card surface from the opening through the final gallery.
  const desktopCanvas=!phoneStage&&webKitDesktop&&phoneRenderer!==null;
  const galleryVisible=scrollY<sceneLength+h*.65&&!document.hidden;
  const settled=p>19.985&&atEnd;
  // Resizing the card canvas at every click resets Safari's drawing buffer.
  const detailFrame=desktopCanvas&&(presenting || settled || !presentationMove&&Math.abs(target-current)<.012&&now-lastScroll>180);
  const galleryInteractive=settled;
  const idle=!reduced&&galleryVisible&&galleryInteractive&&!drag&&now-lastInteraction>2600;
  idleSpeed=idle ? mix(idleSpeed,.10,1-Math.exp(-dt*3)) : 0;
  angleTarget+=idleSpeed*dt;
  angle=Math.abs(angleTarget-angle)<.00001 ? angleTarget : mix(angle,angleTarget,1-Math.exp(-dt*11));
  if (!reduced&&!document.hidden&&p<19.995) driftTime+=dt;
  const backdropSize=`${w}:${h}`;
  const lightBackdrop=p>=19.995;
  if (now-lastBackdrop>=(phoneStage?64:32)||backdropSize!==lastBackdropSize||lightBackdrop!==backdropWasLight) {
    paintBackdrop(backdrop,p,w,h,reduced?0:driftTime,phoneStage?15:24);
    lastBackdrop=now;
    lastBackdropSize=backdropSize;
    backdropWasLight=lightBackdrop;
  }

  const sinceScroll=(now-lastScroll)/1000;
  const pauseFlutter=!reduced&&current>0&&current<5.09&&sinceScroll<1.24;
  const canHover=!usePhoneCanvas&&(!desktopCanvas||settled)&&pointer&&!reduced&&ready&&!drag&&now-lastInteraction>260;
  const hoverPosition=canHover?`${pointer.x}:${pointer.y}`:'';
  const signature=`${current}:${w}:${h}:${angle}:${target}:${scrollY}:${hoverPosition}:${detailFrame}`;
  if (signature===previousScene&&!pauseFlutter&&!lights.some(light=>light.strength>.002&&light.strength<.998)) {
    requestAnimationFrame(render);
    return;
  }
  previousScene=signature;

  const poses=nodes.map((_,i)=>current<OPENING_END?openingPose(current,i,n,w,h):cardPose(p,i,n,w,h,angle,phoneStage));
  if (pauseFlutter) for (const [i,v] of poses.entries()) {
    const sway=openingDrift(current,i,sinceScroll,driftTime);
    v.rz+=sway*2.1;
    v.rx+=sway*1.4;
    v.y+=sway*2.2;
  }
  let hit=null;
  const deformation=phoneStage&&!usePhoneCanvas ? 0 : range(p,15.38,16.9)*(1-range(p,18.13,18.88));
  const repaintBend=deformation>0&&now-lastBendPaint>=31;
  if (repaintBend) lastBendPaint=now;
  const lens=w<700?900:1100;
  const focusDepth=!usePhoneCanvas&&!desktopCanvas&&p>=3.22&&p<13;
  const opaqueScene=p<13;
  if (opaqueScene) for (const card of poses) {
    card.s*=mix(.025,1,range(card.o,0,.78));
  }
  if (canHover) {
    const bounds=stage.getBoundingClientRect();
    const local={x:pointer.x-bounds.left,y:pointer.y-bounds.top};
    const clip=arrival*.21;
    const side=arrival*(w<700?.03:.014);
    if (local.x>=w*side&&local.x<=w*(1-side)&&local.y>=h*arrival*.11&&local.y<=h*(1-clip)) {
      hit=pickCard(poses,local,w,h);
    }
  }
  stage.dataset.hoverCard=hit ? achievements[hit.index].id : '';
  stage.style.setProperty('--gallery-frame',arrival.toFixed(4));
  stage.toggleAttribute('data-opening',current<OPENING_END);
  stage.toggleAttribute('data-focus-depth',focusDepth);
  stage.toggleAttribute('data-desktop-canvas',desktopCanvas);
  stage.toggleAttribute('data-gallery-framing',arrival>0);
  stage.toggleAttribute('data-gallery-ready',galleryInteractive);
  if (phoneStage) {
    const chromeColor=p>=19.56?'#f4f4f6':'#090608';
    if (themeColor.content!==chromeColor) themeColor.content=chromeColor;
  }
  stage.parentElement.toggleAttribute('data-sky',p>=19.56);
  stage.dataset.progress=p.toFixed(4);
  stage.dataset.timeline=current.toFixed(4);
  stage.dataset.galleryAngle=angle.toFixed(5);

  const {index:focusIndex,strength:focusStrength}=focusState(p);
  const lightFollow=1-Math.exp(-dt*11);
  if (!usePhoneCanvas) nodes.forEach((el,i)=>{
    const pose=poses[i], light=lights[i];
    const visiblyPresent=pose.o>=.002;
    if (!visiblyPresent&&(desktopCanvas||el.hidden)) {
      light.strength=0;
      return;
    }
    const isHit=hit?.index===i;
    light.strength=mix(light.strength,isHit?1:0,lightFollow);
    if (light.strength<.002) light.strength=0;
    if (light.strength>.998) light.strength=1;
    if (isHit) {
      light.x=mix(light.x,hit.x,lightFollow);
      light.y=mix(light.y,hit.y,lightFollow);
    }
    if (settled&&light.strength>.002) {
      pose.z+=24*light.strength;
      pose.s*=1+light.strength*.065;
      pose.rx+=(.5-light.y)*10*light.strength;
      pose.ry+=(light.x-.5)*9*light.strength;
    }
    if (desktopCanvas) return;
    el.hidden=!visiblyPresent;
    el.style.borderRadius=mix(4,20,arrival)+'px';
    el.style.transform=transform(pose);
    const opacity=opaqueScene&&!phoneStage ? range(pose.o,.018,.30) : opaqueScene ? 1 : pose.o;
    el.style.opacity=opacity.toFixed(4);
    // Explicit depth avoids reparenting a card when its caption fades or changes.
    el.style.zIndex=focusDepth?Math.round(pose.z*10)+20000:'';
    const depthShade=p>=3.2&&p<13 ? (1-range(pose.z,-685,-65))*.51 : 0;
    if (depthShade>.001) el.style.setProperty('--depth-shade',depthShade.toFixed(3));
    else el.style.removeProperty('--depth-shade');
    if (light.strength>0||el.style.getPropertyValue('--light-alpha')!=='0') {
      el.style.setProperty('--light-x',`${light.x*100}%`);
      el.style.setProperty('--light-y',`${light.y*100}%`);
      el.style.setProperty('--light-alpha',light.strength.toFixed(3));
    }
    if (!deformation&&!el.classList.contains('is-bent')) return;
    const projection=lens/(lens-pose.z);
    const onScreen=pose.o>.02&&Math.abs(pose.x*projection)<w*.66&&Math.abs(pose.y*projection)<h*.74;
    if (onScreen&&deformation>=.001&&!repaintBend) {
      previousScene='';
      return;
    }
    const detail=Math.max(1.18,projection*pose.s*1.32*Math.min(devicePixelRatio||1,2.4));
    bendCard(el,onScreen?deformation:0,Math.sin((i%5-2)*.42+p*.21),detail,light);
  });
  if (desktopCanvas||usePhoneCanvas) {
    phoneRenderer.draw(nodes,poses,p,arrival,deformation,focusIndex,focusStrength,desktopCanvas?lights:null,detailFrame);
  }

  const gridStrength=current<OPENING_END ? range(current,7.04,7.39) : 1-range(p,3.26,3.53);
  easeOpacity(gridCopy,gridStrength);
  easeOpacity(intro,1-range(current,.28,1.56));
  intro.style.transform=`translateY(${-range(current,0,1.56)*h*.10}px)`;
  if (lastFocus!==focusIndex) {
    const item=achievements[focusIndex];
    focusCopy.dataset.item=item.id;
    focusTitle.textContent=displayTitle(item);
    focusDescription.replaceChildren(...item.description.split('\n').map(paragraph=>{
      const text=document.createElement('p');
      text.textContent=paragraph;
      return text;
    }));
    lastFocus=focusIndex;
  }
  easeOpacity(focusCopy,focusStrength);
  focusCopy.style.visibility=focusStrength>.001?'visible':'hidden';
  focusCopy.style.transform=`translateY(${(1-focusStrength)*8}px)`;
  const effectIndex=clamp(Math.round(p)-14,0,4);
  const strength=range(p,13.6,14)*(1-range(p,18.24,18.78))
    *(1-range(Math.abs(p-effectIndex-14),.39,.50));
  if (effectIndex!==lastEffect) {
    effectCopy.textContent=effectLabels[effectIndex];
    lastEffect=effectIndex;
  }
  easeOpacity(effectCopy,strength);
  stage.toggleAttribute('data-effects-copy',strength>.001);
  stage.style.setProperty('--copy-clearance',(strength*.98).toFixed(3));
  easeOpacity(flareLayer,Math.pow(Math.max(0,1-Math.abs(p-16.5)/.8),2)*.22);
  skyLayer.style.opacity=arrival.toFixed(4);
  skyLayer.style.transform=`scale(${mix(1.13,1,arrival)})`;
  const thoughtOpacity=range(p,19.78,19.96);
  easeOpacity(thought,thoughtOpacity);
  thought.inert=thoughtOpacity<.99;
  thought.style.visibility=thoughtOpacity>0?'visible':'hidden';
  if (!galleryInteractive&&document.activeElement===zone) zone.blur();
  zone.toggleAttribute('inert',!galleryInteractive);
  zone.style.pointerEvents=galleryInteractive?'auto':'none';
  zone.tabIndex=galleryInteractive?0:-1;
  easeOpacity(galleryCaption,range(p,19.7,20));
  const center=((Math.round(-angle/(Math.PI*2/n))%n)+n)%n;
  if (center!==lastGallery) {
    galleryCurrent.textContent=displayTitle(achievements[center]);
    lastGallery=center;
  }
  rail.style.transform=`scaleY(${current/SCROLL_END})`;
  const mastheadLight=1-range(p,19.04,19.42);
  const mastheadDark=range(p,19.63,19.94);
  masthead.classList.toggle('on-sky',p>=19.5);
  easeOpacity(masthead,(mastheadLight+mastheadDark)*(1-range(scrollY,sceneLength+h*.15,sceneLength+h*.45)));
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

zone.addEventListener('wheel',e=>{
  if (current<SCROLL_END-.015||e.ctrlKey) return;
  const horizontal=Math.abs(e.deltaX)>Math.abs(e.deltaY);
  if (!horizontal&&!e.shiftKey) return;
  e.preventDefault();
  lastInteraction=performance.now();
  const delta=horizontal?e.deltaX:e.deltaY;
  angleTarget+=clamp(delta*(e.deltaMode===1?16:e.deltaMode===2?h:1),-240,240)*.0028;
},{passive:false});
function beginDrag(x,y,id) {
  if (zone.hasAttribute('inert')) return;
  lastInteraction=performance.now();
  drag={x,y,base:angleTarget,mode:null,id};
}
function moveDrag(x,y,id) {
  if (!drag||drag.id!==id) return false;
  const dx=x-drag.x,dy=y-drag.y;
  if (!drag.mode&&Math.hypot(dx,dy)>(phoneStage?8:7)) {
    drag.mode=Math.abs(dx)>Math.abs(dy)*(phoneStage?1.12:1)?'gallery':'page';
  }
  if (drag.mode==='gallery') {
    angleTarget=drag.base-dx*.006;
    return true;
  }
  return false;
}
function finishDrag() {
  if (drag) lastInteraction=performance.now();
  drag=null;
}
zone.addEventListener('pointerdown',e=>{
  if (e.pointerType==='touch'||e.button!==0||zone.hasAttribute('inert')) return;
  beginDrag(e.clientX,e.clientY,e.pointerId);
  zone.setPointerCapture(e.pointerId);
});
zone.addEventListener('pointermove',e=>{
  if (e.pointerType!=='touch') moveDrag(e.clientX,e.clientY,e.pointerId);
});
for (const event of ['pointerup','pointercancel','lostpointercapture']) {
  zone.addEventListener(event,e=>{if(e.pointerType!=='touch')finishDrag();});
}
zone.addEventListener('touchstart',e=>{
  if (e.touches.length!==1) {finishDrag();return;}
  const touch=e.touches[0];
  beginDrag(touch.clientX,touch.clientY,touch.identifier);
},{passive:true});
zone.addEventListener('touchmove',e=>{
  if (e.touches.length!==1||!drag||!e.cancelable) {finishDrag();return;}
  const touch=e.touches[0];
  if (moveDrag(touch.clientX,touch.clientY,touch.identifier)) e.preventDefault();
},{passive:false});
zone.addEventListener('touchend',finishDrag,{passive:true});
zone.addEventListener('touchcancel',finishDrag,{passive:true});

function stepGallery(direction) {
  lastInteraction=performance.now();
  angleTarget+=direction*Math.PI*2/n;
}
zone.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
    e.preventDefault();
    stepGallery(e.key==='ArrowRight'?1:-1);
  } else if(e.key==='Escape')zone.blur();
});
$('gallery-prev').addEventListener('click',()=>stepGallery(1));
$('gallery-next').addEventListener('click',()=>stepGallery(-1));
$('home').addEventListener('click',e=>{
  e.preventDefault();
  cancelPresentation();
  scrollTo({top:0,behavior:motionPreference.matches?'instant':'smooth'});
});
document.fonts.ready.then(()=>{
  fitTitles();
  if (!phoneRenderer) return;
  const pending=[...nodes];
  function prepareCover() {
    if (ready||target>0||document.hidden||!pending.length) return;
    const node=pending.shift();
    if (!phoneRenderer.prepare(node)) pending.push(node);
    requestAnimationFrame(prepareCover);
  }
  requestAnimationFrame(prepareCover);
});
startLoader(()=>{ready=true;previousScene='';},phoneStage);

const thoughtPreview=$('thought-preview');
const previewImage=thoughtPreview.querySelector('img');
const previewTitle=thoughtPreview.querySelector('figcaption');
let hoveredPhrase=null;

function updateQuotePreview() {
  if (!hoveredPhrase||w<900||h<520||thought.inert) {
    thoughtPreview.classList.remove('visible');
    return;
  }
  const fragment=hoveredPhrase.getClientRects()[0];
  if (!fragment||fragment.top<220||fragment.top>innerHeight) {
    thoughtPreview.classList.remove('visible');
    return;
  }
  const item=achievements.find(item=>item.id===hoveredPhrase.dataset.preview);
  const cover=coverURL(item.id);
  if (previewImage.getAttribute('src')!==cover) {
    previewImage.src=cover;
    previewTitle.textContent=displayTitle(item);
  }
  const footer=thought.getBoundingClientRect();
  thoughtPreview.style.left=`${clamp(fragment.left+fragment.width*.5,100,w-100)-footer.left}px`;
  thoughtPreview.style.top=`${fragment.top-footer.top-12}px`;
  thoughtPreview.classList.add('visible');
}

for (const phrase of thought.querySelectorAll('.thought-accent')) {
  phrase.addEventListener('pointerenter',e=>{
    if(e.pointerType!=='mouse')return;
    hoveredPhrase=phrase;
    updateQuotePreview();
  });
  phrase.addEventListener('focus',()=>{
    if (!phrase.matches(':focus-visible')) return;
    hoveredPhrase=phrase;
    updateQuotePreview();
  });
  const leave=()=>{
    if (hoveredPhrase===phrase&&!phrase.matches(':hover,:focus-visible')) {
      hoveredPhrase=null;
      updateQuotePreview();
    }
  };
  phrase.addEventListener('pointerleave',leave);
  phrase.addEventListener('blur',leave);
}
addEventListener('scroll',updateQuotePreview,{passive:true});
addEventListener('resize',updateQuotePreview,{passive:true});

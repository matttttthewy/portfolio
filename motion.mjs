// Pure, reversible geometry. Every state depends only on scroll progress,
// viewport size and the gallery angle. No scene replacement or random values.
import {achievements} from './achievements.js';

export const END = 20;
export const OPENING_END = 8.12;
export const SCROLL_END = END + OPENING_END - 4;
export function storyProgress(position) {
  if (position <= OPENING_END) return 3 * position / OPENING_END;
  const step = position - OPENING_END + 3;
  if (step <= 11) return step;
  return step < 12 ? 11 + (step - 11) * 2 : step + 1;
}
export const clamp = (x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const mix = (a,b,t)=>a+(b-a)*t;
export const smooth = t=>{t=clamp(t);return t*t*(3-2*t)};
export const range = (p,a,b)=>smooth((p-a)/(b-a));
const tau=Math.PI*2;
const wrap = x=>((x+Math.PI)%tau+tau)%tau-Math.PI;
const pose=(x=0,y=0,z=0,rx=0,ry=0,rz=0,s=1,o=1)=>({x,y,z,rx,ry,rz,s,o,sx:1,sy:1});
function orbitAngle(index, count, rotation) {
  const turn = wrap(index * tau / count + rotation);
  const density = Math.max(1, count / 25);
  const edge = 2.34;
  const visibleTurn = edge / density;
  const distance = Math.abs(turn);
  // Cards move at the same angular spacing on the visible side regardless of collection size.
  // The hidden return arc closes the orbit without recycling a front-facing card.
  const extent = distance <= visibleTurn ? distance * density
    : mix(edge, Math.PI, (distance - visibleTurn) / (Math.PI - visibleTurn));
  return Math.sign(turn) * extent;
}
export function arcPose(i,n,w,h,angle=0,compact=w<700) {
  const a = orbitAngle(i,n,angle), m = Math.abs(a), mobile = w < 700;
  const q = (mobile ? .29 : .36) + Math.pow(m / 1.12, 2.5) * (mobile ? .62 : .78);
  const perspective = mobile ? 900 : 1100;
  const z = perspective * (1 - 1 / q);
  const x = Math.sign(a) * Math.tan(Math.min(m, 1.45)) * w * (mobile ? .46 : .24) / q;
  const y = (h * (compact ? -.177 : -.055) + m * m * h * .006) / q;
  const scale = compact ? Math.min(1, h / 680) : 1;
  const card = pose(x,y,z,0,-a*48,a*1.6,scale,1-range(m,1.28,1.63));
  card.sx = mix(mobile ? .76 : .81,1,range(m,.70,1.19));
  return card;
}

const gridOrder = [
  'mobility', 'stations', 'freshman', 'module',
  'universe', 'lv', 'tbank', 'youngpros',
  'yagodnoe', 'taya', 'megabattle', 'science',
  'dance', 'congress', 'kontur', 'initiation',
].map(id => achievements.findIndex(item => item.id === id));
const ringOrder = [
  'mobility', 'freshman', 'stations', 'youngpros', 'taya', 'marketing',
  'yagodnoe', 'dancecup', 'truuser', 'universe', 'dance', 'module',
].map(id => achievements.findIndex(item => item.id === id));
function gridPose(i, w, h) {
  const mobile = w < 700;
  const index = gridOrder.indexOf(i);
  if (index < 0) return pose(-w*.23,0,-1400,0,0,0,.15,0);
  const aspect = mobile ? 285/210 : 330/250;
  const cell = Math.min(w * (mobile ? .99 : .50) / 4, h * (mobile ? .71 : .80) / (4 * aspect));
  const rx = mobile ? 4 : 7, ry = mobile ? -3 : -7, rz = mobile ? -1 : -3;
  const [pitch, yaw, roll] = [rx, ry, rz].map(deg => deg * Math.PI / 180);
  const col = index % 4 - 1.5, row = Math.floor(index / 4) - 1.5;
  const localX = cell * col, localY = cell * row * aspect;
  // Apply the same rotation to the lattice and every card face.
  const x = localX * Math.cos(roll) - localY * Math.sin(roll);
  const y = localX * Math.sin(roll) + localY * Math.cos(roll);
  const depth = -x * Math.sin(yaw);
  return pose(
    x * Math.cos(yaw) - w * (mobile ? .0 : .215),
    y * Math.cos(pitch) - depth * Math.sin(pitch) + h * (mobile ? .142 : .015),
    y * Math.sin(pitch) + depth * Math.cos(pitch) - 100,
    rx,ry,rz,cell * .91 / (mobile ? 210 : 250),1
  );
}

const focusOrder = [
  'mobility', 'module', 'freshman', 'yagodnoe', 'initiation', 'science', 'kontur', 'dance',
].map(id => achievements.findIndex(item => item.id === id));
const overviewStop = 7.85;
const lastFocusStop = OPENING_END + focusOrder.length;
const presentationTolerance = .055;
const presentationStops = [
  0, overviewStop,
  ...focusOrder.map((_, index) => OPENING_END + 1 + index),
  SCROLL_END,
];

export function presentationDestination(scroll, direction, unit, maxScroll) {
  const tolerance = unit * presentationTolerance;
  const stops = presentationStops.map(stop => Math.min(stop * unit, maxScroll));
  if (maxScroll > stops.at(-1) + tolerance) stops.push(maxScroll);
  if (direction > 0) return stops.find(stop => stop > scroll + tolerance) ?? null;
  for (let index = stops.length - 1; index >= 0; index--) {
    if (stops[index] < scroll - tolerance) return stops[index];
  }
  return null;
}

export function presentationDuration(from, to) {
  const start = Math.min(from, to), end = Math.max(from, to);
  if (end<=overviewStop+presentationTolerance) return (end-start)*920;
  if (start>=lastFocusStop-presentationTolerance && end<=SCROLL_END+presentationTolerance)
    return (end-start)*1180;
  return 0;
}

const focusSlots = [
  {x:.202, y:.006, z:127, rx:0, ry:-4, rz:-1, size:1.15, height:.65, phoneX:.008, phoneY:.163, phoneHeight:.43, phoneWidth:.56},
  {x:.244, y:.025, z:186, rx:5, ry:13, rz:6, size:1.18, height:.70, phoneX:.055, phoneY:.164, phoneHeight:.44, phoneWidth:.61},
  {x:.192, y:.037, z:94, rx:-3, ry:-12, rz:-3, size:1.04, height:.57, phoneX:-.040, phoneY:.178, phoneHeight:.37, phoneWidth:.53},
];
const focusHandoffs = [
  {start:.30, arrival:.94, leave:.17, gone:.64, copyOut:.38, switchAt:.76},
  {start:.38, arrival:.90, leave:.445, gone:.78, copyOut:.43, switchAt:.72},
  {start:.29, arrival:.86, leave:.52, gone:.87, copyOut:.44, switchAt:.68},
];
const defaultHandoff = {start:.38, arrival:.91, leave:.38, gone:.76, copyOut:.47, switchAt:.69};
const handoffAt = step => focusHandoffs[step-3] ?? defaultHandoff;
const lensFor = w => w < 700 ? 900 : 1100;
function focusPose(k, i, n, w, h) {
  const mobile = w < 700;
  const front = k - 4, rel = (i - focusOrder[front] + n) % n;
  const x = w * (mobile ? .018 : .215), y = h * (mobile ? .176 : .016);
  if (!rel) {
    const frame = focusSlots[front] ?? focusSlots[0];
    const lens = lensFor(w), projection = lens / (lens-frame.z);
    const size = mobile
      ? Math.min(1.22, h * frame.phoneHeight * 1.17 / (285 * projection), w * frame.phoneWidth * 1.19 / (210 * projection))
      : Math.min(frame.size, h * frame.height / (330 * projection), w * .34 / (250 * projection));
    return pose(w*(mobile ? frame.phoneX : frame.x), h*(mobile ? frame.phoneY : frame.y), frame.z,
      frame.rx, frame.ry, frame.rz, size, 1);
  }
  const slot = rel === n - 1 ? 12 : rel - 1;
  if (slot > 12) {
    const azimuth=i*2.399963;
    return pose(x+Math.cos(azimuth)*w*.53,y+Math.sin(azimuth)*h*.34,-1590,0,-15,0,.12,0);
  }
  const f = slot / 12;
  const size = Math.min(mobile ? .49 : .61,h/(mobile?980:840));
  if (front % 3 === 0) {
    const a = (f - .5) * 2.95;
    return pose(x+Math.sin(a)*w*(mobile?.48:.40),y+h*(.31-Math.cos(a)*.18),-510-Math.cos(a)*265,
      7,-a*28,a*16,size,1);
  }
  if (front % 3 === 1) {
    const a = f * tau * 12/13 - .32;
    const radius = Math.min(w * (mobile?.45:.32), h * .42);
    return pose(x+Math.cos(a)*radius,y+Math.sin(a)*h*.255+h*.16,-620+Math.cos(a)*225,
      Math.cos(a)*13,Math.sin(a)*34,Math.cos(a)*18,size,1);
  }
  const order = slot - 6;
  return pose(x+order*w*(mobile?.062:.037),y+h*.04+Math.abs(order)*h*.028,-470-Math.abs(order)*61,
    10,-14+order*4,order*7.4,size,1);
}

function key(k,i,n,w,h,angle,compactGallery){
  const mobile=w<700;
  const r=i*2.3999632297, ring=1+Math.floor(i/8);
  const cw=mobile?210:250;
  if(k===0){
    // Opening: a quiet central cluster, punctuated by two floating cards.
    const positions=[[-.13,.04,-15,0],[.12,.08,14,-60],[-.31,.23,-19,-260],[.33,.20,21,-220],[.00,.22,4,-180],[-.02,-.02,-7,-400],[.26,-.02,12,-650],[-.25,-.05,-13,-680],[.04,.10,8,-500]];
    if(i<9){const [x,y,rz,z]=positions[i];return pose(x*w,(y+(mobile?.20:.055))*h,z,5,-rz*.4,rz,mobile?Math.min(.58,h/1120):.72,1)}
    return pose(Math.cos(r)*w*.6,Math.sin(r)*h*.5,-1000,10,20,i*7,.55,0);
  }
  if(k===1) {
    const deep = i % 6;
    return pose(Math.cos(r)*w*(.10+ring*.092),Math.sin(r)*h*(.13+ring*.092),
      265-deep*175,(i%5-2)*19,Math.sin(r)*45,Math.sin(r)*45,mobile?.54:.76,i<18?1:.74);
  }
  if(k===2) {
    const d = i - 9;
    if(i>=19)return pose(w*.07+Math.cos(r)*w*.21,Math.sin(r)*h*.18,-1060,0,40,d*7,.25,0);
    const a = d * .137;
    return pose(w*.06+Math.sin(a)*w*(mobile?.48:.37),h*(.22-Math.cos(a)*.23),
      -35-Math.abs(d)*23,12+d*.9,-d*5.1,d*6.6,mobile?.59:.82,1);
  }
  if(k===3) return gridPose(i,w,h);
  if(k>=4&&k<=11) return focusPose(k,i,n,w,h);
  if(k===13){const d=i-n/2;return pose(w*(mobile?.02:.20)+d*2,-d*2.3,-i*8,9,-18,-9+i*.55,mobile?.84:1.05,1)}
  if(k===14){const col=i%5-2,row=Math.floor(i/5)-2;return pose(col*cw*.92,row*270,-280+row*120,44,-22,-25,mobile?.72:1.04,1)}
  if(k===15){const col=i%5-2,row=Math.floor(i/5)-2;return pose(col*270-w*.12,row*350+h*.1,-230,6,-5,-8,mobile?.97:1.15,1)}
  if(k>=16&&k<=18){
    const col=i%5-2, row=Math.floor(i/5)-2;
    const span=Math.max(w*(mobile?.44:.151),h*.231);
    const lift=k===17?1.05:1;
    return pose(w*(mobile?.03:.145)+col*span*lift,
      h*(mobile?.24:0)+row*h*.43+Math.abs(col)*h*(k===18?.095:.04),
      35-Math.abs(col)*105+(k===17?44:0),7+row*3,-col*12,col*-3,
      Math.min(mobile?.92:1.17,h/(mobile?760:720))*lift,1);
  }
  if(k===19){
    const a = orbitAngle(i,n,angle), silhouette = Math.abs(a);
    const x = Math.sin(a)*w*(mobile?.55:.49);
    const y = (-Math.cos(a)*.14+.07)*h;
    return pose(x,y,-270+320*(1-Math.cos(a)), -9,-a*43,a*7,
      mobile?.64:.82,1-range(silhouette,1.47,2.3));
  }
  return arcPose(i,n,w,h,angle,compactGallery);
}
export function focusState(p) {
  const step = Math.floor(p);
  const cut = handoffAt(step).switchAt;
  const index = clamp(step - 4 + (p-step>=cut ? 1 : 0), 0, focusOrder.length - 1);
  const center = index + 4;
  const entering = handoffAt(center-1);
  const leaving = handoffAt(center);
  const enter = range(p,center-1+entering.switchAt,center-1+entering.arrival);
  const exit = 1-range(p,center+leaving.copyOut,center+(index === focusOrder.length-1 ? .94 : leaving.switchAt));
  return {index:focusOrder[index], strength:enter*exit};
}

export function cardPose(p,i,n,w,h,angle=0,compactGallery=w<700){
  p=clamp(p,0,END);
  const lo=p>=11&&p<13 ? 11 : Math.floor(p);
  const hi=lo===11 ? 13 : Math.min(END,lo+1);
  const fraction=(p-lo)/(hi-lo||1);
  const outgoing = focusOrder[lo-4], incoming = focusOrder[hi-4];
  let t=smooth(fraction);
  if (lo===2) t=range(fraction,0,.78);
  if (lo===3) {
    const cell = gridOrder.indexOf(i);
    const lag = cell<0 ? (i%5)*.025 : (cell%4)*.022+Math.floor(cell/4)*.018;
    t=range(fraction,.24+lag,.73+lag);
  }
  const handoff=handoffAt(lo);
  if (i===outgoing) t=range(fraction,handoff.leave,handoff.gone);
  if (i===incoming) t=range(fraction,handoff.start,handoff.arrival);
  const a=key(lo,i,n,w,h,angle,compactGallery),b=key(hi,i,n,w,h,angle,compactGallery),out=blendPose(a,b,t);
  const swing=t>0&&t<1 ? Math.sin(Math.PI*t)**2 : 0;
  const mobile=w<700;
  if (i===incoming&&hi===4) {
    out.z-=swing*270;
    out.x+=swing*w*(mobile?.085:.105);
    out.y-=swing*h*.085;
    out.s*=1-.17*swing;
  } else if (i===incoming&&hi===5) {
    out.x+=swing*w*(mobile?.23:.22);
    out.y+=swing*h*.079;
    out.ry+=swing*44;
    out.rz+=swing*14 + 2.5*Math.sin(t*5*Math.PI)*swing*t;
  } else if (i===incoming&&hi===6) {
    out.x-=swing*w*(mobile?.22:.20);
    out.y+=swing*h*.08;
    out.z+=swing*93;
    out.ry-=swing*18;
  } else if (i===outgoing&&lo<=6) {
    out.x+=swing*w*[.145,-.245,.205][lo-4];
    out.y+=swing*h*[.10,.02,.22][lo-4];
    out.z-=swing*[105,172,110][lo-4];
  } else if (lo===3) {
    out.y+=swing*h*((i%3)-1)*.13;
    out.z-=swing*(160+(i%4)*74);
    out.ry+=swing*((i%5)-2)*14;
  }
  if (mobile&&p>3&&p<12.1) {
    // Leave a dedicated header above the cards on tall as well as short phones.
    const clearance=range(p,3.22,3.78)*(1-range(p,11.65,12.1));
    const radius=285*out.s*.55;
    const lift=Math.max(0,h-550)*.205*clearance;
    out.y=Math.max(out.y-lift,mix(-h*.52,radius-h*.085,clearance));
  }
  return out;
}

const scatterField = [
  [-.32,.09,90], [.30,.17,90], [-.19,-.22,28], [.34,-.19,-94],
  [-.33,.31,-157], [.06,-.28,-160], [.19,.32,-232], [-.07,.20,210],
  [-.45,-.14,-350], [.43,.01,-383], [-.13,.39,-405], [.14,-.13,-140],
  [.07,.05,-522], [.01,-.07,-670], [-.31,-.34,-840], [.40,.32,-760],
];
const radians = degrees => degrees * Math.PI / 180;

function blendPose(a,b,t) {
  if (t===0) return a;
  if (t===1) return b;
  return {
    x:mix(a.x,b.x,t), y:mix(a.y,b.y,t), z:mix(a.z,b.z,t),
    rx:mix(a.rx,b.rx,t), ry:mix(a.ry,b.ry,t), rz:mix(a.rz,b.rz,t),
    s:mix(a.s,b.s,t), o:mix(a.o,b.o,t), sx:mix(a.sx,b.sx,t), sy:mix(a.sy,b.sy,t),
  };
}

function scattered(i,w,h) {
  const mobile = w<700;
  const orbit = i*2.3999632297;
  const field = scatterField[i];
  if (field) {
    const [x,y,z] = field;
    return pose(x*w*(mobile?.93:1),y*h+(mobile?.075:.018)*h,z+(i%3-1)*52,
      Math.cos(orbit)*37,Math.sin(orbit)*49,Math.cos(orbit+.54)*37,
      (i<8 ? .67 : .43)*(mobile?Math.min(.70,h/810):1),1);
  }
  const distance = .32 + (i%3)*.068;
  return pose(Math.cos(orbit)*w*distance,Math.sin(orbit)*h*distance,-760-(i%5)*130,
    Math.cos(orbit)*32,Math.sin(orbit)*55,Math.cos(orbit)*45,mobile?.31:.42,1);
}

function openingRing(i,w,h,tilt=0,turn=0,shift=0) {
  const mobile = w<700;
  const slot = ringOrder.indexOf(i);
  if (slot<0) {
    const azimuth=i*2.399963;
    return pose(w*(mix(.12,-.16,shift)+Math.cos(azimuth)*.43),
      h*(.13+Math.sin(azimuth)*.25),-1620,10,Math.cos(azimuth)*35,0,.10,0);
  }
  const theta = (slot + .18) * tau / ringOrder.length;
  const tiltAngle = radians(mix(64,31,tilt));
  const bearing = radians(mix(-24,-15,tilt));
  const span = Math.min(w*(mobile?.365:.23),h*(mobile?.31:.355));
  const depth = Math.min(w*(mobile?.67:.27),h*(mobile?.57:.48));
  const track = theta + radians(13)*tilt;
  const tangent = Math.sin(track)*span;
  const radial = Math.cos(track)*depth;
  const baseX = tangent*Math.cos(bearing) + radial*Math.sin(tiltAngle)*Math.sin(bearing);
  const y = -radial*Math.cos(tiltAngle) * (mobile?.53:.73) + h*(mobile?.123:.065);
  const z = radial*Math.sin(tiltAngle)*Math.cos(bearing) - tangent*Math.sin(bearing) - mix(84,182,tilt);
  const size = Math.min(mobile?.48:.64,h*(mobile?.00081:.00105),span/(mobile?210:250)*.69);
  // The center follows the ring while each face has its own resting pose.
  const facing = [0,37,61,72,48,22,4,-29,-52,-69,-67,-34][slot];
  const facePitch = mix(-9,-44,turn) + Math.cos(theta)*8;
  const faceYaw = mix(facing-7,facing*.38-12,turn);
  const faceRoll = mix(-facing*.12,facing*.28,turn);
  const lateral = w * mix(mobile?.016:.09,mobile?-.105:-.235,shift);
  return pose(baseX + lateral,y,z,facePitch,faceYaw,faceRoll,size*mix(1,.84,turn),1);
}

export function openingPose(position,i,n,w,h) {
  const offset = ((i*7)%11)/11;
  const scatter = scattered(i,w,h);
  if (position < 1.92) {
    const flight = range(position,.04+.69*offset,1.21+.36*offset);
    const airborne = blendPose(key(0,i,n,w,h,0),scatter,flight);
    const swing = Math.sin(Math.PI*flight);
    airborne.x += Math.cos(i*1.71)*w*.093*swing;
    airborne.y += Math.sin(i*1.33)*h*.079*swing;
    airborne.z += Math.cos(i*2.3)*286*swing;
    airborne.rz += Math.sin(i*1.81)*30*swing;
    return airborne;
  }
  if (position < 3.52) {
    const assemble = range(position,1.92+.19*offset,2.97+.14*offset);
    const form = blendPose(scatter,openingRing(i,w,h),assemble);
    form.z -= 125*Math.sin(Math.PI*assemble)*(1+offset);
    return form;
  }
  if (position < 5.13) {
    const tilt = range(position,3.52,4.51);
    const turn = range(position,3.88+.21*offset,4.66+.14*offset);
    const form = openingRing(i,w,h,tilt,turn);
    const flutter = turn*(1-turn)*4*Math.sin(turn*9+i*.81);
    form.rz += flutter*5;
    form.ry += flutter*3;
    return form;
  }
  if (position < 6.49) {
    const slide = range(position,5.13,6.13);
    return openingRing(i,w,h,1,1,slide);
  }
  const cell = gridOrder.indexOf(i);
  const lag = cell<0 ? .18*offset : .032*(cell%4)+.038*Math.floor(cell/4);
  const unfold = range(position,6.49+lag,7.34+lag);
  const form = blendPose(openingRing(i,w,h,1,1,1),gridPose(i,w,h),unfold);
  const lift = unfold*(1-unfold)*4;
  form.z += lift*(cell<0 ? -175 : 95);
  form.y += lift*h*((i%3)-1)*.087;
  form.ry += lift*((i%5)-2)*8;
  return form;
}

export function openingDrift(position, index, secondsSinceScroll, phase) {
  const air = range(position,.18,.7)*(1-range(position,2.08,2.55));
  const paper = range(position,3.59,4.04)*(1-range(position,4.70,5.08));
  return (air + paper*.8) * (1-range(secondsSinceScroll,.12,1.23))
    * Math.sin(phase*6.1+index*1.4);
}

export function pickCard(poses,pointer,w,h) {
  const mobile = w<700, lens=mobile?900:1100;
  const width=mobile?210:250, height=mobile?285:330;
  const originX=w*.5, originY=h*.47;
  let nearest=null;
  for (const [index, v] of poses.entries()) {
    if (v.o < .19) continue;
    const rx=radians(v.rx),ry=radians(v.ry),rz=radians(v.rz);
    const cx=Math.cos(rx),sx=Math.sin(rx);
    const cy=Math.cos(ry),sy=Math.sin(ry);
    const cz=Math.cos(rz),sz=Math.sin(rz);
    // Project a ray from the scene camera into the card's local plane.
    const inv=(x,y,z)=>{
      const X=x*cy-(z*cx-y*sx)*sy;
      const Y=y*cx+z*sx;
      return [X*cz+Y*sz,Y*cz-X*sz,x*sy+(z*cx-y*sx)*cy];
    };
    const [ox,oy,oz]=inv(-v.x,originY-h*.5-v.y,lens-v.z);
    const [dx,dy,dz]=inv(pointer.x-originX,pointer.y-originY,-lens);
    if (dz>=-.01) continue;
    const t=-oz/dz;
    if (t<=0 || nearest && t>=nearest.depth) continue;
    const x=.5+(ox+t*dx)/(v.s*v.sx*width),y=.5+(oy+t*dy)/(v.s*v.sy*height);
    if (x>=0 && x<=1 && y>=0 && y<=1) nearest={index,x,y,depth:t};
  }
  return nearest;
}

export function transform(v){return `translate3d(${v.x.toFixed(3)}px,${v.y.toFixed(3)}px,${v.z.toFixed(3)}px) rotateX(${v.rx.toFixed(3)}deg) rotateY(${v.ry.toFixed(3)}deg) rotateZ(${v.rz.toFixed(3)}deg) scale(${(v.s*v.sx).toFixed(5)},${(v.s*v.sy).toFixed(5)})`}

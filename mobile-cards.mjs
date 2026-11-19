import {getCardTexture} from './cards.mjs';
import {range} from './motion.mjs';

const phoneRadians = degrees => degrees * Math.PI / 180;

function projection(placement, width, height, cardWidth, cardHeight, bend = 0, turn = 0) {
  const pitch = phoneRadians(placement.rx);
  const yaw = phoneRadians(placement.ry);
  const roll = phoneRadians(placement.rz);
  const cosX = Math.cos(pitch), sinX = Math.sin(pitch);
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosZ = Math.cos(roll), sinZ = Math.sin(roll);
  const lens = width < 700 ? 900 : 1100;
  const centerX = width * .5, centerY = height * .47;
  const scaleX = cardWidth * placement.s * placement.sx;
  const scaleY = cardHeight * placement.s * placement.sy;

  return (u,v) => {
    const curve = 1.65 * bend;
    const localX = (bend ? Math.sin(u * curve) / curve : u) * scaleX;
    const localZ = bend ? (1 - Math.cos(u * curve)) * scaleX * (.83 + turn * u * .48) : 0;
    const localY = v * scaleY * (1 + bend * (.10 - .33 * u * u + turn * .09 * u));
    const rolledX = localX * cosZ - localY * sinZ;
    const rolledY = localX * sinZ + localY * cosZ;
    const yawZ = localZ * cosY - rolledX * sinY;
    const x = placement.x + rolledX * cosY + localZ * sinY;
    const y = height * .03 + placement.y + rolledY * cosX - yawZ * sinX;
    const z = placement.z + rolledY * sinX + yawZ * cosX;
    const weight = Math.max((lens-z)/lens,.19);
    return {x:centerX+x/weight,y:centerY+y/weight,weight};
  };
}

export function projectPhoneCard(placement,width,height,cardWidth,cardHeight) {
  const at = projection(placement,width,height,cardWidth,cardHeight);
  return [at(-.5,-.5),at(.5,-.5),at(.5,.5),at(-.5,.5)];
}

function outline(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x,point.y);
  ctx.closePath();
}

function drawPhoneStrip(ctx, texture, left, right, topLeft, topRight, bottomRight, bottomLeft) {
  const {width,height} = texture;
  const sx = width * left;
  const sw = width * (right - left);
  const topX = topRight.x - topLeft.x, topY = topRight.y - topLeft.y;
  const sideX = bottomLeft.x - topLeft.x, sideY = bottomLeft.y - topLeft.y;
  const discrepancy = Math.abs(topRight.x + bottomLeft.x - topLeft.x - bottomRight.x)
    + Math.abs(topRight.y + bottomLeft.y - topLeft.y - bottomRight.y);

  if (discrepancy < 1.15) {
    ctx.save();
    ctx.transform(topX,topY,sideX,sideY,topLeft.x,topLeft.y);
    ctx.drawImage(texture,sx,0,sw,height,0,0,1,1);
    ctx.restore();
    return;
  }

  // Map each triangle independently to approximate perspective over the strip.
  ctx.save();
  const seam=.006;
  outline(ctx,[topLeft,topRight,
    {x:topRight.x+(bottomRight.x-topRight.x)*seam,y:topRight.y+(bottomRight.y-topRight.y)*seam},
    {x:bottomLeft.x+(bottomRight.x-bottomLeft.x)*seam,y:bottomLeft.y+(bottomRight.y-bottomLeft.y)*seam},
    bottomLeft]);
  ctx.clip();
  ctx.transform(topX,topY,sideX,sideY,topLeft.x,topLeft.y);
  ctx.drawImage(texture,sx,0,sw,height,0,0,1,1);
  ctx.restore();

  ctx.save();
  outline(ctx,[topRight,bottomRight,bottomLeft]);
  ctx.clip();
  ctx.transform(bottomRight.x-bottomLeft.x,bottomRight.y-bottomLeft.y,
    bottomRight.x-topRight.x,bottomRight.y-topRight.y,
    topRight.x+bottomLeft.x-bottomRight.x,topRight.y+bottomLeft.y-bottomRight.y);
  ctx.drawImage(texture,sx,0,sw,height,0,0,1,1);
  ctx.restore();
}

function phoneFrame(width,desktop) {
  return width < 700 ? {edge:.03,upper:.12,lower:.50,radius:18}
    : {edge:.014,upper:.11,lower:desktop?.21:.50,radius:27};
}

function phoneClip(ctx,width,height,arrival,desktop) {
  const {edge,upper,lower,radius}=phoneFrame(width,desktop);
  const x=width*edge*arrival, y=height*upper*arrival;
  const w=width-2*x, h=height*(1-(upper+lower)*arrival);
  const r=Math.min(radius*arrival,w*.5,h*.5);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  ctx.clip();
}

const phoneVertex = `
attribute vec3 point;
attribute vec2 uv;
uniform float depthBoost;
varying vec2 surface;
void main() {
  surface=uv;
  float distance=max(.19,point.z-depthBoost);
  gl_Position=vec4(point.xy,(1.0-.27/distance)*point.z,point.z);
}
`;

const phoneFragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D cover;
uniform vec4 frame;
uniform vec2 frameScale;
uniform float radius;
uniform float opacity;
uniform float shade;
uniform vec3 light;
varying vec2 surface;
void main() {
  vec4 color=texture2D(cover,surface);
  color.rgb=mix(color.rgb,vec3(.043,.024,.047)*color.a,shade);
  if (light.z>.001) {
    vec2 offset=(surface-light.xy)*vec2(1.0,1.25);
    color.rgb=mix(color.rgb,vec3(1.0,.90,.77)*color.a,exp(-dot(offset,offset)*12.0)*light.z*.19);
  }
  float clip=1.0;
  if (radius>.4) {
    vec2 p=gl_FragCoord.xy;
    vec2 inset=frameScale*radius;
    vec2 corner=max(frame.xy+inset-p,p-frame.zw+inset)/frameScale;
    float distance=length(max(corner,0.0))-radius;
    float edge=.6/frameScale.x;
    clip=1.0-smoothstep(-edge,edge,distance);
  }
  vec4 pixel=color*opacity*clip;
  if (pixel.a<.015) discard;
  gl_FragColor=pixel;
}
`;

function phoneGraphics(canvas) {
  const settings={alpha:true,antialias:false,depth:true,stencil:false,premultipliedAlpha:true};
  const webgl2=canvas.getContext('webgl2',settings);
  const gl=webgl2||canvas.getContext('webgl',settings);
  if (!gl) return null;
  const program=gl.createProgram();
  const shaders=[[gl.VERTEX_SHADER,phoneVertex],[gl.FRAGMENT_SHADER,phoneFragment]].map(([kind,code])=>{
    const shader=gl.createShader(kind);
    gl.shaderSource(shader,code);
    gl.compileShader(shader);
    gl.attachShader(program,shader);
    return shader;
  });
  gl.linkProgram(program);
  shaders.forEach(shader=>gl.deleteShader(shader));
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) return null;
  const uniforms=Object.fromEntries(['frame','frameScale','radius','opacity','shade','light','depthBoost'].map(key=>[key,gl.getUniformLocation(program,key)]));
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  const software=info&&/swiftshader|llvmpipe|software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  const anisotropy=webgl2&&!software&&gl.getExtension('EXT_texture_filter_anisotropic');
  const samples=anisotropy?Math.min(2,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)):1;
  const buffer=gl.createBuffer();
  const batches=[];
  const textures=new WeakMap();
  let vertices=new Float32Array(0);
  let width,height,used;
  let opacityValue,shadeValue,boostValue,highlightOn=false;

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.activeTexture(gl.TEXTURE0);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  const position=gl.getAttribLocation(program,'point'),uv=gl.getAttribLocation(program,'uv');
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(uv);
  gl.vertexAttribPointer(position,3,gl.FLOAT,false,20,0);
  gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0,0,0,0);

  function begin(viewWidth,viewHeight,arrival,desktop,count) {
    width=viewWidth;
    height=viewHeight;
    if (vertices.length<count*5*6*8) vertices=new Float32Array(count*5*6*8);
    used=0;
    batches.length=0;
    const w=canvas.width,h=canvas.height;
    gl.viewport(0,0,w,h);
    gl.disable(gl.SCISSOR_TEST);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const {edge,upper,lower,radius}=phoneFrame(width,desktop);
    const left=Math.round(w*edge*arrival);
    const bottom=Math.round(h*lower*arrival);
    const top=h-Math.round(h*upper*arrival);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(left,bottom,w-2*left,top-bottom);
    gl.uniform4f(uniforms.frame,left,bottom,w-left,top);
    gl.uniform2f(uniforms.frameScale,w/width,h/height);
    gl.uniform1f(uniforms.radius,radius*arrival);
  }

  function point(p,u,v) {
    vertices[used++]=(p.x*2/width-1)*p.weight;
    vertices[used++]=(1-p.y*2/height)*p.weight;
    vertices[used++]=p.weight;
    vertices[used++]=u;
    vertices[used++]=v;
  }

  function strip(left,right,a,b,c,d) {
    point(a,left,0); point(b,right,0); point(d,left,1);
    point(b,right,0); point(c,right,1); point(d,left,1);
  }

  function bindTexture(texture) {
    let entry=textures.get(texture);
    if (!entry) {
      entry={id:gl.createTexture(),revision:null};
      textures.set(texture,entry);
      gl.bindTexture(gl.TEXTURE_2D,entry.id);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,webgl2?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      if (anisotropy) gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,samples);
    } else gl.bindTexture(gl.TEXTURE_2D,entry.id);
    if (entry.revision!==texture.dataset.revision) {
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);
      if (webgl2) gl.generateMipmap(gl.TEXTURE_2D);
      entry.revision=texture.dataset.revision;
    }
  }

  function draw(texture,points,at,strips,alpha,shade,light,depthBoost) {
    const first=used/5;
    if (at) {
      let a=at(-.5,-.5),d=at(-.5,.5);
      for (let i=1;i<=strips;i++) {
        const right=i/strips;
        const b=at(right-.5,-.5),c=at(right-.5,.5);
        strip((i-1)/strips,right,a,b,c,d);
        a=b;
        d=c;
      }
    } else strip(0,1,...points);
    batches.push({texture,first,count:used/5-first,alpha,shade,light,depthBoost});
  }

  function paint({texture,first,count,alpha,shade,light,depthBoost}) {
    bindTexture(texture);
    if (opacityValue!==alpha) {
      gl.uniform1f(uniforms.opacity,alpha);
      opacityValue=alpha;
    }
    if (shadeValue!==shade) {
      gl.uniform1f(uniforms.shade,shade);
      shadeValue=shade;
    }
    if (boostValue!==depthBoost) {
      gl.uniform1f(uniforms.depthBoost,depthBoost);
      boostValue=depthBoost;
    }
    const hasHighlight=light?.strength>.001;
    if (hasHighlight||highlightOn) {
      gl.uniform3f(uniforms.light,light?.x??0,light?.y??0,hasHighlight?light.strength:0);
      highlightOn=hasHighlight;
    }
    gl.drawArrays(gl.TRIANGLES,first,count);
  }

  function end() {
    if (!used) return;
    gl.bufferData(gl.ARRAY_BUFFER,vertices.subarray(0,used),gl.STREAM_DRAW);
    // Resolve opaque surfaces per pixel, then blend fading cards over the saved depth.
    for (const batch of batches) if (batch.alpha>=.998) paint(batch);
    gl.depthMask(false);
    for (const batch of batches) if (batch.alpha<.998) paint(batch);
  }
  return {begin,draw,end,bindTexture,software};
}

export function createPhoneRenderer(canvas, fallback, redraw) {
  let gpu=phoneGraphics(canvas);
  let ctx=null;
  if (!gpu && !(ctx=fallback.getContext('2d'))) return null;
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    gpu=null;
    redraw();
  });
  canvas.addEventListener('webglcontextrestored',()=>{
    gpu=phoneGraphics(canvas);
    redraw();
  });
  let width=0,height=0,bufferHeight=0,density=1,compact=false;

  function resize(w,h,pixelRatio,phone) {
    // Mobile browser chrome can resize the viewport several times per scroll gesture.
    if (w!==width||pixelRatio!==density||phone!==compact||!phone||Math.abs(h-bufferHeight)>bufferHeight*.24) {
      bufferHeight=h;
    }
    width=w;
    height=h;
    density=pixelRatio||1;
    compact=phone;
  }

  function prepare(node) {
    const texture=getCardTexture(node,2.30,true);
    if (!texture) return false;
    gpu?.bindTexture(texture);
    return true;
  }

  function draw(nodes,poses,progress,arrival,deformation,focusIndex,focusStrength,lights) {
    const desktop=!!lights;
    const cardWidth = width < 700 ? 210 : 250;
    const cardHeight = width < 700 ? 285 : 330;
    const accelerated=gpu&&!gpu.software;
    const pixelBudget=accelerated?(compact?1950000:2050000):1750000;
    const maxScale=accelerated?2.45:gpu?2.20:1.9;
    const paintScale=Math.max(1,Math.min(density,maxScale,Math.sqrt(pixelBudget/(width*bufferHeight))));
    const layer=gpu?canvas:fallback;
    canvas.hidden=!gpu;
    fallback.hidden=!!gpu;
    if (!gpu && !ctx) ctx=fallback.getContext('2d');
    const backingWidth=Math.round(width*paintScale),backingHeight=Math.round(bufferHeight*paintScale);
    if (layer.width!==backingWidth || layer.height!==backingHeight) {
      layer.width=backingWidth;
      layer.height=backingHeight;
    }
    const visible = [];
    for (let i=0;i<poses.length;i++) {
      const placement=poses[i];
      if (placement.o < .006) continue;
      const points=projectPhoneCard(placement,width,height,cardWidth,cardHeight);
      const [a,b,,d]=points;
      const signedArea=(b.x-a.x)*(d.y-a.y)-(b.y-a.y)*(d.x-a.x);
      const reverse=progress<3&&signedArea<0;
      const area=reverse?-signedArea:signedArea;
      const margin=deformation ? 22 : 2;
      if (area<=2 || points.every(point=>point.x < -margin) || points.every(point=>point.x > width+margin) ||
          points.every(point=>point.y < -margin) || points.every(point=>point.y > height+margin)) continue;
      // The reverse of a turning card shows its cover instead of a blank plane.
      visible.push({i,placement,points:reverse?[points[1],points[0],points[3],points[2]]:points,area,reverse});
    }
    // Let the foreground priority leave and arrive with the caption.
    const emphasis=95*range(focusStrength,0,.65);
    const depth=card=>card.placement.z+(card.i===focusIndex?emphasis:0);
    visible.sort((left,right)=>depth(left)-depth(right)||left.i-right.i);

    if (gpu) gpu.begin(width,height,arrival,desktop,visible.length);
    else {
      if (!ctx) return;
      ctx.setTransform(backingWidth/width,0,0,backingHeight/height,0,0);
      ctx.imageSmoothingQuality='medium';
      ctx.clearRect(0,0,width,height);
      ctx.save();
      if (arrival>.002) phoneClip(ctx,width,height,arrival,desktop);
    }
    const depthFade=range(progress,3.18,3.66)*(1-range(progress,12.58,13));
    for (const {i,placement,points,area,reverse} of visible) {
      const texture = getCardTexture(nodes[i],2.30);
      if (!texture) continue;
      const curve = reverse ? 0 : deformation * (gpu?Math.min(1,area/3800):range(area,1000,4600));
      const colorDepth = depthFade*.46*Math.max(0,Math.min(1,(-placement.z-65)/620));
      const alpha=progress<13 ? (desktop ? range(placement.o,.015,.40) : 1) : placement.o;
      const at=curve>.003
        ? projection(placement,width,height,cardWidth,cardHeight,curve,Math.sin((i%5-2)*.42+progress*.21))
        : null;
      const strips=gpu?8:4;
      if (gpu) {
        const depthBoost=i===focusIndex?emphasis/(width<700?900:1100):0;
        gpu.draw(texture,points,at,strips,alpha,colorDepth,lights?.[i],depthBoost);
        continue;
      }

      ctx.globalAlpha=alpha;
      if (at) {
        const overlap=.50/Math.max(80,Math.sqrt(area));
        for (let strip=0;strip<strips;strip++) {
          const left=Math.max(0,strip/strips-overlap);
          const right=Math.min(1,(strip+1)/strips+overlap);
          drawPhoneStrip(ctx,texture,left,right,at(left-.5,-.5),at(right-.5,-.5),
            at(right-.5,.5),at(left-.5,.5));
        }
      } else {
        drawPhoneStrip(ctx,texture,0,1,...points);
      }

      if (colorDepth>.01) {
        outline(ctx,points);
        ctx.fillStyle=`rgba(11,6,12,${colorDepth})`;
        ctx.fill();
      }
    }
    if (gpu) gpu.end();
    else ctx.restore();
  }

  return {resize,draw,prepare};
}

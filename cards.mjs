const coverAliases = {
  mobility: 'exchange.webp',
  youngpros: 'conferences.webp',
  dance: 'dance.jpg',
  initiation: 'initiation.jpg',
};
const captionTint = {module: '36,19,60', dance: '18,32,51', kontur: '27,42,71'};

export function coverURL(id) {
  const coverName = coverAliases[id] ?? `${id}.webp`;
  return `assets/covers/${coverName}`;
}

const cardModels = new WeakMap();
const textMeasure = document.createElement('canvas').getContext('2d');
const shadeStart = .57;
const shadeMiddle = .57;
const shadeEnd = .95;
const lineSpacing = 1.11;

export function createCard(item) {
  const node = document.createElement('article');
  node.className = 'card';
  node.hidden = true;
  node.dataset.id = item.id;
  node.style.setProperty('--cover-color', item.color);
  node.style.setProperty('--cover-ink', item.ink);
  if (captionTint[item.id]) node.style.setProperty('--caption-tint', captionTint[item.id]);

  const face = document.createElement('div');
  face.className = 'card-face';
  const image = new Image();
  const model = {item, image, imageReady:false, dirty:true};
  image.className = 'card-photo';
  image.alt = '';
  image.decoding = 'async';
  image.addEventListener('load', () => {
    model.imageReady = true;
    model.dirty = true;
    face.classList.add('has-cover');
  }, {once:true});
  image.src = coverURL(item.id);
  face.append(image);

  const title = document.createElement('h3');
  item.title.split('\n').forEach((line, index) => {
    if (index) title.append(document.createElement('br'));
    title.append(document.createTextNode(line));
  });
  const glow = document.createElement('div');
  glow.className = 'card-light';
  glow.setAttribute('aria-hidden', 'true');
  face.append(glow, title);
  node.append(face);
  Object.assign(model, {title, face});
  cardModels.set(node, model);
  return node;
}

export function fitCardTitles(nodes, width, height, mobile) {
  const base = mobile ? 25 : 28;
  const inset = mobile ? 16 : 19;
  textMeasure.font = `740 ${base}px Manrope`;
  for (const node of nodes) {
    const model = cardModels.get(node);
    const lines = model.item.title.split('\n');
    const widest = Math.max(...lines.map(line => textMeasure.measureText(line).width));
    const font = Math.min(lines.length > 2 ? base-2 : base, base * (width - 2*inset - 1) / Math.max(1,widest));
    model.title.style.fontSize = `${font}px`;
    model.dimensions = {width, height, lines, font, inset};
    model.dirty = true;
  }
}

function buildTexture(model, density) {
  const {width, height, lines, font, inset} = model.dimensions;
  const texture = model.texture ?? document.createElement('canvas');
  texture.width = Math.round(width * density);
  texture.height = Math.round(height * density);
  const ctx = texture.getContext('2d');
  ctx.setTransform(texture.width/width,0,0,texture.height/height,0,0);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, width, height, 4);
  else ctx.rect(0, 0, width, height);
  ctx.clip();

  const image = model.image;
  if (model.imageReady) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const photoWidth = image.naturalWidth * scale, photoHeight = image.naturalHeight * scale;
    ctx.drawImage(image, (width-photoWidth)/2, (height-photoHeight)/2, photoWidth, photoHeight);
  } else {
    ctx.fillStyle = model.item.color;
    ctx.fillRect(0,0,width,height);
  }
  const shade = ctx.createLinearGradient(0,height*shadeStart,0,height);
  const tint = captionTint[model.item.id] ?? '15,12,18';
  shade.addColorStop(0,`rgba(${tint},0)`);
  shade.addColorStop(.53,`rgba(${tint},${shadeMiddle})`);
  shade.addColorStop(1,`rgba(${tint},${shadeEnd})`);
  ctx.fillStyle = shade;
  ctx.fillRect(0,0,width,height);

  ctx.font = `740 ${font}px Manrope`;
  ctx.fillStyle = '#fffaf2';
  const lineHeight = font * lineSpacing;
  const metrics = ctx.measureText('Мд');
  const ascent = metrics.fontBoundingBoxAscent ?? font*.98;
  const descent = metrics.fontBoundingBoxDescent ?? font*.25;
  const lastBaseline = height - inset - (lineHeight - ascent + descent) / 2;
  const firstBaseline = lastBaseline - lineHeight * (lines.length - 1);
  lines.forEach((line,index) => ctx.fillText(line,inset,firstBaseline + index * lineHeight));
  texture.dataset.revision = String(1 + Number(texture.dataset.revision || 0));
  model.texture = texture;
  model.textureDensity = density;
  model.dirty = false;
  model.uploadTexture = true;
}

export function getCardTexture(node,density,onlyWithCover=false) {
  const model=cardModels.get(node);
  if (!model.dimensions||onlyWithCover&&!model.imageReady) return null;
  if (model.dirty || !model.texture || model.textureDensity!==density) buildTexture(model,density);
  return model.texture;
}

const bendVertex = `
  attribute vec2 corner;
  varying vec2 uv;
  void main() {
    uv = vec2(.5 + corner.x * .5, .5 - corner.y * .5);
    gl_Position = vec4(corner, 0.0, 1.0);
  }
`;

const bendFragment = `
  precision highp float;
  varying vec2 uv;
  uniform sampler2D face;
  uniform vec2 pixels;
  uniform vec2 geometry;
  uniform vec2 bend;
  uniform vec3 light;
  void main() {
    float curve = 1.73 * bend.x;
    float edge = sin(curve * .5) / curve;
    float x = uv.x - .5;
    float u = asin(clamp(x, -edge, edge) * curve) / curve;
    float arc = bend.x * ((u*u - .09) * .85 + bend.y * .21 * u);
    float stretch = 1.0 + bend.x * (.15 - u*u * .58 + bend.y * u * .12);
    float y = (uv.y * geometry.y - geometry.x - arc + (stretch - 1.0) * .5) / stretch;
    float horizontal = (edge - abs(x)) * pixels.x;
    float vertical = min(y, 1.0-y) * pixels.y * stretch / geometry.y;
    float alpha = smoothstep(-.45, .65, min(horizontal, vertical));
    if (alpha == 0.0) discard;
    vec4 color = texture2D(face, vec2(u + .5, clamp(y,0.0,1.0)));
    vec2 delta = vec2(uv.x, y) - light.xy;
    float reflection = exp(-dot(delta,delta) * 17.0) * light.z;
    float rim = exp(-min(horizontal,vertical) * .045) * reflection * .16;
    color.rgb += (1.0 - color.rgb) * (reflection * vec3(.18,.13,.075) + rim * vec3(.2,.52,.82));
    gl_FragColor = vec4(color.rgb, color.a * alpha);
  }
`;

let bendRenderer;
function getBendRenderer() {
  if (bendRenderer !== undefined) return bendRenderer;
  bendRenderer = null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1536;
  const gl = canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false});
  if (!gl) return null;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  if (info && /swiftshader|llvmpipe|software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  try {
    const program = gl.createProgram();
    for (const [type,source] of [[gl.VERTEX_SHADER,bendVertex],[gl.FRAGMENT_SHADER,bendFragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(program,'corner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner,2,gl.FLOAT,false,0,0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    const uniforms = Object.fromEntries(
      ['pixels','geometry','bend','light'].map(name => [name,gl.getUniformLocation(program,name)])
    );
    bendRenderer = {canvas,gl,uniforms};
    canvas.addEventListener('webglcontextlost', () => {bendRenderer=null;});
  } catch {
    return null;
  }
  return bendRenderer;
}

function paintBendWithGPU(renderer, model, intensity, direction, highlight, padding) {
  const {canvas,gl,uniforms} = renderer;
  const {width,height} = model.canvas;
  if (!model.gpuTexture) {
    model.gpuTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, model.gpuTexture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }
  gl.bindTexture(gl.TEXTURE_2D,model.gpuTexture);
  if (model.uploadTexture) {
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,model.texture);
    model.uploadTexture = false;
  }
  gl.viewport(0,0,width,height);
  gl.scissor(0,0,width,height);
  gl.enable(gl.SCISSOR_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const faceHeight = model.dimensions.height;
  gl.uniform2f(uniforms.pixels,width,height);
  gl.uniform2f(uniforms.geometry,padding / faceHeight,(faceHeight + 2*padding) / faceHeight);
  gl.uniform2f(uniforms.bend,intensity,direction);
  gl.uniform3f(uniforms.light,highlight.x,highlight.y,highlight.strength);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);

  model.canvas.getContext('2d').drawImage(canvas,0,canvas.height-height,width,height,0,0,width,height);
}

function paintBendColumns(model, intensity, direction, highlight, padding) {
  const {width,height} = model.dimensions;
  const ctx = model.canvas.getContext('2d');
  const {width:bufferWidth,height:bufferHeight} = model.canvas;
  const scaleY = bufferHeight / (height + 2*padding);
  const curvature = 1.73 * intensity;
  const edge = Math.sin(curvature * .5) / curvature;
  const sourceAt = x => Math.asin(Math.max(-edge,Math.min(edge,x/bufferWidth-.5)) * curvature) / curvature;
  const left = Math.floor(bufferWidth * (.5-edge)), right = Math.ceil(bufferWidth * (.5+edge));
  let start = sourceAt(left);
  const stripWidth = Math.max(2, Math.ceil(bufferWidth / 44));
  for (let x=left; x<right; x+=stripWidth) {
    const span = Math.min(stripWidth,right-x);
    const end = sourceAt(x+span);
    const u = (start+end)/2;
    const arc = height * intensity * ((u*u-.09)*.85 + direction*.21*u);
    const stretch = 1 + intensity * (.15-u*u*.58 + direction*u*.12);
    const y = padding + arc - (stretch-1)*height/2;
    ctx.drawImage(model.texture,(start+.5)*model.texture.width,0,(end-start)*model.texture.width,
      model.texture.height,x,y*scaleY,span,height*stretch*scaleY);
    start = end;
  }
  if (highlight.strength > .01) {
    const x = highlight.x * bufferWidth, y = (padding + highlight.y * height) * scaleY;
    const light = ctx.createRadialGradient(x,y,0,x,y,bufferWidth*.43);
    light.addColorStop(0,`rgba(255,222,177,${highlight.strength*.22})`);
    light.addColorStop(1,'transparent');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = light;
    ctx.fillRect(0,0,bufferWidth,bufferHeight);
    ctx.globalCompositeOperation = 'source-over';
  }
}

export function bendCard(node, intensity, direction, detail, highlight) {
  const model = cardModels.get(node);
  if (intensity < .001 || !model.dimensions || !model.imageReady) {
    if (model.canvas) model.canvas.hidden = true;
    model.bendKey = '';
    node.classList.remove('is-bent');
    return;
  }
  const renderer = getBendRenderer();
  const density = Math.max(1,Math.min(renderer ? 2.15 : 1.75,Math.ceil(detail*4)/4));
  const warpStep = renderer ? 500 : 185;
  const warp = Math.max(.001,Math.round(intensity*warpStep)/warpStep);
  const side = Math.round(direction*warpStep)/warpStep;
  const glowKey = highlight.strength > .002
    ? [highlight.x,highlight.y,highlight.strength].map(value=>value.toFixed(2)).join(':') : '';
  const key = `${warp}:${side}:${glowKey}`;
  const cacheKey = `${density}:${key}:${!!renderer}`;
  if (cacheKey === model.bendKey && !model.dirty) return;
  model.bendKey = cacheKey;
  if (model.dirty || model.textureDensity < density) buildTexture(model,density);
  if (!model.canvas) {
    model.canvas = document.createElement('canvas');
    model.canvas.className = 'card-bend';
    model.canvas.setAttribute('aria-hidden','true');
    node.append(model.canvas);
  }
  const {width,height} = model.dimensions;
  const padding = Math.ceil(height*.23);
  const bufferWidth = Math.round(width*density), bufferHeight = Math.round((height + padding*2)*density);
  if (model.canvas.width !== bufferWidth || model.canvas.height !== bufferHeight) {
    model.canvas.width = bufferWidth;
    model.canvas.height = bufferHeight;
    model.canvas.style.top = `${-padding}px`;
    model.canvas.style.height = `${height + 2*padding}px`;
  }
  model.canvas.getContext('2d').clearRect(0,0,bufferWidth,bufferHeight);
  if (renderer) paintBendWithGPU(renderer,model,warp,side,highlight,padding);
  else paintBendColumns(model,warp,side,highlight,padding);
  model.canvas.hidden = false;
  node.classList.add('is-bent');
}

const backgroundStops = [
  [0, [9, 6, 8], [255, 152, 38], [226, 45, 19], .73, .67, .035],
  [1.5, [13, 7, 7], [255, 124, 21], [238, 44, 14], .96, .43, .05],
  [3, [12, 7, 8], [255, 159, 37], [206, 40, 32], .78, .69, .05],
  [5, [13, 6, 10], [249, 131, 39], [212, 29, 36], .60, .77, .025],
  [8, [12, 6, 7], [255, 164, 42], [232, 52, 18], .91, .54, .035],
  [12, [12, 6, 9], [252, 129, 34], [214, 42, 26], .78, .67, .04],
  [16, [12, 6, 8], [249, 143, 38], [239, 47, 18], .67, .86, .055],
  [18.8, [20, 9, 13], [255, 163, 76], [201, 52, 48], .58, .67, .038],
  [20, [244, 244, 246], [255, 183, 119], [211, 109, 90], 0, 0, 0],
];

const backgroundEase = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const interpolate = (a, b, t) => a + (b - a) * t;
const interpolateColor = (a, b, t) => a.map((channel, i) => interpolate(channel, b[i], t));

export function backgroundState(progress, seconds = 0) {
  const p = Math.max(0, Math.min(20, progress));
  let i = 0;
  while (i < backgroundStops.length - 2 && p > backgroundStops[i + 1][0]) i++;
  const a = backgroundStops[i];
  const b = backgroundStops[i + 1];
  const t = backgroundEase((p - a[0]) / (b[0] - a[0]));
  const phase = p * .57;
  const drift = seconds * .36;
  return {
    base: interpolateColor(a[1], b[1], t),
    amber: interpolateColor(a[2], b[2], t),
    ember: interpolateColor(a[3], b[3], t),
    amberPower: interpolate(a[4], b[4], t),
    emberPower: interpolate(a[5], b[5], t),
    grid: interpolate(a[6], b[6], t),
    amberX: .78 + .12 * Math.sin(phase + drift),
    amberY: .35 + .30 * Math.sin(phase * .81 + drift * .71),
    emberX: .53 + .26 * Math.sin(phase * .72 + drift * .58 + 1.8),
    emberY: .94 + .22 * Math.cos(phase + drift * .76),
    aspect: 1 + .21 * Math.sin(phase * .64 + drift * .85),
  };
}

const backdropCache = new WeakMap();
export function paintBackdrop(canvas, p, w, h, seconds = 0, rate = 24) {
  const scale = Math.min(devicePixelRatio || 1, 1) * .67;
  const clock = p < 19.995 ? Math.floor(seconds * rate) / rate : 0;
  const signature = `${p.toFixed(4)}:${w}:${h}:${clock}`;
  if (backdropCache.get(canvas) === signature) return;
  backdropCache.set(canvas, signature);
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d', {alpha: false});
  const state = backgroundState(p, clock);
  const color = rgb => rgb.map(channel => Math.round(channel)).join(',');
  context.setTransform(width, 0, 0, height, 0, 0);
  context.fillStyle = `rgb(${color(state.base)})`;
  context.fillRect(0, 0, 1, 1);

  function glow(x, y, rx, ry, channels, intensity) {
    context.save();
    context.translate(x, y);
    context.scale(rx, ry);
    const field = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [stop, alpha] of [[0, 1], [.24, .86], [.51, .42], [.79, .11], [1, 0]]) {
      field.addColorStop(stop, `rgba(${color(channels)},${intensity * alpha})`);
    }
    context.fillStyle = field;
    context.fillRect(-1, -1, 2, 2);
    context.restore();
  }

  glow(state.emberX, state.emberY, .77 / state.aspect, .93, state.ember, state.emberPower);
  glow(state.amberX, state.amberY, .55 * state.aspect, .82, state.amber, state.amberPower);
  const clearance = backgroundEase((p - 18.8) / 1.2);
  const gridFrame = 1 - backgroundEase(Math.abs(p - 3) / .6);
  const shade = context.createLinearGradient(0, 0, w < 700 ? .33 : .68, w < 700 ? .65 : 0);
  shade.addColorStop(0, `rgba(9,5,9,${(1 - clearance) * .83})`);
  shade.addColorStop(.42, `rgba(9,5,9,${(1 - clearance) * .56})`);
  shade.addColorStop(1, 'rgba(9,5,9,0)');
  context.fillStyle = shade;
  context.fillRect(0, 0, 1, 1);
  if (gridFrame > 0) {
    const right = context.createLinearGradient(.47, 0, 1, 0);
    right.addColorStop(0, 'rgba(9,5,9,0)');
    right.addColorStop(1, `rgba(9,5,9,${gridFrame * .70})`);
    context.fillStyle = right;
    context.fillRect(0, 0, 1, 1);
  }
  if (state.grid < .003) return;
  context.resetTransform();
  context.beginPath();
  const step = Math.round(50 * scale);
  for (let x = step; x < width; x += step) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = step; y < height; y += step) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.strokeStyle = `rgba(255,195,162,${state.grid})`;
  context.lineWidth = .6;
  context.stroke();
}

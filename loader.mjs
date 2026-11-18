const loaderRunStart = 2040;
const loaderRunEnd = 3730;
const loaderEnd = 3930;
const mobileCountRate = 2.55;
const mobileRunRate = 1.88;

export function loaderState(milliseconds) {
  const run = Math.max(0, Math.min(1, (milliseconds - loaderRunStart) / (loaderRunEnd - loaderRunStart)));
  let percent = 0;
  if (milliseconds >= 435) percent = 1;
  if (milliseconds >= 1435) percent = 2;
  if (milliseconds >= 1775) percent = 3;
  if (run > 0) percent = 3 + Math.floor(97 * Math.pow(run, 1.59));
  return {percent, run};
}

export function loaderElapsed(milliseconds, compact) {
  if (!compact) return milliseconds;
  const takeoff = loaderRunStart / mobileCountRate;
  if (milliseconds < takeoff) return milliseconds * mobileCountRate;
  return loaderRunStart + (milliseconds - takeoff) * mobileRunRate;
}

export function startLoader(onReady, compact = false) {
  const label = document.getElementById('load-label');
  const suffix = document.getElementById('load-suffix');
  const bar = document.getElementById('load-bar');
  const track = bar.parentElement;
  const runner = document.getElementById('loader-runner');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const started = performance.now();
  const numberLabel = label.firstChild;
  let runnerReady = false;

  if (!reduced) {
    runner.addEventListener('load', () => {runnerReady = true;}, {once: true});
    runner.src = runner.dataset.src;
    if (compact) runnerReady = runner.complete && runner.naturalWidth > 0;
  }

  function showProgress({percent, run}) {
    suffix.style.visibility = percent ? 'visible' : 'hidden';
    label.style.visibility = percent ? 'visible' : 'hidden';
    numberLabel.data = String(percent);
    bar.style.transform = `scaleX(${percent / 100})`;
    track.setAttribute('aria-valuenow', percent);
    if (runnerReady && run > 0) {
      runner.hidden = false;
      runner.style.left = `${run * 100}%`;
      runner.style.translate = `${(run - 1) * 100}% 0`;
    }
  }

  function finish() {
    showProgress({percent: 100, run: 1});
    document.body.classList.add('ready');
    onReady();
  }

  function advance(now) {
    const elapsed = loaderElapsed(now - started, compact);
    if (elapsed >= (reduced ? 210 : loaderEnd)) {
      finish();
      return;
    }
    showProgress(loaderState(elapsed));
    requestAnimationFrame(advance);
  }

  requestAnimationFrame(advance);
}

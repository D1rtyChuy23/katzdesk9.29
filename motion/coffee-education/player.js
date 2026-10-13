const q = new URLSearchParams(location.search);
if (q.has('render')) document.body.classList.add('render');
function fit() { const k = Math.min(innerWidth / 1920, (innerHeight - (q.has('render') ? 0 : 44)) / 1080); stage.style.transform = q.has('render') ? 'none' : `scale(${k})`; }
addEventListener('resize', fit); fit();
let playing = !q.has('render'), t0 = performance.now(), cur = 0;
const sc = document.getElementById('sc'), tt = document.getElementById('tt'), pp = document.getElementById('pp');
function show(t) { cur = t; seek(t); sc.value = t; tt.textContent = t.toFixed(2) + 's'; }
function loop(now) { if (playing) { cur = (now - t0) / 1000; if (cur >= DUR) { t0 = now; cur = 0; } show(cur); } requestAnimationFrame(loop); }
pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pause' : 'Play'; t0 = performance.now() - cur * 1000; };
sc.oninput = () => { playing = false; pp.textContent = 'Play'; show(+sc.value); };
window.seek = seek; window.show = show; show(0); requestAnimationFrame(loop);

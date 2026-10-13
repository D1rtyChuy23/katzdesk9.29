// Deterministic timeline: every animation is a paused Web Animation whose currentTime = t.
const FPS = 30, DUR = 60;
const E = { out: 'cubic-bezier(.16,1,.3,1)', io: 'cubic-bezier(.65,0,.35,1)', back: 'cubic-bezier(.34,1.56,.64,1)', lin: 'linear' };
const ticks = [];
const stage = document.getElementById('stage');
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
const A = (el, kf, start, dur = .8, ease = E.out) => el.animate(kf, { delay: start * 1000, duration: dur * 1000, fill: 'both', easing: ease });
const rise = (el, t, dist = 36, dur = .8) => A(el, [{ opacity: 0, transform: `translateY(${dist}px)` }, { opacity: 1, transform: 'none' }], t, dur);
const pop = (el, t, dur = .7) => A(el, [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }], t, dur, E.back);
function scene(s, e) {
  const el = $('<section class="scene"></section>');
  el.animate([{ opacity: 0 }, { opacity: 1, offset: .0001 }, { opacity: 1, offset: .9999 }, { opacity: 0 }], { delay: s * 1000, duration: (e - s) * 1000, fill: 'both' });
  stage.appendChild(el); return el;
}
function head(el, s, n, kick, lines, size) {
  el.appendChild($(`<div class="kicker">${n} / 10 &nbsp;—&nbsp; ${kick}</div>`));
  rise(el.lastChild, s + .3, 20, .6);
  const h = $(`<h1 ${size ? `style="font-size:${size}px"` : ''}>${lines.map(l => `<span class="line"><span class="w">${l}</span></span>`).join('')}</h1>`);
  el.appendChild(h);
  h.querySelectorAll('.w').forEach((w, i) => A(w, [{ transform: 'translateY(108%)' }, { transform: 'none' }], s + .35 + i * .12, .8));
}
function kenburns(img, s, e) { A(img, [{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], s, e - s, E.lin); }
function photo(el, src, s, e, x, y, w, h, t0) {
  const c = $(`<div class="card" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><img src="${src}"></div>`);
  el.appendChild(c); A(c, [{ opacity: 0, transform: 'translateX(70px) scale(.94)' }, { opacity: 1, transform: 'none' }], t0, 1);
  kenburns(c.firstChild, t0, e); return c;
}
function stats(el, list, s, x0 = 100, y0 = 450) {
  list.forEach(([big, small], i) => {
    const d = $(`<div class="stat" style="left:${x0 + (i % 2) * 470}px;top:${y0 + Math.floor(i / 2) * 200}px"><b>${big}</b><span>${small}</span></div>`);
    el.appendChild(d); pop(d, s + .9 + i * .35);
  });
}
function rows(el, list, s, y0) {
  list.forEach(([a, b], i) => {
    const d = $(`<div class="row" style="top:${y0 + i * 114}px"><b>${a}</b><span>${b}</span></div>`);
    el.appendChild(d); A(d, [{ opacity: 0, transform: 'translateX(-80px)' }, { opacity: 1, transform: 'none' }], s + .9 + i * .4, .8);
  });
}
function wipe(b) {
  const w = $(`<div class="w"><img src="assets/img/logo.svg"></div>`);
  document.getElementById('wipes').appendChild(w);
  A(w, [{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)', offset: .5 }, { transform: 'translateX(101%)' }], b - .4, .8, E.io);
}
function seek(t) {
  t = Math.max(0, Math.min(DUR, t));
  document.getAnimations().forEach(a => { a.pause(); a.currentTime = t * 1000; });
  ticks.forEach(f => f(t));
}

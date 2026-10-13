const I = n => `assets/img/${n}`;
const B = [4, 9, 14, 19, 25, 30, 34, 43, 48, 52, 56.5]; // scene boundaries
stage.appendChild($('<div class="abs" id="bg"></div>'));
// drifting soft shapes
['left:-260px;top:-300px;width:760px;height:760px', 'right:-300px;bottom:-380px;width:900px;height:900px'].forEach((p, i) => {
  const c = $(`<div class="abs" style="inset:auto;${p};border-radius:50%;background:#67BB2A14"></div>`);
  stage.appendChild(c); A(c, [{ transform: 'translate(0,0)' }, { transform: `translate(${i ? -80 : 90}px,${i ? -50 : 60}px)` }], 0, 60, E.lin);
});

/* 0 INTRO */
{ const s = 0, e = 4, el = scene(s, e);
  const logo = $(`<img src="${I('logo.svg')}" style="position:absolute;left:560px;top:130px;width:800px;height:480px">`);
  el.appendChild(logo); A(logo, [{ opacity: 0, transform: 'scale(.7) rotate(-4deg)' }, { opacity: 1, transform: 'none' }], .1, 1.1, E.back);
  const h = $(`<h1 style="left:0;right:0;top:640px;text-align:center;font-size:150px"><span class="line"><span class="w">COFFEE EDUCATION</span></span></h1>`);
  el.appendChild(h); A(h.querySelector('.w'), [{ transform: 'translateY(108%)' }, { transform: 'none' }], 1, .9);
  const sub = $(`<div style="position:absolute;left:0;right:0;top:830px;text-align:center;font:600 30px PP;letter-spacing:.3em;color:#3F8A12">KATZ TEAM TRAINING MANUAL</div>`);
  el.appendChild(sub); rise(sub, 1.7, 24, .8);
  const ln = $(`<div style="position:absolute;left:660px;top:900px;width:600px;height:8px;border-radius:4px;background:#67BB2A;transform-origin:50% 0"></div>`);
  el.appendChild(ln); A(ln, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 2, .9);
}

/* 1 WHAT IS COFFEE */
{ const s = B[0], e = B[1], el = scene(s, e);
  head(el, s, '01', 'Origin', ['WHAT IS', 'COFFEE?']);
  stats(el, [['120+', 'species in the Coffea genus'], ['SEED', 'Roasted seed of the coffee fruit'], ['11th c.', 'First made into a hot drink'], ['70+', 'countries now grow coffee']], s);
  const c = $(`<div class="card" style="left:1060px;top:90px;width:760px;height:760px;background:#EAF6DF"></div>`);
  c.innerHTML = `<svg viewBox="0 0 760 760" width="760" height="760">
   <g id="cherry"><path d="M380 215 C380 155 430 105 520 85 C500 155 450 200 380 215Z" fill="#3F8A12"/><path d="M380 215 C380 155 330 115 250 105 C270 165 310 200 380 215Z" fill="#67BB2A"/>
   <circle cx="380" cy="430" r="215" fill="#D6262B"/><ellipse cx="305" cy="360" rx="60" ry="30" fill="#fff" opacity=".28" transform="rotate(-35 305 360)"/></g>
   <g id="seeds"><ellipse cx="335" cy="430" rx="62" ry="92" fill="#E9D7A4" stroke="#8C6A2F" stroke-width="6"/><path d="M335 345 C355 400 315 460 335 518" stroke="#8C6A2F" stroke-width="6" fill="none"/>
   <ellipse cx="425" cy="430" rx="62" ry="92" fill="#E9D7A4" stroke="#8C6A2F" stroke-width="6"/><path d="M425 345 C445 400 405 460 425 518" stroke="#8C6A2F" stroke-width="6" fill="none"/></g></svg>
   <div style="position:absolute;left:0;right:0;bottom:36px;text-align:center;font:600 24px PP;color:#3F8A12">Born in Ethiopia, on the shores of the Red Sea</div>`;
  el.appendChild(c); A(c, [{ opacity: 0, transform: 'translateX(70px)' }, { opacity: 1, transform: 'none' }], s + .5, 1);
  A(c.querySelector('#cherry'), [{ transform: 'scale(.4)', transformOrigin: '380px 430px', opacity: 0 }, { transform: 'scale(1)', transformOrigin: '380px 430px', opacity: 1 }], s + .8, 1, E.back);
  // cherry becomes see-through to reveal the two seeds
  A(c.querySelector('#cherry circle'), [{ opacity: 1 }, { opacity: .18 }], s + 2.6, .9, E.io);
  A(c.querySelector('#seeds'), [{ opacity: 0, transform: 'scale(.5)', transformOrigin: '380px 430px' }, { opacity: 1, transform: 'none', transformOrigin: '380px 430px' }], s + 2.6, .9, E.back);
}

/* 2 GROWING */
{ const s = B[1], e = B[2], el = scene(s, e);
  head(el, s, '02', 'Growing', ['GROWING', 'CONDITIONS']);
  stats(el, [['1,000 mi', 'max distance from the equator'], ['0–7,000 ft', 'altitude, sea level up'], ['3–4 yrs', 'until a tree makes coffee'], ['8–10 ft', 'pruned height (they can reach 20 ft)']], s);
  photo(el, I('farm.png'), s, e, 1060, 90, 760, 760, s + .5);
}

/* 3 HARVEST */
{ const s = B[2], e = B[3], el = scene(s, e);
  head(el, s, '03', 'Harvesting', ['HARVESTING', 'COFFEE']);
  stats(el, [['1–4', 'hand pickings per harvest'], ['10–14 days', 'until ripe cherries go over-ripe'], ['2 beans', 'inside every cherry'], ['100–200 lb', 'cherries per picker a day = 20–40 lb beans']], s);
  photo(el, I('pick.png'), s, e, 1060, 90, 760, 760, s + .5);
}

/* 4 PROCESSING */
{ const s = B[3], e = B[4], el = scene(s, e);
  head(el, s, '04', 'Processing & milling', ['PROCESSING', '& MILLING'], 130);
  rows(el, [['Washed', 'Pulp removed first, fermented, dried to 10–12% moisture'], ['Semi-washed', 'Seeds machine-pulped, stored, then hulled at the mill'], ['Natural', 'Whole cherry dried in the sun, raked and turned'], ['Honey', 'Skin removed; sticky fruit layer dries on the bean']], s, 420);
  photo(el, I('drying.png'), s, e, 1060, 90, 760, 760, s + .5);
}

/* 5 SORTING */
{ const s = B[4], e = B[5], el = scene(s, e);
  head(el, s, '05', 'Sorting', ['SORTING & GRADING'], 130);
  [['handsort.png', 'Hand sorting', 'Most labor intensive. Defects picked out one by one.'], ['mech.png', 'Mechanical', 'Machines shake beans through sieves by size.'], ['densi.png', 'Densimetric', 'Air + vibration separate heavy beans from light.'], ['color.png', 'High tech', 'Sensors read each bean’s color and reject defects.']].forEach(([im, h, p], i) => {
    const c = $(`<div class="pc" style="left:${100 + i * 430}px;top:290px;width:400px;height:540px"><div class="im"><img src="${I(im)}"></div><h3>${h}</h3><p>${p}</p></div>`);
    el.appendChild(c); A(c, [{ opacity: 0, transform: 'translateY(90px)' }, { opacity: 1, transform: 'none' }], s + .8 + i * .4, .9); kenburns(c.querySelector('img'), s + .8 + i * .4, e);
  });
  const l = $(`<div style="position:absolute;left:100px;top:868px;width:1720px;height:6px;border-radius:3px;background:#67BB2A;transform-origin:0 0"></div>`);
  el.appendChild(l); A(l, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], s + 1.2, 2.4, E.io);
  const t = $(`<div style="position:absolute;right:100px;top:884px;font:600 22px PP;color:#3F8A12;letter-spacing:.12em">LESS LABOR INTENSIVE →</div>`);
  el.appendChild(t); rise(t, s + 3, 12, .6);
}

/* 6 GRADE & ROAST */
{ const s = B[5], e = B[6], el = scene(s, e);
  head(el, s, '06', 'Grading & roasting', ['GREEN TO ROASTED'], 130);
  [['grading.png', 'Grading', 'Green beans separated into quality grades, often by size.'], ['roasting.png', 'Roasting', 'Around 400°F beans brown (Maillard) then release oils (pyrolysis).'], ['fluidbed.png', 'Roasters', 'Drum roasters or fluid bed roasters, then rapid cooling.']].forEach(([im, h, p], i) => {
    const c = $(`<div class="pc" style="left:${100 + i * 590}px;top:290px;width:540px;height:560px"><div class="im" style="height:340px"><img src="${I(im)}"></div><h3>${h}</h3><p>${p}</p></div>`);
    el.appendChild(c); A(c, [{ opacity: 0, transform: 'translateY(90px)' }, { opacity: 1, transform: 'none' }], s + .7 + i * .35, .9); kenburns(c.querySelector('img'), s + .7 + i * .35, e);
  });
}

/* 7 ROAST PROFILES */
{ const s = B[6], e = B[7], el = scene(s, e);
  head(el, s, '07', 'Roast profiles', ['ROAST PROFILES'], 130);
  const names = [['Cinnamon / American', '400–410°F'], ['Light', '411–420°F'], ['Medium light', '421–431°F'], ['Medium', '432–445°F'], ['Medium dark', '446–456°F'], ['Velvet', '456–459°F'], ['Dark', '466°F +'], ['Double dark', '480–500°F']];
  const t0 = s + 1.2, step = .8;
  names.forEach(([n, t], i) => {
    const d = $(`<div class="bean" style="left:${100 + (i % 4) * 440}px;top:${250 + Math.floor(i / 4) * 290}px"><img src="${I(`bean${i + 1}.png`)}"><div class="n">${n}</div><div class="t">${t}</div></div>`);
    el.appendChild(d); pop(d, s + .6 + i * .12);
    const at = t0 + i * step;
    A(d, [{ transform: 'scale(1)', background: '#fff0', boxShadow: '0 0 0 #0000' }, { transform: 'scale(1.07)', background: '#fff', boxShadow: '0 22px 50px #100f0d33' }, { transform: 'scale(1)', background: '#fff0', boxShadow: '0 0 0 #0000' }], at, 1.1, E.io);
    A(d.querySelector('.n'), [{ color: '#100f0d' }, { color: '#3F8A12' }, { color: '#100f0d' }], at, 1.1);
  });
  const bar = $(`<div style="position:absolute;left:100px;top:860px;width:1720px;height:22px;border-radius:11px;background:#E8E4D2;overflow:hidden"><div id="fill" style="height:100%;width:100%;transform-origin:0 0;background:linear-gradient(90deg,#d9c08a,#b9762f,#6b3a1a,#2a140a)"></div></div>`);
  el.appendChild(bar); rise(bar, s + .8, 20, .6);
  A(bar.firstChild, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], t0, step * 8, E.lin);
  const lab = $(`<div style="position:absolute;left:100px;top:898px;right:100px;display:flex;justify-content:space-between;font:600 22px PP;color:#6b6a63"><span>400°F</span><b id="temp" style="font:800 44px/1 BC;color:#3F8A12;margin-top:-10px">400°F</b><span>500°F</span></div>`);
  el.appendChild(lab); rise(lab, s + .8, 14, .6);
  ticks.push(t => { const p = Math.max(0, Math.min(1, (t - t0) / (step * 8))); lab.querySelector('#temp').textContent = Math.round(400 + 100 * p) + '°F'; });
}

/* 8 ROAST FACTS */
{ const s = B[7], e = B[8], el = scene(s, e);
  head(el, s, '08', 'Roasted coffee facts', ['ROASTED COFFEE FACTS'], 130);
  [['Lighter', 'More acidity. Light-roasted beans stay dry.'], ['Darker', 'Less origin flavor, more roasty. Oils show on the bean.'], ['Caffeine', 'Decreases as the roast gets darker.'], ['Espresso', 'NOT a roast. It’s a method of extraction.']].forEach(([h, p], i) => {
    const d = $(`<div class="fact ${i == 3 ? 'dark' : ''}" style="left:${100 + i * 437}px;top:320px"><h3>${h}</h3><p>${p}</p></div>`);
    el.appendChild(d); A(d, [{ opacity: 0, transform: 'translateY(100px) rotate(2deg)' }, { opacity: 1, transform: 'none' }], s + .9 + i * .5, .9);
  });
}

/* 9 CUPPING */
{ const s = B[8], e = B[9], el = scene(s, e);
  head(el, s, '09', 'Tasting', ['TASTING &', 'CUPPING'], 130);
  rows(el, [['1 · Smell', 'Breathe in the brewed coffee deeply'], ['2 · Slurp', 'Spoon it in to spread across the tongue'], ['3 · Score', 'Body · sweetness · acidity · flavor · aftertaste']], s, 440);
  photo(el, I('cupping.png'), s, e, 1060, 90, 760, 760, s + .5);
}

/* 10 FLAVOR WHEEL */
{ const s = B[9], e = B[10], el = scene(s, e);
  head(el, s, '10', 'Flavor wheel', ['THE FLAVOR', 'WHEEL'], 130);
  const p = $(`<div style="position:absolute;left:100px;top:440px;width:760px;font:500 28px/1.45 PP">A tool for the coffee taster — built to analyze and describe coffees.<div style="margin-top:22px;font:italic 500 22px/1.4 PP;color:#3F8A12">A collaborative effort by the Specialty Coffee Association and World Coffee Research.</div></div>`);
  el.appendChild(p); rise(p, s + 1, 30, .8);
  const w = $(`<img src="${I('wheel.png')}" style="position:absolute;left:930px;top:110px;width:900px;height:733px">`);
  el.appendChild(w);
  A(w, [{ clipPath: 'circle(0% at 50% 50%)', transform: 'rotate(-90deg) scale(.8)' }, { clipPath: 'circle(75% at 50% 50%)', transform: 'rotate(0) scale(1)' }], s + .5, 2.2, E.out);
}

/* 11 OUTRO */
{ const s = B[10], e = 60, el = scene(s, e);
  const logo = $(`<img src="${I('logo.svg')}" style="position:absolute;left:610px;top:170px;width:700px;height:420px">`);
  el.appendChild(logo); A(logo, [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], s + .35, .9, E.back);
  const h = $(`<h1 style="left:0;right:0;top:620px;text-align:center"><span class="line"><span class="w">FROM SEED TO CUP.</span></span></h1>`);
  el.appendChild(h); A(h.querySelector('.w'), [{ transform: 'translateY(108%)' }, { transform: 'none' }], s + .8, .9);
  const sub = $(`<div style="position:absolute;left:0;right:0;top:830px;text-align:center;font:600 30px PP;letter-spacing:.3em;color:#3F8A12">KATZ COFFEE EDUCATION</div>`);
  el.appendChild(sub); rise(sub, s + 1.3, 24, .8);
}

/* footer + progress + wipes */
{ const f = $(`<div class="ft"><i style="left:60px;width:790px"></i><img src="${I('logo.svg')}"><i style="right:60px;width:790px"></i></div>`);
  stage.appendChild(f);
  f.animate([{ opacity: 0 }, { opacity: 1, offset: .0001 }, { opacity: 1, offset: .9999 }, { opacity: 0 }], { delay: (B[0]) * 1000, duration: (B[10] - B[0]) * 1000 - 0, fill: 'both' });
  const pg = $('<div id="prog"></div>'); stage.appendChild(pg); A(pg, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 0, 60, E.lin);
  stage.appendChild($('<div class="abs" id="wipes"></div>')); B.forEach(wipe);
}

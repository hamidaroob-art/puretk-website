/* pen-motion.js 2.0 — محرك ١١قلم للحركة. مكتوب من الصفر (غرفة نظيفة) على واجهات المتصفح القياسية فقط:
   Web Animations API · CSS linear() · IntersectionObserver · ScrollTimeline/ViewTimeline · matchMedia · SVG DOM.
   لا يعتمد على أي مكتبة، ولا يحوي كوداً منقولاً من مكتبات حركة أخرى. المرجع: MDN ومواصفات W3C.
   © ١١قلم — ملك الوكالة.

   PenMotion.enter(targets, { from: { yPercent: 70, opacity: 0 }, ease: PenMotion.spring(), stagger: { each: 35, from: 'center' } })
   PenMotion.timeline().from('.a', {...}).to('.b', {...}, {}, '<+=200').label('done').call(fn)
   PenMotion.flip('.card', () => grid.classList.toggle('list'))
   PenMotion.draw('svg path', { duration: 1400 })            PenMotion.morph(path, 'M…Z')
   PenMotion.onView(el, cb) · progress(track, cb) · scrub(el, keyframes) · link(timeline, track)
   PenMotion.magnetic(btn) · tilt(card) · pointerVars(el) · countUp(el, 1250) · marquee(row)
   PenMotion.media({ motion: '(prefers-reduced-motion: no-preference)' }, (c) => cleanup) · smooth() */
(function (root) {
  'use strict';
  const doc = root.document;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const list = (t) => t == null ? [] : typeof t === 'string' ? [...doc.querySelectorAll(t)] : (t.nodeType === 1 ? [t] : [...t]);
  const RM = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const COARSE = () => !!(root.matchMedia && root.matchMedia('(hover: none)').matches);
  const supports = (p, v) => !!(root.CSS && CSS.supports && CSS.supports(p, v));

  /* ── المنحنيات: cubic-bezier من مواصفة CSS Easing، والنابض يُحسب ويُرسَل للمتصفح بـlinear() ── */
  const EASE = {
    linear: 'linear',
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    soft: 'cubic-bezier(0.33, 1, 0.68, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    in: 'cubic-bezier(0.55, 0, 1, 0.45)',
    back: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
    expo: 'cubic-bezier(0.16, 1, 0.3, 1)'
  };
  const LINEAR_OK = () => supports('animation-timing-function', 'linear(0, 0.5, 1)');
  /* نابض فيزيائي: نحلّ x'' = (−k(x−1) − c·v)/m عددياً، ثم نأخذ عيّنات المنحنى إلى linear() فيرسمه المتصفح على الخيط المركّب */
  function spring(o) {
    o = o || {};
    const k = o.stiffness ?? 170, c = o.damping ?? 22, m = o.mass ?? 1;
    let x = 0, v = o.velocity ?? 0, t = 0;
    const dt = 1 / 240, pts = [0];
    let still = 0;
    while (t < 4) {
      const a = (-k * (x - 1) - c * v) / m;
      v += a * dt; x += v * dt; t += dt;
      pts.push(x);
      if (Math.abs(x - 1) < 0.0008 && Math.abs(v) < 0.002) { if (++still > 24) break; } else still = 0;
    }
    const n = 48, out = [];
    for (let i = 0; i <= n; i++) out.push(+pts[Math.round(i / n * (pts.length - 1))].toFixed(4));
    out[n] = 1;
    return { spring: true, easing: LINEAR_OK() ? `linear(${out.join(', ')})` : EASE.back, duration: Math.round(t * 1000), samples: out };
  }
  const easing = (e) => !e ? EASE.out : e.spring ? e.easing : (EASE[e] || e);
  const dur = (o, d) => o.duration ?? (o.ease && o.ease.spring ? o.ease.duration : d);

  /* ── الحالات والإطارات ── */
  const px = (v) => typeof v === 'number' ? v + 'px' : v;
  function frame(f) {
    const t = [];
    if (f.x != null) t.push(`translateX(${px(f.x)})`);
    if (f.y != null) t.push(`translateY(${px(f.y)})`);
    if (f.xPercent != null) t.push(`translateX(${f.xPercent}%)`);
    if (f.yPercent != null) t.push(`translateY(${f.yPercent}%)`);
    if (f.rotate != null) t.push(`rotate(${f.rotate}deg)`);
    if (f.rotateX != null || f.rotateY != null) t.unshift(`perspective(${f.perspective ?? 800}px)`);
    if (f.rotateX != null) t.push(`rotateX(${f.rotateX}deg)`);
    if (f.rotateY != null) t.push(`rotateY(${f.rotateY}deg)`);
    if (f.skewX != null) t.push(`skewX(${f.skewX}deg)`);
    if (f.scale != null) t.push(`scale(${f.scale})`);
    if (f.scaleX != null) t.push(`scaleX(${f.scaleX})`);
    if (f.scaleY != null) t.push(`scaleY(${f.scaleY})`);
    const k = {};
    if (t.length) k.transform = t.join(' ');
    if (f.opacity != null) k.opacity = f.opacity;
    if (f.blur != null) k.filter = `blur(${f.blur}px)`;
    if (f.clip != null) k.clipPath = f.clip;
    if (f.color != null) k.color = f.color;
    if (f.backgroundColor != null) k.backgroundColor = f.backgroundColor;
    if (f.letterSpacing != null) k.letterSpacing = px(f.letterSpacing);
    return k;
  }
  const rest = (k) => {
    const r = {};
    if ('transform' in k) r.transform = 'none';
    if ('opacity' in k) r.opacity = 1;
    if ('filter' in k) r.filter = 'blur(0px)';
    if ('clipPath' in k) r.clipPath = 'inset(0% 0% 0% 0%)';
    return r;
  };

  /* ── التتابع: رقم، أو { each, from: 'start'|'end'|'center'|'random'|رقم, grid: [صفوف, أعمدة] | 'auto' } ── */
  function offsets(els, s) {
    const n = els.length;
    if (!s) return new Array(n).fill(0);
    if (typeof s === 'number') return els.map((_, i) => i * s);
    const each = s.each ?? 40, from = s.from ?? 'start';
    let pos;
    if (s.grid) {
      let rows, cols;
      if (s.grid === 'auto') {
        const tops = [...new Set(els.map(e => Math.round(e.getBoundingClientRect().top)))];
        rows = tops.length; cols = Math.ceil(n / rows);
      } else [rows, cols] = s.grid;
      const oc = from === 'center' ? [(rows - 1) / 2, (cols - 1) / 2] : from === 'end' ? [rows - 1, cols - 1] : typeof from === 'number' ? [Math.floor(from / cols), from % cols] : [0, 0];
      pos = els.map((_, i) => Math.hypot(Math.floor(i / cols) - oc[0], (i % cols) - oc[1]));
    } else if (from === 'random') {
      const idx = [...Array(n).keys()];
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      pos = new Array(n); idx.forEach((v, i) => pos[v] = i);
    } else {
      const o = from === 'center' ? (n - 1) / 2 : from === 'end' ? n - 1 : typeof from === 'number' ? from : 0;
      pos = els.map((_, i) => Math.abs(i - o));
    }
    return pos.map(p => p * each);
  }
  const NONE = { animations: [], finished: Promise.resolve(), cancel() {}, pause() {}, play() {} };
  const group = (anims) => ({
    animations: anims,
    finished: Promise.all(anims.map(a => a.finished.catch(() => {}))),
    cancel() { anims.forEach(a => a.cancel()); }, pause() { anims.forEach(a => a.pause()); }, play() { anims.forEach(a => a.play()); }
  });

  /* ── الحركات الأساسية ── */
  function run(els, kf, o, fill) {
    const offs = offsets(els, o.stagger);
    return els.map((el, i) => el.animate(typeof kf === 'function' ? kf(el, i) : kf, {
      duration: dur(o, 800), easing: easing(o.ease), delay: (o.delay ?? 0) + offs[i], fill: o.fill || fill,
      iterations: o.repeat ?? 1, direction: o.yoyo ? 'alternate' : 'normal', composite: o.composite || 'replace'
    }));
  }
  /* ── المحرّك الهجين: الحشود (أكثر من CROWD عنصراً) تُدار بحلقة واحدة مجمّعة على الخيط الرئيسي،
        لأن ألف حركة مركّبة تُثقل المتصفح بإدارة الطبقات. القلة تبقى على WAAPI فلا تتأثر بانشغال المعالج. ── */
  /* Firefox يرسم حركات WAAPI الكثيرة على خيطه المركّب بكفاءة (قسناه: ٥٤ إطاراً مقابل ٤٤ للحلقة)، فيبقى عليها دائماً.
     Chromium وWebKit: الحلقة المجمّعة أسرع فوق ~١٦٠ عنصراً (WebKit: ٣٧٫٦ مقابل ٢٣٫٦ إطاراً لألف عنصر). */
  const GECKO = !!(root.CSS && CSS.supports && CSS.supports('-moz-appearance', 'none'));
  const CFG = { crowd: GECKO ? Infinity : 160 };
  function bezier(x1, y1, x2, y2) {
    const lut = new Float32Array(257);
    const bx = (t) => ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t;
    const by = (t) => ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
    const dx = (t) => 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
    for (let i = 0; i <= 256; i++) {
      const x = i / 256; let t = x;
      for (let k = 0; k < 8; k++) { const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= (bx(t) - x) / d; t = clamp(t, 0, 1); }
      lut[i] = by(t);
    }
    return (x) => { const f = clamp(x, 0, 1) * 256, i = f | 0; return i >= 256 ? lut[256] : lut[i] + (lut[i + 1] - lut[i]) * (f - i); };
  }
  function easeFn(e) {
    if (e && e.spring) { const s = e.samples, n = s.length - 1; return (x) => { const f = clamp(x, 0, 1) * n, i = f | 0; return i >= n ? s[n] : s[i] + (s[i + 1] - s[i]) * (f - i); }; }
    const str = easing(e);
    if (str === 'linear') return (x) => x;
    const m = /cubic-bezier\(([^)]+)\)/.exec(str);
    if (m) { const [a, b, c, d] = m[1].split(',').map(Number); return bezier(a, b, c, d); }
    return bezier(0.25, 0.1, 0.25, 1);
  }
  const KEYS = ['x', 'y', 'xPercent', 'yPercent', 'rotate', 'scale', 'scaleX', 'scaleY', 'opacity'];
  const REST = { x: 0, y: 0, xPercent: 0, yPercent: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1, opacity: 1 };
  const simple = (st) => st && typeof st === 'object' && Object.keys(st).every(k => KEYS.includes(k) && typeof st[k] === 'number');
  const tracks = new Set();
  let loop = 0;
  function writeState(el, v) {
    let t = '';
    if (v.x || v.y) t += `translate(${v.x}px,${v.y}px) `;
    if (v.xPercent || v.yPercent) t += `translate(${v.xPercent}%,${v.yPercent}%) `;
    if (v.rotate) t += `rotate(${v.rotate}deg) `;
    if (v.scale !== 1) t += `scale(${v.scale}) `;
    if (v.scaleX !== 1 || v.scaleY !== 1) t += `scale(${v.scaleX},${v.scaleY})`;
    el.style.transform = t || 'none';
    if (v.opacity !== undefined) el.style.opacity = v.opacity;
  }
  function tick(now) {
    loop = 0;
    for (const k of tracks) {
      if (k.paused) continue;
      if (k.t0 == null) k.t0 = now;
      let t = (now - k.t0) * k.rate - k.delay;
      if (t < 0) { if (!k.primed) { k.primed = true; k.apply(0); } continue; }
      const it = Math.floor(t / k.dur), done = k.iter !== Infinity && it >= k.iter;
      let p = done ? 1 : (t % k.dur) / k.dur;
      if (k.yoyo && (done ? (k.iter - 1) % 2 === 1 : it % 2 === 1)) p = 1 - p;
      k.apply(k.ease(p));
      if (done) { tracks.delete(k); k.end(); }
    }
    if (tracks.size) loop = requestAnimationFrame(tick);
  }
  /* يعطي كائناً يشبه Animation بما يكفي لـgroup(). الدالة apply مُفصّلة على المفاتيح الموجودة فقط:
     لا كائنات ولا حلقات مفاتيح في كل إطار، سلسلة transform واحدة وكتابة واحدة لكل عنصر. */
  function drive(el, from, to, o, delay, onEnd) {
    const g = (k, d) => [from[k] ?? (to[k] != null ? REST[k] : d), to[k] ?? REST[k]];
    const has = (k) => from[k] != null || to[k] != null;
    const st = el.style;
    const T = has('x') || has('y'), Pc = has('xPercent') || has('yPercent'), R = has('rotate'), S = has('scale'), SXY = has('scaleX') || has('scaleY'), O = has('opacity');
    const [x0, x1] = g('x', 0), [y0, y1] = g('y', 0), [px0, px1] = g('xPercent', 0), [py0, py1] = g('yPercent', 0), [r0, r1] = g('rotate', 0), [s0, s1] = g('scale', 1), [sx0, sx1] = g('scaleX', 1), [sy0, sy1] = g('scaleY', 1), [o0, o1] = g('opacity', 1);
    const dx = x1 - x0, dy = y1 - y0, dpx = px1 - px0, dpy = py1 - py0, dr = r1 - r0, ds = s1 - s0, dsx = sx1 - sx0, dsy = sy1 - sy0, dop = o1 - o0;
    let last = -1;
    let res; const finished = new Promise(r => res = r);
    const k = {
      delay, dur: Math.max(1, dur(o, 800)), iter: o.repeat ?? 1, yoyo: !!o.yoyo, ease: easeFn(o.ease), rate: 1, t0: null, paused: false, primed: false,
      apply(e) {
        if (e === last) return; last = e;
        let t = '';
        if (T) t = 'translate(' + (x0 + dx * e) + 'px,' + (y0 + dy * e) + 'px)';
        if (Pc) t += ' translate(' + (px0 + dpx * e) + '%,' + (py0 + dpy * e) + '%)';
        if (R) t += ' rotate(' + (r0 + dr * e) + 'deg)';
        if (S) t += ' scale(' + (s0 + ds * e) + ')';
        if (SXY) t += ' scale(' + (sx0 + dsx * e) + ',' + (sy0 + dsy * e) + ')';
        if (t) st.transform = t;
        if (O) st.opacity = o0 + dop * e;
      },
      end() { if (onEnd) onEnd(el); res(); }
    };
    tracks.add(k); if (!loop) loop = requestAnimationFrame(tick);
    return {
      finished, playState: 'running',
      cancel() { tracks.delete(k); st.transform = ''; st.opacity = ''; res(); },
      pause() { k.paused = true; k.pausedAt = performance.now(); }, play() { if (k.paused) { k.t0 += performance.now() - k.pausedAt; k.paused = false; if (!loop) loop = requestAnimationFrame(tick); } }
    };
  }
  const useDriver = (els, o, states) => o.engine === 'js' || (o.engine !== 'waapi' && els.length > CFG.crowd && states.every(simple));
  /* tween: من حالة إلى حالة بأرقام. القلة على WAAPI، والحشود على الحلقة المجمّعة تلقائياً */
  function tween(targets, o) {
    o = o || {};
    const els = list(targets), offs = offsets(els, o.stagger);
    const st = (s, el, i) => typeof s === 'function' ? s(i, el) : (s || {});
    if (RM() && !o.force) { if (o.to) els.forEach((el, i) => writeState(el, { ...REST, ...st(o.to, el, i) })); return NONE; }
    const sample = [st(o.from, els[0], 0), st(o.to, els[0], 0)];
    if (els.length && useDriver(els, o, sample)) {
      const clear = !o.to;   // دخول إلى الحالة الطبيعية: نمسح الأنماط بعد الانتهاء كما في WAAPI
      return group(els.map((el, i) => drive(el, st(o.from, el, i), st(o.to, el, i), o, (o.delay ?? 0) + offs[i], clear ? (x) => { x.style.transform = ''; x.style.opacity = ''; } : null)));
    }
    return group(els.map((el, i) => {
      const f = frame(st(o.from, el, i)), t = o.to ? frame(st(o.to, el, i)) : rest(f);
      return el.animate([f, t], { duration: dur(o, 800), easing: easing(o.ease), delay: (o.delay ?? 0) + offs[i], fill: o.to ? 'both' : 'backwards', iterations: o.repeat ?? 1, direction: o.yoyo ? 'alternate' : 'normal' });
    }));
  }

  /* من حالة إلى الحالة الطبيعية في CSS. fill: backwards: مخفي أثناء التأخير، ثم يُترك لـCSS بلا أنماط باقية */
  function enter(targets, o) {
    o = o || {};
    if (RM() && !o.force) return NONE;
    const els = list(targets), fs = o.from || { y: 24, opacity: 0 };
    if (useDriver(els, o, [fs])) return tween(els, { ...o, from: fs, to: null });
    const from = frame(fs);
    return group(run(els, [from, rest(from)], o, 'backwards'));
  }
  /* من الحالة الحالية إلى حالة جديدة، وتبقى عليها */
  function to(targets, state, o) {
    o = o || {};
    const els = list(targets), k = frame(state);
    if (RM() && !o.force) { els.forEach(el => Object.assign(el.style, k)); return NONE; }
    const anims = run(els, k, o, 'forwards');
    anims.forEach((a, i) => a.finished.then(() => { try { a.commitStyles(); a.cancel(); } catch (e) {} }, () => {}));
    return group(anims);
  }
  function animate(targets, keyframes, o) {
    o = o || {};
    if (RM() && !o.force) return NONE;
    return group(run(list(targets), keyframes, o, o.fill || 'none'));
  }

  /* ── الخط الزمني: كل الحركات WAAPI بمدة كلية واحدة (delay + endDelay)، فالتقديم والعكس والقفز متزامنة.
        البناء كسول: الحركة تُنشأ قبل موعدها بقليل فقط (أفق ١٦٠ms)، وحالة البداية للمتأخر تُكتب مباشرة بلا قراءة،
        فبناء ألف حركة لا يكلّف شيئاً تقريباً. ساعة داخلية من document.timeline تجعل المنشأ لاحقاً متزامناً تماماً. ── */
  function timeline(opt) {
    opt = opt || {};
    const entries = [], labels = {}, calls = [], waiters = [];
    let end = 0, lastStart = 0, lastEnd = 0, D = 0, rate = 1, started = false, rep = opt.repeat ?? 0, raf = 0;
    let playing = false, tBase = 0, tStamp = 0, sorted = true, next = 0, rendered = false;
    const H = opt.horizon ?? 160;   // تُنشأ الحركة قبل موعدها بعشرة إطارات تقريباً
    const reduce = RM() && !opt.force;
    const now = () => (doc.timeline && doc.timeline.currentTime != null) ? doc.timeline.currentTime : performance.now();
    function where(p) {
      if (p == null) return end;
      if (typeof p === 'number') return p;
      const m = /^(<|>|[^<>+\-=]+)?\s*(?:([+-])=\s*(\d+(?:\.\d+)?))?$/.exec(p.trim());
      if (!m) return end;
      const base = m[1] === '<' ? lastStart : m[1] === '>' ? lastEnd : m[1] ? (labels[m[1].trim()] ?? end) : end;
      return Math.max(0, base + (m[2] ? (m[2] === '+' ? 1 : -1) * +m[3] : 0));
    }
    let dirty = false;
    const later = () => { if (!dirty) { dirty = true; queueMicrotask(sync); } };
    const ready = () => { if (dirty) sync(); };
    const endDelay = (e) => Math.max(0, D - e.delay - e.t.duration * (e.t.iterations || 1));
    function sync() {
      dirty = false;
      D = Math.max(end, ...calls.map(c => c.t), 0);
      if (!sorted) { entries.sort((x, y) => x.delay - y.delay); sorted = true; next = entries.findIndex(e => !e.anim); if (next < 0) next = entries.length; }
      entries.forEach(e => { if (e.anim) e.anim.effect.updateTiming({ endDelay: endDelay(e) }); });
    }
    const start = () => tStamp - tBase / rate + (rate < 0 ? 0.01 : 0);   // العكس: نبتعد جزءاً من الألف عن حدّ النهاية، فالمتصفح يعدّ الحدّ نفسه بداية التكرار
    const getTime = () => playing ? clamp(tBase + (now() - tStamp) * rate, 0, D) : tBase;
    function create(e) {
      if (e.prev) { for (const k in e.prev) e.el.style[k] = e.prev[k]; e.prev = null; }
      const kf = typeof e.kf === 'function' ? e.kf(e.el, e.i) : e.kf;
      const a = e.el.animate(kf, { duration: e.t.duration, easing: e.t.easing, iterations: e.t.iterations, direction: e.t.direction, delay: e.delay, endDelay: endDelay(e), fill: e.fill });
      a.pause(); a.playbackRate = rate;
      if (playing) a.startTime = start(); else a.currentTime = tBase;
      e.anim = a;
    }
    function materialize(upTo) {
      ready();
      while (next < entries.length && entries[next].delay <= upTo) { const e = entries[next++]; if (!e.anim) create(e); }
    }
    function hold() {   // حالة البداية للحركات التي لم تُنشأ بعد، كتابة فقط
      if (rendered) return; rendered = true;
      for (let i = next; i < entries.length; i++) {
        const e = entries[i];
        if (e.anim || !e.from) continue;
        e.prev = {}; for (const k in e.from) { e.prev[k] = e.el.style[k]; e.el.style[k] = e.from[k]; }
      }
    }
    function created() { const out = []; for (const e of entries) if (e.anim) out.push(e.anim); return out; }
    function push(els, kf, o, at, from) {
      o = o || {};
      const s = where(at), offs = offsets(els, o.stagger), d = dur(o, 700), it = o.repeat ?? 1;
      const t0 = { duration: d, easing: easing(o.ease), iterations: it, direction: o.yoyo ? 'alternate' : 'normal' };
      for (let i = 0; i < els.length; i++) {
        const delay = s + offs[i];
        if (entries.length && delay < entries[entries.length - 1].delay) sorted = false;
        entries.push({ el: els[i], i, kf, from, fill: 'both', t: t0, delay, anim: null, prev: null });
      }
      const e = s + Math.max(0, ...offs) + d * it;
      lastStart = s; lastEnd = e; end = Math.max(end, e);
      if (rendered) { materialize(Infinity); }   // إضافة بعد البدء: تُنشأ فوراً
      later(); kick();
      return api;
    }
    function kick() { if (!started && !opt.paused) { started = true; queueMicrotask(() => reduce ? api.seek(D) : api.play()); } }
    function settle() { while (waiters.length) waiters.shift()(); }
    let lastT = 0;
    function watch() {
      cancelAnimationFrame(raf);
      const tick = () => {
        const t = getTime();
        if (rate > 0) materialize(t + H * rate);
        calls.forEach(c => { if ((rate > 0 && lastT < c.t && t >= c.t) || (rate < 0 && lastT > c.t && t <= c.t)) c.fn(); });
        lastT = t; if (opt.onUpdate) opt.onUpdate(D ? t / D : 1, t);
        if ((rate > 0 && t >= D) || (rate < 0 && t <= 0)) {
          if (rep !== 0) { if (rep > 0) rep--; if (opt.yoyo) api.reverse(); else { api.seek(0); api.play(); } return; }
          tBase = t; playing = false; settle();
          if (opt.onComplete && rate > 0) opt.onComplete();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    function run(t, r) {
      rate = r; tBase = t; tStamp = now(); playing = true;
      materialize(r > 0 ? t + H * r : Infinity); hold();
      for (const e of entries) if (e.anim) { const a = e.anim; a.playbackRate = rate; a.startTime = start(); }
      lastT = t; watch();
    }
    const api = {
      from(t, from, o, at) { const f = frame(from); return push(list(t), [f, rest(f)], o, at, f); },
      to(t, state, o, at) { return push(list(t), frame(state), o, at, null); },   // إطار واحد: يبدأ المتصفح من القيمة الحالية بلا قراءة منّا
      fromTo(t, a, b, o, at) { const f = frame(a); return push(list(t), [f, frame(b)], o, at, f); },
      animate(t, keyframes, o, at) { const f0 = Array.isArray(keyframes) && keyframes.length > 1 ? keyframes[0] : null; return push(list(t), keyframes, o, at, f0); },
      add(control, at) {
        const s = where(at);
        (control.animations || []).forEach(a => { a.pause(); const tm = a.effect.getTiming(); entries.push({ el: a.effect.target, i: 0, kf: null, from: null, fill: tm.fill, t: { duration: tm.duration, easing: tm.easing, iterations: tm.iterations, direction: tm.direction }, delay: s + (tm.delay || 0), anim: a }); a.effect.updateTiming({ delay: s + (tm.delay || 0) }); });
        sorted = false; end = Math.max(end, s + (control.duration || 0)); later(); kick(); return api;
      },
      label(name, at) { labels[name] = where(at); return api; },
      call(fn, at) { calls.push({ t: where(at), fn }); later(); kick(); return api; },
      play() { ready(); const t = getTime(); run(t >= D ? 0 : t, Math.abs(rate)); return api; },
      pause() { ready(); tBase = getTime(); playing = false; created().forEach(a => { a.pause(); a.currentTime = tBase; }); cancelAnimationFrame(raf); return api; },
      reverse() { ready(); const t = getTime(); run(t <= 0 ? D : t, -Math.abs(rate)); return api; },
      seek(t) {
        ready(); t = typeof t === 'string' ? where(t) : clamp(t, 0, D);
        playing = false; tBase = t; materialize(t); hold();
        created().forEach(a => { a.pause(); a.currentTime = rate < 0 && t > 0 ? t - 0.01 : t; });
        calls.forEach(c => { if (lastT < c.t && t >= c.t) c.fn(); }); lastT = t; cancelAnimationFrame(raf);
        if (opt.onUpdate) opt.onUpdate(D ? t / D : 1, t);
        if (t >= D) settle();
        return api;
      },
      progress(p) { ready(); return api.seek(clamp(p, 0, 1) * D); },
      timeScale(r) { ready(); const t = getTime(), sg = Math.sign(rate || 1); if (playing) run(t, sg * r); else { rate = sg * r; created().forEach(a => a.playbackRate = rate); } return api; },
      kill() { cancelAnimationFrame(raf); playing = false; entries.forEach(e => { if (e.anim) e.anim.cancel(); if (e.prev) for (const k in e.prev) e.el.style[k] = e.prev[k]; }); entries.length = 0; settle(); },
      get time() { ready(); return getTime(); },
      get duration() { ready(); return D; },
      get labels() { return { ...labels }; },
      get finished() { ready(); return (!playing && tBase >= D && rendered) ? Promise.resolve() : new Promise(r => waiters.push(r)); }
    };
    return api;
  }

  /* ── FLIP: نقيس، نغيّر التخطيط، نقيس، ثم نحرّك الفرق بـtransform فقط ── */
  function flip(targets, mutate, o) {
    o = o || {};
    const before = new Map(list(targets).map(el => [el, el.getBoundingClientRect()]));
    mutate();
    const after = list(o.targets || targets);
    if (RM() && !o.force) return NONE;
    const offs = offsets(after, o.stagger), anims = [];
    after.forEach((el, i) => {
      const f = before.get(el), l = el.getBoundingClientRect();
      if (!l.width && !l.height) return;
      const base = { duration: dur(o, 650), easing: easing(o.ease || 'expo'), delay: (o.delay ?? 0) + offs[i] };
      if (!f) { const e = frame(o.enter || { opacity: 0, scale: 0.85 }); anims.push(el.animate([e, rest(e)], { ...base, fill: 'backwards' })); return; }
      const dx = f.left - l.left, dy = f.top - l.top, sx = o.scale === false ? 1 : f.width / l.width, sy = o.scale === false ? 1 : f.height / l.height;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.005 && Math.abs(sy - 1) < 0.005) return;
      anims.push(el.animate([{ transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transformOrigin: '0 0', transform: 'none' }], base));
    });
    return group(anims);
  }

  /* ── رسم مسارات SVG بخط القلم ── */
  function draw(targets, o) {
    o = o || {};
    const els = list(targets);
    const lens = els.map(p => { const L = p.getTotalLength ? p.getTotalLength() : 0; p.style.strokeDasharray = L + ' ' + L; return L; });
    if (RM() && !o.force) { els.forEach(p => { p.style.strokeDasharray = ''; }); return NONE; }
    return group(run(els, (el, i) => o.reverse ? [{ strokeDashoffset: 0 }, { strokeDashoffset: lens[i] }] : [{ strokeDashoffset: lens[i] }, { strokeDashoffset: 0 }], { duration: 1400, ease: 'inOut', ...o }, o.reverse ? 'forwards' : 'backwards'));
  }

  /* ── تحويل شكل إلى شكل: نعيد أخذ عيّنات المسارين بعدد نقاط واحد، ونختار نقطة البداية والاتجاه الأقرب ── */
  const SVGNS = 'http://www.w3.org/2000/svg';
  function samples(d, n) {
    const svg = doc.createElementNS(SVGNS, 'svg'), p = doc.createElementNS(SVGNS, 'path');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    p.setAttribute('d', d); svg.appendChild(p); doc.body.appendChild(svg);
    const L = p.getTotalLength(), pts = [];
    for (let i = 0; i < n; i++) { const q = p.getPointAtLength(L * i / n); pts.push([q.x, q.y]); }
    svg.remove(); return pts;
  }
  function align(a, b) {
    const n = a.length; let best = Infinity, out = b;
    for (const cand of [b, b.slice().reverse()]) for (let s = 0; s < n; s++) {
      let sum = 0; for (let i = 0; i < n; i++) { const q = cand[(i + s) % n]; sum += (a[i][0] - q[0]) ** 2 + (a[i][1] - q[1]) ** 2; }
      if (sum < best) { best = sum; out = cand.map((_, i) => cand[(i + s) % n]); }
    }
    return out;
  }
  const poly = (pts) => 'M' + pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' L') + ' Z';
  /* إطارا التحويل جاهزين لخط زمني: { a, b, css } — css=false في المتصفحات التي لا تحرّك خاصية d */
  function morphFrames(fromD, toD, n) { n = n || 96; const a = samples(fromD, n); return { a: poly(a), b: poly(align(a, samples(toD, n))), css: supports('d', 'path("M0 0")') }; }
  function morph(path, toD, o) {
    o = o || {};
    const n = o.points || 96, from = path.getAttribute('d');
    const a = samples(from, n), b = align(a, samples(toD, n));
    const A = poly(a), B = poly(b);
    const done = () => path.setAttribute('d', o.keep === 'samples' ? B : toD);
    if (RM() && !o.force) { done(); return NONE; }
    if (supports('d', 'path("M0 0")')) {
      path.setAttribute('d', A);
      const an = path.animate([{ d: `path("${A}")` }, { d: `path("${B}")` }], { duration: dur(o, 900), easing: easing(o.ease || 'inOut'), delay: o.delay ?? 0, fill: 'forwards' });
      an.finished.then(() => { done(); an.cancel(); }, () => {});
      return group([an]);
    }
    let raf = 0; const t0 = performance.now() + (o.delay ?? 0), D = dur(o, 900);   // Safari: بلا خاصية d في CSS
    const fin = new Promise(res => { const tick = (t) => { const k = clamp((t - t0) / D, 0, 1), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; path.setAttribute('d', poly(a.map((p, i) => [p[0] + (b[i][0] - p[0]) * e, p[1] + (b[i][1] - p[1]) * e]))); if (k < 1) raf = requestAnimationFrame(tick); else { done(); res(); } }; raf = requestAnimationFrame(tick); });
    return { animations: [], finished: fin, cancel() { cancelAnimationFrame(raf); }, pause() {}, play() {} };
  }

  /* ── الحركة على مسار: CSS offset-path يرسمه المتصفح على الخيط المركّب، بلا حساب نقاط في كل إطار ── */
  function along(targets, d, o) {
    o = o || {};
    const els = list(targets);
    els.forEach(el => { el.style.offsetPath = `path("${d}")`; el.style.offsetRotate = o.rotate === false ? '0deg' : 'auto'; if (o.anchor) el.style.offsetAnchor = o.anchor; });
    if (RM() && !o.force) { els.forEach(el => el.style.offsetDistance = (o.end ?? 100) + '%'); return NONE; }
    return group(run(els, [{ offsetDistance: (o.start ?? 0) + '%' }, { offsetDistance: (o.end ?? 100) + '%' }], { duration: 1600, ease: 'inOut', ...o }, 'both'));
  }

  /* ── عند الظهور في الشاشة ── */
  function onView(el, cb, o) {
    o = o || {};
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { cb(e.target); if (o.once !== false) io.unobserve(e.target); } else if (o.leave) o.leave(e.target); });
    }, { threshold: o.threshold ?? 0, rootMargin: `0px 0px -${Math.round((o.at ?? 0.3) * 100)}% 0px` });
    list(el).forEach(x => io.observe(x));
    return () => io.disconnect();
  }

  /* ── التقدّم مع التمرير: مستمع واحد خامل مشترك، ودفعة واحدة لكل إطار ── */
  const progressSubs = new Set();
  let ticking = false;
  function flush() {
    ticking = false;
    const vh = root.innerHeight;
    progressSubs.forEach(s => {
      const r = s.track.getBoundingClientRect();
      const run = s.mode === 'through' ? r.height + vh : Math.max(1, r.height - vh);
      const p = clamp((s.mode === 'through' ? vh - r.top : -r.top) / run, 0, 1);
      if (p !== s.last) { s.last = p; s.cb(p); }
    });
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(flush); } };
  function progress(track, cb, o) {
    const s = { track: list(track)[0], cb, last: -1, mode: (o && o.mode) || 'pinned' };
    if (!progressSubs.size) { root.addEventListener('scroll', request, { passive: true }); root.addEventListener('resize', request, { passive: true }); }
    progressSubs.add(s); request();
    return () => { progressSubs.delete(s); if (!progressSubs.size) { root.removeEventListener('scroll', request); root.removeEventListener('resize', request); } };
  }
  /* اربط خطاً زمنياً أو حركة بمسار تمرير */
  function link(control, track, o) {
    o = o || {};
    if (control.seek) { control.pause(); return progress(track, p => control.progress(p), o); }
    const anims = control.animations || [];
    anims.forEach(a => a.pause());
    return progress(track, p => anims.forEach(a => { const t = a.effect.getComputedTiming(); a.currentTime = p * t.endTime; }), o);
  }

  /* حركة مربوطة بالتمرير: أصلية بـViewTimeline إن دعمها المتصفح (Baseline منذ أكتوبر ٢٠٢٦)، وإلا فبـprogress */
  const native = () => typeof root.ViewTimeline === 'function';
  function scrub(targets, keyframes, o) {
    o = o || {};
    const els = list(targets);
    if (RM() && !o.force) return () => {};
    if (native() && !o.js) {
      const anims = els.map((el, i) => el.animate(typeof keyframes === 'function' ? keyframes(el, i) : keyframes, {
        timeline: new root.ViewTimeline({ subject: o.subject || el, axis: o.axis || 'block' }), fill: 'both',
        rangeStart: (o.range || [])[0] || 'entry 0%', rangeEnd: (o.range || [])[1] || 'cover 50%', easing: easing(o.ease || 'linear')
      }));
      return () => anims.forEach(a => a.cancel());
    }
    const offs = els.map((el, i) => {
      const a = el.animate(typeof keyframes === 'function' ? keyframes(el, i) : keyframes, { duration: 1000, fill: 'both', easing: easing(o.ease || 'linear') });
      a.pause();
      return progress(o.subject || el, (p) => { a.currentTime = p * 1000; }, { mode: o.mode || 'through' });
    });
    return () => offs.forEach(f => f());
  }

  /* ── المؤشر: تتبع بلا اهتزاز، ويسكن على اللمس ومع تقليل الحركة ── */
  function pointerVars(el, o) {
    o = o || {};
    const els = list(el);
    const move = (e) => { const t = e.currentTarget, r = t.getBoundingClientRect(); t.style.setProperty('--mx', ((e.clientX - r.left) / r.width).toFixed(3)); t.style.setProperty('--my', ((e.clientY - r.top) / r.height).toFixed(3)); t.style.setProperty('--mi', '1'); };
    const out = (e) => e.currentTarget.style.setProperty('--mi', '0');
    els.forEach(x => { x.addEventListener('pointermove', move, { passive: true }); x.addEventListener('pointerleave', out, { passive: true }); });
    return () => els.forEach(x => { x.removeEventListener('pointermove', move); x.removeEventListener('pointerleave', out); });
  }
  function follow(el, fn, o) {   // fn(nx, ny) → إطار؛ nx وny من −١ إلى ١
    o = o || {};
    const els = list(el), offs = [];
    if (COARSE() || (RM() && !o.force)) return () => {};
    els.forEach(x => {
      let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
      const area = o.area ? o.area(x) : x;
      const step = () => { cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18; Object.assign(x.style, frame(fn(cx, cy))); raf = (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002) ? requestAnimationFrame(step) : 0; };
      const move = (e) => { const r = area.getBoundingClientRect(); tx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1); ty = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1); if (!raf) raf = requestAnimationFrame(step); };
      const leave = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); };
      area.addEventListener('pointermove', move, { passive: true }); area.addEventListener('pointerleave', leave, { passive: true });
      offs.push(() => { cancelAnimationFrame(raf); area.removeEventListener('pointermove', move); area.removeEventListener('pointerleave', leave); x.style.transform = ''; });
    });
    return () => offs.forEach(f => f());
  }
  const magnetic = (el, o) => { o = o || {}; const s = o.strength ?? 10; return follow(el, (x, y) => ({ x: x * s, y: y * s * 0.7 }), o); };
  const tilt = (el, o) => { o = o || {}; const m = o.max ?? 7; return follow(el, (x, y) => ({ rotateY: x * m, rotateX: -y * m }), o); };

  /* ── عدّاد بأرقام عربية أو لاتينية ── */
  function countUp(el, target, o) {
    o = o || {};
    const nf = new Intl.NumberFormat(o.locale || 'ar-SA', { maximumFractionDigits: o.decimals ?? 0, minimumFractionDigits: o.decimals ?? 0 });
    const from = o.from ?? 0, D = o.duration ?? 1600, fmt = (v) => (o.prefix || '') + nf.format(v) + (o.suffix || '');
    if (RM() && !o.force) { el.textContent = fmt(target); return Promise.resolve(); }
    el.style.fontVariantNumeric = 'tabular-nums';
    return new Promise(res => { const t0 = performance.now() + (o.delay ?? 0); const tick = (t) => { const k = clamp((t - t0) / D, 0, 1), e = 1 - Math.pow(1 - k, 4); el.textContent = fmt(from + (target - from) * e); if (k < 1) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
  }

  /* ── شريط متحرك بلا نهاية: ننسخ المحتوى حتى يملأ ضعف العرض، ونحرّكه بـWAAPI ── */
  function marquee(el, o) {
    o = o || {};
    const track = el.firstElementChild;
    if (!track || RM()) return NONE;
    const base = [...track.children];
    while (track.scrollWidth < el.clientWidth * 2 + 1 && base.length) base.forEach(c => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); track.appendChild(k); });
    [...track.children].forEach(c => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); track.appendChild(k); });
    const half = track.scrollWidth / 2, dir = (getComputedStyle(el).direction === 'rtl' ? 1 : -1) * (o.reverse ? -1 : 1);
    const a = track.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dir * half}px)` }], { duration: half / (o.speed ?? 50) * 1000, iterations: Infinity, easing: 'linear' });
    if (o.hoverPause !== false) { el.addEventListener('pointerenter', () => a.updatePlaybackRate(0.15)); el.addEventListener('pointerleave', () => a.updatePlaybackRate(1)); }
    return group([a]);
  }

  /* ── شروط الوسائط: يعيد البناء عند تغيّر تفضيل المستخدم، وينظّف ما قبله ── */
  function media(queries, setup) {
    const mqs = Object.entries(queries).map(([k, q]) => [k, root.matchMedia(q)]);
    let cleanup = null;
    const runit = () => {
      if (typeof cleanup === 'function') cleanup();
      const c = {}; mqs.forEach(([k, m]) => c[k] = m.matches);
      cleanup = setup(c);
    };
    mqs.forEach(([, m]) => m.addEventListener('change', runit));
    runit();
    return () => { mqs.forEach(([, m]) => m.removeEventListener('change', runit)); if (typeof cleanup === 'function') cleanup(); };
  }

  /* ── تمرير ناعم بالعجلة فقط. لا يلمس اللمس ولا لوحة المفاتيح ولا الشريط، ويتوقف مع تقليل الحركة
        وفوق العناصر القابلة للتمرير أو المعلَّمة بـdata-pen-prevent، ومع Ctrl (التكبير). ── */
  function smooth(o) {
    o = o || {};
    const k = clamp(o.ease ?? 0.12, 0.02, 1);
    let target = root.scrollY, current = target, raf = 0, ours = -1, on = true;
    const max = () => doc.documentElement.scrollHeight - root.innerHeight;
    const scrollable = (el, dy) => {
      for (; el && el !== doc.body; el = el.parentElement) {
        if (el.hasAttribute && el.hasAttribute('data-pen-prevent')) return true;
        const s = getComputedStyle(el).overflowY;
        if ((s === 'auto' || s === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
        }
      }
      return false;
    };
    function step() {
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.5) current = target;
      ours = Math.round(current);
      root.scrollTo(0, current);
      raf = current !== target ? requestAnimationFrame(step) : 0;
    }
    function wheel(e) {
      if (!on || RM() || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || scrollable(e.target, e.deltaY)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? root.innerHeight : 1;
      if (!raf) { target = current = root.scrollY; }
      target = clamp(target + e.deltaY * unit, 0, max());
      if (!raf) raf = requestAnimationFrame(step);
    }
    function nativeScroll() { if (Math.abs(root.scrollY - ours) > 2 && !raf) { target = current = root.scrollY; } }
    root.addEventListener('wheel', wheel, { passive: false });
    root.addEventListener('scroll', nativeScroll, { passive: true });
    return {
      get active() { return on && !RM(); },
      scrollTo(el, off) {
        const y = typeof el === 'number' ? el : el.getBoundingClientRect().top + root.scrollY + (off || 0);
        if (RM()) { root.scrollTo(0, y); return; }
        target = clamp(y, 0, max()); current = root.scrollY; if (!raf) raf = requestAnimationFrame(step);
      },
      stop() { on = false; cancelAnimationFrame(raf); raf = 0; root.removeEventListener('wheel', wheel); root.removeEventListener('scroll', nativeScroll); }
    };
  }

  const API = { enter, to, tween, animate, timeline, flip, draw, morph, morphFrames, along, onView, progress, link, scrub, pointerVars, follow, magnetic, tilt, countUp, marquee, media, smooth, spring, offsets, EASE, reducedMotion: RM, nativeScroll: native, config: CFG, version: '2.1.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PenMotion = API;
})(typeof self !== 'undefined' ? self : this);

/* puretk.sa — motion. One orchestrated moment on load (the plate is read, then the name forms),
   plus small reveals that carry meaning. Built on 11Pen PenMotion + ArabicSplit; nothing is hidden without JS,
   and with reduced motion the page stays still and complete. */
(function () {
  var P = window.PenMotion, S = window.ArabicSplit;
  if (!P || !S) return;
  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || doc).querySelectorAll(s)); };

  P.media({ motion: '(prefers-reduced-motion: no-preference)' }, function (c) {
    if (!c.motion) return;
    root.classList.add('js-motion');
    var split = null;

    /* ── the one moment: scan → read → name ── */
    var hero = $('.hero');
    if (hero) {
      var h1 = $('h1', hero);
      var start = function () {
        split = S.split(h1, { type: 'chars' });
        var tl = P.timeline();
        tl.from('.scanner .c1', { x: 16, y: -16, opacity: 0 }, { duration: 700, ease: 'expo' })
          .from('.scanner .c2', { x: -16, y: -16, opacity: 0 }, { duration: 700, ease: 'expo' }, '<')
          .from('.scanner .c3', { x: 16, y: 16, opacity: 0 }, { duration: 700, ease: 'expo' }, '<')
          .from('.scanner .c4', { x: -16, y: 16, opacity: 0 }, { duration: 700, ease: 'expo' }, '<')
          .from('.scanner .plate', { y: 14, opacity: 0 }, { duration: 700 }, '<+=120')
          .from('.scanner .num', { opacity: 0 }, { duration: 420, stagger: 120 }, '>-=120')
          .from('.scanner .let span', { y: 10, opacity: 0 }, { duration: 420, stagger: 70 }, '<+=80')
          .from('.readout', { y: 8, opacity: 0 }, { duration: 600 }, '>-=100')
          .from(split.chars, { yPercent: 90, opacity: 0 }, { ease: P.spring({ stiffness: 170, damping: 22 }), stagger: 26 }, '<-=380')
          .from('.hero .tg', { y: 10, opacity: 0 }, { duration: 700 }, '>-=500');
      };
      (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(start);
    }

    /* ── reveals that carry meaning ── */
    var js = $('.journey');
    if (js) P.onView(js, function () {
      js.classList.add('in');
      P.enter($$('.step', js), { from: { y: 18, opacity: 0 }, stagger: 140, duration: 700 });
    });
    var fs = $('.fde-steps');
    if (fs) P.onView(fs, function () {
      fs.classList.add('in');
      P.enter($$('li', fs), { from: { y: 16, opacity: 0 }, stagger: 120, duration: 700 });
    });
    $$('[data-count]').forEach(function (el) {
      P.onView(el, function () {
        P.countUp(el, +el.getAttribute('data-count'), { locale: root.lang === 'ar' ? 'ar-SA' : 'en-US', duration: 1200 });
      });
    });

    return function () { if (split) split.revert(); root.classList.remove('js-motion'); };
  });
})();

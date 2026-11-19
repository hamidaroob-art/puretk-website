/* arabic-split.js — تقسيم النص العربي إلى كلمات وحروف دون كسر الاتصال (١١قلم، بلا اعتماديات)
   المشكلة: كل أدوات التقسيم (GSAP SplitText، React Bits SplitText، Splitting.js) تضع كل حرف في عنصر مستقل،
   فيفقد المتصفح سياق الحرف ويرسمه بشكله المنفصل: «صمّم» تصير «ص م ّم». جرّبناه على GSAP 3.15.1.
   الحل: نضع «الوصلة الصفرية» ZWJ (U+200D) على الجانب الذي يتصل منه الحرف، فيُرسم بشكله المتصل
   داخل عنصره، ويبقى كل حرف قابلاً للتحريك وحده.

   const s = ArabicSplit.split(el, { type: 'chars' | 'words' });
   PenMotion.enter(s.chars, { from: { yPercent: 60, opacity: 0 }, stagger: 30 });   // أو أي محرك حركة
   s.revert();

   القواعد: الحركات (الشدة والفتحة…) تبقى مع حرفها · «لا» رباط واحد · الأرقام واللاتيني كتلة واحدة معزولة الاتجاه · الحروف التي لا تتصل بما بعدها (ا أ إ آ د ذ ر ز و ؤ ء ة ى)
   لا تأخذ وصلة بعدها · الكلمة كاملة داخل عنصر nowrap حتى لا تنكسر بين سطرين · aria-label على الأصل والأجزاء aria-hidden. */
(function (root) {
  'use strict';
  const AR = /[\u0620-\u064A\u066E-\u06D3\u06D5\u06FA-\u06FC\u0750-\u077F\u08A0-\u08FF]/;
  const MARK = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/;
  const NO_JOIN_AFTER = /[\u0621-\u0623\u0625\u0627\u0629\u062F-\u0632\u0648\u0624\u0649\u0671-\u0673\u0675\u0688-\u0699\u06C0-\u06CB\u06CD\u06CF\u06D2\u06D3\u06D5]/;
  const ZWJ = '\u200D';
  const TATWEEL = '\u0640';

  const joinsAfter = (ch) => !!ch && (AR.test(ch) || ch === TATWEEL) && !NO_JOIN_AFTER.test(ch) && ch !== 'ء';
  const joinsBefore = (ch) => !!ch && (AR.test(ch) || ch === TATWEEL) && ch !== 'ء';

  // عناقيد الكلمة: حرف عربي مع حركاته · «لا» وأخواتها عنقود واحد (رباط لام ألف) · تتابع غير عربي (أرقام، لاتيني) عنقود واحد
  function clusters(word) {
    const out = [];
    for (const ch of word) {
      const last = out[out.length - 1];
      if ((MARK.test(ch) || ch === ZWJ) && last) { out[out.length - 1] = last + ch; continue; }
      if (last && /[\u0622\u0623\u0625\u0627]/.test(ch) && last.replace(MARK, '')[0] === '\u0644' && !/[\u0622\u0623\u0625\u0627]/.test(last.slice(-1))) { out[out.length - 1] = last + ch; continue; }
      if (last && !AR.test(ch) && ch !== TATWEEL && !AR.test(last[0]) && last[0] !== TATWEEL) { out[out.length - 1] = last + ch; continue; }
      out.push(ch);
    }
    return out;
  }

  function split(el, opts) {
    opts = opts || {};
    const type = opts.type || 'chars';
    const original = el.innerHTML;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    const words = text.split(' ');
    el.textContent = '';
    if (opts.aria !== false) el.setAttribute('aria-label', text);
    const out = { words: [], chars: [], el, revert() { el.innerHTML = original; if (opts.aria !== false) el.removeAttribute('aria-label'); } };

    words.forEach((w, wi) => {
      const ws = document.createElement('span');
      ws.className = opts.wordClass || 'as-word';
      ws.style.display = 'inline-block';
      ws.style.whiteSpace = 'nowrap';
      if (opts.aria !== false) ws.setAttribute('aria-hidden', 'true');
      if (type === 'words') {
        ws.textContent = w;
      } else {
        const g = clusters(w);
        g.forEach((c, i) => {
          const base = c[0], prev = g[i - 1] && g[i - 1][g[i - 1].replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u200D]+$/, '').length - 1], next = g[i + 1] && g[i + 1][0];
          const left = joinsAfter(prev) && joinsBefore(base);      // يتصل بما قبله
          const right = joinsAfter(base) && joinsBefore(next);     // يتصل بما بعده
          const cs = document.createElement('span');
          cs.className = opts.charClass || 'as-char';
          cs.style.display = 'inline-block';
          cs.textContent = (left ? ZWJ : '') + c + (right ? ZWJ : '');
          if (!AR.test(base) && base !== TATWEEL) { cs.dir = 'auto'; cs.style.unicodeBidi = 'isolate'; }   // أرقام ولاتيني: عنقود واحد معزول الاتجاه
          ws.appendChild(cs);
          out.chars.push(cs);
        });
      }
      el.appendChild(ws);
      out.words.push(ws);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return out;
  }

  const API = { split, clusters, joinsAfter, joinsBefore };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ArabicSplit = API;
})(typeof self !== 'undefined' ? self : this);

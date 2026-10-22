// Live debate: plays each .debate chat with a typing effect when it scrolls into view.
// Without JS, or with reduced motion, every message just shows.
(function () {
  if (!window.IntersectionObserver || !window.matchMedia) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  [].forEach.call(document.querySelectorAll('.debate'), function (box) {
    var msgs = [].slice.call(box.querySelectorAll('.msg'));
    var replay = box.querySelector('.debate-replay');
    var texts = msgs.map(function (m) { return m.querySelector('.bubble').textContent; });
    var timers = [], run = 0;

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function reset() {
      run++;
      timers.forEach(clearTimeout); timers = [];
      msgs.forEach(function (m, i) {
        m.classList.remove('shown', 'typing');
        m.querySelector('.bubble').textContent = texts[i];
      });
      box.classList.add('is-playing');
    }
    // Typed text plus the untyped rest kept invisible, so the bubble never changes size
    function type(m, text, done) {
      var b = m.querySelector('.bubble'), n = 0, id = run;
      var shown = document.createElement('span'), rest = document.createElement('span');
      rest.className = 'rest'; rest.textContent = text;
      b.textContent = ''; b.appendChild(shown); b.appendChild(rest);
      m.classList.add('shown', 'typing');
      (function step() {
        if (id !== run) return;
        n = Math.min(text.length, n + 2);
        shown.textContent = text.slice(0, n);
        rest.textContent = text.slice(n);
        if (n < text.length) later(step, 22);
        else { b.textContent = text; m.classList.remove('typing'); done(); }
      })();
    }
    function play() {
      reset();
      var i = 0;
      (function next() {
        if (i >= msgs.length) { if (replay) replay.hidden = false; return; }
        var m = msgs[i], t = texts[i++];
        if (m.classList.contains('judge')) {
          later(function () { m.classList.add('shown'); later(next, 900); }, 500);
        } else {
          later(function () { type(m, t, function () { later(next, 450); }); }, 350);
        }
      })();
    }

    box.classList.add('is-playing');
    new IntersectionObserver(function (entries, obs) {
      if (entries[0].isIntersecting) { obs.disconnect(); play(); }
    }, { threshold: 0.35 }).observe(box);
    if (replay) replay.addEventListener('click', play);
  });
})();

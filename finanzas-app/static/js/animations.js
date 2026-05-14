// animations.js — Utilidades de animación compartidas
(function injectStyles() {
  if (document.getElementById('_anim-styles')) return;
  const s = document.createElement('style');
  s.id = '_anim-styles';
  s.textContent = `
    @keyframes _fadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes _rowIn {
      from { opacity: 0; transform: translateX(-6px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes _goalPop {
      0%,100% { transform: scale(1); }
      50%      { transform: scale(1.04); }
    }
    .anim-enter { animation: _fadeUp 0.35s ease both; }
    .anim-row-in { animation: _rowIn 0.22s ease both; }
    .anim-goal-pop { animation: _goalPop 0.4s ease; }
  `;
  document.head.appendChild(s);
})();

function staggerFadeIn(selector, step = 70) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.style.animationDelay = `${i * step}ms`;
    el.classList.add('anim-enter');
  });
}

function animateCounter(el, target, fmt, duration = 750) {
  const abs = Math.abs(target);
  const sign = target < 0 ? -1 : 1;
  const start = performance.now();
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = fmt(sign * abs * ease(t));
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = fmt(target);
  }
  requestAnimationFrame(tick);
}

function animateProgressBar(barEl, targetPct) {
  barEl.style.width = '0%';
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      requestAnimationFrame(() => {
        barEl.style.transition = 'width 0.65s cubic-bezier(0.4,0,0.2,1)';
        barEl.style.width = Math.min(targetPct, 100) + '%';
      });
      obs.unobserve(barEl);
    }
  }, { threshold: 0.1 });
  obs.observe(barEl);
}

function animateRowIn(tr) {
  tr.classList.add('anim-row-in');
}

function animateRowOut(tr, cb) {
  tr.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
  tr.style.opacity = '0';
  tr.style.transform = 'translateX(-8px)';
  setTimeout(cb, 240);
}

function animateGoalComplete(cardEl) {
  cardEl.classList.remove('anim-goal-pop');
  void cardEl.offsetWidth;
  cardEl.classList.add('anim-goal-pop');
}

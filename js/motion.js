// Page transitions and Apple-style scroll reveals.
// Content is only hidden once this script runs, so pages still work if it fails.

const REVEAL_TARGETS = 'main .card, main .workout-section, main .setting-group, main .program-item, main .worship-series, main .deck, main .focus-stat, main .history-stat, main .exercise-item';
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';

export function initPageTransitions() {
  // Show the loading screen before leaving for another Lassitude page.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();
    if (reducedMotion()) { location.href = url.href; return; }
    document.documentElement.classList.add('is-leaving');
    window.setTimeout(() => { location.href = url.href; }, 240);
  });
  // Coming back with the browser's Back button restores the page from cache; clear the overlay.
  addEventListener('pageshow', event => { if (event.persisted) document.documentElement.classList.remove('is-leaving'); });
}

export function initReveal() {
  if (reducedMotion() || !('IntersectionObserver' in window)) return;
  const root = document.documentElement;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      element.classList.add('is-in');
      observer.unobserve(element);
      // Drop the reveal transition afterwards so hover effects keep their own timing.
      element.addEventListener('transitionend', () => { element.classList.remove('reveal', 'is-in'); element.style.removeProperty('--reveal-delay'); }, { once: true });
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  const prepare = () => {
    const fold = innerHeight * 0.92;
    const siblings = new Map();
    document.querySelectorAll(REVEAL_TARGETS).forEach(element => {
      if (element.dataset.revealed || element.closest('dialog, .coach-log, .nadir-log, .note-editor, .flashcard')) return;
      element.dataset.revealed = 'true';
      // Anything already on screen when the page opens is left alone, so nothing pops in late.
      if (element.getBoundingClientRect().top < fold) return;
      const index = siblings.get(element.parentElement) || 0;
      siblings.set(element.parentElement, index + 1);
      element.style.setProperty('--reveal-delay', `${Math.min(index, 3) * 0.08}s`);
      element.classList.add('reveal');
      observer.observe(element);
    });
  };
  root.classList.add('reveal-on');
  prepare();
  // Some pages render cards after their data loads.
  window.setTimeout(prepare, 400);
  window.setTimeout(prepare, 1200);
}

// A soft "liquid mesh" behind every page: four blurred color blobs that slowly morph,
// drift with scroll position, and shift hue as a new section comes into view.
// Everything is CSS transforms on one fixed layer, so it stays cheap to render.

const SECTIONS = 'main > section, main > div > section, main .card, main .workout-section, main .settings-panel, main .focus-panel, main .setting-group';
const HUE_STEP = 34;

export function initMesh() {
  if (document.querySelector('.mesh')) return;
  const mesh = document.createElement('div');
  mesh.className = 'mesh';
  mesh.setAttribute('aria-hidden', 'true');
  for (let index = 1; index <= 4; index += 1) {
    const blob = document.createElement('span');
    blob.className = `mesh-blob mesh-blob-${index}`;
    mesh.append(blob);
  }
  document.body.prepend(mesh);

  const root = document.documentElement;
  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const max = Math.max(1, root.scrollHeight - innerHeight);
      mesh.style.setProperty('--scroll', (scrollY / max).toFixed(4));
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  // Shift the palette when a different section reaches the middle of the screen.
  const sections = new Map();
  let current = -1;
  const setSection = index => {
    if (index === current) return;
    current = index;
    mesh.style.setProperty('--section-hue', `${(index * HUE_STEP) % 360}deg`);
    mesh.style.setProperty('--section-shift', String(index % 2 ? 1 : -1));
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) setSection(sections.get(entry.target) ?? 0); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  const watch = () => {
    document.querySelectorAll(SECTIONS).forEach(element => {
      if (sections.has(element) || element.closest('dialog')) return;
      sections.set(element, sections.size);
      observer.observe(element);
    });
  };
  watch();
  // Pages render some sections after load (cards, settings panels, focus tabs).
  new MutationObserver(() => watch()).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
  document.addEventListener('focus-tab', event => setSection(['timer', 'notes', 'study'].indexOf(event.detail) * 3 + 1));
  setSection(0);
}

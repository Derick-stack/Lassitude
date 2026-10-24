import { getDayKey, getState, subscribe } from './store.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2), value);
    else if (value !== false && value != null) element.setAttribute(key, value === true ? '' : String(value));
  }
  element.append(...children.flat().filter(child => child != null));
  return element;
}

const iconPaths = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6',
  start: 'M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  focus: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  progress: 'M4 19V5m0 14h17M8 15l3-4 3 2 5-7',
  future: 'M12 3v18m-9-9h18M5.6 5.6l12.8 12.8m0-12.8L5.6 18.4',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64',
  calendar: 'M8 3v4m8-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Zm2 8h3m2 0h3m-8 4h3',
  workouts: 'M6 8v8m12-8v8M3 10v4m18-4v4M6 12h12M6 6v12m12-12v12',
  habits: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  faith: 'M12 3v18m-7-11h14m-12-4h10',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  menu: 'M4 6h16M4 12h16M4 18h16'
};

export function icon(name) {
  // SVG must be created in the SVG namespace; document.createElement('svg') renders nothing.
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', iconPaths[name] || iconPaths.home);
  svg.append(path);
  return svg;
}

function renderStats() {
  const state = getState();
  const level = Math.floor(state.xp / 100) + 1;
  let streak = 0;
  const date = new Date();
  const completed = key => Object.values(state.habits[key] || {}).some(Boolean);
  if (!completed(getDayKey(date))) date.setDate(date.getDate() - 1);
  while (completed(getDayKey(date))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  $$('[data-stat]').forEach(element => {
    const key = element.dataset.stat;
    element.textContent = key === 'xp' ? String(state.xp) : key === 'level' ? String(level) : String(streak);
  });
}

export function mountShell() {
  const header = $('#site-header');
  const navItems = [
    ['index.html', 'Home', 'home'], ['start.html', 'Start', 'start'],
    ['focus.html', 'Focus', 'focus'], ['calendar.html', 'Calendar', 'calendar'], ['workouts.html', 'Workouts', 'workouts'], ['progress.html', 'Progress', 'progress'],
    ['faith.html', 'Faith', 'faith'], ['habits.html', 'Habits', 'habits'],
    ['future.html', 'Future', 'future'], ['settings.html', 'Settings', 'settings']
  ];
  const current = location.pathname.split('/').pop() || 'index.html';
  if (header) {
    const nav = h('nav', { id: 'main-nav', class: 'nav-links', 'aria-label': 'Main navigation' },
      navItems.map(([url, label, symbol]) => h('a', { href: url, ...(url === current ? { 'aria-current': 'page' } : {}) }, icon(symbol), h('span', {}, label))));
    const menu = h('button', { class: 'nav-toggle ghost', type: 'button', 'aria-controls': 'main-nav', 'aria-expanded': 'false', 'aria-label': 'Open navigation' }, icon('menu'), h('span', { class: 'sr' }, 'Open menu'));
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') !== 'true';
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      nav.dataset.open = String(open);
    });
    nav.addEventListener('click', event => {
      if (event.target.closest('a')) {
        menu.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-label', 'Open navigation');
        nav.dataset.open = 'false';
      }
    });
    const help = h('button', { id: 'help-trigger', class: 'help-trigger ghost', type: 'button', 'aria-label': 'Open help' }, '?');
    header.replaceChildren(h('div', { class: 'bar' }, h('a', { class: 'brand', href: 'index.html' }, 'Lassitude'), menu, nav, help));
    // Phones get the most-used pages in a bottom bar within thumb reach; "More" opens the full menu above it.
    const more = h('button', { type: 'button', class: 'tab-link', 'aria-controls': 'main-nav', 'aria-expanded': 'false' }, icon('more'), h('span', {}, 'More'));
    const setOpen = open => {
      nav.dataset.open = String(open);
      [menu, more].forEach(button => button.setAttribute('aria-expanded', String(open)));
      menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    };
    more.addEventListener('click', () => setOpen(nav.dataset.open !== 'true'));
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.dataset.open === 'true') { setOpen(false); more.focus(); } });
    document.addEventListener('click', event => { if (nav.dataset.open === 'true' && !nav.contains(event.target) && !more.contains(event.target) && !menu.contains(event.target)) setOpen(false); });
    const tabs = [['index.html', 'Home', 'home'], ['workouts.html', 'Workouts', 'workouts'], ['focus.html', 'Focus', 'focus'], ['faith.html', 'Faith', 'faith']];
    document.body.append(h('nav', { class: 'tabbar', 'aria-label': 'Quick navigation' },
      tabs.map(([url, label, symbol]) => h('a', { class: 'tab-link', href: url, ...(url === current ? { 'aria-current': 'page' } : {}) }, icon(symbol), h('span', {}, label))), more));
    document.body.append(h('footer', {}, h('span', {}, 'Your data stays in this browser. '), h('a', { href: 'privacy.html' }, 'Privacy'), ' · ', h('a', { href: 'terms.html' }, 'Terms')));
  }
  if (!$('#toast-region')) document.body.append(h('div', { id: 'toast-region', class: 'toast-region', 'aria-live': 'polite', 'aria-atomic': 'false' }));
  applyTheme();
  renderStats();
  subscribe(renderStats);
}

export function toast(message, { actionLabel, onAction, duration = 4000 } = {}) {
  const region = $('#toast-region');
  if (!region) return;
  const item = h('div', { class: 'toast', role: 'status' }, h('span', {}, message));
  if (actionLabel && onAction) item.append(h('button', { class: 'ghost toast-action', type: 'button' }, actionLabel));
  region.append(item);
  const action = $('.toast-action', item);
  if (action) action.addEventListener('click', () => { onAction(); item.remove(); });
  window.setTimeout(() => item.remove(), duration);
}

export function confirmDialog({ title, message, confirmLabel = 'Continue', danger = false }) {
  return new Promise(resolve => {
    const dialog = h('dialog', { class: 'dialog' },
      h('form', { method: 'dialog' },
        h('h2', {}, title), h('p', {}, message),
        h('div', { class: 'dialog-actions' },
          h('button', { value: 'cancel', class: 'ghost' }, 'Cancel'),
          h('button', { value: 'confirm', class: danger ? 'danger' : '' }, confirmLabel))));
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
  });
}

const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)');
let followingSystem = false;

export function applyTheme(state = getState()) {
  const prefs = state.appPrefs;
  const root = document.documentElement;
  const dark = prefs.mode === 'system' ? systemDark?.matches ?? true : prefs.mode === 'dark';
  root.dataset.theme = state.theme;
  root.dataset.mode = dark ? 'dark' : 'light';
  root.dataset.text = prefs.textSize;
  if (prefs.reduceMotion === 'on') root.dataset.motion = 'reduce'; else delete root.dataset.motion;
  if (!followingSystem && systemDark) {
    followingSystem = true;
    systemDark.addEventListener('change', () => { if (getState().appPrefs.mode === 'system') applyTheme(); });
  }
}

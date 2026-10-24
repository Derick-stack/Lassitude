import { $, $$, h } from '../ui.js';

const topics = [
  ['Home', 'Daily verse, routine, focus music, challenge, and NADIR coach.', 'index.html'],
  ['Start', 'Set up your first week and add a simple calendar event.', 'start.html'],
  ['Focus', 'Focus timer with a growing tree, quick notes with templates, and flashcards that come back right before you forget.', 'focus.html'],
  ['Calendar', 'Month, week and day views of events, planned workouts, habits and goal deadlines. Tap a day to see its list.', 'calendar.html'],
  ['Workouts', 'Your weekly plan, the workout coach, programs, routine builder, guided sessions, and the exercise library by muscle group.', 'workouts.html'],
  ['Habits', 'Daily, weekday and weekly habits with chains, notes, a weekly freeze and a 12-week heatmap.', 'habits.html'],
  ['Faith', 'Reading plans, prayer journal and requests, scripture memory cards, and a gratitude log.', 'faith.html'],
  ['Progress', 'Track habits, water, reflections, prayer time, and streaks.', 'progress.html'],
  ['Future', 'Save goals with due dates, milestones, and vision items.', 'future.html'],
  ['Settings', 'Profile, appearance, notifications, training, NADIR chat, data backup, account and legal.', 'settings.html'],
  ['Account', 'Sign in, sync across devices, change email or password, or delete your account.', 'account.html']
];

export function initHelp() {
  $('#help-trigger')?.addEventListener('click', openHelp);
}

function openHelp() {
  const dialog = h('dialog', { class: 'dialog help-dialog', 'aria-labelledby': 'help-title' });
  const search = h('input', { id: 'help-search', type: 'search', autocomplete: 'off', placeholder: 'Search pages and features' });
  const list = h('ul', { class: 'help-results' });
  const render = () => {
    const query = search.value.trim().toLowerCase();
    const matches = topics.filter(([title, description]) => `${title} ${description}`.toLowerCase().includes(query));
    list.replaceChildren(...(matches.length ? matches.map(([title, description, href]) => h('li', {}, h('a', { href }, h('strong', {}, title), h('span', {}, description)))) : [h('li', { class: 'empty' }, 'No matching help topics.') ]));
  };
  search.addEventListener('input', render);
  const tourButton = h('button', { type: 'button', class: 'ghost' }, 'Replay guided tour');
  const closeButton = h('button', { type: 'button', class: 'ghost' }, 'Close');
  closeButton.addEventListener('click', () => dialog.close());
  tourButton.addEventListener('click', () => { dialog.addEventListener('close', startTour, { once: true }); dialog.close(); });
  dialog.append(h('h2', { id: 'help-title' }, 'Help'), h('label', { for: 'help-search' }, 'Search help'), search, list, h('div', { class: 'dialog-actions' }, tourButton, closeButton));
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  render();
  dialog.showModal();
  search.focus();
}

function startTour() {
  const targets = $$('.hero, main .card').filter(target => target.getClientRects().length);
  if (!targets.length) return;
  const dialog = h('dialog', { class: 'dialog tour-dialog', 'aria-labelledby': 'tour-title' });
  const count = h('p', { class: 'eyebrow', 'aria-live': 'polite' });
  const title = h('h2', { id: 'tour-title' });
  const tip = h('p', { id: 'tour-tip', role: 'tooltip' });
  const next = h('button', { type: 'button' }, 'Next');
  const skip = h('button', { type: 'button', class: 'ghost' }, 'End tour');
  const actions = h('div', { class: 'dialog-actions' }, skip, next);
  let index = 0;
  let previous = null;
  const clearHighlight = () => {
    if (!previous) return;
    previous.classList.remove('tour-highlight');
    previous.removeAttribute('aria-describedby');
    previous.removeAttribute('data-tour-name');
  };
  const render = () => {
    clearHighlight();
    const target = targets[index];
    previous = target;
    target.classList.add('tour-highlight');
    target.setAttribute('aria-describedby', 'tour-tip');
    const heading = target.querySelector('h1, h2, h3');
    const label = heading?.textContent?.trim() || 'This area';
    count.textContent = `Area ${index + 1} of ${targets.length}`;
    title.textContent = label;
    tip.textContent = `This is the ${label.toLowerCase()} section. Use its visible controls to take action.`;
    next.textContent = index === targets.length - 1 ? 'Finish tour' : 'Next';
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  next.addEventListener('click', () => {
    if (index === targets.length - 1) { dialog.close(); return; }
    index += 1;
    render();
  });
  skip.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { clearHighlight(); dialog.remove(); }, { once: true });
  dialog.append(count, title, tip, actions);
  document.body.append(dialog);
  render();
  dialog.showModal();
}

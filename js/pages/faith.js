import { getDayKey, getState, markDevotionalRead, update } from '../store.js';
import { $, confirmDialog, h, toast } from '../ui.js';

export function initFaith() {
  let readings = [];
  let revealedCardId = '';
  loadReadings();
  $('#reading-plan-form').addEventListener('submit', choosePlan);
  $('#devotional-form').addEventListener('submit', saveReflection);
  $('#mark-reading').addEventListener('click', markRead);
  $('#prayer-entry-form').addEventListener('submit', savePrayerEntry);
  $('#prayer-request-form').addEventListener('submit', addPrayerRequest);
  $('#scripture-card-form').addEventListener('submit', addScriptureCard);
  $('#gratitude-form').addEventListener('submit', addGratitude);
  renderPlan();
  renderPrayerEntries();
  renderPrayerRequests();
  renderFlashcards();
  renderGratitude();

  async function loadReadings() {
    try {
      const response = await fetch(new URL('../../data/reading-plan.json', import.meta.url));
      if (!response.ok) throw new Error('Reading plan unavailable.');
      readings = await response.json();
      renderPlan();
    } catch {
      $('#reading-title').textContent = 'Reading unavailable';
      $('#reading-verse').textContent = 'The local reading file could not be loaded.';
    }
  }

  async function choosePlan(event) {
    event.preventDefault();
    const length = Number($('#reading-plan-length').value);
    const current = getState().faithPlan;
    if (current.planId && current.completedDays.length < Number(current.planId) && current.startDate !== getDayKey()) {
      const confirmed = await confirmDialog({ title: 'Replace your reading plan?', message: 'Your current plan progress will be cleared.', confirmLabel: 'Start new plan', danger: true });
      if (!confirmed) return;
    }
    update(state => { state.faithPlan = { planId: String(length), startDate: getDayKey(), completedDays: [] }; });
    $('#reading-plan-status').textContent = `${length}-day plan started today.`;
    toast(`${length}-day reading plan started.`);
    renderPlan();
  }

  function getCurrentReading() {
    if (!readings.length) return null;
    const plan = getState().faithPlan;
    if (!plan.planId || !plan.startDate) return readings[(Math.floor(Date.now() / 864e5) % readings.length)];
    const length = Number(plan.planId);
    const elapsed = Math.floor((dateAtNoon(getDayKey()) - dateAtNoon(plan.startDate)) / 86400000);
    if (elapsed < 0) return readings[0];
    if (elapsed >= length) {
      const nextDay = Array.from({ length }, (_, index) => index + 1).find(day => !plan.completedDays.includes(day));
      return nextDay ? readings[nextDay - 1] : null;
    }
    return readings[elapsed % length];
  }

  function renderPlan() {
    if (!readings.length) return;
    const plan = getState().faithPlan;
    const length = Number(plan.planId) || 0;
    const entry = getCurrentReading();
    const title = $('#reading-title');
    if (!entry) {
      const complete = length > 0 && plan.completedDays.length >= length;
      title.textContent = complete ? 'Plan complete' : 'Today’s reading';
      $('#reading-verse').textContent = complete ? `Your ${length}-day plan is complete. Start another plan whenever you’re ready.` : '';
      $('#reading-reference').textContent = '';
      $('#reading-reflection').textContent = '';
      $('#reading-prayer').textContent = '';
      $('#reading-plan-progress').textContent = length ? `${plan.completedDays.length} of ${length} days completed.` : '';
      return;
    }
    const done = length ? plan.completedDays.includes(entry.day) : Boolean(getState().devotionalRead[getDayKey()]);
    title.textContent = `Day ${length ? Math.min(entry.day, length) : entry.day}: ${entry.reference}`;
    $('#reading-verse').textContent = entry.text;
    $('#reading-reference').textContent = entry.reference;
    $('#reading-reflection').textContent = entry.reflection;
    $('#reading-prayer').textContent = entry.prayer;
    $('#reading-plan-progress').textContent = length ? `${plan.completedDays.length} of ${length} days completed.` : 'Choose a 7, 14, or 30-day plan to track progress.';
    $('#mark-reading').disabled = done;
    $('#mark-reading').textContent = done ? 'Read today' : 'Mark today read';
    const savedReflection = getState().journal.find(item => item.date === getDayKey() && item.type === 'devotional');
    if (savedReflection && !$('#devotional-note').value) $('#devotional-note').value = savedReflection.text;
  }

  function saveReflection(event) {
    event.preventDefault();
    const text = $('#devotional-note').value.trim();
    if (!text) { $('#devotional-status').textContent = 'Write a reflection first.'; return; }
    update(state => {
      const existing = state.journal.find(item => item.date === getDayKey() && item.type === 'devotional');
      if (existing) existing.text = text;
      else state.journal.unshift({ date: getDayKey(), text, type: 'devotional' });
    });
    $('#devotional-status').textContent = 'Reflection saved privately.';
    toast('Reflection saved.');
  }

  function markRead() {
    const entry = getCurrentReading();
    if (!entry) return;
    markDevotionalRead();
    const plan = getState().faithPlan;
    if (plan.planId && !plan.completedDays.includes(entry.day)) update(state => { state.faithPlan.completedDays.push(entry.day); });
    renderPlan();
    toast('Reading marked complete.');
  }

  function savePrayerEntry(event) {
    event.preventDefault();
    const input = $('#prayer-entry');
    const text = input.value.trim();
    if (!text) return;
    update(state => state.prayerEntries.unshift({ id: `prayer-${crypto.randomUUID()}`, date: getDayKey(), text }));
    input.value = '';
    toast('Prayer entry saved privately.');
    renderPrayerEntries();
  }

  function renderPrayerEntries() {
    const list = $('#prayer-entry-list');
    list.replaceChildren();
    const entries = getState().prayerEntries.slice(0, 10);
    if (!entries.length) list.append(h('li', { class: 'empty' }, 'Private prayer entries will appear here.'));
    entries.forEach(entry => {
      const row = h('li', {}, h('span', {}, `${entry.date}: ${entry.text}`), h('button', { class: 'x', type: 'button', 'aria-label': 'Delete prayer entry' }, '×'));
      row.querySelector('button').addEventListener('click', () => removeWithUndo('prayerEntries', entry.id, renderPrayerEntries, 'Prayer entry deleted.'));
      list.append(row);
    });
  }

  function addPrayerRequest(event) {
    event.preventDefault();
    const title = $('#request-title').value.trim();
    const details = $('#request-details').value.trim();
    if (!title) return;
    update(state => state.prayerRequests.unshift({ id: `request-${crypto.randomUUID()}`, title, details, date: getDayKey(), answered: false }));
    $('#request-title').value = '';
    $('#request-details').value = '';
    toast('Prayer request saved privately.');
    renderPrayerRequests();
  }

  function renderPrayerRequests() {
    const list = $('#prayer-request-list');
    list.replaceChildren();
    const requests = getState().prayerRequests;
    if (!requests.length) list.append(h('li', { class: 'empty' }, 'Add a request to keep it in your private list.'));
    requests.forEach(request => {
      const answered = h('input', { type: 'checkbox', checked: request.answered, 'aria-label': `${request.answered ? 'Mark unanswered' : 'Mark answered'}: ${request.title}` });
      answered.addEventListener('change', () => { update(state => { const item = state.prayerRequests.find(entry => entry.id === request.id); if (item) item.answered = answered.checked; }); toast(answered.checked ? 'Marked answered.' : 'Marked active.'); renderPrayerRequests(); });
      const row = h('li', {}, answered, h('span', { class: request.answered ? 'done' : '' }, request.title), h('button', { class: 'x', type: 'button', 'aria-label': `Delete request: ${request.title}` }, '×'));
      if (request.details) row.append(h('small', {}, request.details));
      row.querySelector('button').addEventListener('click', () => removeWithUndo('prayerRequests', request.id, renderPrayerRequests, 'Prayer request deleted.'));
      list.append(row);
    });
  }

  function addScriptureCard(event) {
    event.preventDefault();
    const reference = $('#card-reference').value.trim();
    const text = $('#card-text').value.trim();
    if (!reference || !text) return;
    update(state => state.scriptureCards.push({ id: `card-${crypto.randomUUID()}`, reference, text, box: 1, dueDate: getDayKey(), reviews: 0 }));
    $('#card-reference').value = '';
    $('#card-text').value = '';
    toast('Scripture card added.');
    renderFlashcards();
  }

  function renderFlashcards() {
    const container = $('#flashcard-review');
    container.replaceChildren();
    const due = getState().scriptureCards.filter(card => card.dueDate <= getDayKey());
    if (!due.length) { container.append(h('p', { class: 'empty' }, getState().scriptureCards.length ? 'No cards due today. Review again on the due date.' : 'Add a verse card to begin spaced review.')); return; }
    const card = due[0];
    const reveal = h('button', { type: 'button', class: 'ghost' }, revealedCardId === card.id ? 'Hide verse' : `Reveal ${card.reference}`);
    reveal.addEventListener('click', () => { revealedCardId = revealedCardId === card.id ? '' : card.id; renderFlashcards(); });
    container.append(h('p', { class: 'eyebrow' }, `Box ${card.box} · ${due.length} due`), h('h3', {}, card.reference), reveal);
    if (revealedCardId === card.id) {
      const again = h('button', { type: 'button', class: 'ghost' }, 'Again');
      const known = h('button', { type: 'button' }, 'I know it');
      container.append(h('p', { class: 'big flashcard-text' }, card.text), h('div', { class: 'dialog-actions' }, again, known));
      again.addEventListener('click', () => reviewCard(card, false));
      known.addEventListener('click', () => reviewCard(card, true));
    }
  }

  function reviewCard(card, remembered) {
    const spacing = [1, 3, 7, 14, 30];
    update(state => {
      const saved = state.scriptureCards.find(item => item.id === card.id);
      if (!saved) return;
      saved.box = remembered ? Math.min(5, saved.box + 1) : 1;
      saved.reviews += 1;
      const days = remembered ? spacing[saved.box - 1] : 1;
      const due = new Date();
      due.setDate(due.getDate() + days);
      saved.dueDate = getDayKey(due);
    });
    revealedCardId = '';
    toast(remembered ? 'Card scheduled for later review.' : 'Card returned to the first box.');
    renderFlashcards();
  }

  function addGratitude(event) {
    event.preventDefault();
    const input = $('#gratitude-entry');
    const text = input.value.trim();
    if (!text) return;
    update(state => state.gratitude.unshift({ id: `gratitude-${crypto.randomUUID()}`, date: getDayKey(), text }));
    input.value = '';
    toast('Gratitude entry saved.');
    renderGratitude();
  }

  function renderGratitude() {
    const list = $('#gratitude-list');
    list.replaceChildren();
    const entries = getState().gratitude.slice(0, 14);
    if (!entries.length) list.append(h('li', { class: 'empty' }, 'Your gratitude notes are private and saved here.'));
    entries.forEach(entry => {
      const row = h('li', {}, h('span', {}, `${entry.date}: ${entry.text}`), h('button', { class: 'x', type: 'button', 'aria-label': 'Delete gratitude entry' }, '×'));
      row.querySelector('button').addEventListener('click', () => removeWithUndo('gratitude', entry.id, renderGratitude, 'Gratitude entry deleted.'));
      list.append(row);
    });
  }

  function removeWithUndo(collection, id, render, message) {
    const index = getState()[collection].findIndex(item => item.id === id);
    if (index < 0) return;
    const [removed] = getState()[collection].slice(index, index + 1);
    update(state => state[collection].splice(index, 1));
    toast(message, { actionLabel: 'Undo', duration: 5000, onAction: () => { update(state => state[collection].splice(index, 0, removed)); render(); } });
    render();
  }
}

function dateAtNoon(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

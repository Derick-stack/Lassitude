import { getDayKey, getState, setWater, subscribe, update } from '../store.js';
import { isScheduled } from '../habit-utils.js';
import { $, h, toast } from '../ui.js';

export function initProgress() {
  $('#wPlus').addEventListener('click', () => {
    const next = Math.min(99, (getState().water[getDayKey()] || 0) + 1);
    setWater(next);
    toast(`${next} of 8 glasses logged.`);
    renderWater();
  });
  $('#wMinus').addEventListener('click', () => {
    const next = Math.max(0, (getState().water[getDayKey()] || 0) - 1);
    setWater(next);
    toast(`${next} of 8 glasses logged.`);
    renderWater();
  });

  $('#journalForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#journalIn');
    const text = input.value.trim();
    if (!text) return;
    update(state => {
      state.journal.unshift({ date: getDayKey(), text });
      state.firstWeek.journalWritten = true;
    });
    input.value = '';
    toast('Reflection saved on this device.');
    renderJournal();
  });
  const prompts = ['What moved you closer to your goals today?', 'What challenged you today, and how did you respond?', 'What are you grateful for today?', 'What habit do you want to strengthen tomorrow?'];
  let promptIndex = 0;
  const renderPrompt = () => { $('#prompt').textContent = prompts[promptIndex % prompts.length]; };
  $('#newPrompt').addEventListener('click', () => { promptIndex += 1; renderPrompt(); });

  $('#prayerForm').addEventListener('submit', event => {
    event.preventDefault();
    const minutes = Number.parseInt($('#prayerIn').value, 10);
    if (!minutes || minutes < 1) return;
    update(state => { state.prayer[getDayKey()] = minutes; });
    toast('Prayer time saved.');
    renderPrayer();
  });

  renderPrompt();
  renderChart();
  renderWater();
  renderJournal();
  renderPrayer();
  subscribe(renderChart);

  function renderChart() {
    const chart = $('#chart');
    chart.replaceChildren();
    const state = getState();
    const activeHabits = state.habitDefinitions.filter(habit => !habit.archived);
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = getDayKey(date);
      const dayLogs = state.habitLogs[key] || {};
      const count = activeHabits.filter(habit => dayLogs[habit.id]?.status === 'yes').length;
      const total = Math.max(1, activeHabits.filter(habit => isScheduled(habit, date, state.habitLogs)).length);
      chart.append(h('li', {},
        h('span', { class: 'chart-day' }, date.toLocaleDateString('en-US', { weekday: 'short' })),
        h('div', { class: 'meter', role: 'img', 'aria-label': `${count} of ${total} habits completed` }, h('div', { style: `width:${Math.min(100, count / total * 100)}%` })),
        h('span', {}, `${count}/${total}`)));
    }
    const streak = Number($('[data-stat="streak"]')?.textContent || 0);
    const badges = [['First habit', Object.values(state.habits).some(day => Object.values(day).some(Boolean))], ['3-day streak', streak >= 3], ['7-day streak', streak >= 7], ['100 XP', state.xp >= 100]];
    $('#badges').replaceChildren(...badges.map(([label, earned]) => h('li', {}, h('span', { class: earned ? 'badge-earned' : 'badge-locked' }, earned ? 'Earned' : 'Not yet'), h('span', {}, label))));
  }
  function renderWater() {
    const count = getState().water[getDayKey()] || 0;
    $('#waterBar').style.width = `${Math.min(100, count / 8 * 100)}%`;
    $('#waterBarWrap').setAttribute('aria-valuenow', String(count));
    $('#waterCount').textContent = `${count} of 8 glasses`;
  }
  function renderJournal() {
    const list = $('#journalList');
    list.replaceChildren();
    const entries = getState().journal.slice(0, 5);
    if (!entries.length) list.append(h('li', { class: 'empty' }, 'No entries yet. Add a reflection above.'));
    entries.forEach(entry => {
      const row = h('li', {}, h('span', {}, `${entry.date || entry.d}: ${entry.text || entry.t}`), h('button', { type: 'button', class: 'x', 'aria-label': 'Delete reflection' }, '×'));
      row.querySelector('button').addEventListener('click', () => removeJournal(entry));
      list.append(row);
    });
  }
  function renderPrayer() {
    let count = 0;
    const date = new Date();
    while (getState().prayer[getDayKey(date)]) { count += 1; date.setDate(date.getDate() - 1); }
    $('#prayerNote').textContent = `Prayer streak: ${count} day${count === 1 ? '' : 's'}. Saved only on this device.`;
  }
  function removeJournal(entry) {
    const index = getState().journal.findIndex(item => item === entry || (item.date === entry.date && item.text === entry.text));
    if (index < 0) return;
    const removed = getState().journal[index];
    update(state => { state.journal.splice(index, 1); });
    toast('Reflection deleted.', { actionLabel: 'Undo', duration: 5000, onAction: () => { update(state => state.journal.splice(index, 0, removed)); renderJournal(); } });
    renderJournal();
  }
}

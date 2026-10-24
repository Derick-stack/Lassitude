import { getDayKey, getState, logHabit, update, useHabitFreeze, subscribe } from '../store.js';
import { habitChain, habitDateKey, isScheduled, lastTwelveWeeks, weekKey } from '../habit-utils.js';
import { $, $$, h, toast } from '../ui.js';

const weekdays = [['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]];

export function initHabits() {
  let editingId = '';
  const form = $('#habit-definition-form');
  const schedule = $('#habit-schedule');
  const weekdayOptions = $('#habit-weekday-options');
  weekdays.forEach(([label, day]) => weekdayOptions.append(h('label', { class: 'choice' }, h('input', { type: 'checkbox', name: 'habit-day', value: day }), h('span', {}, label))));
  schedule.addEventListener('change', renderScheduleFields);
  form.addEventListener('submit', saveDefinition);
  $('#habit-cancel-edit').addEventListener('click', resetForm);
  $('#use-habit-freeze').addEventListener('click', freezeToday);
  $('#heatmap-habit').addEventListener('change', renderHeatmap);
  $('#freeze-habit').addEventListener('change', render);
  renderScheduleFields();
  render();
  subscribe(render);

  function renderScheduleFields() {
    $('#habit-weekdays').hidden = schedule.value !== 'weekdays';
    $('#habit-weekly-target').hidden = schedule.value !== 'weekly';
  }

  function saveDefinition(event) {
    event.preventDefault();
    const title = $('#habit-title').value.trim();
    const type = schedule.value;
    const days = $$('input[name="habit-day"]:checked', weekdayOptions).map(input => Number(input.value));
    if (!title) return;
    if (type === 'weekdays' && !days.length) { $('#habit-form-status').textContent = 'Choose at least one weekday.'; return; }
    const scheduleData = { type, days: type === 'weekdays' ? days : [], target: type === 'weekly' ? Number($('#habit-target').value) : 3 };
    if (editingId) {
      update(state => {
        const habit = state.habitDefinitions.find(item => item.id === editingId);
        if (habit) { habit.title = title; habit.schedule = scheduleData; }
      });
      toast('Habit updated.');
    } else {
      update(state => {
        state.habitDefinitions.push({ id: `habit-${crypto.randomUUID()}`, title, schedule: scheduleData, archived: false, order: state.habitDefinitions.length });
        state.firstWeek.habitAdded = true;
      });
      toast('Habit added.');
    }
    resetForm();
  }

  function resetForm() {
    editingId = '';
    form.reset();
    schedule.value = 'daily';
    $('#habit-target').value = '3';
    $('#habit-form-heading').textContent = 'Add a habit';
    $('#habit-save').textContent = 'Add habit';
    $('#habit-cancel-edit').hidden = true;
    $('#habit-form-status').textContent = '';
    renderScheduleFields();
  }

  function editHabit(habit) {
    editingId = habit.id;
    $('#habit-title').value = habit.title;
    schedule.value = habit.schedule.type;
    $('#habit-target').value = String(habit.schedule.target || 3);
    $$('input[name="habit-day"]', weekdayOptions).forEach(input => { input.checked = habit.schedule.days.includes(Number(input.value)); });
    $('#habit-form-heading').textContent = 'Edit habit';
    $('#habit-save').textContent = 'Save changes';
    $('#habit-cancel-edit').hidden = false;
    renderScheduleFields();
    $('#habit-title').focus();
  }

  function render() {
    const state = getState();
    const active = state.habitDefinitions.filter(habit => !habit.archived).sort((a, b) => a.order - b.order);
    const archived = state.habitDefinitions.filter(habit => habit.archived).sort((a, b) => a.order - b.order);
    const today = getDayKey();
    const logs = state.habitLogs;
    const list = $('#habit-list');
    list.replaceChildren();
    $('#habit-empty').hidden = active.length > 0;
    $('#habit-freeze-summary').textContent = state.habitFreezeWeeks[weekKey(new Date())] ? 'Weekly freeze used.' : 'Weekly freeze available.';

    active.forEach((habit, index) => {
      const entry = logs[today]?.[habit.id];
      const due = isScheduled(habit, new Date(), logs);
      const chain = habitChain(habit, logs);
      const title = h('div', { class: 'habit-title-row' }, h('div', {}, h('h3', {}, habit.title), h('p', { class: 'field-note' }, `${scheduleLabel(habit.schedule)} · ${chain} day chain${due ? ' · due today' : habit.schedule.type === 'weekly' ? ' · weekly target met' : ' · not scheduled today'}`)));
      const statusButtons = h('div', { class: 'habit-status-controls', role: 'group', 'aria-label': `Log ${habit.title} for today` });
      [['yes', 'Yes'], ['no', 'No'], ['skip', 'Skip']].forEach(([value, label]) => {
        const button = h('button', { type: 'button', class: 'ghost habit-status', 'aria-pressed': String(entry?.status === value) }, label);
        button.addEventListener('click', () => {
          logHabit(habit.id, value, entry?.note || '');
          toast(value === 'yes' ? 'Habit completed.' : value === 'no' ? 'Habit marked no.' : 'Habit skipped. Chain preserved.');
        });
        statusButtons.append(button);
      });
      const noteForm = h('form', { class: 'habit-note-form' });
      const note = h('input', { type: 'text', maxlength: '500', value: entry?.note || '', placeholder: 'Optional note', 'aria-label': `Note for ${habit.title}` });
      noteForm.append(note, h('button', { type: 'submit', class: 'ghost' }, 'Save note'));
      noteForm.addEventListener('submit', event => {
        event.preventDefault();
        if (!entry?.status) {
          toast('Choose Yes, No or Skip for today first, then save your note.');
          statusButtons.querySelector('button')?.focus();
          return;
        }
        logHabit(habit.id, entry.status, note.value);
        toast('Habit note saved.');
      });
      const actions = h('div', { class: 'habit-actions' });
      const up = h('button', { type: 'button', class: 'ghost', disabled: index === 0, 'aria-label': `Move ${habit.title} up` }, 'Move up');
      const down = h('button', { type: 'button', class: 'ghost', disabled: index === active.length - 1, 'aria-label': `Move ${habit.title} down` }, 'Move down');
      const edit = h('button', { type: 'button', class: 'ghost' }, 'Edit');
      const archive = h('button', { type: 'button', class: 'ghost' }, 'Archive');
      up.addEventListener('click', () => reorder(habit.id, -1));
      down.addEventListener('click', () => reorder(habit.id, 1));
      edit.addEventListener('click', () => editHabit(habit));
      archive.addEventListener('click', () => archiveHabit(habit));
      actions.append(up, down, edit, archive);
      list.append(h('li', { class: `habit-item${due ? '' : ' is-rest-day'}` }, title, statusButtons, noteForm, actions));
    });

    const archiveList = $('#archived-habits');
    archiveList.replaceChildren();
    if (!archived.length) archiveList.append(h('li', { class: 'empty' }, 'No archived habits.'));
    archived.forEach(habit => {
      const restore = h('button', { type: 'button', class: 'ghost' }, 'Restore');
      restore.addEventListener('click', () => { update(state => { const item = state.habitDefinitions.find(entry => entry.id === habit.id); if (item) item.archived = false; }); toast('Habit restored.'); });
      archiveList.append(h('li', {}, h('span', {}, habit.title), restore));
    });

    const freezeSelect = $('#freeze-habit');
    const selectedFreezeHabit = freezeSelect.value;
    freezeSelect.replaceChildren(...(active.length ? active.map(habit => h('option', { value: habit.id }, habit.title)) : [h('option', { value: '', disabled: true }, 'No active habits') ]));
    if (active.some(habit => habit.id === selectedFreezeHabit)) freezeSelect.value = selectedFreezeHabit;
    const selectedHabit = active.find(habit => habit.id === freezeSelect.value);
    const freezeUsed = Boolean(state.habitFreezeWeeks[weekKey(new Date())]);
    const freezeLog = selectedHabit ? logs[today]?.[selectedHabit.id] : null;
    const freezeDue = selectedHabit && isScheduled(selectedHabit, new Date(), logs);
    $('#use-habit-freeze').disabled = freezeUsed || !freezeDue || freezeLog?.status === 'yes' || Boolean(freezeLog?.freeze);
    $('#freeze-status').textContent = freezeUsed ? 'This week’s freeze has been used.' : !freezeDue ? 'Choose a habit due today.' : 'Available once during the current week.';
    const heatmapSelect = $('#heatmap-habit');
    const priorId = heatmapSelect.value;
    heatmapSelect.replaceChildren(...(active.length ? active.map(habit => h('option', { value: habit.id }, habit.title)) : [h('option', { value: '', disabled: true }, 'Add a habit to see its heatmap') ]));
    if (active.some(habit => habit.id === priorId)) heatmapSelect.value = priorId;
    renderHeatmap();
  }

  function reorder(id, delta) {
    const active = getState().habitDefinitions.filter(habit => !habit.archived).sort((a, b) => a.order - b.order);
    const index = active.findIndex(habit => habit.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= active.length) return;
    [active[index], active[target]] = [active[target], active[index]];
    update(state => active.forEach((habit, order) => { const item = state.habitDefinitions.find(entry => entry.id === habit.id); item.order = order; }));
    toast('Habit order saved.');
  }

  function archiveHabit(habit) {
    update(state => { const item = state.habitDefinitions.find(entry => entry.id === habit.id); if (item) item.archived = true; });
    toast('Habit archived.', { actionLabel: 'Undo', duration: 5000, onAction: () => update(state => { const item = state.habitDefinitions.find(entry => entry.id === habit.id); if (item) item.archived = false; }) });
  }

  function freezeToday() {
    const id = $('#freeze-habit').value;
    if (!id) return;
    if (!useHabitFreeze(id)) { $('#freeze-status').textContent = 'The weekly freeze is unavailable or this habit is already complete today.'; return; }
    toast('Weekly freeze used. Your chain is protected.');
  }

  function renderHeatmap() {
    const id = $('#heatmap-habit').value;
    const container = $('#habit-heatmap');
    container.replaceChildren();
    if (!id) return;
    const logs = getState().habitLogs;
    const dates = lastTwelveWeeks();
    dates.forEach(date => {
      const key = habitDateKey(date);
      const entry = logs[key]?.[id];
      const symbols = { yes: 'Y', no: 'N', skip: 'S' };
      const label = `${date.toLocaleDateString(undefined, { dateStyle: 'full' })}: ${entry?.status || 'not logged'}`;
      container.append(h('span', { class: `heat-day heat-${entry?.status || 'empty'}`, title: label, 'aria-label': label }, symbols[entry?.status] || '·'));
    });
  }
}

function scheduleLabel(schedule) {
  if (schedule.type === 'weekdays') return (schedule.days || []).map(day => weekdays.find(item => item[1] === day)?.[0]).join(', ') || 'Choose days';
  if (schedule.type === 'weekly') return `${schedule.target} times per week`;
  return 'Daily';
}

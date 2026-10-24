import { addCalendarEvent, getDayKey, getState, update, updateCalendarEvent } from '../store.js';
import { $, $$, confirmDialog, h, toast } from '../ui.js';
import { addDays, dateKey, dayCodes, fromKey, occursOn, parseICS, routinesForDate, serializeICS, startOfWeek } from '../calendar-utils.js';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const eventTypes = [
  ['workout', 'Workout'], ['faith', 'Prayer / faith'], ['focus', 'Focus block'],
  ['deadline', 'Goal deadline'], ['custom', 'Custom']
];

export function initCalendar() {
  let cursor = fromKey(getDayKey());
  let view = 'month';
  const grid = $('#calendar-grid');
  const title = $('#calendar-heading');
  const range = $('#calendar-range');
  const eventStatus = $('#calendar-status');
  const viewButtons = $$('[data-calendar-view]');

  viewButtons.forEach(button => button.addEventListener('click', () => {
    view = button.dataset.calendarView;
    render();
  }));
  $('#calendar-prev').addEventListener('click', () => moveCursor(-1));
  $('#calendar-next').addEventListener('click', () => moveCursor(1));
  $('#calendar-today').addEventListener('click', () => { cursor = fromKey(getDayKey()); render(); });
  $('#calendar-add').addEventListener('click', () => openEventDialog(getDayKey(cursor)));
  $('#calendar-export').addEventListener('click', exportICS);
  $('#calendar-import-button').addEventListener('click', () => $('#calendar-import').click());
  $('#calendar-import').addEventListener('change', importICS);
  render();
  scheduleReminders();

  function moveCursor(direction) {
    if (view === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
    else cursor = addDays(cursor, direction * (view === 'week' ? 7 : 1));
    render();
  }

  function render() {
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.calendarView === view)));
    title.textContent = view === 'month' ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : view === 'week' ? 'Week view' : 'Day view';
    const first = view === 'month' ? startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1)) : view === 'week' ? startOfWeek(cursor) : cursor;
    const count = view === 'month' ? 42 : view === 'week' ? 7 : 1;
    const last = addDays(first, count - 1);
    range.textContent = count === 1 ? first.toLocaleDateString(undefined, { dateStyle: 'full' }) : `${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    grid.className = `calendar-grid calendar-view-${view}`;
    grid.replaceChildren();
    if (view !== 'day') dayLabels.forEach(label => grid.append(h('div', { class: 'calendar-weekday', 'aria-hidden': 'true' }, label)));
    for (let offset = 0; offset < count; offset += 1) {
      const date = addDays(first, offset);
      grid.append(renderDay(date));
    }
    const eventCount = getState().calendarEvents.length;
    eventStatus.textContent = `${eventCount} saved event${eventCount === 1 ? '' : 's'}. Drag an event to another day to reschedule it.`;
  }

  function renderDay(date) {
    const key = dateKey(date);
    const today = key === getDayKey();
    const outsideMonth = view === 'month' && date.getMonth() !== cursor.getMonth();
    const cell = h('section', { class: `calendar-day${today ? ' is-today' : ''}${outsideMonth ? ' is-outside' : ''}`, 'aria-label': `${date.toLocaleDateString(undefined, { dateStyle: 'full' })}${today ? ', today' : ''}` });
    const dayButton = h('button', { type: 'button', class: 'calendar-day-number', 'aria-label': `Add event on ${date.toLocaleDateString(undefined, { dateStyle: 'full' })}` }, String(date.getDate()));
    dayButton.addEventListener('click', () => openEventDialog(key));
    cell.append(dayButton, renderHabitIndicator(key));
    const events = getEventsForDay(date);
    const list = h('ul', { class: 'calendar-day-events', 'aria-label': `Events for ${date.toLocaleDateString()}` });
    events.forEach(event => list.append(renderEvent(event, date)));
    if (view === 'month' && events.length > 3) {
      list.replaceChildren(...events.slice(0, 3).map(event => renderEvent(event, date)));
      list.append(h('li', { class: 'calendar-more' }, `+${events.length - 3} more`));
    }
    cell.append(list);
    cell.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('text/plain')) event.preventDefault(); });
    cell.addEventListener('drop', event => {
      event.preventDefault();
      const id = event.dataTransfer?.getData('text/plain');
      const saved = getState().calendarEvents.find(item => item.id === id);
      if (!saved || saved.date === key) return;
      const dayShift = Math.round((fromKey(key) - fromKey(saved.date)) / 86400000);
      const recurrence = { ...(saved.recurrence || { frequency: 'none', interval: 1, days: [], until: '' }) };
      if (recurrence.frequency === 'weekly' && recurrence.days?.length) {
        recurrence.days = recurrence.days.map(code => dayCodes[(dayCodes.indexOf(code) + dayShift + 7) % 7]);
      }
      updateCalendarEvent(id, { date: key, recurrence, remindedFor: '' });
      toast(`Moved “${saved.title}” to ${date.toLocaleDateString()}.`, { actionLabel: 'Undo', duration: 5000, onAction: () => { updateCalendarEvent(id, { date: saved.date, recurrence: saved.recurrence, remindedFor: saved.remindedFor || '' }); render(); } });
      render();
    });
    return cell;
  }

  function renderHabitIndicator(key) {
    const habits = getState().habits[key] || {};
    const count = Object.values(habits).filter(Boolean).length;
    return h('span', { class: `habit-indicator${count ? ' has-habits' : ''}`, 'aria-label': `${count} habits completed` }, count ? `${count} habits` : 'No habits');
  }

  function renderEvent(event, occurrenceDate) {
    const item = h('li', { class: `calendar-event type-${event.type}`, draggable: !event.readOnly, tabindex: '0' },
      h('span', { class: 'event-marker', 'aria-hidden': 'true' }, eventIcon(event.type)),
      h('span', { class: 'event-type' }, event.typeLabel || typeLabel(event.type)),
      h('span', { class: 'event-time' }, event.time || ''),
      h('span', { class: 'event-title' }, event.title));
    if (!event.readOnly && !event.virtual) {
      item.addEventListener('dragstart', drag => {
        drag.dataTransfer?.setData('text/plain', event.id);
        if (drag.dataTransfer) drag.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('keydown', keyEvent => {
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          openEventDialog(event.date, event);
        }
      });
      item.addEventListener('click', click => {
        if (!click.target.closest('button')) openEventDialog(event.date, event);
      });
      const remove = h('button', { class: 'x event-delete', type: 'button', 'aria-label': `Delete ${event.title}${event.recurrence?.frequency !== 'none' ? ' series' : ''}` }, '×');
      remove.addEventListener('click', async click => {
        click.stopPropagation();
        const confirmed = await confirmDialog({ title: 'Delete calendar event?', message: event.recurrence?.frequency !== 'none' ? 'This removes the recurring event series.' : 'This removes this event from your calendar.', confirmLabel: 'Delete', danger: true });
        if (!confirmed) return;
        const saved = getState().calendarEvents.find(item => item.id === event.id);
        update(state => { state.calendarEvents = state.calendarEvents.filter(item => item.id !== event.id); });
        toast('Calendar event deleted.', { actionLabel: 'Undo', duration: 5000, onAction: () => { update(state => state.calendarEvents.push(saved)); render(); } });
        render();
      });
      item.append(remove);
    }
    if (event.virtual) item.setAttribute('aria-label', `${event.typeLabel}: ${event.title}`);
    item.dataset.date = dateKey(occurrenceDate);
    return item;
  }

  function getEventsForDay(date) {
    const key = dateKey(date);
    const state = getState();
    const plannedWorkouts = routinesForDate(state.workoutRoutines, date).map(routine => ({
      id: `planned-${routine.id}-${key}`, title: routine.title, date: key, time: '09:00', type: 'workout', typeLabel: 'Planned workout', virtual: true, readOnly: true
    }));
    const recurring = state.calendarEvents.filter(event => occursOn(event, date));
    const logs = state.workoutLogs.filter(log => (log.date || log.d) === key).map(log => ({
      id: log.id, title: log.title || log.t || 'Workout completed', date: key, time: '', type: 'workout', typeLabel: 'Completed workout', virtual: true, readOnly: true
    }));
    const deadlines = state.goals.filter(goal => goal.dueDate === key && !goal.done).map(goal => ({
      id: `goal-${goal.id || goal.title}`, title: goal.title || goal.t || 'Goal deadline', date: key, time: '', type: 'deadline', typeLabel: 'Goal deadline', virtual: true, readOnly: true
    }));
    return [...plannedWorkouts, ...recurring, ...logs, ...deadlines].sort((left, right) => (left.time || '').localeCompare(right.time || '') || left.title.localeCompare(right.title));
  }

  function openEventDialog(dateKeyValue, existing = null) {
    const dialog = h('dialog', { class: 'dialog calendar-dialog', 'aria-labelledby': 'calendar-dialog-title' });
    const title = h('input', { id: 'event-name', type: 'text', maxlength: '100', required: true, value: existing?.title || '' });
    const date = h('input', { id: 'event-date', type: 'date', required: true, value: existing?.date || dateKeyValue });
    const time = h('input', { id: 'event-time', type: 'time', value: existing?.time || '09:00' });
    const type = h('select', { id: 'event-type' }, eventTypes.map(([value, label]) => h('option', { value, selected: (existing?.type || 'custom') === value }, label)));
    const existingDays = existing?.recurrence?.days || [];
    const startDay = existing ? dayCodes[fromKey(existing.date).getDay()] : '';
    const existingRepeat = existing?.recurrence?.frequency === 'weekly' && (existingDays.length > 1 || (existingDays.length === 1 && existingDays[0] !== startDay)) ? 'custom' : existing?.recurrence?.frequency || 'none';
    const recurrence = h('select', { id: 'event-recurrence' }, [['none', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week'], ['custom', 'Custom weekdays']].map(([value, label]) => h('option', { value, selected: existingRepeat === value }, label)));
    const until = h('input', { id: 'event-until', type: 'date', value: existing?.recurrence?.until || '' });
    const days = h('fieldset', { class: 'calendar-days-picker', hidden: true }, h('legend', {}, 'Repeat on'), dayCodes.slice(1).concat(dayCodes[0]).map(code => {
      const index = dayCodes.indexOf(code);
      return h('label', { class: 'choice' }, h('input', { type: 'checkbox', name: 'repeat-day', value: code, checked: existing?.recurrence?.days?.includes(code) || (existing?.recurrence?.frequency === 'weekly' && existing.date === dateKeyValue && code === dayCodes[fromKey(dateKeyValue).getDay()]) }), h('span', {}, dayNames[index]));
    }));
    const reminder = h('input', { id: 'event-reminder', type: 'checkbox', checked: Boolean(existing?.reminder) });
    const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const close = h('button', { type: 'button', class: 'ghost' }, 'Cancel');
    close.addEventListener('click', () => dialog.close());
    recurrence.addEventListener('change', () => { days.hidden = recurrence.value !== 'custom'; });
    days.hidden = recurrence.value !== 'custom';
    const form = h('form', { class: 'calendar-event-form' },
      h('label', { for: 'event-name' }, 'Event name'), title,
      h('label', { for: 'event-date' }, 'Date'), date,
      h('label', { for: 'event-time' }, 'Time'), time,
      h('label', { for: 'event-type' }, 'Type'), type,
      h('label', { for: 'event-recurrence' }, 'Repeat'), recurrence,
      days,
      h('label', { for: 'event-until' }, 'Repeat until (optional)'), until,
      h('label', { class: 'choice', for: 'event-reminder' }, reminder, h('span', {}, 'Remind me with a browser notification')),
      h('p', { class: 'field-note' }, 'Reminders appear only while this site is open. Notification permission is requested only when you save with reminders enabled.'),
      message,
      h('div', { class: 'dialog-actions' }, close, h('button', { type: 'submit' }, existing ? 'Save changes' : 'Add event')));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!title.value.trim()) { message.hidden = false; message.textContent = 'Enter an event name.'; title.focus(); return; }
      if (until.value && until.value < date.value) { message.hidden = false; message.textContent = 'The repeat-until date must be on or after the event date.'; until.focus(); return; }
      const selectedDays = $$('input[name="repeat-day"]:checked', days).map(input => input.value);
      if (recurrence.value === 'custom' && !selectedDays.length) { message.hidden = false; message.textContent = 'Choose at least one day for this repeat pattern.'; return; }
      let reminderEnabled = reminder.checked;
      if (reminderEnabled) {
        if (!('Notification' in window)) reminderEnabled = false;
        else {
          let permission = Notification.permission;
          if (permission === 'default') {
            try { permission = await Notification.requestPermission(); } catch { permission = 'denied'; }
          }
          reminderEnabled = permission === 'granted';
        }
      }
      const repeat = recurrence.value;
      const weeklyDays = repeat === 'custom' ? selectedDays : repeat === 'weekly' ? [dayCodes[fromKey(date.value).getDay()]] : [];
      const savedEvent = {
        title: title.value.trim(), date: date.value, time: time.value || '09:00', type: type.value,
        recurrence: { frequency: repeat === 'custom' ? 'weekly' : repeat, interval: 1, days: weeklyDays, until: until.value },
        reminder: reminderEnabled, remindedFor: ''
      };
      if (existing) updateCalendarEvent(existing.id, savedEvent);
      else addCalendarEvent(savedEvent);
      dialog.close();
      toast(reminder.checked && !reminderEnabled ? 'Event saved; browser notifications were unavailable or not allowed.' : 'Calendar event saved.');
      render();
    });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.append(h('h2', { id: 'calendar-dialog-title' }, existing ? 'Edit event' : 'Add event'), form);
    document.body.append(dialog);
    dialog.showModal();
    title.focus();
  }

  function exportICS() {
    downloadFile('lassitude-calendar.ics', serializeICS(getState().calendarEvents), 'text/calendar;charset=utf-8');
    toast('Calendar exported as an ICS file.');
  }

  async function importICS(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) { toast('That calendar file is too large (1 MB max).'); return; }
    try {
      const text = await file.text();
      const imported = parseICS(text);
      if (!imported.length) { toast('No supported calendar events were found.'); return; }
      update(state => {
        state.calendarEvents.unshift(...imported);
        state.firstWeek.calendarEvent = true;
      });
      render();
      toast(`${imported.length} event${imported.length === 1 ? '' : 's'} imported.`);
    } catch {
      toast('Could not read that calendar file. Use a valid ICS file.');
    }
  }

  function scheduleReminders() {
    window.setInterval(() => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const now = new Date();
      const key = getDayKey(now);
      const minute = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      getState().calendarEvents.filter(item => item.reminder && item.time === minute && item.remindedFor !== key && occursOn(item, now)).forEach(item => {
        new Notification('Lassitude calendar reminder', { body: item.title });
        updateCalendarEvent(item.id, { remindedFor: key });
      });
    }, 30000);
  }
}

function typeLabel(type) {
  return eventTypes.find(([value]) => value === type)?.[1] || 'Custom';
}

function eventIcon(type) {
  const paths = {
    workout: 'M6 8v8m12-8v8M3 10v4m18-4v4M6 12h12',
    faith: 'M12 3v18m-7-11h14m-12-4h10',
    focus: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    deadline: 'M5 21V4m0 1h13l-3 4 3 4H5',
    custom: 'M5 5h14v14H5zM8 9h8m-8 4h8m-8 4h5'
  };
  const svg = h('svg', { viewBox: '0 0 24 24', focusable: 'false' });
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.append(h('path', { d: paths[type] || paths.custom }));
  return svg;
}

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = h('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

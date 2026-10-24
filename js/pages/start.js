import { addCalendarEvent, getDayKey, getState, subscribe } from '../store.js';
import { $, h, toast } from '../ui.js';

export function initStart() {
  const checklist = [
    ['habitAdded', 'Add a habit', 'habits.html'],
    ['focusSession', 'Finish a focus session', 'focus.html'],
    ['workoutLogged', 'Log a workout', 'index.html#workout'],
    ['journalWritten', 'Write a reflection', 'progress.html'],
    ['calendarEvent', 'Add a calendar event', '#calendarEventForm'],
    ['devotionalRead', 'Read today’s devotional', 'index.html#devotional']
  ];
  const render = () => {
    const completed = getState().firstWeek;
    const count = checklist.filter(([key]) => completed[key]).length;
    const percent = Math.round(count / checklist.length * 100);
    $('#week-progress-wrap').style.setProperty('--ring-progress', `${percent}%`);
    $('#week-progress-wrap').setAttribute('aria-valuenow', String(percent));
    $('#week-percent').textContent = `${percent}%`;
    $('#week-count').textContent = `${count} of ${checklist.length} first-week steps complete`;
    $('#steps').replaceChildren(...checklist.map(([key, label, href]) => h('li', {},
      h('span', { class: completed[key] ? 'step-done' : 'step-pending' }, completed[key] ? 'Complete' : 'Next'),
      h('a', { href }, label))));
    const today = getDayKey();
    const labels = { workout: 'Workout', faith: 'Faith', focus: 'Focus', deadline: 'Deadline', custom: 'Event' };
    const upcoming = getState().calendarEvents.filter(item => item.date >= today || item.recurrence?.frequency !== 'none').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
    const when = key => { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
    $('#start-events').replaceChildren(...(upcoming.length ? upcoming.map(item => h('li', {}, h('strong', {}, item.title), ` · ${labels[item.type] || 'Event'} · ${item.recurrence?.frequency && item.recurrence.frequency !== 'none' ? `repeats from ${when(item.date)}` : when(item.date)}`)) : [h('li', { class: 'empty' }, 'No upcoming events yet.')]));
  };
  $('#calendarEventForm').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('#event-title').value.trim();
    const date = $('#event-date').value;
    if (!title || !date) return;
    addCalendarEvent({ title, date, type: $('#event-type').value });
    $('#event-title').value = '';
    toast('Calendar event saved.');
    render();
  });
  $('#event-date').value = getDayKey();
  render();
  subscribe(render);
}

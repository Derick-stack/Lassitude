export const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const fromKey = key => { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day); };
export const addDays = (date, amount) => { const result = new Date(date); result.setDate(result.getDate() + amount); return result; };
export const startOfWeek = date => addDays(date, -date.getDay());

export function routinesForDate(routines, date) {
  return routines.filter(routine => routine.active !== false && Array.isArray(routine.days) && routine.days.includes(date.getDay()));
}

export function occursOn(event, date) {
  const key = dateKey(date);
  if (key < event.date || (event.recurrence?.until && key > event.recurrence.until)) return false;
  const frequency = event.recurrence?.frequency || 'none';
  if (frequency === 'none') return key === event.date;
  const start = fromKey(event.date);
  const interval = Math.max(1, event.recurrence?.interval || 1);
  if (frequency === 'daily') return Math.floor((date - start) / 86400000) % interval === 0;
  const days = event.recurrence?.days?.length ? event.recurrence.days : [dayCodes[start.getDay()]];
  const elapsedWeeks = Math.floor((startOfWeek(date) - startOfWeek(start)) / 604800000);
  return elapsedWeeks >= 0 && elapsedWeeks % interval === 0 && days.includes(dayCodes[date.getDay()]);
}

function escapeICS(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function unescapeICS(value) {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseICSDate(value) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return null;
  return { date: `${match[1]}-${match[2]}-${match[3]}`, time: match[4] ? `${match[4]}:${match[5]}` : '09:00' };
}

export function serializeICS(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lassitude//Calendar//EN', 'CALSCALE:GREGORIAN'];
  events.forEach(event => {
    lines.push('BEGIN:VEVENT', `UID:${escapeICS(event.id)}@lassitude`, `DTSTART:${event.date.replaceAll('-', '')}T${(event.time || '09:00').replace(':', '')}00`, `SUMMARY:${escapeICS(event.title)}`, `CATEGORIES:${escapeICS(event.type || 'custom')}`);
    const frequency = event.recurrence?.frequency || 'none';
    if (frequency !== 'none') {
      const rule = [`FREQ=${frequency.toUpperCase()}`];
      if ((event.recurrence.interval || 1) > 1) rule.push(`INTERVAL=${event.recurrence.interval}`);
      if (event.recurrence.days?.length) rule.push(`BYDAY=${event.recurrence.days.join(',')}`);
      if (event.recurrence.until) rule.push(`UNTIL=${event.recurrence.until.replaceAll('-', '')}`);
      lines.push(`RRULE:${rule.join(';')}`);
    }
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function parseICS(text) {
  const unfolded = text.replace(/^\uFEFF/, '').replace(/\r?\n[ \t]/g, '').slice(0, 1024 * 1024);
  const events = [];
  let current = null;
  for (const line of unfolded.split(/\r?\n/)) {
    if (line.toUpperCase() === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line.toUpperCase() === 'END:VEVENT' && current) {
      const start = current.start && parseICSDate(current.start);
      if (start && current.summary) {
        const rule = Object.fromEntries((current.rrule || '').split(';').filter(Boolean).map(part => {
          const at = part.indexOf('=');
          return at > -1 ? [part.slice(0, at).toUpperCase(), part.slice(at + 1)] : ['', ''];
        }).filter(([key]) => key));
        const frequency = rule.FREQ === 'DAILY' ? 'daily' : rule.FREQ === 'WEEKLY' ? 'weekly' : 'none';
        const until = rule.UNTIL ? parseICSDate(rule.UNTIL)?.date || '' : '';
        const categories = (current.categories || '').toLowerCase();
        const type = categories.includes('workout') ? 'workout' : categories.includes('faith') || categories.includes('prayer') ? 'faith' : categories.includes('focus') ? 'focus' : categories.includes('deadline') ? 'deadline' : 'custom';
        events.push({
          id: `ics-${Date.now()}-${events.length}-${Math.random().toString(36).slice(2, 6)}`,
          title: unescapeICS(current.summary), date: start.date, time: start.time, type, reminder: false, remindedFor: '',
          recurrence: { frequency, interval: Math.max(1, Number.parseInt(rule.INTERVAL, 10) || 1), days: (rule.BYDAY || '').split(',').filter(day => dayCodes.includes(day)), until }
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).split(';')[0].toUpperCase();
    const value = line.slice(colon + 1);
    if (key === 'DTSTART') current.start = value;
    else if (key === 'SUMMARY') current.summary = value;
    else if (key === 'CATEGORIES') current.categories = value;
    else if (key === 'RRULE') current.rrule = value;
  }
  return events;
}

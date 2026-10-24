export const habitDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const parseHabitDate = key => { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day, 12); };
export const mondayOf = date => { const result = new Date(date); result.setHours(12, 0, 0, 0); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; };
export const weekKey = date => habitDateKey(mondayOf(date));

export function isScheduled(habit, date, logs = {}) {
  const schedule = habit.schedule || { type: 'daily' };
  if (schedule.type === 'daily') return true;
  if (schedule.type === 'weekdays') return (schedule.days || []).includes(date.getDay());
  const start = mondayOf(date);
  let completed = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    const loggedDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset, 12);
    if (habitDateKey(loggedDate) > habitDateKey(date)) break;
    const key = habitDateKey(loggedDate);
    if (logs[key]?.[habit.id]?.status === 'yes') completed += 1;
  }
  return completed < (schedule.target || 3);
}

export function habitChain(habit, logs, today = new Date(), lookback = 365) {
  const schedule = habit.schedule || { type: 'daily' };
  let date = new Date(today);
  date.setHours(12, 0, 0, 0);
  const todayStatus = logs[habitDateKey(date)]?.[habit.id]?.status;
  if (!todayStatus && isScheduled(habit, date, logs)) date.setDate(date.getDate() - 1);
  let chain = 0;
  if (schedule.type === 'weekly') {
    const visited = new Set();
    for (let offset = 0; offset < lookback; offset += 1) {
      const key = weekKey(date);
      if (visited.has(key)) { date.setDate(date.getDate() - 7); continue; }
      visited.add(key);
      let yes = 0;
      let skips = 0;
      for (let day = 0; day < 7; day += 1) {
        const log = logs[habitDateKey(new Date(mondayOf(date).getFullYear(), mondayOf(date).getMonth(), mondayOf(date).getDate() + day, 12))]?.[habit.id];
        if (log?.status === 'yes') yes += 1;
        if (log?.status === 'skip') skips += 1;
      }
      if (yes >= (schedule.target || 3) || yes + skips >= (schedule.target || 3)) chain += 1;
      else if (key !== weekKey(today)) break;
      date.setDate(date.getDate() - 7);
    }
    return chain;
  }
  for (let offset = 0; offset < lookback; offset += 1) {
    if (!isScheduled(habit, date, logs)) { date.setDate(date.getDate() - 1); continue; }
    const status = logs[habitDateKey(date)]?.[habit.id]?.status;
    if (status === 'yes') chain += 1;
    else if (status === 'skip') { /* A skipped day preserves, but does not extend, the chain. */ }
    else break;
    date.setDate(date.getDate() - 1);
  }
  return chain;
}

export function lastTwelveWeeks(today = new Date()) {
  const currentMonday = mondayOf(today);
  return Array.from({ length: 84 }, (_, index) => {
    const date = new Date(currentMonday);
    date.setDate(date.getDate() - 77 + index);
    return date;
  });
}

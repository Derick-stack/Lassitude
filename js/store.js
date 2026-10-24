import { isScheduled, parseHabitDate } from './habit-utils.js';

const STORAGE_KEY = 'lassitude';
const SCHEMA_VERSION = 6;
const listeners = new Set();
export const THEMES = ['midnight', 'emerald', 'royal', 'ocean', 'sunset', 'rose', 'violet'];

const defaults = () => ({
  schemaVersion: SCHEMA_VERSION,
  name: '',
  xp: 0,
  theme: 'midnight',
  light: false,
  appPrefs: { mode: 'dark', textSize: 'default', reduceMotion: 'system', chatSound: false, chatAutoScroll: true, chatTimestamps: true },
  profileGoals: [],
  starterHabits: [],
  workoutExperience: 'beginner',
  workoutDays: 3,
  reminders: { enabled: false, time: '18:00', lastSent: '' },
  onboarding: { completed: false, skipped: false, startedAt: null },
  firstWeek: { habitAdded: false, focusSession: false, workoutLogged: false, journalWritten: false, calendarEvent: false, devotionalRead: false },
  habits: {},
  habitDefinitions: [],
  habitLogs: {},
  habitFreezeWeeks: {},
  habitXP: {},
  focusXP: {},
  custom: [],
  water: {},
  journal: [],
  goals: [],
  miles: [],
  vision: [],
  calendarEvents: [],
  workoutLogs: [],
  workoutRoutines: [],
  workoutSessions: [],
  workoutPosts: [],
  workoutPrefs: { sound: false, vibration: false, equipment: 'gym' },
  devotionalRead: {},
  prayer: {},
  faithPlan: { planId: '', startDate: '', completedDays: [] },
  worshipSeries: { active: '', level: 'standard', progress: {} },
  prayerEntries: [],
  prayerRequests: [],
  scriptureCards: [],
  gratitude: [],
  focusPrefs: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4, witherOnLeave: false, witherAfterSeconds: 60, ambientVolume: 0.2 },
  focusTasks: [],
  focusSessions: [],
  studyNotes: [],
  studyNotebooks: ['General'],
  studyCards: {},
  gardenHistory: [],
  accountSync: { migratedUserId: '', lastSyncedAt: '' },
  plant: 0,
  chal: {}
});

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function migrate(value) {
  const previous = objectOrEmpty(value);
  const next = { ...defaults(), ...previous };
  next.schemaVersion = SCHEMA_VERSION;
  next.name = typeof next.name === 'string' ? next.name : '';
  next.xp = Number.isFinite(Number(next.xp)) ? Math.max(0, Number(next.xp)) : 0;
  next.theme = THEMES.includes(next.theme) ? next.theme : 'midnight';
  next.light = Boolean(next.light);
  const prefs = objectOrEmpty(next.appPrefs);
  next.appPrefs = {
    mode: ['system', 'dark', 'light'].includes(prefs.mode) ? prefs.mode : next.light ? 'light' : 'dark',
    textSize: ['default', 'large'].includes(prefs.textSize) ? prefs.textSize : 'default',
    reduceMotion: ['system', 'on'].includes(prefs.reduceMotion) ? prefs.reduceMotion : 'system',
    chatSound: Boolean(prefs.chatSound),
    chatAutoScroll: prefs.chatAutoScroll !== false,
    chatTimestamps: prefs.chatTimestamps !== false
  };
  next.profileGoals = arrayOrEmpty(next.profileGoals);
  next.starterHabits = arrayOrEmpty(next.starterHabits);
  next.workoutExperience = ['beginner', 'intermediate', 'advanced'].includes(next.workoutExperience) ? next.workoutExperience : 'beginner';
  next.workoutDays = Math.max(1, Math.min(7, Number.parseInt(next.workoutDays, 10) || 3));
  next.reminders = { ...defaults().reminders, ...objectOrEmpty(next.reminders) };
  next.onboarding = { ...defaults().onboarding, ...objectOrEmpty(next.onboarding) };
  next.firstWeek = { ...defaults().firstWeek, ...objectOrEmpty(next.firstWeek) };
  next.habits = objectOrEmpty(next.habits);
  next.custom = arrayOrEmpty(next.custom);
  next.habitLogs = objectOrEmpty(next.habitLogs);
  next.habitFreezeWeeks = objectOrEmpty(next.habitFreezeWeeks);
  if (Array.isArray(previous.habitLogs)) next.habitLogs = {};
  if (!Object.keys(next.habitLogs).length) {
    Object.entries(next.habits).forEach(([date, entries]) => {
      const oldDay = objectOrEmpty(entries);
      next.habitLogs[date] = Object.fromEntries(Object.entries(oldDay).map(([id, done]) => [id, { status: done ? 'yes' : 'no', note: '', updatedAt: 0 }]));
    });
  }
  next.habitDefinitions = arrayOrEmpty(next.habitDefinitions).map((habit, index) => {
    const item = objectOrEmpty(habit);
    const schedule = objectOrEmpty(item.schedule);
    return {
      ...item,
      id: typeof item.id === 'string' && item.id ? item.id : `habit-${index}`,
      title: typeof item.title === 'string' ? item.title : typeof item.t === 'string' ? item.t : 'Habit',
      schedule: {
        type: ['daily', 'weekdays', 'weekly'].includes(schedule.type) ? schedule.type : 'daily',
        days: arrayOrEmpty(schedule.days).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6),
        target: Math.max(1, Math.min(7, Number.parseInt(schedule.target, 10) || 3))
      },
      archived: Boolean(item.archived),
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index
    };
  });
  if (!next.habitDefinitions.length) {
    const seeded = next.starterHabits.length ? next.starterHabits : [{ id: 'workout', title: 'Workout' }, { id: 'scripture', title: 'Read scripture' }, { id: 'water', title: 'Drink 8 glasses of water' }, { id: 'focus', title: 'Focus session' }];
    next.habitDefinitions = [...seeded, ...next.custom].map((habit, index) => ({ id: String(habit.id || `habit-${index}`), title: habit.title || habit.t || 'Habit', schedule: { type: 'daily', days: [], target: 3 }, archived: false, order: index }));
  }
  next.habitXP = objectOrEmpty(next.habitXP);
  next.focusXP = objectOrEmpty(next.focusXP);
  next.custom = arrayOrEmpty(next.custom);
  next.water = objectOrEmpty(next.water);
  next.journal = arrayOrEmpty(next.journal);
  next.goals = arrayOrEmpty(next.goals);
  next.miles = arrayOrEmpty(next.miles);
  next.vision = arrayOrEmpty(next.vision);
  next.calendarEvents = arrayOrEmpty(next.calendarEvents).map((event, index) => {
    const item = objectOrEmpty(event);
    const recurrence = objectOrEmpty(item.recurrence);
    const frequency = ['none', 'daily', 'weekly'].includes(recurrence.frequency) ? recurrence.frequency : 'none';
    return {
      ...item,
      id: typeof item.id === 'string' && item.id ? item.id : `event-${index}`,
      title: typeof item.title === 'string' ? item.title : 'Untitled event',
      date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : getDayKey(),
      type: ['workout', 'faith', 'focus', 'deadline', 'custom'].includes(item.type) ? item.type : 'custom',
      time: /^\d{2}:\d{2}$/.test(item.time || '') ? item.time : '09:00',
      recurrence: {
        frequency,
        interval: Math.max(1, Math.min(30, Number.parseInt(recurrence.interval, 10) || 1)),
        days: arrayOrEmpty(recurrence.days).filter(day => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].includes(day)),
        until: /^\d{4}-\d{2}-\d{2}$/.test(recurrence.until || '') ? recurrence.until : ''
      },
      reminder: Boolean(item.reminder),
      remindedFor: typeof item.remindedFor === 'string' ? item.remindedFor : ''
    };
  });
  next.workoutLogs = arrayOrEmpty(next.workoutLogs);
  next.workoutRoutines = arrayOrEmpty(next.workoutRoutines).map((routine, index) => {
    const item = objectOrEmpty(routine);
    return {
      ...item,
      id: typeof item.id === 'string' && item.id ? item.id : `routine-${index}`,
      title: typeof item.title === 'string' ? item.title : 'My routine',
      days: arrayOrEmpty(item.days).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6),
      exercises: arrayOrEmpty(item.exercises).map(exercise => {
        const entry = objectOrEmpty(exercise);
        return { ...entry, id: String(entry.id || ''), sets: Math.max(1, Number.parseInt(entry.sets, 10) || 3), reps: Math.max(1, Number.parseInt(entry.reps, 10) || 10), unit: entry.unit === 'seconds' ? 'seconds' : 'reps', weight: Math.max(0, Number(entry.weight) || 0), rest: Math.max(0, Number.parseInt(entry.rest, 10) || 60), notes: typeof entry.notes === 'string' ? entry.notes : '' };
      }),
      active: item.active !== false
    };
  });
  next.workoutSessions = arrayOrEmpty(next.workoutSessions).map((session, index) => {
    const item = objectOrEmpty(session);
    return {
      ...item,
      id: typeof item.id === 'string' && item.id ? item.id : `session-${index}`,
      title: typeof item.title === 'string' ? item.title : 'Workout session',
      date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : getDayKey(),
      startedAt: Number.isFinite(Number(item.startedAt)) ? Number(item.startedAt) : Date.now(),
      finishedAt: Number.isFinite(Number(item.finishedAt)) ? Number(item.finishedAt) : Date.now(),
      durationSeconds: Math.max(0, Number(item.durationSeconds) || 0),
      volume: Math.max(0, Number(item.volume) || 0),
      prs: arrayOrEmpty(item.prs),
      exercises: arrayOrEmpty(item.exercises).map(exercise => {
        const entry = objectOrEmpty(exercise);
        return {
          ...entry,
          id: String(entry.id || ''),
          name: typeof entry.name === 'string' ? entry.name : 'Exercise',
          muscle: typeof entry.muscle === 'string' ? entry.muscle : 'Other',
          unit: entry.unit === 'seconds' ? 'seconds' : 'reps',
          sets: arrayOrEmpty(entry.sets).map(set => {
            const result = objectOrEmpty(set);
            return { reps: Math.max(0, Number(result.reps) || 0), weight: Math.max(0, Number(result.weight) || 0), unit: result.unit === 'seconds' ? 'seconds' : 'reps' };
          })
        };
      })
    };
  });
  next.workoutPosts = arrayOrEmpty(next.workoutPosts).map((post, index) => {
    const item = objectOrEmpty(post);
    return {
      ...item,
      id: typeof item.id === 'string' && item.id ? item.id : `post-${index}`,
      date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : getDayKey(),
      text: typeof item.text === 'string' ? item.text : '',
      mood: typeof item.mood === 'string' ? item.mood : 'steady',
      energy: Math.max(1, Math.min(10, Number.parseInt(item.energy, 10) || 7)),
      exercises: arrayOrEmpty(item.exercises),
      photo: typeof item.photo === 'string' && /^data:image\/(?:jpeg|png|webp);base64,/.test(item.photo) && item.photo.length < 1_000_000 ? item.photo : '',
      private: true
    };
  });
  const workoutPrefs = { ...defaults().workoutPrefs, ...objectOrEmpty(next.workoutPrefs) };
  next.workoutPrefs = { sound: Boolean(workoutPrefs.sound), vibration: Boolean(workoutPrefs.vibration), equipment: ['gym', 'dumbbells', 'bodyweight'].includes(workoutPrefs.equipment) ? workoutPrefs.equipment : 'gym' };
  next.devotionalRead = objectOrEmpty(next.devotionalRead);
  next.prayer = objectOrEmpty(next.prayer);
  next.faithPlan = { ...defaults().faithPlan, ...objectOrEmpty(next.faithPlan), completedDays: arrayOrEmpty(next.faithPlan?.completedDays) };
  const worship = objectOrEmpty(next.worshipSeries);
  next.worshipSeries = {
    active: typeof worship.active === 'string' ? worship.active : '',
    level: ['gentle', 'standard', 'push'].includes(worship.level) ? worship.level : next.workoutExperience === 'advanced' ? 'push' : 'standard',
    progress: Object.fromEntries(Object.entries(objectOrEmpty(worship.progress)).map(([id, days]) => [id, arrayOrEmpty(days).map(Number).filter(Number.isInteger)]))
  };
  next.prayerEntries = arrayOrEmpty(next.prayerEntries);
  next.prayerRequests = arrayOrEmpty(next.prayerRequests);
  next.scriptureCards = arrayOrEmpty(next.scriptureCards);
  next.gratitude = arrayOrEmpty(next.gratitude);
  const focusPrefs = { ...defaults().focusPrefs, ...objectOrEmpty(next.focusPrefs) };
  next.focusPrefs = {
    focusMinutes: Math.max(1, Math.min(120, Number.parseInt(focusPrefs.focusMinutes, 10) || 25)),
    shortBreakMinutes: Math.max(1, Math.min(60, Number.parseInt(focusPrefs.shortBreakMinutes, 10) || 5)),
    longBreakMinutes: Math.max(1, Math.min(90, Number.parseInt(focusPrefs.longBreakMinutes, 10) || 15)),
    longBreakEvery: Math.max(2, Math.min(8, Number.parseInt(focusPrefs.longBreakEvery, 10) || 4)),
    witherOnLeave: Boolean(focusPrefs.witherOnLeave),
    witherAfterSeconds: Math.max(10, Math.min(3600, Number.parseInt(focusPrefs.witherAfterSeconds, 10) || 60)),
    ambientVolume: Math.max(0, Math.min(1, Number.isFinite(Number(focusPrefs.ambientVolume)) ? Number(focusPrefs.ambientVolume) : 0.2))
  };
  next.focusTasks = arrayOrEmpty(next.focusTasks);
  next.studyNotes = arrayOrEmpty(next.studyNotes).filter(note => note && typeof note.id === 'string').map(note => ({
    id: note.id,
    title: typeof note.title === 'string' ? note.title.slice(0, 120) : '',
    body: typeof note.body === 'string' ? note.body.slice(0, 20000) : '',
    notebook: typeof note.notebook === 'string' && note.notebook ? note.notebook : 'General',
    pinned: Boolean(note.pinned),
    skipCards: arrayOrEmpty(note.skipCards).filter(id => typeof id === 'string'),
    ...(Array.isArray(note.aiCards) && note.aiCards.length ? { aiCards: note.aiCards.filter(card => typeof card?.front === 'string' && typeof card?.back === 'string').slice(0, 40) } : {}),
    createdAt: Number(note.createdAt) || Date.now(),
    updatedAt: Number(note.updatedAt) || Date.now()
  }));
  next.studyNotebooks = [...new Set(['General', ...arrayOrEmpty(next.studyNotebooks).filter(name => typeof name === 'string' && name.trim()).map(name => name.trim().slice(0, 40)), ...next.studyNotes.map(note => note.notebook)])];
  next.studyCards = objectOrEmpty(next.studyCards);
  next.focusSessions = arrayOrEmpty(next.focusSessions);
  next.gardenHistory = arrayOrEmpty(next.gardenHistory);
  next.accountSync = { ...defaults().accountSync, ...objectOrEmpty(next.accountSync) };
  next.plant = Number.isFinite(Number(next.plant)) ? Math.max(0, Number(next.plant)) : 0;
  next.chal = objectOrEmpty(next.chal);
  return next;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function readInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    const next = migrate(parsed);
    if (!saved || !parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return next;
  } catch {
    return defaults();
  }
}

let state = readInitialState();

export function getState() {
  return state;
}

export function getDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function update(mutator) {
  const draft = clone(state);
  mutator(draft);
  state = migrate(draft);
  const saved = persist();
  listeners.forEach(listener => listener(state));
  return saved;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setHabitOnDraft(draft, id, complete, key = getDayKey()) {
  draft.habits[key] ??= {};
  draft.habitXP[key] ??= {};
  if (Boolean(draft.habits[key][id]) === complete) return false;
  draft.habits[key][id] = complete;
  if (complete && !draft.habitXP[key][id]) {
    draft.habitXP[key][id] = true;
    draft.xp += 5;
  }
  return true;
}

export function setHabit(id, complete) {
  return update(draft => setHabitOnDraft(draft, id, complete));
}

export function logHabit(id, status, note = '', date = getDayKey()) {
  if (!['yes', 'no', 'skip'].includes(status)) return false;
  update(draft => {
    draft.habitLogs[date] ??= {};
    draft.habitLogs[date][id] = { status, note: String(note).slice(0, 500), updatedAt: Date.now(), freeze: false };
    setHabitOnDraft(draft, id, status === 'yes', date);
  });
  return true;
}

export function useHabitFreeze(id, date = getDayKey()) {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  const week = getDayKey(parsed);
  const existing = state.habitLogs[date]?.[id];
  const habit = state.habitDefinitions.find(item => item.id === id);
  if (!habit || !isScheduled(habit, parseHabitDate(date), state.habitLogs) || state.habitFreezeWeeks[week] || existing?.status === 'yes' || existing?.freeze) return false;
  update(draft => {
    draft.habitLogs[date] ??= {};
    draft.habitLogs[date][id] = { status: 'skip', note: 'Weekly streak freeze used', updatedAt: Date.now(), freeze: true };
    draft.habits[date] ??= {};
    draft.habits[date][id] = false;
    draft.habitFreezeWeeks[week] = { date, habitId: id };
  });
  return true;
}

export function setWater(amount) {
  return update(draft => {
    const key = getDayKey();
    draft.water[key] = Math.max(0, Math.min(99, Number(amount) || 0));
    if (draft.water[key] >= 8 || draft.habits[key]?.water) {
      const complete = draft.water[key] >= 8;
      setHabitOnDraft(draft, 'water', complete, key);
      draft.habitLogs[key] ??= {};
      draft.habitLogs[key].water = { status: complete ? 'yes' : 'no', note: '', updatedAt: Date.now(), freeze: false };
    }
  });
}

export function finishFocusSession(session) {
  return update(draft => {
    const type = session.type === 'break' ? 'break' : 'focus';
    const key = session.date || getDayKey();
    const saved = {
      id: session.id || `focus-${Date.now()}`,
      type,
      date: key,
      startedAt: Number(session.startedAt) || Date.now(),
      finishedAt: Number(session.finishedAt) || Date.now(),
      focusMinutes: Math.max(0, Number(session.focusMinutes) || 0),
      durationSeconds: Math.max(0, Number(session.durationSeconds) || 0),
      taskId: session.taskId || '',
      withered: Boolean(session.withered)
    };
    draft.focusSessions.unshift(saved);
    if (type === 'focus') {
      draft.firstWeek.focusSession = true;
      setHabitOnDraft(draft, 'focus', true, key);
      draft.gardenHistory.unshift({ sessionId: saved.id, date: key, outcome: saved.withered ? 'withered' : 'grown' });
      if (!saved.withered) draft.plant += 1;
      if (!draft.focusXP[key]) {
        draft.focusXP[key] = true;
        draft.xp += Math.min(45, Math.max(1, saved.focusMinutes));
      }
    }
  });
}

export function completeFocus(minutes) {
  return finishFocusSession({ type: 'focus', focusMinutes: minutes, durationSeconds: Number(minutes) * 60 });
}

export function finishOnboarding(preferences = {}, skipped = false) {
  return update(draft => {
    if (typeof preferences.name === 'string') draft.name = preferences.name.trim().slice(0, 40);
    if (Array.isArray(preferences.goals)) draft.profileGoals = preferences.goals;
    if (Array.isArray(preferences.starterHabits)) draft.starterHabits = preferences.starterHabits;
    if (preferences.workoutExperience) draft.workoutExperience = preferences.workoutExperience;
    if (preferences.workoutDays) draft.workoutDays = preferences.workoutDays;
    if (preferences.reminders) draft.reminders = { ...draft.reminders, ...preferences.reminders };
    draft.onboarding = { completed: true, skipped, startedAt: draft.onboarding.startedAt || Date.now() };
  });
}

export function markFirstWeek(task) {
  if (!Object.hasOwn(defaults().firstWeek, task)) return false;
  update(draft => { draft.firstWeek[task] = true; });
  return true;
}

export function recordWorkout(title, minutes) {
  return update(draft => {
    draft.workoutLogs.unshift({ id: `workout-${Date.now()}`, title, minutes, date: getDayKey() });
    draft.firstWeek.workoutLogged = true;
  });
}

export function addCalendarEvent(event) {
  return update(draft => {
    draft.calendarEvents.unshift({ ...event, id: event.id || `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    draft.firstWeek.calendarEvent = true;
  });
}

export function updateCalendarEvent(id, changes) {
  return update(draft => {
    const event = draft.calendarEvents.find(item => item.id === id);
    if (event) Object.assign(event, changes);
  });
}

export function markDevotionalRead() {
  return update(draft => {
    draft.devotionalRead[getDayKey()] = true;
    draft.firstWeek.devotionalRead = true;
  });
}

export function completeChallenge() {
  const key = getDayKey();
  if (state.chal[key]) return false;
  update(draft => {
    draft.chal[key] = true;
    draft.xp += 20;
  });
  return true;
}

export function clearData() {
  const previous = clone(state);
  state = defaults();
  persist();
  listeners.forEach(listener => listener(state));
  return previous;
}

export function restoreData(value) {
  state = migrate(value);
  persist();
  listeners.forEach(listener => listener(state));
}

export function exportData() {
  return JSON.stringify(state, null, 2);
}

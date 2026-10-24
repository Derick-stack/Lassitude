import { clearData, getState, update } from './store.js';
import { supabaseConfigured } from './config.js';

let clientPromise;
let syncing = false;
let syncTimer = 0;
let unsubscribe = null;
let lastSyncSignature = '';

async function getClient() {
  if (!supabaseConfigured) return null;
  clientPromise ||= import('./auth.js').then(module => module.supabase);
  return clientPromise;
}

export function hasGuestData(state = getState()) {
  const builtInHabits = ['workout', 'scripture', 'water', 'focus'];
  const customizedHabits = state.habitDefinitions.some(habit => !builtInHabits.includes(habit.id) || habit.archived || habit.schedule?.type !== 'daily');
  return Boolean(state.name || state.xp || state.plant || state.onboarding.completed || customizedHabits || Object.keys(state.habitLogs).length || Object.keys(state.habits).length || state.calendarEvents.length || state.workoutSessions.length || state.workoutRoutines.some(routine => !routine.programId) || state.journal.length || state.prayerEntries.length || state.prayerRequests.length || state.scriptureCards.length || state.gratitude.length || state.focusSessions.length || state.focusTasks.length || state.goals.length || state.miles.length || state.vision.length || state.workoutPosts.length || Object.keys(state.water).length || Object.keys(state.prayer).length);
}

export async function syncOnSignIn(user, confirmDialog, toast) {
  const client = await getClient();
  if (!client || !user) return { ok: false, reason: 'not-configured' };
  let state = getState();
  let sync = state.accountSync || {};
  if (sync.migratedUserId && sync.migratedUserId !== user.id) {
    const confirmed = await confirmDialog({
      title: 'Switch Supabase account?',
      message: 'This browser is linked to another account. Local changes are never sent to the new account automatically. Export any un-synced work first; continuing clears this local cache and loads the account you just signed into.',
      confirmLabel: 'Switch account',
      danger: true
    });
    if (!confirmed) return { ok: false, reason: 'declined', accountSwitch: true };
    clearData();
    state = getState();
    sync = state.accountSync;
  }
  if (sync.migratedUserId !== user.id && hasGuestData(state)) {
    const confirmed = await confirmDialog({
      title: 'Sync this browser’s guest data?',
      message: 'Habits, plans, workout history, calendar items, notes, and settings from this browser will be copied to your account. No passwords are included. Existing account rows with matching IDs may be updated.',
      confirmLabel: 'Sync guest data'
    });
    if (!confirmed) return { ok: false, reason: 'declined' };
    const result = await uploadState(client, user.id, getState(), false);
    if (!result.ok) { toast(`Could not sync guest data: ${result.message}`); return result; }
    update(draft => { draft.accountSync = { migratedUserId: user.id, lastSyncedAt: new Date().toISOString(), snapshotHash: syncSignature(draft) }; });
  } else if (sync.migratedUserId === user.id && sync.snapshotHash && sync.snapshotHash !== syncSignature(state)) {
    const result = await uploadState(client, user.id, state, true);
    if (!result.ok) { toast(`Could not sync local changes: ${result.message}`); return result; }
    update(draft => { draft.accountSync = { migratedUserId: user.id, lastSyncedAt: new Date().toISOString(), snapshotHash: syncSignature(draft) }; });
  }
  const downloaded = await downloadState(client);
  if (!downloaded.ok) { toast(`Cloud sync could not load: ${downloaded.message}`); return downloaded; }
  if (downloaded.data) mergeCloudState(downloaded.data, user.id);
  await startAutoSync(user.id, client, toast);
  return { ok: true };
}

async function startAutoSync(userId, client, toast) {
  unsubscribe?.();
  unsubscribe = null;
  const { subscribe } = await import('./store.js');
  lastSyncSignature = syncSignature(getState());
  unsubscribe = subscribe(state => {
    if (syncing || state.accountSync.migratedUserId !== userId || syncSignature(state) === lastSyncSignature) return;
    queueSync(userId, client, toast);
  });
}

export function stopAutoSync() {
  unsubscribe?.();
  unsubscribe = null;
  window.clearTimeout(syncTimer);
}

function syncSignature(state) {
  const { accountSync, ...syncable } = state;
  return JSON.stringify(syncable);
}

function queueSync(userId, client, toast) {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(async () => {
    const snapshot = getState();
    const signature = syncSignature(snapshot);
    const result = await uploadState(client, userId, snapshot, true);
    if (!result.ok) { toast(`Cloud sync paused: ${result.message}`); return; }
    lastSyncSignature = signature;
    update(state => { state.accountSync = { ...state.accountSync, lastSyncedAt: new Date().toISOString(), snapshotHash: signature }; });
    if (syncSignature(getState()) !== lastSyncSignature) queueSync(userId, client, toast);
  }, 1200);
}

async function upsertRows(client, table, rows, conflict) {
  if (!rows.length) return { data: [], error: null };
  return client.from(table).upsert(rows, { onConflict: conflict });
}

function buildRows(userId, state) {
  const base = { user_id: userId };
  return {
    profiles: [{ ...base, display_name: state.name, avatar: state.avatar || '' }],
    settings: [{ ...base, data: { name: state.name, xp: state.xp, theme: state.theme, light: state.light, appPrefs: state.appPrefs, reminders: state.reminders, focusPrefs: state.focusPrefs, workoutPrefs: state.workoutPrefs, workoutExperience: state.workoutExperience, workoutDays: state.workoutDays, profileGoals: state.profileGoals, starterHabits: state.starterHabits, onboarding: state.onboarding, firstWeek: state.firstWeek, habitXP: state.habitXP, focusXP: state.focusXP, habitFreezeWeeks: state.habitFreezeWeeks, habits: state.habits, custom: state.custom, devotionalRead: state.devotionalRead, chal: state.chal, plant: state.plant, workoutLogs: state.workoutLogs, miles: state.miles, vision: state.vision, faithPlan: state.faithPlan, worshipSeries: state.worshipSeries } }],
    habits: state.habitDefinitions.map(habit => ({ ...base, habit_id: habit.id, title: habit.title, schedule: habit.schedule, archived: habit.archived, sort_order: habit.order })),
    habit_logs: Object.entries(state.habitLogs).flatMap(([date, logs]) => Object.entries(logs).map(([habitId, log]) => ({ ...base, habit_id: habitId, log_date: date, status: log.status, note: log.note || '', frozen: Boolean(log.freeze), updated_at: log.updatedAt || Date.now() }))),
    workouts: state.workoutRoutines.map(routine => ({ ...base, routine_id: routine.id, title: routine.title, schedule_days: routine.days, data: routine })),
    workout_sessions: state.workoutSessions.map(session => ({ ...base, session_id: session.id, session_date: session.date, data: session })),
    workout_posts: state.workoutPosts.map(post => ({ ...base, post_id: post.id, post_date: post.date, data: post })),
    calendar_events: state.calendarEvents.map(event => ({ ...base, event_id: event.id, event_date: event.date, title: event.title, event_type: event.type, event_time: event.time, recurrence: event.recurrence, data: event })),
    goals: state.goals.map((goal, index) => ({ ...base, entry_id: goal.id || `goal-${index}-${goal.title || goal.t}`, title: goal.title || goal.t, due_date: goal.dueDate || null, data: goal })),
    journal_entries: state.journal.map((entry, index) => ({ ...base, entry_id: entry.id || `journal-${entry.date}-${index}`, entry_date: entry.date || entry.d, kind: entry.type || 'reflection', data: entry })),
    prayer_entries: state.prayerEntries.map(entry => ({ ...base, entry_id: entry.id, entry_date: entry.date, data: entry })),
    prayer_requests: state.prayerRequests.map(entry => ({ ...base, entry_id: entry.id, entry_date: entry.date, data: entry })),
    scripture_cards: state.scriptureCards.map(entry => ({ ...base, card_id: entry.id, reference: entry.reference, due_date: entry.dueDate, data: entry })),
    gratitude_entries: state.gratitude.map(entry => ({ ...base, entry_id: entry.id, entry_date: entry.date, data: entry })),
    focus_sessions: state.focusSessions.map(entry => ({ ...base, session_id: entry.id, session_date: entry.date, data: entry })),
    focus_tasks: state.focusTasks.map(entry => ({ ...base, task_id: entry.id, title: entry.title, data: entry })),
    focus_garden: state.gardenHistory.map((entry, index) => ({ ...base, entry_id: entry.sessionId || `garden-${index}`, entry_date: entry.date, outcome: entry.outcome, data: entry })),
    water_logs: Object.entries(state.water).map(([date, amount]) => ({ ...base, log_date: date, amount })),
    prayer_time_logs: Object.entries(state.prayer).map(([date, minutes]) => ({ ...base, log_date: date, minutes })),
    future_items: [
      ...state.miles.map((item, index) => ({ ...base, entry_id: item.id || `milestone-${index}-${item.title || item.t}`, kind: 'milestone', data: item })),
      ...state.vision.map((item, index) => ({ ...base, entry_id: item.id || `vision-${index}-${item.title || item.t}`, kind: 'vision', data: item }))
    ]
  };
}

const conflictKeys = {
  profiles: 'user_id', settings: 'user_id', habits: 'user_id,habit_id', habit_logs: 'user_id,habit_id,log_date',
  workouts: 'user_id,routine_id', workout_sessions: 'user_id,session_id', workout_posts: 'user_id,post_id',
  calendar_events: 'user_id,event_id', goals: 'user_id,entry_id', journal_entries: 'user_id,entry_id',
  prayer_entries: 'user_id,entry_id', prayer_requests: 'user_id,entry_id', scripture_cards: 'user_id,card_id',
  gratitude_entries: 'user_id,entry_id', focus_sessions: 'user_id,session_id', focus_tasks: 'user_id,task_id',
  focus_garden: 'user_id,entry_id', water_logs: 'user_id,log_date', prayer_time_logs: 'user_id,log_date', future_items: 'user_id,entry_id'
};

const keyFields = {
  habits: ['habit_id'], habit_logs: ['habit_id', 'log_date'], workouts: ['routine_id'],
  workout_sessions: ['session_id'], workout_posts: ['post_id'], calendar_events: ['event_id'],
  goals: ['entry_id'], journal_entries: ['entry_id'], prayer_entries: ['entry_id'],
  prayer_requests: ['entry_id'], scripture_cards: ['card_id'], gratitude_entries: ['entry_id'],
  focus_sessions: ['session_id'], focus_tasks: ['task_id'], focus_garden: ['entry_id'],
  water_logs: ['log_date'], prayer_time_logs: ['log_date'], future_items: ['entry_id']
};

async function uploadState(client, userId, state, prune = false) {
  syncing = true;
  try {
    const rows = buildRows(userId, state);
    for (const [table, data] of Object.entries(rows)) {
      const { error } = await upsertRows(client, table, data, conflictKeys[table]);
      if (error) return { ok: false, message: error.message };
      if (prune && keyFields[table]) {
        const fields = keyFields[table];
        const { data: existing, error: readError } = await client.from(table).select(fields.join(',')).eq('user_id', userId);
        if (readError) return { ok: false, message: readError.message };
        for (const row of existing || []) {
          const retained = data.some(item => fields.every(field => item[field] === row[field]));
          if (retained) continue;
          let deletion = client.from(table).delete().eq('user_id', userId);
          fields.forEach(field => { deletion = deletion.eq(field, row[field]); });
          const { error: deleteError } = await deletion;
          if (deleteError) return { ok: false, message: deleteError.message };
        }
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unknown sync error' };
  } finally {
    syncing = false;
  }
}

async function downloadState(client) {
  const tables = Object.keys(conflictKeys);
  try {
    const results = await Promise.all(tables.map(table => client.from(table).select('*')));
    const failed = results.find(result => result.error);
    if (failed) return { ok: false, message: failed.error.message };
    const data = Object.fromEntries(tables.map((table, index) => [table, results[index].data || []]));
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unknown download error' };
  }
}

function mergeCloudState(cloud, userId) {
  syncing = true;
  const profile = cloud.profiles[0];
  const settings = cloud.settings[0]?.data || {};
  update(state => {
    if (profile) { state.name = profile.display_name ?? ''; state.avatar = profile.avatar ?? ''; }
    Object.assign(state, {
      xp: settings.xp ?? state.xp,
      theme: settings.theme ?? state.theme,
      light: settings.light ?? state.light,
      appPrefs: settings.appPrefs ?? state.appPrefs,
      reminders: settings.reminders ?? state.reminders,
      focusPrefs: settings.focusPrefs ?? state.focusPrefs,
      workoutPrefs: settings.workoutPrefs ?? state.workoutPrefs,
      workoutExperience: settings.workoutExperience ?? state.workoutExperience,
      workoutDays: settings.workoutDays ?? state.workoutDays,
      name: settings.name ?? state.name,
      profileGoals: settings.profileGoals ?? state.profileGoals,
      starterHabits: settings.starterHabits ?? state.starterHabits,
      onboarding: settings.onboarding ?? state.onboarding,
      firstWeek: settings.firstWeek ?? state.firstWeek,
      habitXP: settings.habitXP ?? state.habitXP,
      focusXP: settings.focusXP ?? state.focusXP,
      habitFreezeWeeks: settings.habitFreezeWeeks ?? state.habitFreezeWeeks,
      habits: settings.habits ?? state.habits,
      custom: settings.custom ?? state.custom,
      devotionalRead: settings.devotionalRead ?? state.devotionalRead,
      chal: settings.chal ?? state.chal,
      plant: settings.plant ?? state.plant,
      workoutLogs: settings.workoutLogs ?? state.workoutLogs,
      miles: settings.miles ?? state.miles,
      vision: settings.vision ?? state.vision,
      faithPlan: settings.faithPlan ?? state.faithPlan,
      worshipSeries: settings.worshipSeries ?? state.worshipSeries
    });
    state.workoutRoutines = cloud.workouts.map(row => row.data);
    state.workoutSessions = cloud.workout_sessions.map(row => row.data);
    state.workoutPosts = cloud.workout_posts.map(row => row.data);
    state.calendarEvents = cloud.calendar_events.map(row => row.data);
    state.goals = cloud.goals.map(row => row.data);
    state.journal = cloud.journal_entries.map(row => row.data);
    state.prayerEntries = cloud.prayer_entries.map(row => row.data);
    state.prayerRequests = cloud.prayer_requests.map(row => row.data);
    state.scriptureCards = cloud.scripture_cards.map(row => row.data);
    state.gratitude = cloud.gratitude_entries.map(row => row.data);
    state.focusSessions = cloud.focus_sessions.map(row => row.data);
    state.focusTasks = cloud.focus_tasks.map(row => row.data);
    state.gardenHistory = cloud.focus_garden.map(row => row.data);
    state.habitDefinitions = cloud.habits.map(row => ({ id: row.habit_id, title: row.title, schedule: row.schedule, archived: row.archived, order: row.sort_order }));
    state.habitLogs = {};
    cloud.habit_logs.forEach(row => {
      state.habitLogs[row.log_date] ??= {};
      state.habitLogs[row.log_date][row.habit_id] = { status: row.status, note: row.note || '', freeze: row.frozen, updatedAt: row.updated_at };
    });
    state.water = Object.fromEntries(cloud.water_logs.map(row => [row.log_date, row.amount]));
    state.prayer = Object.fromEntries(cloud.prayer_time_logs.map(row => [row.log_date, row.minutes]));
    const future = cloud.future_items;
    state.miles = future.filter(row => row.kind === 'milestone').map(row => row.data);
    state.vision = future.filter(row => row.kind === 'vision').map(row => row.data);
    state.accountSync = { migratedUserId: userId, lastSyncedAt: new Date().toISOString(), snapshotHash: '' };
  });
  update(state => { state.accountSync.snapshotHash = syncSignature(state); });
  syncing = false;
}

export async function syncNow(toast = () => {}, confirmDialog) {
  const client = await getClient();
  if (!client) return { ok: false, message: 'Supabase is not configured.' };
  const { data: { session } } = await client.auth.getSession();
  if (!session?.user) return { ok: false, message: 'Sign in to sync.' };
  return syncOnSignIn(session.user, confirmDialog, toast);
}

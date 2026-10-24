import { supabaseConfigured } from './config.js';
import { getDayKey, getState, markDevotionalRead, setWater } from './store.js';
import { habitChain, isScheduled, parseHabitDate } from './habit-utils.js';
import { $, h, toast } from './ui.js';

// NADIR works offline from the visitor's own Lassitude data. When accounts are configured and the
// visitor is signed in, it asks the `nadir-coach` Edge Function (Claude) instead and falls back to
// the offline coach if that call fails.

const HISTORY_KEY = 'lassitude-nadir-chat';
const MAX_HISTORY = 40;
const SUGGESTIONS = ['Plan my day', 'Quick workout', 'Help me focus', 'Verse for today', 'I’m tired', 'How am I doing?'];

const verses = [
  ['Whether therefore ye eat, or drink, or whatsoever ye do, do all to the glory of God.', '1 Corinthians 10:31'],
  ['For bodily exercise profiteth little: but godliness is profitable unto all things.', '1 Timothy 4:8'],
  ['I can do all things through Christ which strengtheneth me.', 'Philippians 4:13'],
  ['They that wait upon the LORD shall renew their strength; they shall run, and not be weary.', 'Isaiah 40:31'],
  ['Let us not be weary in well doing: for in due season we shall reap, if we faint not.', 'Galatians 6:9'],
  ['Commit thy works unto the LORD, and thy thoughts shall be established.', 'Proverbs 16:3'],
  ['Come unto me, all ye that labour and are heavy laden, and I will give you rest.', 'Matthew 11:28'],
  ['Be strong and of a good courage; be not afraid, neither be thou dismayed.', 'Joshua 1:9']
];

const workoutsByLevel = {
  beginner: ['10 bodyweight squats', '5–8 push-ups (knees are fine)', '20-second plank', '10 glute bridges'],
  intermediate: ['15 squats', '12 push-ups', '10 reverse lunges per leg', '40-second plank'],
  advanced: ['20 jump squats', '20 push-ups', '12 Bulgarian split squats per leg', '60-second plank']
};

const dayOffset = (days, from = new Date()) => { const date = new Date(from); date.setDate(date.getDate() - days); return getDayKey(date); };
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const pick = values => values[Math.floor(Date.now() / 864e5) % values.length];

export function buildContext(state = getState(), now = new Date()) {
  const today = getDayKey(now);
  const weekKeys = new Set(Array.from({ length: 7 }, (_, index) => dayOffset(index, now)));
  const habits = state.habitDefinitions.filter(habit => !habit.archived);
  const dueToday = habits.filter(habit => isScheduled(habit, parseHabitDate(today), state.habitLogs) || state.habitLogs[today]?.[habit.id]);
  const isDone = habit => state.habitLogs[today]?.[habit.id]?.status === 'yes' || Boolean(state.habits[today]?.[habit.id]);
  const streaks = habits.map(habit => ({ title: habit.title, days: habitChain(habit, state.habitLogs, now) })).sort((a, b) => b.days - a.days);
  // Guided sessions are also written to workoutLogs with the same id, so count each id once.
  const loggedIds = new Set(state.workoutLogs.map(log => log.id));
  const workouts = [
    ...state.workoutLogs.map(log => ({ date: log.date || log.d, minutes: Number(log.minutes) || 0, title: log.title })),
    ...state.workoutSessions.filter(session => !loggedIds.has(session.id)).map(session => ({ date: session.date, minutes: Math.round((session.durationSeconds || 0) / 60), title: session.title }))
  ].filter(workout => workout.date).sort((a, b) => b.date.localeCompare(a.date));
  const weekWorkouts = workouts.filter(workout => weekKeys.has(workout.date));
  const focus = state.focusSessions.filter(session => session.type === 'focus' && !session.withered);
  const focusToday = focus.filter(session => session.date === today);
  const lastWorkout = workouts[0];
  return {
    name: state.name,
    hour: now.getHours(),
    goals: state.profileGoals,
    level: state.workoutExperience,
    plannedWorkoutDays: state.workoutDays,
    habitsDone: dueToday.filter(isDone).map(habit => habit.title),
    habitsLeft: dueToday.filter(habit => !isDone(habit)).map(habit => habit.title),
    bestStreak: streaks[0] && streaks[0].days > 0 ? streaks[0] : null,
    workoutsThisWeek: weekWorkouts.length,
    workoutMinutesThisWeek: weekWorkouts.reduce((sum, workout) => sum + workout.minutes, 0),
    daysSinceWorkout: lastWorkout ? Math.round((parseHabitDate(today) - parseHabitDate(lastWorkout.date)) / 864e5) : null,
    workedOutToday: lastWorkout?.date === today,
    focusMinutesToday: focusToday.reduce((sum, session) => sum + (session.focusMinutes || 0), 0),
    focusSessionsThisWeek: focus.filter(session => weekKeys.has(session.date)).length,
    devotionalToday: Boolean(state.devotionalRead[today]),
    waterToday: Number(state.water[today]) || 0,
    xp: state.xp
  };
}

// Plain-language summary sent to the AI coach. Kept short and free of anything but the visitor's own progress.
export function describeContext(context) {
  const lines = [
    context.name && `Name: ${context.name}`,
    `Local time: ${String(context.hour).padStart(2, '0')}:00`,
    context.goals.length && `Priorities: ${context.goals.join(', ')}`,
    `Fitness level: ${context.level}, plans ${context.plannedWorkoutDays} workout days a week`,
    `Habits done today: ${context.habitsDone.join(', ') || 'none yet'}`,
    `Habits still open today: ${context.habitsLeft.join(', ') || 'none'}`,
    context.bestStreak && `Best current streak: ${context.bestStreak.title}, ${context.bestStreak.days} days`,
    `Workouts in the last 7 days: ${context.workoutsThisWeek} (${context.workoutMinutesThisWeek} minutes)`,
    context.daysSinceWorkout !== null && `Days since last workout: ${context.daysSinceWorkout}`,
    `Focus minutes today: ${context.focusMinutesToday}`,
    `Devotional read today: ${context.devotionalToday ? 'yes' : 'no'}`,
    `Glasses of water today: ${context.waterToday}`
  ];
  return lines.filter(Boolean).join('\n');
}

const link = (label, href) => ({ label, href });
const act = (label, run) => ({ label, run });
const actions = {
  focus: link('Start a focus session', 'focus.html'),
  workouts: link('Open workouts', 'workouts.html'),
  worship: link('Start a worship workout', 'workouts.html#worship'),
  habits: link('Open habits', 'habits.html'),
  faith: link('Open faith page', 'faith.html'),
  progress: link('See progress', 'progress.html'),
  water: act('Log a glass of water', () => { setWater((Number(getState().water[getDayKey()]) || 0) + 1); return `Logged. That’s ${plural(Number(getState().water[getDayKey()]) || 0, 'glass')} today.`; }),
  devotional: act('Mark devotional read', () => { markDevotionalRead(); return 'Devotional marked as read for today.'; })
};

const intents = [
  { id: 'crisis', test: /suicid|kill myself|end (it|my life)|self.?harm|want to die|hurt myself|no reason to live/ },
  { id: 'stress', test: /stress|anxi|worr|overwhelm|sad|down|depress|lonely|angry/ },
  { id: 'plan', test: /plan|what (should|do) i do|where (do|should) i start|next step|routine|schedule|my day/ },
  { id: 'workout', test: /work ?out|exercise|train|gym|lift|cardio|run|push.?up|squat|strength|muscle/ },
  { id: 'tired', test: /tired|exhaust|sleep|rest|sore|burn(ed|t)? out|no energy|fatigue|sick/ },
  { id: 'focus', test: /focus|study|distract|procrastinat|concentrat|productiv|lazy|phone/ },
  { id: 'faith', test: /faith|pray|prayer|scripture|bible|verse|god|jesus|christ|church|devotion|worship|spirit/ },
  { id: 'food', test: /food|eat|meal|diet|nutrition|protein|snack|junk|sugar|hungry|calorie|breakfast|lunch|dinner/ },
  { id: 'water', test: /water|hydrat|drink/ },
  { id: 'progress', test: /progress|how am i|how('?m| am) i doing|stats|streak|week|review/ },
  { id: 'motivation', test: /motivat|give up|quit|discipline|consisten|habit|can'?t|struggl|fail/ },
  { id: 'thanks', test: /^(thanks|thank you|thx|ty)\b/ },
  { id: 'greeting', test: /^(hi|hey|hello|yo|good (morning|afternoon|evening)|sup)\b/ }
];

export function offlineReply(message, context = buildContext()) {
  const text = message.toLowerCase();
  const matched = intents.filter(intent => intent.test.test(text)).map(intent => intent.id);
  if (matched.includes('crisis')) {
    return { text: 'I’m really glad you told me. You deserve support from a real person right now. In the U.S., call or text 988 (Suicide & Crisis Lifeline), or call 911 if you are in danger. Outside the U.S., contact your local emergency number. If you can, tell someone near you how you feel.', actions: [] };
  }
  const topics = matched.filter(id => !['greeting', 'thanks'].includes(id)).slice(0, 2);
  if (!topics.length) {
    if (matched.includes('thanks')) return { text: 'Anytime. Keep stacking small wins today.', actions: [] };
    if (matched.includes('greeting')) return reply.plan(context, true);
    return { text: 'I can help you plan your day, pick a workout, focus, pray, eat well, or review your progress. Try one of the suggestions below, or tell me what you’re working on.', actions: [] };
  }
  const parts = topics.map(topic => reply[topic](context));
  return { text: parts.map(part => part.text).join('\n\n'), actions: parts.flatMap(part => part.actions).slice(0, 3) };
}

const reply = {
  plan(context, greeting = false) {
    const hello = greeting ? `${context.hour < 12 ? 'Good morning' : context.hour < 18 ? 'Good afternoon' : 'Good evening'}${context.name ? `, ${context.name}` : ''}. ` : '';
    const steps = [];
    if (!context.devotionalToday) steps.push('read today’s verse and pray for two minutes');
    if (!context.workedOutToday) steps.push(context.daysSinceWorkout !== null && context.daysSinceWorkout >= 3 ? 'get a 15-minute workout in (it’s been a few days)' : 'move for 15–20 minutes');
    if (context.focusMinutesToday < 25) steps.push('do one 25-minute focus session on your most important task');
    if (context.waterToday < 8) steps.push(`drink water (${context.waterToday}/8 so far)`);
    const open = context.habitsLeft.length ? `\nStill open: ${context.habitsLeft.slice(0, 4).join(', ')}.` : '';
    if (!steps.length) return { text: `${hello}You’ve covered faith, movement, focus and water today. Well done. Finish with a short gratitude prayer and get to bed on time.${open}`, actions: [actions.habits] };
    const list = steps.slice(0, 3).map((step, index) => `${index + 1}. ${step[0].toUpperCase()}${step.slice(1)}`).join('\n');
    const next = !context.devotionalToday && !context.workedOutToday ? actions.worship : !context.devotionalToday ? actions.devotional : !context.workedOutToday ? actions.workouts : actions.focus;
    return { text: `${hello}Here’s your next best three:\n${list}${open}`, actions: [next, actions.habits] };
  },
  workout(context) {
    const moves = workoutsByLevel[context.level] || workoutsByLevel.beginner;
    const note = context.workedOutToday ? 'You already trained today, so keep this light or swap it for a walk. ' : context.daysSinceWorkout !== null && context.daysSinceWorkout >= 3 ? `It’s been ${plural(context.daysSinceWorkout, 'day')} since your last workout, so ease back in. ` : '';
    return { text: `${note}A 15-minute ${context.level} circuit, 3 rounds with 60 seconds rest:\n• ${moves.join('\n• ')}\nWarm up for 3 minutes first. Pray or play worship between rounds. Stop if anything hurts. This is general guidance, not medical advice.\nWant scripture and a timer with it? Try today’s worship workout.`, actions: [actions.worship, actions.workouts] };
  },
  tired(context) {
    const trained = context.workoutsThisWeek >= context.plannedWorkoutDays ? ` You’ve already hit ${plural(context.workoutsThisWeek, 'workout')} this week, so a rest day is earned.` : '';
    return { text: `Rest is part of stewardship, not a failure.${trained} Today: a 10-minute walk, gentle stretching, water, and lights out 30 minutes earlier. Aim for 7–9 hours. If you feel unwell or exhausted for days, check in with a doctor.`, actions: [actions.water] };
  },
  focus(context) {
    const done = context.focusMinutesToday ? `You’ve focused ${context.focusMinutesToday} minutes today. ` : '';
    return { text: `${done}Pick the one task that matters most, put your phone in another room, and start a 25-minute session. When your mind wanders, write the thought down and return. Take a 5-minute break after.`, actions: [actions.focus] };
  },
  faith(context) {
    const [verse, ref] = pick(verses);
    const status = context.devotionalToday ? 'You’ve already done your devotional today. ' : '';
    return { text: `${status}“${verse}” (${ref})\nReflect: where can you honor God with your body or time today? Pray about that one thing for two minutes.`, actions: context.devotionalToday ? [actions.faith] : [actions.devotional, actions.faith] };
  },
  food() {
    return { text: 'Keep it simple: build each meal around a protein (eggs, chicken, beans, fish, Greek yogurt), add a fruit or vegetable, and drink water before you reach for a snack. Plan tomorrow’s first meal tonight. Thank God for it before you eat; it slows you down. For specific needs, talk to a doctor or dietitian.', actions: [actions.water] };
  },
  water(context) {
    return { text: `You’re at ${plural(context.waterToday, 'glass')} today${context.waterToday >= 8 ? ', target hit' : ` of 8`}. Keep a bottle in sight and drink a glass with every meal.`, actions: [actions.water] };
  },
  stress() {
    return { text: 'Pause for 60 seconds: breathe in for 4, hold for 4, out for 6. Then pray Philippians 4:6–7 in your own words and name the one thing you can control next. A short walk helps too. If this feeling sticks around, talk to someone you trust or a counselor.', actions: [actions.faith] };
  },
  progress(context) {
    const habits = context.habitsDone.length + context.habitsLeft.length;
    const streak = context.bestStreak ? ` Best streak: ${context.bestStreak.title}, ${plural(context.bestStreak.days, 'day')}.` : '';
    const pace = context.workoutsThisWeek >= context.plannedWorkoutDays ? 'You’re on target for workouts.' : `That’s ${context.workoutsThisWeek} of your ${context.plannedWorkoutDays} planned workouts.`;
    return { text: `Today: ${context.habitsDone.length} of ${habits} habits, ${context.focusMinutesToday} focus minutes, devotional ${context.devotionalToday ? 'done' : 'not yet'}.\nLast 7 days: ${plural(context.workoutsThisWeek, 'workout')} (${context.workoutMinutesThisWeek} min), ${plural(context.focusSessionsThisWeek, 'focus session')}. ${pace}${streak}`, actions: [actions.progress] };
  },
  motivation(context) {
    const smallest = context.habitsLeft[0];
    return { text: `Don’t wait to feel motivated. Shrink the step until it’s easy: ${smallest ? `do just two minutes of “${smallest}” right now` : 'pick one habit and do two minutes of it now'}. Consistency is built by showing up on the hard days. “Let us not be weary in well doing” (Galatians 6:9).`, actions: [actions.habits] };
  }
};

async function aiReply(history, context) {
  if (!supabaseConfigured) return null;
  try {
    const { supabase } = await import('./auth.js');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const messages = history.filter(item => item.role === 'user' || item.role === 'assistant').slice(-12).map(({ role, text }) => ({ role, content: text }));
    while (messages.length && messages[0].role !== 'user') messages.shift();
    const { data, error } = await supabase.functions.invoke('nadir-coach', { body: { messages, context: describeContext(context) } });
    if (error || typeof data?.reply !== 'string') return null;
    return { text: data.reply, actions: [] };
  } catch {
    return null;
  }
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').filter(item => typeof item?.text === 'string'); } catch { return []; }
}
function saveHistory(history) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY))); } catch { /* History is a convenience; the chat still works without it. */ }
}

export function mountNadir(root) {
  const log = $('[data-nadir-log]', root);
  const form = $('[data-nadir-form]', root);
  const input = $('[data-nadir-input]', root);
  const send = $('button[type="submit"]', form);
  const chips = $('[data-nadir-chips]', root);
  const mode = $('[data-nadir-mode]', root);
  let history = loadHistory();
  let busy = false;

  const render = item => {
    const bubble = h('div', { class: `nadir-msg ${item.role === 'user' ? 'nadir-user' : 'nadir-bot'}` });
    item.text.split('\n').forEach((line, index) => { if (index) bubble.append(h('br')); bubble.append(line); });
    if (item.actions?.length) {
      const row = h('div', { class: 'nadir-actions' });
      item.actions.forEach(action => {
        if (action.href) row.append(h('a', { class: 'nadir-action', href: action.href }, action.label));
        else if (action.id && actionsById[action.id]) {
          const button = h('button', { type: 'button', class: 'nadir-action' }, action.label);
          button.addEventListener('click', () => { const result = actionsById[action.id].run(); toast(result); button.disabled = true; button.textContent = '✓ Done'; });
          row.append(button);
        }
      });
      bubble.append(row);
    }
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  };
  // Actions are stored by id so the buttons keep working after a reload.
  const actionsById = Object.fromEntries(Object.entries(actions).filter(([, action]) => action.run).map(([id, action]) => [id, action]));
  const serialize = list => list.map(action => action.href ? { label: action.label, href: action.href } : { label: action.label, id: Object.keys(actionsById).find(id => actionsById[id] === action) });

  const add = (role, text, itemActions = []) => {
    const item = { role, text, actions: serialize(itemActions), at: Date.now() };
    history.push(item);
    saveHistory(history);
    render(item);
  };

  async function ask(text) {
    if (busy || !text.trim()) return;
    busy = true;
    send.disabled = true;
    add('user', text.trim());
    const typing = h('div', { class: 'nadir-msg nadir-bot nadir-typing', 'aria-label': 'NADIR is typing' }, h('span'), h('span'), h('span'));
    log.append(typing);
    log.scrollTop = log.scrollHeight;
    const context = buildContext();
    const [answer] = await Promise.all([aiReply(history, context), new Promise(resolve => setTimeout(resolve, 350))]);
    const result = answer || offlineReply(text, context);
    typing.remove();
    add('assistant', result.text, result.actions);
    busy = false;
    send.disabled = false;
  }

  SUGGESTIONS.forEach(label => {
    const chip = h('button', { type: 'button', class: 'nadir-chip' }, label);
    chip.addEventListener('click', () => { void ask(label); });
    chips.append(chip);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value;
    input.value = '';
    void ask(text);
  });
  $('[data-nadir-clear]', root).addEventListener('click', () => {
    history = [];
    saveHistory(history);
    log.replaceChildren();
    greet();
  });

  function greet() {
    const opening = offlineReply('hello');
    add('assistant', opening.text, opening.actions);
  }
  if (history.length) history.forEach(render); else greet();

  void (async () => {
    if (!supabaseConfigured) return;
    try {
      const { supabase } = await import('./auth.js');
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { mode.textContent = 'AI coach'; mode.dataset.mode = 'ai'; }
    } catch { /* Stays in offline mode. */ }
  })();
}

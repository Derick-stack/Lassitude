import { getState, update } from './store.js';
import { $, confirmDialog, h, toast } from './ui.js';
import { MUSCLE_GROUPS, WEEKDAYS, equipmentSwaps, estimateMinutes, parseRoutineText, weeklyPlan } from './workout-plan.js';

// The workout coach on the Workouts page. It runs in the browser: it reads pasted routines,
// answers "what's my workout today?", equips programs into the weekly plan, browses muscle
// groups and swaps exercises for the equipment you have.

const HISTORY_KEY = 'lassitude-workout-coach';
const CHIPS = [['today', 'What’s my workout today?'], ['week', 'Show my week'], ['paste', 'Paste my plan'], ['equip', 'Equip a program'], ['dumbbells', 'Dumbbells only'], ['bodyweight', 'No equipment']];
const EQUIPMENT = { gym: 'Full gym', dumbbells: 'Dumbbells only', bodyweight: 'No equipment' };
const SHORT_DAY = day => WEEKDAYS[day].slice(0, 3);

const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').slice(-30); } catch { return []; } };
const saveHistory = history => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-30))); } catch { /* optional */ } };

export function initWorkoutCoach({ getLibrary, programs, startRoutine, showGroup, onPlanChanged }) {
  const log = $('#coach-log');
  const input = $('#coach-input');
  const form = $('#coach-form');
  let history = loadHistory();

  const name = item => getLibrary().find(entry => entry.id === item.id)?.name || item.name || item.id;
  const activeRoutines = () => getState().workoutRoutines.filter(routine => routine.active !== false && routine.exercises.length);
  const prescription = item => `${item.sets} × ${item.repRange || item.reps}${item.unit === 'seconds' ? ' sec' : ''}`;
  const restLabel = seconds => seconds >= 60 ? `${Math.round(seconds / 30) / 2} min` : `${seconds} sec`;
  const range = values => { const min = Math.min(...values); const max = Math.max(...values); return min === max ? `${min}` : `${min}–${max}`; };

  // ---------- Weekly plan ----------
  function planTable(routines, { compact = false, interactive = true } = {}) {
    const plan = weeklyPlan(routines);
    const today = new Date().getDay();
    const shown = compact ? 3 : 4;
    const rows = plan.map(({ day, type, sessions }) => {
      const isToday = day === today;
      const label = h('th', { scope: 'row' }, h('span', { class: 'plan-day' }, compact ? SHORT_DAY(day) : WEEKDAYS[day]), isToday ? h('span', { class: 'today-tag' }, 'Today') : null);
      if (type !== 'train') {
        return h('tr', { class: `plan-${type}${isToday ? ' is-today' : ''}` }, label,
          h('td', {}, type === 'recovery' ? h('strong', {}, '🧘 Active recovery') : h('strong', {}, '💤 Rest day'), h('span', { class: 'plan-ex' }, type === 'recovery' ? 'Light walk and stretching' : 'Sleep, water and recovery')),
          h('td', { class: 'plan-time' }, type === 'recovery' ? '20–30 min' : '—'));
      }
      const exercises = sessions.flatMap(session => session.exercises);
      const rests = exercises.map(item => item.rest);
      const reps = [...new Set(exercises.map(item => item.repRange || `${item.reps}${item.unit === 'seconds' ? 's' : ''}`))];
      const start = interactive ? h('button', { type: 'button', class: isToday ? 'small-btn' : 'ghost small-btn' }, isToday ? 'Start' : 'Preview') : null;
      start?.addEventListener('click', () => (isToday ? startRoutine(sessions[0].id) : reply(dayCard(day))));
      return h('tr', { class: `plan-train${isToday ? ' is-today' : ''}` }, label,
        h('td', {},
          h('strong', {}, sessions.map(session => session.title).join(' + ')),
          h('span', { class: 'plan-ex' }, exercises.slice(0, shown).map(name).join(' · ') + (exercises.length > shown ? ` +${exercises.length - shown} more` : '')),
          h('span', { class: 'plan-meta' }, `${range(exercises.map(item => item.sets))} sets × ${reps.slice(0, 2).join(', ')}${reps.length > 2 ? '…' : ''} reps · rest ${restLabel(Math.min(...rests))}${Math.min(...rests) !== Math.max(...rests) ? `–${restLabel(Math.max(...rests))}` : ''}`)),
        h('td', { class: 'plan-time' }, h('span', {}, `${sessions.reduce((sum, session) => sum + estimateMinutes(session), 0)} min`), start));
    });
    return h('div', { class: 'plan-table-wrap' }, h('table', { class: `plan-table${compact ? ' is-compact' : ''}` },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Day'), h('th', { scope: 'col' }, 'Workout'), h('th', { scope: 'col', class: 'plan-time' }, 'Time'))),
      h('tbody', {}, rows)));
  }

  function planSummary(routines) {
    const plan = weeklyPlan(routines).filter(day => day.type === 'train');
    const minutes = routines.map(estimateMinutes);
    return { days: plan.length, minutes: minutes.length ? range(minutes) : '0', schedule: plan.map(day => `${SHORT_DAY(day.day)} (${day.sessions.map(session => session.title).join(' + ')})`).join(', ') };
  }

  function renderWeek() {
    const routines = activeRoutines();
    const box = $('#week-plan');
    if (!routines.length) {
      box.replaceChildren(h('div', { class: 'week-empty' },
        h('p', { class: 'week-empty-title' }, 'No plan equipped yet'),
        h('p', {}, 'Paste the routine you already follow, or equip a ready-made program. Your week will show up here with rest days planned in.'),
        h('div', { class: 'coach-actions' }, actionButton('Paste my plan', () => startPaste()), actionButton('Equip a program', () => reply(programCard()), 'ghost'))));
      return;
    }
    const summary = planSummary(routines);
    box.replaceChildren(
      h('div', { class: 'week-summary' },
        h('span', {}, h('strong', {}, `${summary.days}`), ' training days'),
        h('span', {}, h('strong', {}, summary.minutes), ' min per session'),
        h('span', { class: 'week-schedule' }, summary.schedule)),
      planTable(routines));
  }

  // ---------- Coach replies ----------
  function actionButton(label, onClick, style = '') {
    const button = h('button', { type: 'button', class: `${style} small-btn` }, label);
    button.addEventListener('click', onClick);
    return button;
  }

  function dayCard(day) {
    const plan = weeklyPlan(activeRoutines());
    const entry = plan.find(item => item.day === day);
    const when = day === new Date().getDay() ? 'today' : WEEKDAYS[day];
    if (!activeRoutines().length) return { text: 'You don’t have a plan equipped yet. Paste your routine or equip a program and I’ll schedule it for you.', node: h('div', { class: 'coach-actions' }, actionButton('Paste my plan', startPaste), actionButton('Equip a program', () => reply(programCard()), 'ghost')) };
    if (entry.type !== 'train') {
      const next = [1, 2, 3, 4, 5, 6, 7].map(offset => plan.find(item => item.day === (day + offset) % 7)).find(item => item.type === 'train');
      return {
        text: `${capitalize(when)} is ${entry.type === 'recovery' ? 'an active recovery day' : 'a rest day'}. ${entry.type === 'recovery' ? 'Take a 20–30 minute walk and stretch.' : 'Rest, hydrate and sleep well. Recovery is where you get stronger.'}${next ? ` Next up: ${next.sessions[0].title} on ${WEEKDAYS[next.day]}.` : ''}`,
        node: next ? h('div', { class: 'coach-actions' }, actionButton(`Preview ${WEEKDAYS[next.day]}`, () => reply(dayCard(next.day)), 'ghost')) : null
      };
    }
    const session = entry.sessions[0];
    const list = h('ol', { class: 'coach-exercises' }, session.exercises.map(item => h('li', {}, h('strong', {}, name(item)), h('span', {}, `${prescription(item)} · rest ${restLabel(item.rest)}`))));
    return {
      text: `${capitalize(when)}: ${entry.sessions.map(item => item.title).join(' + ')}, about ${estimateMinutes(session)} minutes.`,
      node: h('div', {}, list, h('div', { class: 'coach-actions' }, actionButton(day === new Date().getDay() ? 'Start this workout' : 'Start it now', () => startRoutine(session.id)), actionButton('Dumbbells only', () => reply(swapCard('dumbbells')), 'ghost'), actionButton('No equipment', () => reply(swapCard('bodyweight')), 'ghost')))
    };
  }

  function weekCard() {
    const routines = activeRoutines();
    if (!routines.length) return dayCard(new Date().getDay());
    const summary = planSummary(routines);
    return { text: `📅 Your week: ${summary.days} training days, about ${summary.minutes} minutes per session. ${summary.schedule}.`, node: planTable(routines, { compact: true }) };
  }

  function programCard() {
    return {
      text: 'Pick a program to equip. I’ll schedule the days, add rest days and set sets, reps and rest for you.',
      node: h('div', { class: 'coach-programs' }, programs.map(program => {
        const routines = program.parts.map(part => ({ title: part.title, days: part.days, exercises: part.exercises.map(([id, sets, reps, unit = 'reps', rest = unit === 'seconds' ? 20 : 90]) => ({ id, sets, reps, unit, rest })) }));
        const days = [...new Set(program.parts.flatMap(part => part.days))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
        return h('article', { class: 'coach-program' }, h('strong', {}, program.title), h('span', {}, `${days.map(SHORT_DAY).join(' · ')} · ~${range(routines.map(estimateMinutes))} min`), h('p', {}, program.description), actionButton('Equip', () => equipRoutines(program.title, routines.map(routine => ({ ...routine, programId: program.id })))));
      }))
    };
  }

  function swapCard(equipment) {
    update(state => { state.workoutPrefs.equipment = equipment; });
    syncEquipmentSelect();
    const swaps = equipmentSwaps(activeRoutines(), getLibrary(), equipment);
    if (!activeRoutines().length) return { text: `Got it: ${EQUIPMENT[equipment].toLowerCase()}. Equip a program or paste your plan and I’ll only suggest exercises you can do.`, node: h('div', { class: 'coach-actions' }, actionButton('Equip a program', () => reply(programCard()))) };
    if (!swaps.length) return { text: `Good news: everything in your plan already works with ${EQUIPMENT[equipment].toLowerCase()}.` };
    const apply = actionButton(`Apply ${swaps.length} swap${swaps.length === 1 ? '' : 's'}`, () => {
      update(state => swaps.forEach(swap => {
        const routine = state.workoutRoutines.find(item => item.id === swap.routineId);
        const item = routine?.exercises[swap.index];
        if (item) Object.assign(item, { id: swap.to.id, name: swap.to.name, weight: 0 });
      }));
      apply.disabled = true;
      apply.textContent = 'Swapped ✓';
      onPlanChanged();
      say('assistant', `Saved to your workout section! ${swaps.length} exercise${swaps.length === 1 ? '' : 's'} swapped for ${EQUIPMENT[equipment].toLowerCase()}.`);
    });
    return {
      text: `Here’s your plan with ${EQUIPMENT[equipment].toLowerCase()}. Same muscles, different tools:`,
      node: h('div', {}, h('ul', { class: 'coach-swaps' }, swaps.map(swap => h('li', {}, h('span', {}, swap.from.name), h('span', { 'aria-hidden': 'true' }, '→'), h('strong', {}, swap.to.name)))), h('div', { class: 'coach-actions' }, apply))
    };
  }

  function groupCard(group) {
    const equipment = getState().workoutPrefs.equipment;
    const allowed = equipment === 'bodyweight' ? ['Bodyweight', 'Wall', 'Outdoors'] : equipment === 'dumbbells' ? ['Dumbbell', 'Bodyweight', 'Bench', 'Wall'] : null;
    // Lead with the tool the person chose (dumbbells first when "Dumbbells only"), then mix difficulty.
    const picks = getLibrary().filter(exercise => group.muscles.includes(exercise.muscle) && (!allowed || allowed.includes(exercise.equipment)))
      .sort((a, b) => Number(Boolean(allowed) && b.equipment === allowed[0]) - Number(Boolean(allowed) && a.equipment === allowed[0]) || ['Beginner', 'Intermediate', 'Advanced'].indexOf(a.difficulty) - ['Beginner', 'Intermediate', 'Advanced'].indexOf(b.difficulty))
      .slice(0, 6);
    return {
      text: `${group.icon} ${group.label}${allowed ? ` (${EQUIPMENT[equipment].toLowerCase()})` : ''}: good options to build around.`,
      node: h('div', {}, h('ul', { class: 'coach-exercises' }, picks.map(exercise => h('li', {}, h('strong', {}, exercise.name), h('span', {}, `${exercise.equipment} · ${exercise.difficulty}`)))), h('div', { class: 'coach-actions' }, actionButton(`See all ${group.label.toLowerCase()} exercises`, () => showGroup(group.id), 'ghost')))
    };
  }

  function importCard(text) {
    const parsed = parseRoutineText(text, getLibrary());
    if (!parsed.routines.length) return { text: 'I couldn’t find exercises in that. Try one exercise per line, like “Bench press 3x10”, with day names or “Day 1” above each workout.' };
    const routines = parsed.routines.map(routine => ({ ...routine, id: `preview-${Math.random()}` }));
    const custom = [...new Set(parsed.unmatched)];
    const save = actionButton('Save to my week', () => equipRoutines('your plan', parsed.routines.map(routine => ({ ...routine, programId: 'imported' })), save));
    const summary = planSummary(routines);
    return {
      text: `I read ${routines.length} workout${routines.length === 1 ? '' : 's'}: ${summary.schedule}. Rest days are planned in. Check it, then save.`,
      node: h('div', {}, planTable(routines, { compact: true, interactive: false }),
        custom.length ? h('p', { class: 'coach-note' }, `Added as your own exercises: ${custom.join(', ')}.`) : null,
        h('div', { class: 'coach-actions' }, save))
    };
  }

  async function equipRoutines(label, routines, button) {
    const current = activeRoutines();
    if (current.length) {
      const ok = await confirmDialog({ title: 'Replace your weekly plan?', message: 'Your current routines stay saved in the routine builder, but they’ll leave your weekly plan.', confirmLabel: 'Replace plan' });
      if (!ok) return;
    }
    update(state => {
      state.workoutRoutines.forEach(routine => { routine.active = false; });
      state.workoutRoutines.push(...routines.map(routine => ({
        id: `routine-${crypto.randomUUID()}`, title: routine.title, days: routine.days, active: true, programId: routine.programId,
        exercises: routine.exercises.map(item => ({ id: item.id, name: item.name || '', sets: item.sets, reps: item.reps, repRange: item.repRange || '', unit: item.unit || 'reps', weight: item.weight || 0, rest: item.rest ?? 90, notes: '' }))
      })));
    });
    if (button) { button.disabled = true; button.textContent = 'Saved ✓'; }
    onPlanChanged();
    say('assistant', `Equipped to your weekly plan! ${capitalize(label)} is scheduled with rest days.`);
    toast('Equipped to your weekly plan!');
    $('#plan').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Conversation ----------
  function respond(text) {
    const lower = text.toLowerCase();
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length >= 2 && (/\d\s*[x×*]\s*\d|\d+\s*sets?\b|\d+\s*reps?\b/i.test(text) || lines.length >= 4)) return importCard(text);
    if (/dumbbell/.test(lower)) return swapCard('dumbbells');
    if (/no (gym|equipment|weights)|bodyweight|body weight|at home|home workout/.test(lower)) return swapCard('bodyweight');
    if (/full gym|gym access/.test(lower)) { update(state => { state.workoutPrefs.equipment = 'gym'; }); syncEquipmentSelect(); return { text: 'Full gym it is. I’ll suggest any equipment from now on.' }; }
    if (/tomorrow/.test(lower)) return dayCard((new Date().getDay() + 1) % 7);
    const named = WEEKDAYS.findIndex(day => lower.includes(day.toLowerCase()) || new RegExp(`\\b${day.slice(0, 3).toLowerCase()}\\b`).test(lower));
    if (named >= 0) return dayCard(named);
    if (/today|workout now|what.*(do|train)|what'?s my workout/.test(lower)) return dayCard(new Date().getDay());
    if (/week|plan|schedule|split/.test(lower) && !/equip|new|program/.test(lower)) return weekCard();
    if (/equip|program|routine|suggest|recommend|beginner|start/.test(lower)) return programCard();
    const group = MUSCLE_GROUPS.find(item => new RegExp(`\\b(${[item.id, item.label.toLowerCase(), ...item.muscles.map(muscle => muscle.toLowerCase())].join('|').replace(/ & /g, '|')}|${item.id === 'arms' ? 'bicep|tricep' : item.id === 'legs' ? 'quad|hamstring|glute|calf|calves|leg' : item.id === 'core' ? 'abs|ab\\b' : item.id === 'back' ? 'lats?' : item.id === 'shoulders' ? 'delts?' : item.id})`).test(lower));
    if (group) return groupCard(group);
    if (/how long|duration|minutes|time/.test(lower)) {
      const routines = activeRoutines();
      return routines.length ? { text: `Your sessions take about ${planSummary(routines).minutes} minutes, including a 5-minute warm-up: ${routines.map(routine => `${routine.title} ~${estimateMinutes(routine)} min`).join(', ')}.` } : programCard();
    }
    if (/rest|recover|sore|tired/.test(lower)) return { text: 'Rest days are when muscles rebuild. Aim for 7–9 hours of sleep, drink water, and keep moving lightly: a 20–30 minute walk and gentle stretching. Train a sore muscle again once it feels mostly normal.' };
    return { text: 'I can show today’s workout, your week, equip a program, read a plan you paste, find exercises by muscle group, or swap exercises for the equipment you have.' };
  }

  function render(item, node) {
    const bubble = h('div', { class: `coach-msg ${item.role === 'user' ? 'coach-user' : 'coach-bot'}` });
    item.text.split('\n').slice(0, item.role === 'user' ? 6 : 99).forEach((line, index) => { if (index) bubble.append(h('br')); bubble.append(line); });
    if (item.role === 'user' && item.text.split('\n').length > 6) bubble.append(h('br'), `… ${item.text.split('\n').length - 6} more lines`);
    if (node) bubble.append(node);
    if (getState().appPrefs.chatTimestamps && item.at) bubble.append(h('time', { class: 'nadir-time' }, new Date(item.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })));
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  }
  function say(role, text, node) {
    const item = { role, text, at: Date.now() };
    history.push(item);
    saveHistory(history);
    render(item, node);
  }
  function reply(result) { say('assistant', result.text, result.node); }
  function ask(text) {
    if (!text.trim()) return;
    say('user', text.trim());
    const typing = h('div', { class: 'ai-typing-indicator', role: 'status', 'aria-label': 'Coach is typing' }, h('span', { class: 'dot' }), h('span', { class: 'dot' }), h('span', { class: 'dot' }));
    log.append(typing);
    log.scrollTop = log.scrollHeight;
    window.setTimeout(() => { typing.remove(); reply(respond(text)); }, 300);
  }
  function startPaste() {
    input.value = '';
    input.placeholder = 'Paste your routine here, for example:\nMonday - Push\nBench press 4x8\nOverhead press 3x10\nWednesday: rest';
    input.rows = 6;
    input.focus();
    $('#coach').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function syncEquipmentSelect() { $('#coach-equipment').value = getState().workoutPrefs.equipment; }

  CHIPS.forEach(([id, label]) => {
    const chip = h('button', { type: 'button', class: 'nadir-chip' }, label);
    chip.addEventListener('click', () => {
      if (id === 'paste') { startPaste(); return; }
      if (id === 'equip') { say('user', label); reply(programCard()); return; }
      ask(label);
    });
    $('#coach-chips').append(chip);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value;
    input.value = '';
    input.rows = 1;
    input.placeholder = 'Ask, or paste your workout plan…';
    ask(text);
  });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  input.addEventListener('input', () => { input.rows = Math.min(8, Math.max(1, input.value.split('\n').length)); });
  input.addEventListener('paste', () => window.setTimeout(() => { if (input.value.includes('\n')) { input.rows = 6; $('#coach-hint').textContent = 'Press Send and I’ll organize this into your week.'; } }, 0));
  $('#coach-equipment').addEventListener('change', event => {
    update(state => { state.workoutPrefs.equipment = event.target.value; });
    if (event.target.value !== 'gym' && activeRoutines().length) { say('user', EQUIPMENT[event.target.value]); reply(swapCard(event.target.value)); }
    else toast(`Equipment: ${EQUIPMENT[event.target.value]}`);
  });
  $('#coach-clear').addEventListener('click', () => { history = []; saveHistory(history); log.replaceChildren(); greet(); });
  syncEquipmentSelect();

  function greet() {
    const plan = activeRoutines();
    const today = weeklyPlan(plan).find(item => item.day === new Date().getDay());
    reply(plan.length
      ? { text: today.type === 'train' ? `Today is ${today.sessions[0].title}, about ${estimateMinutes(today.sessions[0])} minutes. Ask me anything about your plan.` : `Today is ${today.type === 'recovery' ? 'an active recovery day' : 'a rest day'}. Ask me about your week, or swap exercises for the equipment you have.` }
      : { text: 'Hi! I’m your workout coach. Paste the routine you already follow and I’ll organize it into your week, or equip one of the programs below.' });
  }
  if (history.length) history.forEach(item => render(item)); else greet();

  function equipProgram(program) {
    const routines = program.parts.map(part => ({ title: part.title, days: part.days, programId: program.id, exercises: part.exercises.map(([id, sets, reps, unit = 'reps', rest = unit === 'seconds' ? 20 : 90]) => ({ id, sets, reps, unit, rest })) }));
    return equipRoutines(program.title, routines);
  }

  return { renderWeek, equipProgram };
}

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

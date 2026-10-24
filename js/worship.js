import { getDayKey, getState, setHabit, update } from './store.js';
import { $, h, toast } from './ui.js';

// "Workout as worship" series: themed 7-day programs that pair a verse, a reflection and a breath
// prayer with a guided interval workout at three levels.

const GET_READY_SECONDS = 10;
let content = null;

export async function loadWorshipContent() {
  if (content) return content;
  const response = await fetch(new URL('../data/worship-series.json', import.meta.url));
  if (!response.ok) throw new Error('Series unavailable');
  content = await response.json();
  return content;
}

export function seriesProgress(seriesId, state = getState()) {
  return state.worshipSeries.progress[seriesId] || [];
}

export function nextDayIndex(series, state = getState()) {
  const done = seriesProgress(series.id, state);
  const index = series.days.findIndex((_, dayIndex) => !done.includes(dayIndex));
  return index === -1 ? 0 : index;
}

export function buildSteps(day, levelId, data = content) {
  const level = data.levels[levelId];
  const rounds = day.recovery ? 1 : level.rounds;
  const work = day.recovery ? 45 : level.work;
  const rest = day.recovery ? 15 : level.rest;
  const steps = [{ type: 'ready', seconds: GET_READY_SECONDS, label: 'Get ready' }];
  for (let round = 1; round <= rounds; round += 1) {
    day.moves.forEach((moveId, index) => {
      const move = data.moves[moveId];
      steps.push({ type: 'work', seconds: work, label: move[levelId], cue: move.cue, round, rounds });
      const last = round === rounds && index === day.moves.length - 1;
      if (!last) steps.push({ type: 'rest', seconds: rest, label: 'Rest and breathe', round, rounds });
    });
  }
  return steps;
}

export const stepsMinutes = steps => Math.max(1, Math.round(steps.reduce((sum, step) => sum + step.seconds, 0) / 60));

export async function initWorship() {
  const root = $('#worship');
  if (!root) return;
  let data;
  try { data = await loadWorshipContent(); } catch {
    $('[data-worship-series]', root).replaceChildren(h('p', { class: 'field-note' }, 'The worship series could not be loaded. Check that data/worship-series.json is available from this site.'));
    return;
  }
  let selected = { seriesId: getState().worshipSeries.active || data.series[0].id, dayIndex: null };

  const levelPicker = $('[data-worship-levels]', root);
  Object.entries(data.levels).forEach(([id, level]) => {
    const input = h('input', { type: 'radio', name: 'worship-level', id: `worship-level-${id}`, value: id });
    input.checked = getState().worshipSeries.level === id;
    input.addEventListener('change', () => { update(state => { state.worshipSeries.level = id; }); render(); });
    levelPicker.append(h('label', { class: 'worship-level', for: `worship-level-${id}` }, input, h('strong', {}, level.label), h('span', {}, level.description)));
  });

  function render() {
    const state = getState();
    const list = $('[data-worship-series]', root);
    list.replaceChildren(...data.series.map(series => {
      const done = seriesProgress(series.id, state);
      const active = series.id === selected.seriesId;
      const button = h('button', { type: 'button', class: active ? '' : 'ghost' }, active ? 'Selected' : done.length ? 'Continue series' : 'Start series');
      button.addEventListener('click', () => {
        selected = { seriesId: series.id, dayIndex: null };
        update(draft => { draft.worshipSeries.active = series.id; });
        render();
        $('[data-worship-today]', root).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return h('article', { class: `worship-series${active ? ' is-active' : ''}` },
        h('h3', {}, series.title), h('p', {}, series.summary),
        h('div', { class: 'meter', role: 'progressbar', 'aria-label': `${series.title} progress`, 'aria-valuemin': '0', 'aria-valuemax': String(series.days.length), 'aria-valuenow': String(done.length) }, h('div', { style: `width:${Math.round(done.length / series.days.length * 100)}%` })),
        h('small', {}, `${done.length} of ${series.days.length} days complete`), button);
    }));
    renderToday();
  }

  function renderToday() {
    const state = getState();
    const series = data.series.find(item => item.id === selected.seriesId) || data.series[0];
    const done = seriesProgress(series.id, state);
    const dayIndex = selected.dayIndex ?? nextDayIndex(series, state);
    const day = series.days[dayIndex];
    const levelId = state.worshipSeries.level;
    const steps = buildSteps(day, levelId, data);
    const dots = h('div', { class: 'worship-days', role: 'group', 'aria-label': 'Choose a day' }, series.days.map((item, index) => {
      const dot = h('button', { type: 'button', class: `worship-day${done.includes(index) ? ' is-done' : ''}${index === dayIndex ? ' is-current' : ''}`, 'aria-pressed': String(index === dayIndex), 'aria-label': `Day ${index + 1}: ${item.title}${done.includes(index) ? ', complete' : ''}` }, done.includes(index) ? '✓' : String(index + 1));
      dot.addEventListener('click', () => { selected.dayIndex = index; renderToday(); });
      return dot;
    }));
    const begin = h('button', { type: 'button' }, done.includes(dayIndex) ? 'Do this day again' : 'Begin worship workout');
    begin.addEventListener('click', () => openPlayer(series, dayIndex));
    const invite = h('button', { type: 'button', class: 'ghost' }, 'Invite a friend');
    invite.addEventListener('click', () => shareInvite(series, day, dayIndex, stepsMinutes(steps)));
    const moves = day.moves.map(id => data.moves[id][day.recovery ? 'standard' : levelId]);
    $('[data-worship-today]', root).replaceChildren(
      h('p', { class: 'eyebrow' }, `${series.title} · Day ${dayIndex + 1} of ${series.days.length}${day.recovery ? ' · Recovery' : ''}`),
      h('h3', {}, day.title),
      dots,
      h('blockquote', { class: 'worship-verse' }, `“${day.verse}”`, h('cite', {}, day.reference)),
      h('p', { class: 'worship-reflection' }, h('strong', {}, 'Reflect: '), day.reflection),
      h('div', { class: 'worship-plan' },
        h('div', {}, h('strong', {}, `${stepsMinutes(steps)} minutes · ${day.recovery ? 'gentle mobility for everyone' : data.levels[levelId].label}`), h('ul', {}, moves.map(move => h('li', {}, move)))),
        h('div', {}, h('strong', {}, 'Breath prayer for rest breaks'), h('p', {}, `Breathe in: “${day.breath[0]}”`, h('br'), `Breathe out: “${day.breath[1]}”`))),
      h('div', { class: 'worship-actions' }, begin, invite));
  }

  function shareInvite(series, day, dayIndex, minutes) {
    const url = new URL('workouts.html#worship', location.href).href;
    const text = `I’m doing the 7-day “${series.title}” workout-as-worship series on Lassitude. Day ${dayIndex + 1}: ${day.reference} and a ${minutes}-minute workout you can do at home at any level. Want to do it with me this week?`;
    if (navigator.share) {
      navigator.share({ title: `${series.title} · Lassitude`, text, url }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(`${text} ${url}`).then(() => toast('Invite copied. Paste it into a text or group chat.'), () => toast(`${text} ${url}`, { duration: 10000 }));
  }

  function openPlayer(series, dayIndex) {
    const day = series.days[dayIndex];
    const levelId = getState().worshipSeries.level;
    const steps = buildSteps(day, levelId, data);
    const startedAt = Date.now();
    let stepIndex = 0;
    let remaining = steps[0].seconds;
    let tick = null;
    let paused = false;
    let lastTick = 0;
    let wakeLock = null;
    let audio = null;

    const dialog = h('dialog', { class: 'dialog worship-player', 'aria-labelledby': 'worship-player-title' });
    document.body.append(dialog);
    dialog.addEventListener('close', () => { window.clearInterval(tick); wakeLock?.release?.().catch(() => {}); dialog.remove(); });
    const close = h('button', { type: 'button', class: 'ghost worship-close', 'aria-label': 'End workout' }, 'End');
    close.addEventListener('click', () => dialog.close());

    showPrepare();
    dialog.showModal();

    function frame(...children) { dialog.replaceChildren(close, ...children.filter(Boolean)); }

    function showPrepare() {
      const ready = h('button', { type: 'button' }, 'I’ve prayed, let’s begin');
      ready.addEventListener('click', startTimer);
      frame(
        h('p', { class: 'eyebrow' }, `${series.title} · Day ${dayIndex + 1}`),
        h('h2', { id: 'worship-player-title' }, day.title),
        h('blockquote', { class: 'worship-verse' }, `“${day.verse}”`, h('cite', {}, day.reference)),
        h('p', {}, day.reflection),
        h('p', { class: 'field-note' }, 'Take a moment to pray and offer this time to God. Play some worship music if you like. Stop if anything hurts; this is general guidance, not medical advice.'),
        ready);
    }

    function beep(high = false) {
      const prefs = getState().workoutPrefs;
      if (prefs.vibration) navigator.vibrate?.(high ? [120, 60, 120] : 150);
      if (!prefs.sound) return;
      try {
        audio ??= new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = high ? 880 : 660;
        gain.gain.setValueAtTime(0.15, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.25);
      } catch { /* Sound is optional. */ }
    }

    function startTimer() {
      navigator.wakeLock?.request('screen').then(lock => { wakeLock = lock; }).catch(() => {});
      lastTick = Date.now();
      renderStep();
      tick = window.setInterval(() => {
        if (paused) { lastTick = Date.now(); return; }
        const now = Date.now();
        if (now - lastTick < 1000) return;
        remaining -= Math.floor((now - lastTick) / 1000);
        lastTick = now - ((now - lastTick) % 1000);
        if (remaining <= 0) advance(); else updateClock();
      }, 200);
    }

    function advance() {
      stepIndex += 1;
      if (stepIndex >= steps.length) { window.clearInterval(tick); beep(true); showFinish(); return; }
      remaining = steps[stepIndex].seconds;
      beep(steps[stepIndex].type === 'work');
      renderStep();
    }

    function updateClock() {
      const clock = $('[data-clock]', dialog);
      if (clock) clock.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
    }

    function renderStep() {
      const step = steps[stepIndex];
      const next = steps.slice(stepIndex + 1).find(item => item.type === 'work');
      const pause = h('button', { type: 'button', class: 'ghost', 'aria-pressed': String(paused) }, paused ? 'Resume' : 'Pause');
      pause.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'Resume' : 'Pause'; pause.setAttribute('aria-pressed', String(paused)); });
      const skip = h('button', { type: 'button', class: 'ghost' }, 'Skip');
      skip.addEventListener('click', advance);
      const progress = Math.round(stepIndex / steps.length * 100);
      frame(
        h('p', { class: 'eyebrow' }, step.type === 'ready' ? 'Starting soon' : `Round ${step.round} of ${step.rounds}`),
        h('h2', { id: 'worship-player-title', class: `worship-step worship-step-${step.type}` }, step.label),
        step.type === 'work' ? h('p', { class: 'worship-cue' }, step.cue) : null,
        step.type === 'rest' ? h('p', { class: 'worship-breath' }, `Breathe in: “${day.breath[0]}”`, h('br'), `Breathe out: “${day.breath[1]}”`) : null,
        h('p', { class: 'time', 'data-clock': '', 'aria-live': 'off' }, ''),
        next ? h('p', { class: 'field-note' }, `Next: ${next.label}`) : h('p', { class: 'field-note' }, 'Last one. Finish strong.'),
        h('div', { class: 'meter', 'aria-hidden': 'true' }, h('div', { style: `width:${progress}%` })),
        h('div', { class: 'worship-actions' }, pause, skip));
      updateClock();
    }

    function showFinish() {
      wakeLock?.release?.().catch(() => {});
      const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const devotional = h('input', { type: 'checkbox', id: 'worship-devotional' });
      devotional.checked = !getState().devotionalRead[getDayKey()];
      const save = h('button', { type: 'button' }, 'Save and finish');
      save.addEventListener('click', () => {
        const today = getDayKey();
        update(state => {
          const done = state.worshipSeries.progress[series.id] || [];
          if (!done.includes(dayIndex)) state.worshipSeries.progress[series.id] = [...done, dayIndex].sort((a, b) => a - b);
          state.worshipSeries.active = series.id;
          state.workoutLogs.unshift({ id: `worship-${Date.now()}`, title: `${series.title}: ${day.title}`, minutes, date: today });
          state.firstWeek.workoutLogged = true;
          if (devotional.checked) { state.devotionalRead[today] = true; state.firstWeek.devotionalRead = true; }
        });
        setHabit('workout', true);
        const complete = seriesProgress(series.id).length === series.days.length;
        toast(complete ? `You finished the ${series.title} series. Well done!` : `Day ${dayIndex + 1} saved. ${minutes} minutes logged.`);
        selected.dayIndex = null;
        dialog.close();
        render();
      });
      frame(
        h('p', { class: 'eyebrow' }, 'Workout complete'),
        h('h2', { id: 'worship-player-title' }, 'Well done.'),
        h('p', {}, `You moved for about ${minutes} minute${minutes === 1 ? '' : 's'}. Close with a short prayer of thanks for the strength you were given today.`),
        h('blockquote', { class: 'worship-verse' }, `“${day.verse}”`, h('cite', {}, day.reference)),
        h('label', { class: 'choice', for: 'worship-devotional' }, devotional, ' Count today’s verse and reflection as my devotional'),
        save);
    }
  }

  render();
}

import { getDayKey, getState, setHabit, update } from '../store.js';
import { $, $$, confirmDialog, h, toast } from '../ui.js';
import { initWorship } from '../worship.js';

const weekdays = [['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]];
const programs = [
  { id: 'full-body-3', title: '3-day full body', description: 'A balanced beginner routine on Monday, Wednesday, and Friday.', parts: [{ title: 'Full Body A', days: [1, 3, 5], exercises: [['goblet-squat', 3, 10], ['push-up', 3, 8], ['one-arm-db-row', 3, 10], ['glute-bridge', 3, 12], ['plank', 3, 30]] }] },
  { id: 'upper-lower-4', title: '4-day upper / lower', description: 'Two upper sessions and two lower sessions, each editable.', parts: [{ title: 'Upper Body', days: [1, 4], exercises: [['db-bench-press', 3, 8], ['lat-pulldown-neutral', 3, 10], ['seated-db-press', 3, 8], ['cable-curl', 2, 12], ['triceps-pushdown', 2, 12]] }, { title: 'Lower Body', days: [2, 5], exercises: [['goblet-squat', 3, 10], ['romanian-deadlift', 3, 8], ['reverse-lunge', 3, 8], ['hamstring-curl', 3, 10], ['standing-calf-raise', 2, 10]] }] },
  { id: 'home-hiit-20', title: '20-minute home intervals', description: 'Four simple bodyweight movements with 40-second work intervals and short recovery.', parts: [{ title: 'Home HIIT', days: [2, 4, 6], exercises: [['squat', 4, 40, 'seconds'], ['incline-push-up', 4, 40, 'seconds'], ['mountain-climber', 4, 40, 'seconds'], ['glute-bridge', 4, 40, 'seconds']] }] },
  { id: 'mobility-recovery', title: 'Mobility and recovery', description: 'A gentle full-body sequence with comfortable ranges of motion.', parts: [{ title: 'Mobility Flow', days: [1, 3, 5], exercises: [['cat-cow', 2, 8], ['hip-90-90', 2, 8], ['thoracic-rotation', 2, 8], ['ankle-rock', 2, 8], ['couch-stretch', 2, 30, 'seconds']] }] }
];

export function initWorkouts() {
  let library = [];
  let draft = null;
  let activeRun = null;
  let restTimer = null;
  let restEndsAt = 0;
  let photoData = '';
  const routineSelect = $('#routine-select');
  const libraryList = $('#exercise-library');

  void initWorship();
  loadLibrary();
  renderPrograms();
  renderRoutineSelect();
  renderHistory();
  renderPosts();
  if (getState().workoutRoutines.length) {
    draft = getState().workoutRoutines[0];
    routineSelect.value = draft.id;
    renderBuilder();
  } else newRoutine();
  bindFilters();

  $('#new-routine').addEventListener('click', newRoutine);
  routineSelect.addEventListener('change', () => {
    if (!routineSelect.value) { newRoutine(); return; }
    draft = getState().workoutRoutines.find(routine => routine.id === routineSelect.value) || null;
    renderBuilder();
  });
  $('#routine-form').addEventListener('submit', saveRoutine);
  $('#duplicate-routine').addEventListener('click', duplicateRoutine);
  $('#delete-routine').addEventListener('click', deleteRoutine);
  $('#start-workout').addEventListener('click', startWorkout);
  $('#cancel-workout').addEventListener('click', cancelWorkout);
  $('#post-form').addEventListener('submit', savePost);
  $('#post-photo').addEventListener('change', loadPhoto);

  async function loadLibrary() {
    try {
      const response = await fetch(new URL('../../data/exercises.json', import.meta.url));
      if (!response.ok) throw new Error('Exercise library unavailable.');
      library = await response.json();
      fillFilters();
      renderLibrary();
      renderPrograms();
      renderRoutineExercises();
    } catch {
      $('#exercise-count').textContent = 'The exercise catalog could not be loaded.';
      libraryList.replaceChildren(h('li', { class: 'empty' }, 'Check that data/exercises.json is available from this site.'));
    }
  }

  function fillFilters() {
    const muscles = [...new Set(library.map(exercise => exercise.muscle))].sort();
    const equipment = [...new Set(library.map(exercise => exercise.equipment))].sort();
    $('#muscle-filter').append(...muscles.map(value => h('option', { value }, value)));
    $('#equipment-filter').append(...equipment.map(value => h('option', { value }, value)));
  }

  function bindFilters() {
    ['exercise-search', 'muscle-filter', 'equipment-filter', 'location-filter', 'difficulty-filter'].forEach(id => {
      $(`#${id}`).addEventListener('input', renderLibrary);
      $(`#${id}`).addEventListener('change', renderLibrary);
    });
  }

  function renderLibrary() {
    const query = $('#exercise-search').value.trim().toLowerCase();
    const muscle = $('#muscle-filter').value;
    const equipment = $('#equipment-filter').value;
    const location = $('#location-filter').value;
    const difficulty = $('#difficulty-filter').value;
    const matches = library.filter(exercise => {
      const textMatch = `${exercise.name} ${exercise.instructions} ${exercise.muscle}`.toLowerCase().includes(query);
      const bodyweight = exercise.equipment === 'Bodyweight';
      const gymOnly = ['Machine', 'Cable', 'Barbell', 'EZ bar', 'Rower', 'Treadmill', 'Elliptical'].includes(exercise.equipment);
      return textMatch && (!muscle || exercise.muscle === muscle) && (!equipment || exercise.equipment === equipment) && (!difficulty || exercise.difficulty === difficulty) && (!location || (location === 'bodyweight' ? bodyweight : location === 'home' ? !gymOnly : !bodyweight));
    });
    $('#exercise-count').textContent = `${matches.length} of ${library.length} exercises`;
    libraryList.replaceChildren();
    if (!matches.length) libraryList.append(h('li', { class: 'empty' }, 'No exercises match those filters. Change a filter or search term.'));
    matches.forEach(exercise => {
      const add = h('button', { type: 'button', class: 'ghost exercise-add', 'aria-label': `Add ${exercise.name} to current routine` }, 'Add to routine');
      add.addEventListener('click', () => {
        if (!draft) newRoutine();
        draft.exercises.push({ id: exercise.id, sets: 3, reps: 10, weight: 0, rest: 60, notes: '' });
        renderRoutineExercises();
        $('#routine-status').textContent = `${exercise.name} added. Save the routine to keep this change.`;
        toast(`${exercise.name} added to routine draft.`);
      });
      libraryList.append(h('li', { class: 'exercise-item' },
        h('div', {}, h('strong', {}, exercise.name), h('span', { class: 'exercise-meta' }, `${exercise.muscle} · ${exercise.equipment} · ${exercise.difficulty}`), h('p', {}, exercise.instructions)), add));
    });
  }

  function renderPrograms() {
    const list = $('#program-list');
    list.replaceChildren(...programs.map(program => {
      const button = h('button', { type: 'button', class: 'ghost program-use' }, 'Add editable program');
      button.addEventListener('click', () => addProgram(program));
      return h('article', { class: 'program-item' }, h('h3', {}, program.title), h('p', {}, program.description), h('small', {}, `${program.parts.reduce((count, part) => count + part.exercises.length, 0)} movements`), button);
    }));
  }

  function addProgram(program) {
    const additions = program.parts.map(part => ({
      id: `routine-${crypto.randomUUID()}`,
      title: part.title,
      days: [...part.days],
      exercises: part.exercises.map(([id, sets, reps, unit = 'reps']) => ({ id, sets, reps, unit, weight: 0, rest: program.id === 'home-hiit-20' ? 20 : 60, notes: '' })),
      active: true,
      programId: program.id
    }));
    update(state => { state.workoutRoutines.push(...additions); });
    renderRoutineSelect();
    draft = getState().workoutRoutines.find(routine => routine.id === additions[0].id);
    routineSelect.value = additions[0].id;
    renderBuilder();
    toast(`${program.title} added. Edit and save your routine details.`);
  }

  function renderRoutineSelect() {
    const routines = getState().workoutRoutines;
    routineSelect.replaceChildren(h('option', { value: '' }, 'New routine draft'), ...routines.map(routine => h('option', { value: routine.id }, routine.title)));
    if (draft?.id && routines.some(routine => routine.id === draft.id)) routineSelect.value = draft.id;
  }

  function newRoutine() {
    const days = chooseDays(getState().workoutDays);
    draft = { id: '', title: 'My Daily Routine', days, exercises: [], active: true };
    routineSelect.value = '';
    renderBuilder();
  }

  function renderBuilder() {
    if (!draft) return;
    $('#routine-title').value = draft.title;
    $('#routine-days').replaceChildren(...weekdays.map(([label, value]) => {
      const checkbox = h('input', { type: 'checkbox', name: 'routine-day', value, checked: draft.days.includes(value) });
      checkbox.addEventListener('change', () => { draft.days = $$('input[name="routine-day"]:checked', $('#routine-days')).map(input => Number(input.value)); });
      return h('label', { class: 'choice' }, checkbox, h('span', {}, label));
    }));
    $('#routine-summary').textContent = `${draft.days.length ? draft.days.map(day => weekdays.find(item => item[1] === day)?.[0]).join(', ') : 'No scheduled days'} · ${draft.exercises.length} exercises`;
    $('#routine-status').textContent = '';
    $('#duplicate-routine').disabled = !draft.id;
    $('#delete-routine').disabled = !draft.id;
    renderRoutineExercises();
  }

  function renderRoutineExercises() {
    const list = $('#routine-exercises');
    list.replaceChildren();
    draft.exercises.forEach((item, index) => {
      const exercise = library.find(entry => entry.id === item.id);
      const row = h('li', { class: 'routine-exercise', draggable: true });
      const title = h('div', { class: 'routine-exercise-title' }, h('strong', {}, exercise?.name || item.id), h('small', {}, exercise ? `${exercise.muscle} · ${exercise.equipment}` : 'Exercise unavailable in catalog'));
      const controls = h('div', { class: 'routine-exercise-controls' });
      for (const [key, label, type, min, max] of [['sets', 'Sets', 'number', 1, 20], ['reps', 'Target', 'number', 1, 300], ['weight', 'Weight', 'number', 0, 999], ['rest', 'Rest seconds', 'number', 0, 900]]) {
        const input = h('input', { type, min, max, step: key === 'weight' ? '0.5' : '1', value: item[key], 'aria-label': `${label} for ${exercise?.name || item.id}` });
        input.addEventListener('change', () => { item[key] = Math.max(Number(min), Number(input.value) || 0); input.value = String(item[key]); $('#routine-status').textContent = 'Unsaved changes.'; });
        controls.append(h('label', {}, h('span', {}, label), input));
      }
      const unit = h('select', { 'aria-label': `Target unit for ${exercise?.name || item.id}` }, [h('option', { value: 'reps', selected: (item.unit || 'reps') === 'reps' }, 'Reps'), h('option', { value: 'seconds', selected: item.unit === 'seconds' }, 'Seconds')]);
      unit.addEventListener('change', () => { item.unit = unit.value; $('#routine-status').textContent = 'Unsaved changes.'; });
      controls.append(h('label', {}, h('span', {}, 'Target unit'), unit));
      const note = h('input', { type: 'text', maxlength: '120', value: item.notes, placeholder: 'Optional notes', 'aria-label': `Notes for ${exercise?.name || item.id}` });
      note.addEventListener('input', () => { item.notes = note.value; $('#routine-status').textContent = 'Unsaved changes.'; });
      controls.append(h('label', { class: 'exercise-note' }, h('span', {}, 'Notes'), note));
      const moveUp = h('button', { type: 'button', class: 'ghost', disabled: index === 0, 'aria-label': `Move ${exercise?.name || item.id} up` }, 'Move up');
      const moveDown = h('button', { type: 'button', class: 'ghost', disabled: index === draft.exercises.length - 1, 'aria-label': `Move ${exercise?.name || item.id} down` }, 'Move down');
      const remove = h('button', { type: 'button', class: 'x', 'aria-label': `Remove ${exercise?.name || item.id}` }, '×');
      moveUp.addEventListener('click', () => moveExercise(index, index - 1));
      moveDown.addEventListener('click', () => moveExercise(index, index + 1));
      remove.addEventListener('click', () => { draft.exercises.splice(index, 1); renderRoutineExercises(); });
      row.addEventListener('dragstart', event => { event.dataTransfer?.setData('text/plain', String(index)); });
      row.addEventListener('dragover', event => event.preventDefault());
      row.addEventListener('drop', event => { event.preventDefault(); const from = Number(event.dataTransfer?.getData('text/plain')); moveExercise(from, index); });
      row.append(title, controls, h('div', { class: 'routine-reorder' }, moveUp, moveDown, remove));
      list.append(row);
    });
    $('#routine-summary').textContent = `${draft.days.length ? draft.days.map(day => weekdays.find(item => item[1] === day)?.[0]).join(', ') : 'No scheduled days'} · ${draft.exercises.length} exercises`;
  }

  function moveExercise(from, to) {
    if (from < 0 || to < 0 || from >= draft.exercises.length || to >= draft.exercises.length) return;
    const [item] = draft.exercises.splice(from, 1);
    draft.exercises.splice(to, 0, item);
    renderRoutineExercises();
  }

  function saveRoutine(event) {
    event.preventDefault();
    const title = $('#routine-title').value.trim();
    if (!title) return;
    draft.title = title;
    draft.days = $$('input[name="routine-day"]:checked', $('#routine-days')).map(input => Number(input.value));
    if (draft.id) update(state => { const index = state.workoutRoutines.findIndex(item => item.id === draft.id); if (index >= 0) state.workoutRoutines[index] = { ...draft }; });
    else {
      draft.id = `routine-${crypto.randomUUID()}`;
      update(state => state.workoutRoutines.push({ ...draft, exercises: draft.exercises.map(item => ({ ...item })) }));
    }
    renderRoutineSelect();
    $('#routine-status').textContent = 'Routine saved on this device.';
    toast('Routine saved.');
  }

  function duplicateRoutine() {
    if (!draft?.id) return;
    const copy = { ...draft, id: `routine-${crypto.randomUUID()}`, title: `${draft.title} copy`, exercises: draft.exercises.map(item => ({ ...item })), days: [...draft.days] };
    update(state => state.workoutRoutines.push(copy));
    draft = copy;
    renderRoutineSelect();
    renderBuilder();
    toast('Routine duplicated.');
  }

  async function deleteRoutine() {
    if (!draft?.id) return;
    const confirmed = await confirmDialog({ title: 'Delete routine?', message: 'You can restore it for five seconds.', confirmLabel: 'Delete', danger: true });
    if (!confirmed) return;
    const removed = getState().workoutRoutines.find(item => item.id === draft.id);
    update(state => { state.workoutRoutines = state.workoutRoutines.filter(item => item.id !== draft.id); });
    toast('Routine deleted.', { actionLabel: 'Undo', duration: 5000, onAction: () => { update(state => state.workoutRoutines.push(removed)); renderRoutineSelect(); draft = removed; renderBuilder(); } });
    draft = null;
    renderRoutineSelect();
    newRoutine();
  }

  function startWorkout() {
    if (!draft?.id || !draft.exercises.length) {
      $('#routine-status').textContent = 'Save a routine with at least one exercise before starting.';
      return;
    }
    activeRun = { id: `session-${crypto.randomUUID()}`, routineId: draft.id, title: draft.title, startedAt: Date.now(), index: 0, exercises: draft.exercises.map(item => ({ ...item, plannedSets: item.sets, sets: [] })) };
    $('#active-workout').hidden = false;
    $('#session-summary').hidden = true;
    $('#session-title').textContent = draft.title;
    renderSessionStage();
    $('#active-workout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderSessionStage() {
    if (!activeRun) return;
    const stage = $('#session-stage');
    const entry = activeRun.exercises[activeRun.index];
    const exercise = library.find(item => item.id === entry.id);
    const previous = getState().workoutSessions.find(session => session.exercises?.some(item => item.id === entry.id));
    const prior = previous?.exercises?.find(item => item.id === entry.id);
    stage.replaceChildren();
    const previousText = prior?.sets?.length ? `Previous: ${prior.sets.map(set => `${set.reps} ${set.unit === 'seconds' ? 'sec' : 'reps'} × ${set.weight} kg`).join(', ')}` : 'No previous sets logged for this exercise.';
    stage.append(h('p', { class: 'eyebrow' }, `Exercise ${activeRun.index + 1} of ${activeRun.exercises.length}`), h('h3', {}, exercise?.name || entry.id), h('p', {}, exercise?.instructions || ''), h('p', { class: 'previous-set' }, previousText), h('p', {}, `Set ${entry.sets.length + 1} of ${entry.plannedSets} · Target ${entry.reps} ${entry.unit === 'seconds' ? 'seconds' : 'reps'}`));
    const sound = h('input', { type: 'checkbox', checked: getState().workoutPrefs.sound });
    const vibration = h('input', { type: 'checkbox', checked: getState().workoutPrefs.vibration });
    sound.addEventListener('change', () => update(state => { state.workoutPrefs.sound = sound.checked; }));
    vibration.addEventListener('change', () => update(state => { state.workoutPrefs.vibration = vibration.checked; }));
    stage.append(h('div', { class: 'session-options' }, h('label', { class: 'choice' }, sound, h('span', {}, 'Rest sound')), h('label', { class: 'choice' }, vibration, h('span', {}, 'Vibrate'))));
    if (entry.sets.length < entry.plannedSets) {
      const form = h('form', { class: 'set-log-form' });
      const reps = h('input', { type: 'number', min: '1', max: '300', value: entry.reps, required: true });
      const weight = h('input', { type: 'number', min: '0', max: '999', step: '0.5', value: entry.weight, required: true });
      form.append(h('label', {}, h('span', {}, entry.unit === 'seconds' ? 'Seconds completed' : 'Reps completed'), reps), h('label', {}, h('span', {}, 'Weight (kg)'), weight), h('button', { type: 'submit' }, 'Log set'));
      form.addEventListener('submit', event => {
        event.preventDefault();
        const repsValue = Number.parseInt(reps.value, 10);
        const weightValue = Number(weight.value);
        if (repsValue < 1 || !Number.isFinite(weightValue) || weightValue < 0) return;
        entry.sets.push({ reps: repsValue, weight: weightValue, unit: entry.unit || 'reps', completedAt: Date.now() });
        if (entry.sets.length < entry.plannedSets) startRest(entry.rest);
        else renderSessionStage();
      });
      stage.append(form);
    } else {
      const next = h('button', { type: 'button' }, activeRun.index === activeRun.exercises.length - 1 ? 'Finish workout' : 'Next exercise');
      next.addEventListener('click', () => {
        if (activeRun.index === activeRun.exercises.length - 1) finishWorkout();
        else { activeRun.index += 1; renderSessionStage(); }
      });
      stage.append(h('p', { class: 'field-note' }, 'All planned sets are logged for this exercise.'), next);
    }
  }

  function startRest(seconds) {
    window.clearInterval(restTimer);
    const stage = $('#session-stage');
    let time = h('div', { class: 'time', role: 'timer', 'aria-live': 'polite' }, formatClock(seconds));
    const skip = h('button', { type: 'button', class: 'ghost' }, 'Skip rest');
    const stopRest = () => { window.clearInterval(restTimer); restTimer = null; playRestCue(); renderSessionStage(); };
    skip.addEventListener('click', stopRest);
    stage.replaceChildren(h('h3', {}, 'Rest'), time, h('p', {}, 'Take a comfortable recovery break.'), skip);
    restEndsAt = Date.now() + seconds * 1000;
    restTimer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      time.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
      if (!left) stopRest();
    }, 250);
    if (getState().workoutPrefs.vibration && navigator.vibrate) navigator.vibrate(40);
  }

  function playRestCue() {
    if (getState().workoutPrefs.vibration && navigator.vibrate) navigator.vibrate([80, 40, 80]);
    if (!getState().workoutPrefs.sound) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 660;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.16);
      oscillator.onended = () => context.close();
    } catch { /* Sound is optional and may be blocked by the browser. */ }
  }

  async function cancelWorkout() {
    if (!activeRun) return;
    const confirmed = await confirmDialog({ title: 'End this workout?', message: 'Unfinished session sets will not be saved.', confirmLabel: 'End workout', danger: true });
    if (!confirmed) return;
    window.clearInterval(restTimer);
    restTimer = null;
    activeRun = null;
    $('#active-workout').hidden = true;
    toast('Workout ended.');
  }

  function finishWorkout() {
    if (!activeRun) return;
    window.clearInterval(restTimer);
    const finishedAt = Date.now();
    const exerciseEntries = activeRun.exercises.filter(item => item.sets.length).map(item => ({ id: item.id, name: library.find(exercise => exercise.id === item.id)?.name || item.id, muscle: library.find(exercise => exercise.id === item.id)?.muscle || 'Other', unit: item.unit || 'reps', sets: item.sets }));
    const volume = exerciseEntries.reduce((sum, exercise) => sum + exercise.sets.reduce((subtotal, set) => subtotal + set.reps * set.weight, 0), 0);
    const prs = exerciseEntries.filter(exercise => {
      const previousBest = getState().workoutSessions.flatMap(session => session.exercises || []).filter(item => item.id === exercise.id).flatMap(item => item.sets || []).reduce((best, set) => Math.max(best, set.reps * set.weight), 0);
      const currentBest = exercise.sets.reduce((best, set) => Math.max(best, set.reps * set.weight), 0);
      return currentBest > 0 && currentBest > previousBest;
    }).map(exercise => exercise.name);
    const session = { id: activeRun.id, routineId: activeRun.routineId, title: activeRun.title, date: getDayKey(new Date(activeRun.startedAt)), startedAt: activeRun.startedAt, finishedAt, durationSeconds: Math.max(1, Math.round((finishedAt - activeRun.startedAt) / 1000)), volume, prs, exercises: exerciseEntries };
    update(state => {
      state.workoutSessions.unshift(session);
      state.workoutLogs.unshift({ id: session.id, title: session.title, minutes: Math.max(1, Math.round(session.durationSeconds / 60)), date: session.date });
      state.firstWeek.workoutLogged = true;
    });
    setHabit('workout', true);
    activeRun = null;
    $('#active-workout').hidden = true;
    renderSummary(session);
    renderHistory();
    renderPosts();
    toast('Workout complete. Session saved privately.');
  }

  function renderSummary(session) {
    const summary = $('#session-summary');
    summary.hidden = false;
    summary.className = 'workout-section session-summary';
    summary.replaceChildren(h('h2', {}, 'Workout complete'), h('p', {}, `${Math.round(session.durationSeconds / 60)} minutes · ${session.exercises.length} exercises · ${formatNumber(session.volume)} kg total volume`), h('p', {}, session.prs.length ? `New best set volume: ${session.prs.join(', ')}` : 'No new best set today. Consistency counts.'), h('button', { type: 'button', class: 'ghost' }, 'Dismiss'));
    summary.querySelector('button').addEventListener('click', () => { summary.hidden = true; });
    summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderHistory() {
    const state = getState();
    const sessions = state.workoutSessions;
    const weekAgo = Date.now() - 7 * 86400000;
    const recent = sessions.filter(session => session.startedAt >= weekAgo);
    const recentVolume = recent.reduce((sum, session) => sum + (session.volume || 0), 0);
    $('#history-summary').replaceChildren(h('div', { class: 'history-stat' }, h('strong', {}, String(recent.length)), h('span', {}, 'sessions this week')), h('div', { class: 'history-stat' }, h('strong', {}, `${formatNumber(recentVolume)} kg`), h('span', {}, 'volume this week')), h('div', { class: 'history-stat' }, h('strong', {}, String(sessions.length)), h('span', {}, 'saved sessions')));
    const list = $('#session-history');
    list.replaceChildren();
    if (!sessions.length) list.append(h('li', { class: 'empty' }, 'No finished workouts yet. Start a routine above to build your history.'));
    sessions.slice(0, 20).forEach(session => list.append(h('li', {}, h('div', {}, h('strong', {}, session.title), h('span', {}, `${session.date} · ${Math.round(session.durationSeconds / 60)} min · ${session.exercises.length} exercises`)), h('span', {}, `${formatNumber(session.volume)} kg`))));
    const groups = new Map();
    sessions.forEach(session => (session.exercises || []).forEach(exercise => {
      const volume = exercise.sets.reduce((sum, set) => sum + set.reps * set.weight, 0);
      groups.set(exercise.muscle, (groups.get(exercise.muscle) || 0) + volume);
    }));
    const maxVolume = Math.max(1, ...groups.values());
    const volumeList = $('#muscle-volume');
    volumeList.replaceChildren();
    if (!groups.size) volumeList.append(h('li', { class: 'empty' }, 'Muscle-group volume appears after weighted sets are saved.'));
    [...groups].sort((a, b) => b[1] - a[1]).forEach(([muscle, volume]) => volumeList.append(h('li', {}, h('span', {}, muscle), h('div', { class: 'meter', role: 'img', 'aria-label': `${muscle}: ${formatNumber(volume)} kilograms` }, h('div', { style: `width:${Math.min(100, volume / maxVolume * 100)}%` })), h('span', {}, `${formatNumber(volume)} kg`))));
    const bests = new Map();
    sessions.forEach(session => (session.exercises || []).forEach(exercise => exercise.sets.forEach(set => {
      const score = set.reps * set.weight;
      const prior = bests.get(exercise.id);
      if (!prior || score > prior.score) bests.set(exercise.id, { name: exercise.name, score, reps: set.reps, weight: set.weight });
    })));
    const records = $('#personal-records');
    records.replaceChildren();
    if (!bests.size) records.append(h('li', { class: 'empty' }, 'Personal bests appear after you log weighted sets.'));
    [...bests.values()].sort((a, b) => b.score - a.score).slice(0, 10).forEach(record => records.append(h('li', {}, h('span', {}, record.name), h('span', {}, `${record.reps} reps · ${record.weight} kg`))));
  }

  function latestPostExercises() {
    const todaySession = getState().workoutSessions.find(session => session.date === getDayKey());
    const options = $('#post-exercise-options');
    if (!options) return;
    options.replaceChildren(h('legend', {}, 'Exercises from today’s session'));
    const items = todaySession?.exercises || [];
    if (!items.length) options.append(h('p', { class: 'field-note' }, 'Finish a workout today to attach its exercise list.'));
    items.forEach(exercise => options.append(h('label', { class: 'choice' }, h('input', { type: 'checkbox', name: 'post-exercise', value: exercise.id, checked: true }), h('span', {}, exercise.name))));
  }

  async function loadPhoto(event) {
    const file = event.target.files?.[0];
    photoData = '';
    const preview = $('#post-photo-preview');
    preview.replaceChildren();
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
      $('#post-status').textContent = 'Choose an image under 8 MB.';
      event.target.value = '';
      return;
    }
    try {
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 800 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      photoData = canvas.toDataURL('image/jpeg', 0.72);
      if (photoData.length > 700000) throw new Error('Photo too large after compression.');
      preview.append(h('img', { src: photoData, alt: 'Selected workout photo preview' }));
      $('#post-status').textContent = 'Photo ready. It will stay in this browser with the private post.';
    } catch {
      photoData = '';
      $('#post-status').textContent = 'That photo could not be prepared. Try a smaller image.';
    }
  }

  function savePost(event) {
    event.preventDefault();
    const text = $('#post-text').value.trim();
    const selectedIds = $$('input[name="post-exercise"]:checked').map(input => input.value);
    const todaySession = getState().workoutSessions.find(session => session.date === getDayKey());
    const exercises = (todaySession?.exercises || []).filter(exercise => selectedIds.includes(exercise.id)).map(exercise => ({ id: exercise.id, name: exercise.name, sets: exercise.sets }));
    if (!text && !exercises.length && !photoData) { $('#post-status').textContent = 'Add a note, select a session exercise, or attach a photo.'; return; }
    const post = { id: `post-${crypto.randomUUID()}`, date: getDayKey(), text, mood: $('#post-mood').value, energy: Number($('#post-energy').value), exercises, photo: photoData, private: true };
    update(state => state.workoutPosts.unshift(post));
    $('#post-text').value = '';
    $('#post-photo').value = '';
    photoData = '';
    $('#post-photo-preview').replaceChildren();
    $('#post-status').textContent = 'Saved privately on this device.';
    toast('Private workout post saved.');
    renderPosts();
  }

  function renderPosts() {
    latestPostExercises();
    const list = $('#post-history');
    if (!list) return;
    list.replaceChildren();
    const posts = getState().workoutPosts;
    if (!posts.length) list.append(h('li', { class: 'empty' }, 'Your private workout notes will appear here.'));
    posts.slice(0, 20).forEach(post => {
      const article = h('li', { class: 'workout-post' }, h('div', {}, h('strong', {}, `${post.date} · Private`), h('span', {}, `${post.mood} mood · energy ${post.energy}/10`)));
      if (post.photo) article.append(h('img', { src: post.photo, alt: 'Photo attached to private workout post' }));
      if (post.text) article.append(h('p', {}, post.text));
      if (post.exercises?.length) article.append(h('ul', {}, post.exercises.map(exercise => h('li', {}, `${exercise.name} · ${exercise.sets.map(set => `${set.reps} ${set.unit === 'seconds' ? 'sec' : 'reps'} at ${set.weight} kg`).join(', ')}`))));
      const share = h('button', { type: 'button', class: 'ghost' }, 'Download share card');
      share.addEventListener('click', () => exportShareCard(post));
      article.append(share);
      list.append(article);
    });
  }

  async function exportShareCard(post) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 720;
    const context = canvas.getContext('2d');
    context.fillStyle = '#101b31';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f3d68f';
    context.font = 'bold 38px Georgia';
    context.fillText('Lassitude · Workout log', 64, 82);
    context.fillStyle = '#e8ecf4';
    context.font = '28px Arial';
    context.fillText(`${post.date} · ${post.mood} · energy ${post.energy}/10`, 64, 140);
    let y = 205;
    const lines = [post.text, ...(post.exercises || []).map(exercise => `${exercise.name}: ${exercise.sets.map(set => `${set.reps} ${set.unit === 'seconds' ? 'sec' : 'reps'} × ${set.weight} kg`).join(', ')}`)].filter(Boolean);
    lines.forEach(line => {
      for (const wrapped of wrapCanvasText(context, line, 930)) {
        if (y > 640) break;
        context.fillText(wrapped, 64, y);
        y += 44;
      }
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) { toast('Could not create the share image.'); return; }
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: `lassitude-workout-${post.date}.png` });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Private share card downloaded.');
  }

  function wrapCanvasText(context, text, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; }
      else line = candidate;
    });
    if (line) lines.push(line);
    return lines;
  }

  function chooseDays(count) {
    const schedule = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
    return [...(schedule[count] || schedule[3])];
  }

  function formatNumber(value) {
    return Math.round(value).toLocaleString();
  }

  function formatClock(seconds) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
}

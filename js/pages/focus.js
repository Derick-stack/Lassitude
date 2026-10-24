import { finishFocusSession, getDayKey, getState, update } from '../store.js';
import { $, $$, confirmDialog, h, toast } from '../ui.js';
import { addToParkingLot, dueCount, initNotes, initStudy } from '../study.js';

const RING = 2 * Math.PI * 100;
const PRESETS = [
  { id: 'quick', label: 'Quick start', detail: '15 / 3', focus: 15, short: 3, hint: 'Good for getting started' },
  { id: 'classic', label: 'Classic', detail: '25 / 5', focus: 25, short: 5, hint: 'Recommended' },
  { id: 'deep', label: 'Deep work', detail: '50 / 10', focus: 50, short: 10, hint: 'For long tasks' }
];
const SOUNDS = [['off', 'Off'], ['rain', 'Rain'], ['ocean', 'Ocean'], ['forest', 'Forest'], ['brown', 'Brown noise']];
const TABS = ['timer', 'notes', 'study'];
const pageTitle = document.title;

export function initFocus() {
  let prefs = { ...getState().focusPrefs };
  let phase = 'focus';
  let cycles = 0;
  let totalSeconds = prefs.focusMinutes * 60;
  let remaining = totalSeconds;
  let timer = null;
  let endsAt = 0;
  let sessionStartedAt = 0;
  let hiddenAt = 0;
  let sessionWithered = false;
  let audioContext = null;
  let audioSource = null;
  let audioGain = null;
  let audioModulator = null;
  let birdTimer = null;
  const birds = new Set();

  setupTabs();
  $('#pomodoro-settings').addEventListener('submit', savePreferences);
  $('#start').addEventListener('click', () => (timer ? pauseTimer() : startTimer()));
  $('#reset').addEventListener('click', resetTimer);
  $('#skip').addEventListener('click', skipPhase);
  $('#focus-mode').addEventListener('click', toggleFocusMode);
  $('#quick-task').addEventListener('click', showQuickTask);
  $('#focus-task-form').addEventListener('submit', addTask);
  $('#parking-form').addEventListener('submit', parkThought);
  $('#ambient-volume').addEventListener('input', changeVolume);
  document.addEventListener('visibilitychange', handleVisibility);
  document.addEventListener('keydown', handleKeys);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('focus-mode-on'); syncFocusModeButton(); });
  window.addEventListener('pagehide', stopSound);
  loadPreferences();
  renderPresets();
  renderSounds();
  renderTasks();
  renderStats();
  renderGarden();
  updateDisplay();
  initNotes();
  initStudy(renderDueBadge);
  renderDueBadge();

  function setupTabs() {
    const tabs = $$('[data-ftab]');
    const show = (tab, focus = false) => {
      if (!TABS.includes(tab)) tab = 'timer';
      tabs.forEach(button => {
        const selected = button.dataset.ftab === tab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected && focus) button.focus();
      });
      TABS.forEach(id => { $(`#fpanel-${id}`).hidden = id !== tab; });
      if (location.hash.slice(1) !== tab) history.replaceState(null, '', `#${tab}`);
      document.dispatchEvent(new CustomEvent('focus-tab', { detail: tab }));
    };
    tabs.forEach(button => button.addEventListener('click', () => show(button.dataset.ftab)));
    $('.focus-tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const index = tabs.indexOf(document.activeElement);
      show(tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].dataset.ftab, true);
    });
    window.addEventListener('hashchange', () => show(location.hash.slice(1)));
    show(location.hash.slice(1));
  }

  function renderDueBadge() {
    const count = dueCount();
    const badge = $('#due-badge');
    badge.hidden = !count;
    badge.textContent = String(count);
    badge.setAttribute('aria-label', `${count} cards due`);
  }

  function loadPreferences() {
    $('#focus-minutes').value = prefs.focusMinutes;
    $('#short-minutes').value = prefs.shortBreakMinutes;
    $('#long-minutes').value = prefs.longBreakMinutes;
    $('#long-every').value = prefs.longBreakEvery;
    $('#ambient-volume').value = prefs.ambientVolume;
    $('#ambient-volume-value').textContent = `${Math.round(prefs.ambientVolume * 100)}%`;
  }
  function applyPrefs(next, message) {
    prefs = { ...prefs, ...next };
    update(state => { state.focusPrefs = { ...state.focusPrefs, ...next }; });
    if (!timer) { totalSeconds = remaining = phaseDuration() * 60; updateDisplay(); }
    loadPreferences();
    renderPresets();
    if (message) toast(message, { duration: 1800 });
  }
  function savePreferences(event) {
    event.preventDefault();
    applyPrefs({ focusMinutes: clamp($('#focus-minutes').value, 1, 120, 25), shortBreakMinutes: clamp($('#short-minutes').value, 1, 60, 5), longBreakMinutes: clamp($('#long-minutes').value, 1, 90, 15), longBreakEvery: clamp($('#long-every').value, 2, 8, 4) }, 'Timer settings saved');
    $('#focus-settings-status').textContent = timer ? 'Saved. New lengths apply from the next interval.' : 'Saved.';
  }
  function renderPresets() {
    $('#presets').replaceChildren(...PRESETS.map(preset => {
      const active = prefs.focusMinutes === preset.focus && prefs.shortBreakMinutes === preset.short;
      const button = h('button', { type: 'button', class: 'preset', 'aria-pressed': String(active), title: preset.hint }, h('strong', {}, preset.label), h('span', {}, preset.detail), preset.id === 'classic' ? h('em', {}, 'Recommended') : null);
      button.addEventListener('click', () => {
        if (timer) { toast('Pause the timer to change presets.'); return; }
        applyPrefs({ focusMinutes: preset.focus, shortBreakMinutes: preset.short }, `${preset.label}: ${preset.detail} minutes`);
      });
      return button;
    }));
  }

  function phaseDuration() { return phase === 'short' ? prefs.shortBreakMinutes : phase === 'long' ? prefs.longBreakMinutes : prefs.focusMinutes; }
  function startTimer() {
    if (timer) return;
    if (phase === 'focus' && !sessionStartedAt) sessionStartedAt = Date.now();
    endsAt = Date.now() + remaining * 1000;
    timer = window.setInterval(tick, 200);
    $('#note').textContent = phase === 'focus' ? 'Stay with it. Park any stray thoughts below.' : 'Stand up, stretch, drink some water.';
    $('#timer-card').dataset.running = 'true';
    updateDisplay();
  }
  function pauseTimer() {
    if (!timer) return;
    remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    window.clearInterval(timer);
    timer = null;
    $('#note').textContent = 'Paused.';
    delete $('#timer-card').dataset.running;
    updateDisplay();
  }
  function resetTimer() {
    window.clearInterval(timer);
    timer = null;
    remaining = totalSeconds = phaseDuration() * 60;
    sessionStartedAt = 0;
    sessionWithered = false;
    delete $('#timer-card').dataset.running;
    $('#note').textContent = 'Interval restarted.';
    renderGarden();
    updateDisplay();
  }
  async function skipPhase() {
    if (phase === 'focus' && sessionStartedAt && totalSeconds - remaining > 60) {
      const ok = await confirmDialog({ title: 'End this focus session early?', message: 'Sessions that end early aren’t added to your garden or stats.', confirmLabel: 'End session' });
      if (!ok) return;
    }
    window.clearInterval(timer);
    timer = null;
    delete $('#timer-card').dataset.running;
    if (phase === 'focus') { sessionStartedAt = 0; sessionWithered = false; phase = 'short'; $('#note').textContent = 'Skipped. Take a short break, or skip again to keep going.'; }
    else { phase = 'focus'; $('#note').textContent = 'Break skipped. Ready when you are.'; }
    totalSeconds = remaining = phaseDuration() * 60;
    renderGarden();
    updateDisplay();
  }
  function tick() {
    remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    updateDisplay();
    if (remaining === 0) finishPhase();
  }
  function chime() {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      [523, 659, 784].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + index * 0.15;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.5);
      });
      window.setTimeout(() => context.close(), 1200);
    } catch { /* Sound is optional. */ }
  }
  function finishPhase() {
    window.clearInterval(timer);
    timer = null;
    delete $('#timer-card').dataset.running;
    chime();
    const finishedAt = Date.now();
    if (phase === 'focus') {
      const focusMinutes = Math.round(totalSeconds / 60);
      finishFocusSession({ type: 'focus', date: getDayKey(new Date(sessionStartedAt)), startedAt: sessionStartedAt, finishedAt, focusMinutes, durationSeconds: totalSeconds, taskId: $('#focus-task-select').value, withered: sessionWithered });
      const wasWithered = sessionWithered;
      sessionWithered = false;
      cycles += 1;
      phase = cycles % prefs.longBreakEvery === 0 ? 'long' : 'short';
      sessionStartedAt = 0;
      $('#note').textContent = wasWithered ? 'Session complete, but your tree withered while you were away.' : `Well done! ${focusMinutes} minutes of focus. Your tree has grown.`;
      toast(wasWithered ? 'Focus complete. Tree withered.' : `Focus complete. Cycle ${cycles} saved.`);
      renderGarden();
      renderStats();
      renderTasks();
    } else {
      finishFocusSession({ type: 'break', date: getDayKey(), startedAt: finishedAt - totalSeconds * 1000, finishedAt, durationSeconds: totalSeconds });
      phase = 'focus';
      $('#note').textContent = 'Break complete. Ready for another round?';
      toast('Break complete.');
    }
    totalSeconds = remaining = phaseDuration() * 60;
    updateDisplay();
    $('#time-announcer').textContent = $('#note').textContent;
  }
  function updateDisplay() {
    const percent = totalSeconds ? (totalSeconds - remaining) / totalSeconds : 0;
    const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    $('#time').textContent = clock;
    $('#ring-fill').style.strokeDasharray = String(RING);
    $('#ring-fill').style.strokeDashoffset = String(RING * (1 - percent));
    const label = phase === 'focus' ? 'Focus' : phase === 'short' ? 'Short break' : 'Long break';
    $('#phase-title').textContent = label;
    $('#phase-title').dataset.phase = phase;
    $('#timer-card').dataset.phase = phase;
    const cycleNumber = phase === 'focus' ? (cycles % prefs.longBreakEvery) + 1 : ((cycles - 1) % prefs.longBreakEvery) + 1;
    $('#cycle-count').textContent = `Cycle ${cycleNumber} of ${prefs.longBreakEvery}`;
    $('#cycle-dots').replaceChildren(...Array.from({ length: prefs.longBreakEvery }, (_, index) => h('span', { class: index < cycles % prefs.longBreakEvery || (phase !== 'focus' && index === cycleNumber - 1) ? 'is-done' : index === cycleNumber - 1 ? 'is-current' : '' })));
    const started = remaining < totalSeconds;
    $('#start').textContent = timer ? 'Pause' : started ? 'Resume' : phase === 'focus' ? 'Start focus' : 'Start break';
    $('#plant').textContent = phase !== 'focus' ? '☕' : sessionWithered ? '🍂' : percent < 0.34 ? '🌱' : percent < 0.67 ? '🌿' : '🌳';
    document.title = timer ? `${clock} · ${label}` : pageTitle;
  }
  function handleVisibility() {
    if (document.hidden) { if (timer && phase === 'focus') hiddenAt = Date.now(); return; }
    if (!hiddenAt) return;
    const awaySeconds = (Date.now() - hiddenAt) / 1000;
    hiddenAt = 0;
    if (prefs.witherOnLeave && phase === 'focus' && !sessionWithered && awaySeconds >= prefs.witherAfterSeconds && sessionStartedAt) {
      sessionWithered = true;
      $('#garden-status').textContent = `You were away for ${Math.floor(awaySeconds)} seconds, so this session’s tree withered. The timer kept counting.`;
      renderGarden();
      toast('Your tree withered while you were away.');
    }
    if (timer) tick();
  }
  function handleKeys(event) {
    if ($('#fpanel-timer').hidden || event.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    if (event.code === 'Space') { event.preventDefault(); $('#start').click(); }
    if (event.key === 'f' || event.key === 'F') toggleFocusMode();
  }
  function toggleFocusMode() {
    const on = !document.body.classList.contains('focus-mode-on');
    document.body.classList.toggle('focus-mode-on', on);
    if (on) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    syncFocusModeButton();
  }
  function syncFocusModeButton() {
    const on = document.body.classList.contains('focus-mode-on');
    $('#focus-mode').setAttribute('aria-label', on ? 'Exit full-screen focus mode' : 'Enter full-screen focus mode');
    $('#focus-mode').setAttribute('aria-pressed', String(on));
  }

  function showQuickTask() {
    const row = $('.task-pick-row');
    const input = h('input', { type: 'text', maxlength: '100', placeholder: 'New task', 'aria-label': 'New task name' });
    const add = h('button', { type: 'submit' }, 'Add');
    const cancel = h('button', { type: 'button', class: 'ghost' }, 'Cancel');
    const form = h('form', { class: 'task-pick-row' }, input, add, cancel);
    const restore = () => { form.replaceWith(row); $('#focus-task-select').focus(); };
    cancel.addEventListener('click', restore);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const title = input.value.trim();
      if (!title) return;
      const id = `task-${crypto.randomUUID()}`;
      update(state => state.focusTasks.push({ id, title, done: false, createdAt: Date.now() }));
      restore();
      renderTasks();
      $('#focus-task-select').value = id;
      toast('Task added');
    });
    row.replaceWith(form);
    input.focus();
  }
  function renderTasks() {
    const state = getState();
    const select = $('#focus-task-select');
    const selected = select.value;
    const open = state.focusTasks.filter(task => !task.done);
    select.replaceChildren(h('option', { value: '' }, 'Just focusing'), ...open.map(task => h('option', { value: task.id }, task.title)));
    if (open.some(task => task.id === selected)) select.value = selected;
    const sessionsByTask = state.focusSessions.reduce((counts, session) => { if (session.type === 'focus' && session.taskId) counts[session.taskId] = (counts[session.taskId] || 0) + 1; return counts; }, {});
    const list = $('#focus-task-list');
    list.replaceChildren();
    if (!state.focusTasks.length) list.append(h('li', { class: 'empty' }, 'Add what you need to get done, then pick it on the timer.'));
    [...state.focusTasks].sort((a, b) => Number(a.done) - Number(b.done)).forEach(task => {
      const done = h('input', { type: 'checkbox', checked: task.done, 'aria-label': `${task.done ? 'Reopen' : 'Complete'} ${task.title}` });
      done.addEventListener('change', () => { update(data => { const item = data.focusTasks.find(entry => entry.id === task.id); if (item) item.done = done.checked; }); toast(done.checked ? 'Nice, task done.' : 'Task reopened.'); renderTasks(); });
      const play = h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Focus on ${task.title}`, title: 'Focus on this' }, '▶');
      play.addEventListener('click', () => { select.value = task.id; if (!timer && phase === 'focus') startTimer(); $('#timer-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      const remove = h('button', { type: 'button', class: 'x', 'aria-label': `Delete ${task.title}` }, '×');
      remove.addEventListener('click', () => removeTask(task));
      const count = sessionsByTask[task.id];
      list.append(h('li', { class: task.done ? 'is-done' : '' }, done, h('span', { class: 'task-title' }, task.title, count ? h('small', {}, `${count} session${count === 1 ? '' : 's'}`) : null), task.done ? null : play, remove));
    });
  }
  function addTask(event) {
    event.preventDefault();
    const input = $('#focus-task-title');
    const title = input.value.trim();
    if (!title) return;
    update(state => state.focusTasks.push({ id: `task-${crypto.randomUUID()}`, title, done: false, createdAt: Date.now() }));
    input.value = '';
    toast('Task added');
    renderTasks();
  }
  async function removeTask(task) {
    const confirmed = await confirmDialog({ title: 'Delete task?', message: 'You can undo this for five seconds.', confirmLabel: 'Delete', danger: true });
    if (!confirmed) return;
    const index = getState().focusTasks.findIndex(item => item.id === task.id);
    update(state => { state.focusTasks.splice(index, 1); });
    toast('Task deleted.', { actionLabel: 'Undo', duration: 5000, onAction: () => { update(state => state.focusTasks.splice(index, 0, task)); renderTasks(); } });
    renderTasks();
  }
  function parkThought(event) {
    event.preventDefault();
    const input = $('#parking-input');
    const text = input.value.trim();
    if (!text) return;
    addToParkingLot(text);
    input.value = '';
    toast('Parked in Notes → Parking lot. Back to it!', { duration: 2200 });
  }

  function renderGarden() {
    const state = getState();
    const withered = state.gardenHistory.filter(item => item.outcome === 'withered').length;
    $('#plantNote').textContent = state.plant ? `${state.plant} tree${state.plant === 1 ? '' : 's'} grown${withered ? ` · ${withered} withered` : ''}` : '';
    if (!sessionWithered) $('#garden-status').textContent = prefs.witherOnLeave ? `Leave this tab for more than ${prefs.witherAfterSeconds} seconds during focus and your tree withers.` : 'Each completed focus session grows a tree.';
    const recent = state.gardenHistory.slice(0, 24).reverse();
    const row = $('#garden-history');
    row.replaceChildren();
    if (!recent.length) { row.append(h('p', { class: 'empty' }, 'Finish your first focus session to plant a tree.')); return; }
    recent.forEach(item => row.append(h('span', { class: 'garden-tree', title: `${item.date}: ${item.outcome === 'withered' ? 'withered' : 'grown'}` }, item.outcome === 'withered' ? '🍂' : '🌳')));
  }
  function renderStats() {
    const sessions = getState().focusSessions.filter(session => session.type === 'focus');
    const today = getDayKey();
    const todaySessions = sessions.filter(session => session.date === today);
    const todayMinutes = todaySessions.reduce((sum, session) => sum + (session.focusMinutes || 0), 0);
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); const key = getDayKey(date); return { date, key, minutes: sessions.filter(session => session.date === key).reduce((sum, session) => sum + (session.focusMinutes || 0), 0) }; });
    const dates = new Set(sessions.map(session => session.date));
    let streak = 0;
    const cursor = new Date();
    if (!dates.has(getDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (dates.has(getDayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    const stat = (value, label) => h('div', { class: 'focus-stat' }, h('strong', {}, value), h('span', {}, label));
    $('#focus-stats').replaceChildren(stat(String(todaySessions.length), todaySessions.length === 1 ? 'session' : 'sessions'), stat(`${todayMinutes}`, 'minutes'), stat(`${streak}`, streak === 1 ? 'day streak' : 'day streak'));
    const max = Math.max(25, ...days.map(day => day.minutes));
    $('#focus-chart').replaceChildren(...days.map(day => h('li', { class: day.key === today ? 'is-today' : '' },
      h('span', { class: 'bar-value' }, day.minutes ? `${day.minutes}` : ''),
      h('span', { class: 'week-bar', style: `--h:${Math.max(4, day.minutes / max * 100)}%`, role: 'img', 'aria-label': `${day.date.toLocaleDateString(undefined, { weekday: 'long' })}: ${day.minutes} minutes` }),
      h('span', { class: 'bar-day', 'aria-hidden': 'true' }, day.date.toLocaleDateString(undefined, { weekday: 'narrow' })))));
  }

  function renderSounds() {
    $('#sound-pills').replaceChildren(...SOUNDS.map(([id, label]) => {
      const input = h('input', { type: 'radio', name: 'ambient', value: id, id: `sound-${id}` });
      input.checked = id === 'off';
      input.addEventListener('change', () => { if (id === 'off') stopSound(); else startSound(id); });
      return h('label', { class: 'sound-pill', for: `sound-${id}` }, input, label);
    }));
  }
  function changeVolume() {
    const value = Number($('#ambient-volume').value);
    $('#ambient-volume-value').textContent = `${Math.round(value * 100)}%`;
    prefs = { ...prefs, ambientVolume: value };
    update(state => { state.focusPrefs.ambientVolume = value; });
    if (audioGain && audioContext) audioGain.gain.setTargetAtTime(value, audioContext.currentTime, 0.08);
  }
  async function startSound(type) {
    stopSound();
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is unavailable.');
      audioContext = new AudioContextClass();
      await audioContext.resume();
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
      const channel = buffer.getChannelData(0);
      let brown = 0;
      for (let index = 0; index < channel.length; index += 1) { const white = Math.random() * 2 - 1; brown = (brown + 0.02 * white) / 1.02; channel[index] = type === 'brown' ? brown * 3.5 : white * 0.55; }
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = buffer;
      audioSource.loop = true;
      const filter = audioContext.createBiquadFilter();
      filter.type = type === 'rain' ? 'highpass' : 'lowpass';
      filter.frequency.value = type === 'rain' ? 900 : type === 'forest' ? 2400 : type === 'ocean' ? 500 : 180;
      audioGain = audioContext.createGain();
      audioGain.gain.value = prefs.ambientVolume;
      audioSource.connect(filter);
      filter.connect(audioGain);
      audioGain.connect(audioContext.destination);
      audioSource.start();
      if (type === 'ocean') {
        audioModulator = audioContext.createOscillator();
        const depth = audioContext.createGain();
        audioModulator.frequency.value = 0.08;
        depth.gain.value = prefs.ambientVolume * 0.35;
        audioModulator.connect(depth);
        depth.connect(audioGain.gain);
        audioModulator.start();
      }
      if (type === 'forest') startBirdNotes();
      $('#ambient-status').textContent = `${type} sound playing`;
    } catch {
      $('#ambient-status').textContent = 'Could not start sound in this browser.';
      toast('Sound isn’t available in this browser.');
      $('#sound-off').checked = true;
    }
  }
  function startBirdNotes() {
    birdTimer = window.setInterval(() => {
      if (!audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1500 + Math.random() * 900, start);
      oscillator.frequency.exponentialRampToValueAtTime(2400 + Math.random() * 500, start + 0.12);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.006, prefs.ambientVolume * 0.08), start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.23);
      birds.add(oscillator);
      oscillator.onended = () => birds.delete(oscillator);
    }, 4200);
  }
  function stopSound() {
    window.clearInterval(birdTimer);
    birdTimer = null;
    birds.forEach(oscillator => { try { oscillator.stop(); } catch { /* already stopped */ } });
    birds.clear();
    try { audioSource?.stop(); } catch { /* already stopped */ }
    try { audioModulator?.stop(); } catch { /* already stopped */ }
    audioSource = null;
    audioModulator = null;
    audioGain = null;
    if (audioContext) audioContext.close();
    audioContext = null;
    $('#ambient-status').textContent = 'Sound off';
  }
}

function clamp(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

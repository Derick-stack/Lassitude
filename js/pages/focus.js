import { finishFocusSession, getDayKey, getState, update } from '../store.js';
import { $, h, toast } from '../ui.js';

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

  $('#pomodoro-settings').addEventListener('submit', savePreferences);
  $('#start').addEventListener('click', startTimer);
  $('#pause').addEventListener('click', pauseTimer);
  $('#reset').addEventListener('click', resetTimer);
  $('#focus-task-form').addEventListener('submit', addTask);
  $('#ambient-start').addEventListener('click', startSound);
  $('#ambient-stop').addEventListener('click', stopSound);
  $('#ambient-type').addEventListener('change', () => { if (audioContext) { stopSound(); startSound(); } });
  $('#ambient-volume').addEventListener('input', changeVolume);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', stopSound);
  loadPreferences();
  renderTasks();
  renderStats();
  renderGarden();
  updateDisplay();

  function loadPreferences() {
    $('#focus-minutes').value = prefs.focusMinutes;
    $('#short-minutes').value = prefs.shortBreakMinutes;
    $('#long-minutes').value = prefs.longBreakMinutes;
    $('#long-every').value = prefs.longBreakEvery;
    $('#ambient-volume').value = prefs.ambientVolume;
    $('#ambient-volume-value').textContent = `${Math.round(prefs.ambientVolume * 100)}%`;
  }
  function savePreferences(event) {
    event.preventDefault();
    prefs = { ...prefs, focusMinutes: clamp($('#focus-minutes').value, 1, 120, 25), shortBreakMinutes: clamp($('#short-minutes').value, 1, 60, 5), longBreakMinutes: clamp($('#long-minutes').value, 1, 90, 15), longBreakEvery: clamp($('#long-every').value, 2, 8, 4) };
    update(state => { state.focusPrefs = { ...state.focusPrefs, ...prefs }; });
    if (!timer) { totalSeconds = remaining = phaseDuration() * 60; updateDisplay(); }
    $('#focus-settings-status').textContent = 'Cycle settings saved on this device.';
    toast('Focus settings saved.');
  }
  function phaseDuration() { return phase === 'short' ? prefs.shortBreakMinutes : phase === 'long' ? prefs.longBreakMinutes : prefs.focusMinutes; }
  function startTimer() {
    if (timer) return;
    if (phase === 'focus' && !sessionStartedAt) sessionStartedAt = Date.now();
    endsAt = Date.now() + remaining * 1000;
    timer = window.setInterval(tick, 200);
    $('#note').textContent = phase === 'focus' ? 'Focus interval in progress.' : 'Break interval in progress.';
  }
  function pauseTimer() {
    if (!timer) return;
    remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    window.clearInterval(timer);
    timer = null;
    $('#note').textContent = 'Paused.';
    updateDisplay();
  }
  function resetTimer() {
    window.clearInterval(timer);
    timer = null;
    remaining = totalSeconds = phaseDuration() * 60;
    sessionStartedAt = 0;
    sessionWithered = false;
    $('#note').textContent = 'Interval reset.';
    renderGarden();
    updateDisplay();
  }
  function tick() {
    remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    updateDisplay();
    if (remaining === 0) finishPhase();
  }
  function finishPhase() {
    window.clearInterval(timer);
    timer = null;
    const finishedAt = Date.now();
    if (phase === 'focus') {
      const focusMinutes = prefs.focusMinutes;
      finishFocusSession({ type: 'focus', date: getDayKey(new Date(sessionStartedAt)), startedAt: sessionStartedAt, finishedAt, focusMinutes, durationSeconds: focusMinutes * 60, taskId: $('#focus-task-select').value, withered: sessionWithered });
      const wasWithered = sessionWithered;
      sessionWithered = false;
      cycles += 1;
      phase = cycles % prefs.longBreakEvery === 0 ? 'long' : 'short';
      sessionStartedAt = 0;
      $('#note').textContent = wasWithered ? 'Focus complete. This session’s garden entry is marked withered.' : 'Focus complete. Take a break when you are ready.';
      toast(wasWithered ? 'Focus complete. Session marked withered.' : `Focus complete. Cycle ${cycles} saved.`);
      renderGarden();
      renderStats();
      renderTasks();
    } else {
      finishFocusSession({ type: 'break', date: getDayKey(), startedAt: finishedAt - totalSeconds * 1000, finishedAt, durationSeconds: totalSeconds });
      phase = 'focus';
      $('#note').textContent = 'Break complete. Ready for another focus interval?';
      toast('Break complete.');
    }
    totalSeconds = remaining = phaseDuration() * 60;
    updateDisplay();
  }
  function updateDisplay() {
    const percent = totalSeconds ? Math.round((totalSeconds - remaining) / totalSeconds * 100) : 0;
    $('#time').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    $('#bar').style.width = `${percent}%`;
    $('#barWrap').setAttribute('aria-valuenow', String(percent));
    $('#phase-title').textContent = phase === 'focus' ? 'Focus session' : phase === 'short' ? 'Short break' : 'Long break';
    const cycleNumber = phase === 'focus' ? (cycles % prefs.longBreakEvery) + 1 : ((cycles - 1) % prefs.longBreakEvery) + 1;
    $('#cycle-count').textContent = `Cycle ${cycleNumber} of ${prefs.longBreakEvery}`;
  }
  function handleVisibility() {
    if (document.hidden) { if (timer && phase === 'focus') hiddenAt = Date.now(); return; }
    if (!hiddenAt) return;
    const awaySeconds = (Date.now() - hiddenAt) / 1000;
    hiddenAt = 0;
    if (prefs.witherOnLeave && phase === 'focus' && !sessionWithered && awaySeconds >= prefs.witherAfterSeconds && sessionStartedAt) {
      sessionWithered = true;
      $('#garden-status').textContent = `Away for ${Math.floor(awaySeconds)} seconds; this session will be marked withered when it ends.`;
      renderGarden();
      toast('Garden session marked withered. Timer stayed accurate.');
    }
    if (timer) tick();
  }
  function renderTasks() {
    const state = getState();
    const select = $('#focus-task-select');
    const selected = select.value;
    const open = state.focusTasks.filter(task => !task.done);
    select.replaceChildren(h('option', { value: '' }, 'No task'), ...open.map(task => h('option', { value: task.id }, task.title)));
    if (open.some(task => task.id === selected)) select.value = selected;
    const list = $('#focus-task-list');
    list.replaceChildren();
    if (!state.focusTasks.length) list.append(h('li', { class: 'empty' }, 'Add a task to attach it to a focus session.'));
    state.focusTasks.forEach(task => {
      const done = h('input', { type: 'checkbox', checked: task.done, 'aria-label': `${task.done ? 'Reopen' : 'Complete'} task ${task.title}` });
      done.addEventListener('change', () => { update(data => { const item = data.focusTasks.find(entry => entry.id === task.id); if (item) item.done = done.checked; }); toast(done.checked ? 'Task completed.' : 'Task reopened.'); renderTasks(); });
      const remove = h('button', { type: 'button', class: 'x', 'aria-label': `Delete task ${task.title}` }, '×');
      remove.addEventListener('click', () => removeTask(task));
      list.append(h('li', {}, done, h('span', { class: task.done ? 'done' : '' }, task.title), remove));
    });
  }
  function addTask(event) {
    event.preventDefault();
    const input = $('#focus-task-title');
    const title = input.value.trim();
    if (!title) return;
    update(state => state.focusTasks.push({ id: `task-${crypto.randomUUID()}`, title, done: false, createdAt: Date.now() }));
    input.value = '';
    toast('Focus task saved.');
    renderTasks();
  }
  async function removeTask(task) {
    const confirmed = await confirmDialog({ title: 'Delete task?', message: 'This task can be restored for five seconds.', confirmLabel: 'Delete', danger: true });
    if (!confirmed) return;
    const index = getState().focusTasks.findIndex(item => item.id === task.id);
    update(state => { state.focusTasks.splice(index, 1); });
    toast('Task deleted.', { actionLabel: 'Undo', duration: 5000, onAction: () => { update(state => state.focusTasks.splice(index, 0, task)); renderTasks(); } });
    renderTasks();
  }
  function renderGarden() {
    const state = getState();
    $('#plant').textContent = sessionWithered ? '🍂' : ['🌱', '🌿', '🌳', '🌲', '🌴'][Math.min(state.plant, 4)];
    $('#plantNote').textContent = `${state.plant} focus sessions grown · ${state.gardenHistory.filter(item => item.outcome === 'withered').length} withered`;
    if (!sessionWithered) $('#garden-status').textContent = prefs.witherOnLeave ? `A session is marked withered after ${prefs.witherAfterSeconds} seconds away.` : 'Withering is off. Sessions can grow even if you switch tabs.';
    const list = $('#garden-history');
    list.replaceChildren();
    const recent = state.gardenHistory.slice(0, 8);
    if (!recent.length) list.append(h('li', { class: 'empty' }, 'Complete a focus interval to begin your garden history.'));
    recent.forEach(item => list.append(h('li', {}, `${item.date} · ${item.outcome === 'withered' ? 'Withered' : 'Grown'}`)));
  }
  function renderStats() {
    const sessions = getState().focusSessions.filter(session => session.type === 'focus');
    const today = getDayKey();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const recent = sessions.filter(session => session.date >= getDayKey(weekStart) && session.date <= today);
    const todaySessions = sessions.filter(session => session.date === today);
    const todayMinutes = todaySessions.reduce((sum, session) => sum + session.focusMinutes, 0);
    const weekMinutes = recent.reduce((sum, session) => sum + session.focusMinutes, 0);
    $('#focus-stats').replaceChildren(h('div', { class: 'history-stat' }, h('strong', {}, String(todaySessions.length)), h('span', {}, 'focus sessions today')), h('div', { class: 'history-stat' }, h('strong', {}, `${todayMinutes} min`), h('span', {}, 'focused today')), h('div', { class: 'history-stat' }, h('div', {}, `${weekMinutes} min`), h('span', {}, 'focused this week')));
    const chart = $('#focus-chart');
    chart.replaceChildren();
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); const key = getDayKey(date); return { date, minutes: sessions.filter(session => session.date === key).reduce((sum, session) => sum + session.focusMinutes, 0) }; });
    const max = Math.max(1, ...days.map(day => day.minutes));
    days.forEach(day => chart.append(h('li', {}, h('span', {}, day.date.toLocaleDateString(undefined, { weekday: 'short' })), h('div', { class: 'meter', role: 'img', 'aria-label': `${day.minutes} focus minutes` }, h('div', { style: `width:${day.minutes / max * 100}%` })), h('span', {}, `${day.minutes}m`))));
  }
  function changeVolume() {
    const value = Number($('#ambient-volume').value);
    $('#ambient-volume-value').textContent = `${Math.round(value * 100)}%`;
    prefs = { ...prefs, ambientVolume: value };
    update(state => { state.focusPrefs.ambientVolume = value; });
    if (audioGain && audioContext) audioGain.gain.setTargetAtTime(value, audioContext.currentTime, 0.08);
  }
  async function startSound() {
    stopSound();
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is unavailable.');
      audioContext = new AudioContextClass();
      await audioContext.resume();
      const type = $('#ambient-type').value;
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
      $('#ambient-status').textContent = `${type[0].toUpperCase()}${type.slice(1)} ambience playing from generated audio.`;
    } catch {
      $('#ambient-status').textContent = 'Could not start generated audio in this browser.';
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
    birds.forEach(oscillator => { try { oscillator.stop(); } catch {} });
    birds.clear();
    try { audioSource?.stop(); } catch {}
    try { audioModulator?.stop(); } catch {}
    audioSource = null;
    audioModulator = null;
    audioGain = null;
    if (audioContext) audioContext.close();
    audioContext = null;
    $('#ambient-status').textContent = 'Ambient sound stopped.';
  }
}

function clamp(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

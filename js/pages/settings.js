import { THEMES, clearData, exportData, getState, restoreData, update } from '../store.js';
import { supabaseConfigured } from '../config.js';
import { chatMessageCount, chatTranscript, clearChatHistory } from '../nadir.js';
import { $, $$, applyTheme, confirmDialog, h, toast } from '../ui.js';

const THEME_LABELS = { midnight: 'Midnight gold', emerald: 'Emerald', royal: 'Royal blue', ocean: 'Ocean', sunset: 'Warm sunset', rose: 'Rose', violet: 'Midnight violet' };
const THEME_SWATCH = { midnight: '#d9b25c', emerald: '#58d6a0', royal: '#6f97ff', ocean: '#5cc8e8', sunset: '#ff9a5c', rose: '#f08aa8', violet: '#b48cff' };
const GOALS = [['faith', 'Faith'], ['fitness', 'Fitness'], ['focus', 'Focus'], ['habits', 'Habits']];
const PANELS = ['profile', 'appearance', 'notifications', 'training', 'chat', 'data', 'account', 'legal'];

// Small helper: every preference saves the moment it changes, with one short confirmation.
function save(mutator, message = 'Saved') {
  update(mutator);
  toast(message, { duration: 1800 });
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function radioGroup(container, name, options, current, onChange) {
  container.replaceChildren(...options.map(({ value, label, badge, swatch }) => {
    const input = h('input', { type: 'radio', name, value, id: `${name}-${value}` });
    input.checked = value === current;
    input.addEventListener('change', () => onChange(value));
    return h('label', { class: 'option', for: `${name}-${value}` }, input,
      swatch ? h('span', { class: 'swatch', style: `--swatch:${swatch}`, 'aria-hidden': 'true' }) : null,
      h('span', { class: 'option-label' }, label), badge ? h('span', { class: 'badge' }, badge) : null);
  }));
}

function bindSwitch(id, read, write, message) {
  const input = $(`#${id}`);
  input.checked = read();
  input.addEventListener('change', () => save(state => write(state, input.checked), message?.(input.checked)));
}

export function initSettings() {
  setupTabs();
  setupProfile();
  setupAppearance();
  setupNotifications();
  setupTraining();
  setupChat();
  setupData();
  void setupAccount();
}

function setupTabs() {
  const tabs = $$('[role="tab"][data-panel]');
  const show = (panel, focus = false) => {
    if (!PANELS.includes(panel)) panel = 'profile';
    tabs.forEach(tab => {
      const selected = tab.dataset.panel === panel;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
      if (selected) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    PANELS.forEach(id => { $(`#panel-${id}`).hidden = id !== panel; });
    if (location.hash !== `#${panel}`) history.replaceState(null, '', `#${panel}`);
  };
  tabs.forEach(tab => tab.addEventListener('click', () => show(tab.dataset.panel)));
  $('.settings-tabs').addEventListener('keydown', event => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(event.key in keys) && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + keys[event.key] + tabs.length) % tabs.length;
    show(tabs[next].dataset.panel, true);
  });
  show(location.hash.slice(1));
}

function setupProfile() {
  const name = $('#name');
  name.value = getState().name;
  name.addEventListener('change', () => save(state => { state.name = name.value.trim().slice(0, 40); }, 'Display name saved'));

  const goals = $('#goal-options');
  goals.replaceChildren(...GOALS.map(([value, label]) => {
    const input = h('input', { type: 'checkbox', value, id: `goal-${value}` });
    input.checked = getState().profileGoals.includes(value);
    input.addEventListener('change', () => save(state => {
      state.profileGoals = GOALS.map(([id]) => id).filter(id => id === value ? input.checked : state.profileGoals.includes(id));
    }, 'Focus areas saved'));
    return h('label', { class: 'chip-option', for: `goal-${value}` }, input, h('span', {}, label));
  }));

  const experience = $('#experience');
  experience.value = getState().workoutExperience;
  experience.addEventListener('change', () => save(state => { state.workoutExperience = experience.value; }, 'Fitness level saved'));
  const days = $('#workout-days');
  days.replaceChildren(...[1, 2, 3, 4, 5, 6, 7].map(count => h('option', { value: String(count) }, `${count} day${count === 1 ? '' : 's'}`)));
  days.value = String(getState().workoutDays);
  days.addEventListener('change', () => save(state => { state.workoutDays = Number(days.value); }, 'Weekly target saved'));
}

function setupAppearance() {
  const renderMode = () => radioGroup($('#mode-options'), 'mode', [
    { value: 'system', label: 'System', badge: 'Recommended' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }
  ], getState().appPrefs.mode, value => {
    save(state => { state.appPrefs.mode = value; state.light = value === 'light'; }, `${value === 'system' ? 'System' : value === 'dark' ? 'Dark' : 'Light'} mode on`);
    applyTheme();
  });
  renderMode();
  radioGroup($('#theme-options'), 'theme', THEMES.map(value => ({ value, label: THEME_LABELS[value], swatch: THEME_SWATCH[value], badge: value === 'midnight' ? 'Default' : '' })), getState().theme, value => {
    save(state => { state.theme = value; }, `${THEME_LABELS[value]} applied`);
    applyTheme();
  });
  radioGroup($('#text-options'), 'text-size', [{ value: 'default', label: 'Default' }, { value: 'large', label: 'Large' }], getState().appPrefs.textSize, value => {
    save(state => { state.appPrefs.textSize = value; }, 'Text size updated');
    applyTheme();
  });
  const motion = $('#reduce-motion');
  motion.checked = getState().appPrefs.reduceMotion === 'on';
  motion.addEventListener('change', () => {
    save(state => { state.appPrefs.reduceMotion = motion.checked ? 'on' : 'system'; }, motion.checked ? 'Animations off' : 'Following your device');
    applyTheme();
  });
}

function setupNotifications() {
  const enabledInput = $('#reminder-enabled');
  const timeInput = $('#reminder-time');
  enabledInput.checked = getState().reminders.enabled;
  timeInput.value = getState().reminders.time || '18:00';
  $('#reminderForm').addEventListener('submit', async event => {
    event.preventDefault();
    const requested = enabledInput.checked;
    let enabled = requested;
    if (enabled) {
      if (!('Notification' in window)) enabled = false;
      else {
        let permission = Notification.permission;
        if (permission === 'default') {
          try { permission = await Notification.requestPermission(); } catch { permission = 'denied'; }
        }
        enabled = permission === 'granted';
      }
    }
    update(state => { state.reminders = { ...state.reminders, enabled, time: timeInput.value || '18:00' }; });
    enabledInput.checked = enabled;
    const message = enabled ? `Reminder set for ${timeInput.value}.` : requested ? 'Notifications are blocked or unavailable in this browser. Allow them in your browser’s site settings, then try again.' : 'Reminder turned off.';
    $('#reminder-status').textContent = message;
    toast(message);
  });
}

function setupTraining() {
  bindSwitch('workout-sound', () => getState().workoutPrefs.sound, (state, on) => { state.workoutPrefs.sound = on; }, on => on ? 'Sound cues on' : 'Sound cues off');
  bindSwitch('workout-vibration', () => getState().workoutPrefs.vibration, (state, on) => { state.workoutPrefs.vibration = on; }, on => on ? 'Vibration on' : 'Vibration off');
  const focusMinutes = $('#focus-minutes');
  const focusOptions = [...new Set([15, 20, 25, 30, 45, 50, 60, getState().focusPrefs.focusMinutes])].sort((a, b) => a - b);
  focusMinutes.replaceChildren(...focusOptions.map(minutes => h('option', { value: String(minutes) }, `${minutes} minutes${minutes === 25 ? ' (recommended)' : ''}`)));
  focusMinutes.value = String(getState().focusPrefs.focusMinutes);
  focusMinutes.addEventListener('change', () => save(state => { state.focusPrefs.focusMinutes = Number(focusMinutes.value); }, 'Focus length saved'));
  const breakMinutes = $('#break-minutes');
  const breakOptions = [...new Set([3, 5, 10, 15, getState().focusPrefs.shortBreakMinutes])].sort((a, b) => a - b);
  breakMinutes.replaceChildren(...breakOptions.map(minutes => h('option', { value: String(minutes) }, `${minutes} minutes`)));
  breakMinutes.value = String(getState().focusPrefs.shortBreakMinutes);
  breakMinutes.addEventListener('change', () => save(state => { state.focusPrefs.shortBreakMinutes = Number(breakMinutes.value); }, 'Break length saved'));
  bindSwitch('wither-enabled', () => getState().focusPrefs.witherOnLeave, (state, on) => { state.focusPrefs.witherOnLeave = on; }, on => on ? 'Withering on' : 'Withering off');
  const seconds = $('#wither-seconds');
  seconds.value = String(getState().focusPrefs.witherAfterSeconds);
  seconds.addEventListener('change', () => {
    const value = Math.max(10, Math.min(3600, Number.parseInt(seconds.value, 10) || 60));
    seconds.value = String(value);
    save(state => { state.focusPrefs.witherAfterSeconds = value; }, 'Saved');
  });
}

function setupChat() {
  bindSwitch('chat-sound', () => getState().appPrefs.chatSound, (state, on) => { state.appPrefs.chatSound = on; }, on => on ? 'Message sounds on' : 'Message sounds off');
  bindSwitch('chat-scroll', () => getState().appPrefs.chatAutoScroll, (state, on) => { state.appPrefs.chatAutoScroll = on; });
  bindSwitch('chat-time', () => getState().appPrefs.chatTimestamps, (state, on) => { state.appPrefs.chatTimestamps = on; });
  const renderCount = () => {
    const count = chatMessageCount();
    $('#chat-count').textContent = count ? `${count} message${count === 1 ? '' : 's'} saved in this browser.` : 'No saved messages.';
    $('#chat-export').disabled = !count;
    $('#chat-clear').disabled = !count;
  };
  renderCount();
  $('#chat-export').addEventListener('click', () => {
    download(`nadir-chat-${new Date().toISOString().slice(0, 10)}.txt`, chatTranscript(), 'text/plain');
    toast('Transcript downloaded');
  });
  $('#chat-clear').addEventListener('click', async () => {
    if (!await confirmDialog({ title: 'Clear chat history?', message: 'This deletes your saved conversation with NADIR from this browser.', confirmLabel: 'Clear history', danger: true })) return;
    clearChatHistory();
    renderCount();
    toast('Chat history cleared');
  });
  $('#ai-status').textContent = supabaseConfigured
    ? 'When you are signed in and AI replies are enabled on the server, NADIR answers with Claude using your recent messages and a short summary of today’s progress. Guests use the built-in offline coach.'
    : 'NADIR is using its built-in offline coach. Nothing you type leaves this browser.';
}

function setupData() {
  const synced = getState().accountSync.lastSyncedAt;
  $('#storage-status').textContent = synced ? `Saved in this browser and synced to your account. Last synced ${new Date(synced).toLocaleString()}.` : 'Saved only in this browser. Sign in to back it up and use it on other devices.';
  $('#export').addEventListener('click', () => {
    download(`lassitude-backup-${new Date().toISOString().slice(0, 10)}.json`, exportData(), 'application/json');
    toast('Backup downloaded');
  });
  const file = $('#import-file');
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    file.value = '';
    if (!chosen) return;
    if (chosen.size > 20 * 1024 * 1024) { toast('That file is too large to be a Lassitude backup.'); return; }
    let data;
    try { data = JSON.parse(await chosen.text()); } catch { toast('That file isn’t a Lassitude backup.'); return; }
    if (!data || typeof data !== 'object' || !('habits' in data || 'habitLogs' in data || 'schemaVersion' in data)) { toast('That file isn’t a Lassitude backup.'); return; }
    if (!await confirmDialog({ title: 'Restore this backup?', message: `This replaces the data in this browser with “${chosen.name}”.`, confirmLabel: 'Restore backup' })) return;
    const previous = JSON.parse(exportData());
    restoreData(data);
    applyTheme();
    toast('Backup restored', { actionLabel: 'Undo', duration: 6000, onAction: () => { restoreData(previous); applyTheme(); toast('Restore undone'); } });
  });
  $('#clear').addEventListener('click', async () => {
    const first = await confirmDialog({ title: 'Delete all data on this device?', message: 'Habits, logs, journal entries, workouts and settings will be removed from this browser.', confirmLabel: 'Continue', danger: true });
    if (!first) return;
    const second = await confirmDialog({ title: 'Are you sure?', message: 'Export a backup first if you might want this later. You’ll have 5 seconds to undo.', confirmLabel: 'Delete everything', danger: true });
    if (!second) return;
    const previous = clearData();
    clearChatHistory();
    applyTheme();
    toast('Your data was deleted.', { actionLabel: 'Undo', duration: 5000, onAction: () => { restoreData(previous); applyTheme(); toast('Your data was restored.'); } });
  });
}

async function setupAccount() {
  const summary = $('#account-summary');
  const guest = message => summary.replaceChildren(
    h('div', { class: 'account-row' }, h('span', { class: 'avatar-initial', 'aria-hidden': 'true' }, 'G'), h('div', {}, h('strong', {}, 'Guest mode'), h('p', {}, message))),
    supabaseConfigured ? h('div', { class: 'setting-buttons' }, h('a', { class: 'btn', href: 'login.html' }, 'Sign in'), h('a', { class: 'btn ghost-btn', href: 'login.html?mode=signup' }, 'Create account')) : null);
  if (!supabaseConfigured) { guest('Accounts are not available yet. Your data is saved in this browser.'); return; }
  try {
    const { supabase } = await import('../auth.js');
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { guest('Sign in to back up your data and use Lassitude on all your devices.'); return; }
    const name = user.user_metadata?.display_name || getState().name || user.email;
    const signOut = h('button', { type: 'button', class: 'ghost' }, 'Sign out');
    signOut.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();
      if (error) { toast(error.message); return; }
      toast('Signed out');
      void setupAccount();
    });
    summary.replaceChildren(
      h('div', { class: 'account-row' }, h('span', { class: 'avatar-initial', 'aria-hidden': 'true' }, name.trim().charAt(0).toUpperCase()), h('div', {}, h('strong', {}, name), h('p', {}, user.email || ''))),
      h('nav', { class: 'setting-nav', 'aria-label': 'Account options' },
        h('a', { href: 'account.html' }, h('span', {}, 'Profile and sync'), h('small', {}, 'Display name, sync now')),
        h('a', { href: 'account.html#email-form' }, h('span', {}, 'Change email'), h('small', {}, 'We’ll send a confirmation link')),
        h('a', { href: 'account.html#password-form' }, h('span', {}, 'Change password'), h('small', {}, 'At least 10 characters'))),
      h('div', { class: 'setting-buttons' }, signOut));
    $('#account-danger').hidden = false;
  } catch {
    guest('Account details could not be loaded. Your local data is safe.');
  }
}

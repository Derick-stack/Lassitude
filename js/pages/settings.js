import { clearData, exportData, getState, restoreData, update } from '../store.js';
import { $, $$, applyTheme, confirmDialog, toast } from '../ui.js';

export function initSettings() {
  const nameInput = $('#name');
  nameInput.value = getState().name;
  $('#nameForm').addEventListener('submit', event => {
    event.preventDefault();
    update(state => { state.name = nameInput.value.trim().slice(0, 40); });
    $('#saved').textContent = 'Saved on this device.';
    toast('Display name saved.');
  });

  const renderTheme = () => $$('[data-t]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.t === getState().theme)));
  $$('[data-t]').forEach(button => button.addEventListener('click', () => {
    update(state => { state.theme = button.dataset.t; });
    applyTheme();
    renderTheme();
    toast('Theme updated.');
  }));
  renderTheme();
  const light = $('#light');
  light.checked = getState().light;
  light.addEventListener('change', () => {
    update(state => { state.light = light.checked; });
    applyTheme();
    toast(light.checked ? 'Light mode enabled.' : 'Dark mode enabled.');
  });

  const reminderEnabled = $('#reminder-enabled');
  const reminderTime = $('#reminder-time');
  reminderEnabled.checked = getState().reminders.enabled;
  reminderTime.value = getState().reminders.time || '18:00';
  $('#reminderForm').addEventListener('submit', async event => {
    event.preventDefault();
    const requested = reminderEnabled.checked;
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
    update(state => { state.reminders = { ...state.reminders, enabled, time: reminderTime.value || '18:00' }; });
    reminderEnabled.checked = enabled;
    const message = enabled ? 'Reminder saved.' : requested ? 'Browser notifications are unavailable or were not allowed.' : 'Reminder preference saved.';
    $('#reminder-status').textContent = message;
    toast(message);
  });

  const focusPrefs = getState().focusPrefs;
  $('#wither-enabled').checked = focusPrefs.witherOnLeave;
  $('#wither-seconds').value = String(focusPrefs.witherAfterSeconds);
  $('#focus-preferences-form').addEventListener('submit', event => {
    event.preventDefault();
    const witherAfterSeconds = Math.max(10, Math.min(3600, Number.parseInt($('#wither-seconds').value, 10) || 60));
    update(state => { state.focusPrefs.witherOnLeave = $('#wither-enabled').checked; state.focusPrefs.witherAfterSeconds = witherAfterSeconds; });
    $('#wither-seconds').value = String(witherAfterSeconds);
    $('#focus-preferences-status').textContent = 'Focus garden preference saved.';
    toast('Focus garden preference saved.');
  });

  $('#export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lassitude-data.json';
    link.click();
    URL.revokeObjectURL(url);
    toast('Data export downloaded.');
  });
  $('#clear').addEventListener('click', async () => {
    const confirmed = await confirmDialog({ title: 'Delete your data?', message: 'This removes Lassitude data from this browser. You can undo for 5 seconds.', confirmLabel: 'Delete data', danger: true });
    if (!confirmed) return;
    const previous = clearData();
    applyTheme();
    toast('Your data was deleted.', { actionLabel: 'Undo', duration: 5000, onAction: () => { restoreData(previous); applyTheme(); toast('Your data was restored.'); } });
  });
}

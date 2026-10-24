import { finishOnboarding, getState, getDayKey, update } from '../store.js';
import { $, $$, applyTheme, h, toast } from '../ui.js';

const starterOptions = [
  ['scripture', 'Read scripture'], ['workout', 'Workout'], ['water', 'Drink 8 glasses of water'],
  ['focus', 'Focus session'], ['walk', 'Take a walk'], ['stretch', 'Stretch'],
  ['journal', 'Write a reflection'], ['prayer', 'Prayer or quiet time']
];
const goalOptions = ['Faith', 'Fitness', 'Focus', 'Habits'];

export function showOnboardingIfNeeded() {
  if (getState().onboarding.completed) return;
  const values = {
    name: getState().name,
    goals: [...getState().profileGoals],
    starterHabits: [...getState().starterHabits],
    workoutExperience: getState().workoutExperience,
    workoutDays: getState().workoutDays,
    reminders: { ...getState().reminders }
  };
  let step = 0;
  let dialog;

  const close = (skipped = false) => {
    if (!getState().onboarding.completed) finishOnboarding({}, true);
    if (dialog.open) dialog.close();
    if (skipped) toast('Setup skipped. You can begin with the default routine.');
  };

  const capture = () => {
    if (step === 0) {
      values.name = $('#wizard-name', dialog).value.trim();
      values.goals = $$('input[name="wizard-goal"]:checked', dialog).map(input => input.value);
    } else if (step === 1) {
      values.starterHabits = $$('input[name="wizard-habit"]:checked', dialog).map(input => ({
        id: input.value,
        title: starterOptions.find(([id]) => id === input.value)?.[1] || input.value,
        custom: false
      }));
    } else if (step === 2) {
      values.workoutExperience = $('#wizard-experience', dialog).value;
      values.workoutDays = Number($('#wizard-days', dialog).value);
    } else {
      values.reminders.enabled = $('#wizard-reminders', dialog).checked;
      values.reminders.time = $('#wizard-time', dialog).value || '18:00';
    }
  };

  const finish = async () => {
    let reminderEnabled = false;
    let permissionDenied = false;
    if (values.reminders.enabled) {
      if (!('Notification' in window)) {
        permissionDenied = true;
      } else {
        let permission = Notification.permission;
        if (permission === 'default') {
          try { permission = await Notification.requestPermission(); } catch { permission = 'denied'; }
        }
        reminderEnabled = permission === 'granted';
        permissionDenied = !reminderEnabled;
      }
    }
    values.reminders.enabled = reminderEnabled;
    finishOnboarding(values);
    applyTheme();
    dialog.close();
    toast(permissionDenied ? 'Setup saved. Browser notifications are unavailable or were not allowed.' : 'Your routine is ready.');
    if (reminderEnabled) toast('Reminder set for when Lassitude is open.');
  };

  const render = () => {
    const title = ['Your priorities', 'Choose starter habits', 'Set your training rhythm', 'Optional reminder'][step];
    const description = [
      'A few details help tailor your home screen.',
      'Choose two or three habits to start with.',
      'Choose a level and the number of training days you prefer.',
      'Browser reminders work only while Lassitude is open.'
    ][step];
    const content = [];
    if (step === 0) {
      content.push(h('label', { for: 'wizard-name' }, 'Display name'), h('input', { id: 'wizard-name', type: 'text', maxlength: '40', autocomplete: 'nickname', value: values.name }));
      content.push(h('fieldset', { class: 'wizard-options' }, h('legend', {}, 'What matters to you?'), goalOptions.map(goal => {
        const input = h('input', { type: 'checkbox', name: 'wizard-goal', value: goal.toLowerCase(), checked: values.goals.includes(goal.toLowerCase()) });
        return h('label', { class: 'choice' }, input, h('span', {}, goal));
      })));
    } else if (step === 1) {
      const fieldset = h('fieldset', { class: 'wizard-options', id: 'wizard-habits' }, h('legend', {}, 'Select 2 or 3 habits'));
      starterOptions.forEach(([id, label]) => {
        const input = h('input', { type: 'checkbox', name: 'wizard-habit', value: id, checked: values.starterHabits.some(item => item.id === id) });
        input.addEventListener('change', () => {
          const selected = $$('input[name="wizard-habit"]:checked', fieldset);
          if (selected.length > 3) input.checked = false;
          $('#wizard-habit-count', dialog).textContent = `${$$('input[name="wizard-habit"]:checked', fieldset).length} selected`;
        });
        fieldset.append(h('label', { class: 'choice' }, input, h('span', {}, label)));
      });
      content.push(fieldset, h('p', { id: 'wizard-habit-count', class: 'field-note', 'aria-live': 'polite' }, `${values.starterHabits.length} selected`));
    } else if (step === 2) {
      content.push(h('label', { for: 'wizard-experience' }, 'Experience level'), h('select', { id: 'wizard-experience' },
        [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']].map(([value, label]) => h('option', { value, selected: values.workoutExperience === value }, label))));
      content.push(h('label', { for: 'wizard-days' }, 'Training days per week'), h('select', { id: 'wizard-days' },
        Array.from({ length: 7 }, (_, index) => index + 1).map(days => h('option', { value: days, selected: values.workoutDays === days }, `${days} ${days === 1 ? 'day' : 'days'}`))));
    } else {
      const enabled = h('input', { id: 'wizard-reminders', type: 'checkbox', checked: values.reminders.enabled });
      content.push(h('label', { class: 'choice', for: 'wizard-reminders' }, enabled, h('span', {}, 'Send me a daily browser reminder')));
      content.push(h('label', { for: 'wizard-time' }, 'Reminder time'), h('input', { id: 'wizard-time', type: 'time', value: values.reminders.time || '18:00' }));
      content.push(h('p', { class: 'field-note' }, 'Notifications require browser permission and this site to remain open. You can change this later in Settings.'));
    }

    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const back = step > 0 ? h('button', { type: 'button', class: 'ghost' }, 'Back') : h('span');
    if (step > 0) back.addEventListener('click', () => { capture(); step -= 1; render(); });
    const form = h('form', { class: 'wizard-form' }, ...content, error,
      h('div', { class: 'wizard-actions' },
        back,
        h('button', { type: 'button', class: 'ghost wizard-skip' }, 'Skip for now'),
        h('button', { type: 'submit' }, step === 3 ? 'Finish setup' : 'Continue')));
    form.querySelector('.wizard-skip').addEventListener('click', () => close(true));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      capture();
      if (step === 1 && (values.starterHabits.length < 2 || values.starterHabits.length > 3)) {
        error.hidden = false;
        error.textContent = 'Choose two or three starter habits to continue.';
        return;
      }
      if (step < 3) { step += 1; render(); return; }
      await finish();
    });
    dialog.replaceChildren(h('div', { class: 'wizard-heading', 'aria-live': 'polite' }, h('p', { class: 'eyebrow' }, `Step ${step + 1} of 4`), h('h2', { id: 'wizard-title' }, title), h('p', {}, description)), form);
    const firstControl = $('input, select', form);
    firstControl?.focus();
  };

  dialog = h('dialog', { id: 'onboarding-dialog', class: 'dialog wizard-dialog', 'aria-labelledby': 'wizard-title' });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(true); });
  document.body.append(dialog);
  render();
  dialog.showModal();
}

export function startReminderScheduler() {
  const check = () => {
    const state = getState();
    if (!state.reminders.enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = getDayKey(now);
    if (time < state.reminders.time || state.reminders.lastSent === today) return;
    new Notification('Lassitude reminder', { body: 'Take a moment for your routine today.' });
    update(draft => { draft.reminders.lastSent = today; });
  };
  window.setInterval(check, 30000);
}

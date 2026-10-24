import { clearData, exportData, getState, update } from '../store.js';
import { supabaseConfigured } from '../config.js';
import { $, confirmDialog, h, toast } from '../ui.js';

export async function initAccount() {
  if (!supabaseConfigured) {
    $('#account-status').textContent = 'Account sync is not configured. Guest mode continues to store data in this browser.';
    $('#account-email').textContent = 'No Supabase project configured.';
    bindExport();
    return;
  }
  try {
    const { supabase } = await import('../auth.js');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { $('#account-status').textContent = 'Sign in to manage account settings. Guest mode is available without an account.'; bindExport(); return; }
    $('#account-email').textContent = user.email || 'Signed in';
    $('#account-name').value = user.user_metadata?.display_name || getState().name;
    $('#account-profile-form').addEventListener('submit', async event => {
      event.preventDefault();
      const displayName = $('#account-name').value.trim().slice(0, 40);
      update(state => { state.name = displayName; });
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
      $('#account-status').textContent = error ? `Saved locally; cloud profile update failed: ${error.message}` : 'Profile updated.';
      toast(error ? 'Profile updated locally; cloud update failed.' : 'Profile updated.');
    });
    $('#email-form').addEventListener('submit', async event => {
      event.preventDefault();
      const email = $('#new-email').value.trim();
      if (!email) return;
      const { error } = await supabase.auth.updateUser({ email });
      $('#account-status').textContent = error ? error.message : 'Check your inbox to confirm the email change.';
      if (!error) toast('Confirmation email sent.');
    });
    $('#password-form').addEventListener('submit', async event => {
      event.preventDefault();
      const password = $('#new-password').value;
      if (password.length < 10) { $('#account-status').textContent = 'Password must be at least 10 characters.'; return; }
      const { error } = await supabase.auth.updateUser({ password });
      $('#new-password').value = '';
      $('#account-status').textContent = error ? error.message : 'Password updated.';
      if (!error) toast('Password updated.');
    });
    $('#sync-now').addEventListener('click', syncNow);
    $('#delete-account').addEventListener('click', deleteAccount);
    bindExport();
    if (new URLSearchParams(location.search).get('delete') === '1') {
      history.replaceState(null, '', 'account.html');
      void deleteAccount();
    }

    async function syncNow() {
      try {
        const { syncNow: sync } = await import('../sync.js');
        const result = await sync(toast, confirmDialog);
        $('#account-status').textContent = result.ok ? `Last synced ${new Date(getState().accountSync.lastSyncedAt).toLocaleString()}.` : result.message;
      } catch { $('#account-status').textContent = 'Sync module unavailable. Your local data remains unchanged.'; }
    }

    async function deleteAccount() {
      // Two separate confirmations: an "are you sure" step, then typing DELETE.
      const proceed = await confirmDialog({ title: 'Delete your account?', message: 'Your account, synced habits, workouts, journal and prayer entries will be permanently deleted. This cannot be undone. Consider exporting your data first.', confirmLabel: 'Continue', danger: true });
      if (!proceed) return;
      const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'delete-account-title' });
      const form = h('form', { method: 'dialog' });
      const typed = h('input', { type: 'text', autocomplete: 'off', required: true, 'aria-label': 'Type DELETE to confirm' });
      const message = h('p', { role: 'alert', class: 'form-error', hidden: true });
      const cancel = h('button', { value: 'cancel', class: 'ghost', formnovalidate: true }, 'Cancel');
      const confirm = h('button', { value: 'confirm', class: 'danger' }, 'Delete account');
      form.append(h('h2', { id: 'delete-account-title' }, 'Delete account and cloud data'), h('p', {}, 'This permanently deletes your Supabase account and its rows. Type DELETE to confirm. Your local guest data will be cleared only after the server confirms deletion.'), h('label', {}, 'Type DELETE', typed), message, h('div', { class: 'dialog-actions' }, cancel, confirm));
      dialog.append(form);
      document.body.append(dialog);
      const confirmed = await new Promise(resolve => {
        form.addEventListener('submit', event => {
          if (event.submitter?.value !== 'confirm') return;
          if (typed.value !== 'DELETE') { event.preventDefault(); message.hidden = false; message.textContent = 'Type DELETE exactly to continue.'; typed.focus(); return; }
        });
        dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
        dialog.showModal();
        typed.focus();
      });
      dialog.remove();
      if (!confirmed) return;
      const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirmation: 'DELETE' } });
      if (error || !data?.deleted) { $('#account-status').textContent = error?.message || 'Account deletion was not confirmed by the server. Deploy the delete-account function first.'; return; }
      await supabase.auth.signOut();
      clearData();
      location.href = 'index.html';
    }
  } catch (error) {
    $('#account-status').textContent = error instanceof Error ? error.message : 'Could not load account information.';
    bindExport();
  }
}

function bindExport() {
  const button = $('#account-export');
  if (!button) return;
  button.addEventListener('click', () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: 'lassitude-account-data.json' });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Data export downloaded.');
  });
}

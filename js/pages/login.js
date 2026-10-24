import { supabaseConfigured } from '../config.js';
import { $, $$, h, toast } from '../ui.js';

export function initLogin() {
  const status = $('#auth-status');
  const error = $('#auth-error');
  let auth = null;
  let authPromise = null;
  let activeTab = 'signin';
  const forms = { signin: $('#signin-form'), signup: $('#signup-form'), reset: $('#reset-form'), recovery: $('#recovery-form') };
  const tabs = $$('[data-auth-tab]');
  tabs.forEach(button => button.addEventListener('click', () => showTab(button.dataset.authTab)));
  bindPasswordToggle('#signin-password', '#signin-toggle');
  bindPasswordToggle('#signup-password', '#signup-toggle');
  bindPasswordToggle('#recovery-password', '#recovery-toggle');
  $('#signup-password').addEventListener('input', updateStrength);
  forms.signin.addEventListener('submit', submitSignIn);
  forms.signup.addEventListener('submit', submitSignUp);
  forms.reset.addEventListener('submit', submitReset);
  forms.recovery.addEventListener('submit', submitRecovery);
  $('#magic-link').addEventListener('click', sendMagic);
  $('#google-signin').addEventListener('click', googleSignIn);
  if (new URLSearchParams(location.search).get('flow') === 'recovery') showTab('recovery');
  else showTab('signin');
  if (!supabaseConfigured) {
    status.textContent = 'Guest mode is ready. To enable accounts and sync, add your Supabase project URL and public anon key to js/config.js after creating the Supabase project and applying supabase/schema.sql.';
    $$('button[type="submit"], #magic-link, #google-signin').forEach(button => { button.disabled = true; });
    return;
  }
  authPromise = import('../auth.js').then(module => { auth = module; return module; }).catch(() => { status.textContent = 'Could not load the authentication client. Guest mode is still available.'; return null; });

  function showTab(tab) {
    activeTab = tab;
    tabs.forEach(button => {
      const selected = button.dataset.authTab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    Object.entries(forms).forEach(([name, form]) => { form.hidden = name !== tab; });
    error.textContent = '';
  }

  function bindPasswordToggle(inputSelector, buttonSelector) {
    const input = $(inputSelector);
    const button = $(buttonSelector);
    button.addEventListener('click', () => {
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.textContent = visible ? 'Show' : 'Hide';
      button.setAttribute('aria-pressed', String(!visible));
    });
  }

  function updateStrength() {
    const password = $('#signup-password').value;
    const score = [password.length >= 10, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
    $('#password-strength').textContent = password ? `Password strength: ${['too short', 'weak', 'fair', 'good', 'strong'][score]}` : 'Use at least 10 characters. A mix of letter cases, numbers, and symbols is stronger.';
  }

  function emailFrom(form) { return $('input[type="email"]', form).value.trim(); }
  function showError(message) { error.textContent = message; }
  function showStatus(message) { status.textContent = message; toast(message); }
  async function getAuth() { return auth || await authPromise; }

  async function submitSignIn(event) {
    event.preventDefault();
    const api = await getAuth();
    if (!api) return showError('Authentication is not configured yet. Guest mode remains available.');
    const { error: signInError } = await api.signIn(emailFrom(forms.signin), $('#signin-password').value);
    if (signInError) showError(signInError.message); else location.href = 'index.html';
  }
  async function submitSignUp(event) {
    event.preventDefault();
    const password = $('#signup-password').value;
    if (password.length < 10) return showError('Password must be at least 10 characters.');
    const api = await getAuth();
    if (!api) return showError('Authentication is not configured yet. Guest mode remains available.');
    const { data, error: signUpError } = await api.createAccount(emailFrom(forms.signup), password, $('#signup-name').value);
    if (signUpError) showError(signUpError.message);
    else showStatus(data.session ? 'Account created. Signing you in…' : 'Account created. Check your email to confirm the address, then sign in.');
  }
  async function submitReset(event) {
    event.preventDefault();
    const api = await getAuth();
    if (!api) return showError('Authentication is not configured yet.');
    const { error: resetError } = await api.sendPasswordReset(emailFrom(forms.reset));
    if (resetError) showError(resetError.message); else showStatus('If an account exists for that address, a reset link has been sent.');
  }
  async function submitRecovery(event) {
    event.preventDefault();
    const password = $('#recovery-password').value;
    if (password.length < 10) return showError('Password must be at least 10 characters.');
    const api = await getAuth();
    if (!api) return showError('Authentication is not configured yet.');
    const { error: updateError } = await api.supabase.auth.updateUser({ password });
    if (updateError) showError(updateError.message); else { showStatus('Password updated.'); window.setTimeout(() => { location.href = 'account.html'; }, 800); }
  }
  async function sendMagic() {
    const api = await getAuth();
    if (!api) return showError('Authentication is not configured yet.');
    const { error: linkError } = await api.sendMagicLink(emailFrom(forms.signin));
    if (linkError) showError(linkError.message); else showStatus('If the address is registered, a sign-in link has been sent.');
  }
  async function googleSignIn() {
    const api = await getAuth();
    if (!api) return showError('Authentication is not configured yet.');
    const { error: oauthError } = await api.signInWithGoogle();
    if (oauthError) showError(oauthError.message);
  }
}

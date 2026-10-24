import { supabaseConfigured } from '../config.js';
import { $, $$, toast } from '../ui.js';

const COPY = {
  signin: { title: 'Welcome back', subtitle: 'Sign in to pick up where you left off.' },
  signup: { title: 'Create your account', subtitle: 'Free, private, and synced across your devices.' },
  reset: { title: 'Reset your password', subtitle: 'Enter your email and we will send you a secure reset link.' },
  recovery: { title: 'Choose a new password', subtitle: 'Pick something you have not used here before.' }
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Supabase error messages are written for developers; map the common ones to plain language.
function friendlyError(error) {
  const message = (error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'That email and password do not match. Check for typos, or reset your password.';
  if (message.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox (and spam folder) for the link.';
  if (message.includes('already registered') || message.includes('already been registered')) return 'An account with this email already exists. Try signing in instead.';
  if (message.includes('rate limit') || message.includes('too many') || error?.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'Could not reach the server. Check your connection and try again.';
  if (message.includes('should be different')) return 'Your new password must be different from your old one.';
  return error?.message || 'Something went wrong. Please try again.';
}

export function initLogin() {
  const status = $('#auth-status');
  const error = $('#auth-error');
  let auth = null;
  let authPromise = null;
  const forms = { signin: $('#signin-form'), signup: $('#signup-form'), reset: $('#reset-form'), recovery: $('#recovery-form') };
  const tabs = $$('[data-auth-tab]');
  tabs.forEach(button => button.addEventListener('click', () => showTab(button.dataset.authTab, true)));
  $('.auth-tabs').addEventListener('keydown', moveTabFocus);
  $$('[data-goto]').forEach(button => button.addEventListener('click', () => showTab(button.dataset.goto, true)));
  bindPasswordToggle('#signin-password', '#signin-toggle');
  bindPasswordToggle('#signup-password', '#signup-toggle');
  bindPasswordToggle('#recovery-password', '#recovery-toggle');
  $('#signup-password').addEventListener('input', updateStrength);
  $$('.auth-form input').forEach(input => input.addEventListener('input', () => clearFieldError(input)));
  $$('.auth-form input[type="email"]').forEach(input => input.addEventListener('blur', () => {
    if (input.value.trim() && !EMAIL_PATTERN.test(input.value.trim())) setFieldError(input, 'That email does not look quite right.');
  }));
  forms.signin.addEventListener('submit', submitSignIn);
  forms.signup.addEventListener('submit', submitSignUp);
  forms.reset.addEventListener('submit', submitReset);
  forms.recovery.addEventListener('submit', submitRecovery);
  $('#magic-link').addEventListener('click', sendMagic);
  $('#google-signin').addEventListener('click', googleSignIn);
  updateStrength();

  const params = new URLSearchParams(location.search);
  if (params.get('flow') === 'recovery') showTab('recovery');
  else showTab(['signup', 'reset'].includes(params.get('mode')) ? params.get('mode') : 'signin');

  if (!supabaseConfigured) {
    console.info('Lassitude accounts are off: add your Supabase project URL and anon key to js/config.js and apply supabase/schema.sql.');
    $('#auth-unavailable').hidden = false;
    $('.auth-guest').classList.add('auth-guest-primary');
    $$('.auth-form button[type="submit"], #magic-link, #google-signin').forEach(button => { button.disabled = true; });
    return;
  }
  authPromise = import('../auth.js').then(module => { auth = module; return module; }).catch(() => {
    showError('Sign-in is temporarily unavailable. You can keep going in guest mode.');
    return null;
  });
  void showSignedInState();

  function showTab(tab, focusField = false) {
    // Keep whatever email the visitor already typed when they switch forms.
    const typedEmail = Object.values(forms).map(form => $('input[type="email"]', form)?.value.trim()).find(Boolean) || '';
    tabs.forEach(button => {
      const selected = button.dataset.authTab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    $('.auth-tabs').hidden = tab === 'recovery';
    $('#social-block').hidden = tab === 'reset' || tab === 'recovery';
    Object.entries(forms).forEach(([name, form]) => { form.hidden = name !== tab; });
    $('#auth-title').textContent = COPY[tab].title;
    $('#auth-subtitle').textContent = COPY[tab].subtitle;
    const emailInput = $('input[type="email"]', forms[tab]);
    if (emailInput && !emailInput.value) emailInput.value = typedEmail;
    hideMessages();
    if (focusField) $('input', forms[tab])?.focus();
  }

  function moveTabFocus(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    showTab(tabs[next].dataset.authTab);
  }

  function bindPasswordToggle(inputSelector, buttonSelector) {
    const input = $(inputSelector);
    const button = $(buttonSelector);
    button.addEventListener('click', () => {
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.textContent = visible ? 'Show' : 'Hide';
      button.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
      button.setAttribute('aria-pressed', String(!visible));
    });
  }

  function passwordRules(password) {
    return {
      length: password.length >= 10,
      case: /[a-z]/.test(password) && /[A-Z]/.test(password),
      number: /[\d\W_]/.test(password)
    };
  }

  function updateStrength() {
    const password = $('#signup-password').value;
    const rules = passwordRules(password);
    $$('#password-rules [data-rule]').forEach(item => item.classList.toggle('met', rules[item.dataset.rule]));
    const score = !password ? 0 : !rules.length ? 1 : 1 + Object.values(rules).filter(Boolean).length;
    const labels = ['', 'Too short', 'Okay', 'Good', 'Strong'];
    const meter = $('#password-meter');
    meter.style.width = `${score * 25}%`;
    meter.dataset.score = String(score);
    $('#password-strength').textContent = password ? `Strength: ${labels[score]}` : '';
  }

  function setFieldError(input, message) {
    input.setAttribute('aria-invalid', 'true');
    const slot = $(`[data-error-for="${input.id}"]`);
    if (slot) { slot.textContent = message; slot.id ||= `${input.id}-error`; input.setAttribute('aria-errormessage', slot.id); }
  }
  function clearFieldError(input) {
    input.removeAttribute('aria-invalid');
    const slot = $(`[data-error-for="${input.id}"]`);
    if (slot) slot.textContent = '';
  }
  function validateEmail(input) {
    const value = input.value.trim();
    if (!value) { setFieldError(input, 'Enter your email address.'); return false; }
    if (!EMAIL_PATTERN.test(value)) { setFieldError(input, 'That email does not look quite right.'); return false; }
    return true;
  }
  function validatePassword(input, minimum = 1) {
    if (!input.value) { setFieldError(input, 'Enter a password.'); return false; }
    if (input.value.length < minimum) { setFieldError(input, `Use at least ${minimum} characters.`); return false; }
    return true;
  }
  function focusFirstInvalid(form) { $('[aria-invalid="true"]', form)?.focus(); }

  function hideMessages() { error.hidden = true; status.hidden = true; }
  function showError(message) { status.hidden = true; error.textContent = message; error.hidden = false; }
  function showStatus(message) { error.hidden = true; status.textContent = message; status.hidden = false; toast(message); }

  // Disables the button and swaps its label while a request is in flight, so nothing is sent twice.
  async function withBusy(button, busyLabel, task) {
    const content = [...button.childNodes];
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = busyLabel;
    try { return await task(); }
    finally { button.disabled = false; button.removeAttribute('aria-busy'); button.replaceChildren(...content); }
  }
  async function getAuth() {
    const api = auth || await authPromise;
    if (!api) showError('Sign-in is temporarily unavailable. You can keep going in guest mode.');
    return api;
  }
  function emailFrom(form) { return $('input[type="email"]', form).value.trim(); }
  function submitButton(form) { return $('button[type="submit"]', form); }

  async function showSignedInState() {
    const api = await authPromise;
    const { data } = await api?.supabase.auth.getSession() ?? { data: {} };
    const user = data?.session?.user;
    if (!user || params.get('flow') === 'recovery') return;
    const banner = $('#auth-signed-in');
    banner.replaceChildren();
    const name = user.user_metadata?.display_name || user.email;
    banner.append(`You are signed in as ${name}. `, Object.assign(document.createElement('a'), { href: 'account.html', textContent: 'Go to your account' }), ' or ', Object.assign(document.createElement('a'), { href: 'index.html', textContent: 'back to today' }), '.');
    banner.hidden = false;
  }

  async function submitSignIn(event) {
    event.preventDefault();
    hideMessages();
    const emailInput = $('#signin-email');
    const passwordInput = $('#signin-password');
    const valid = [validateEmail(emailInput), validatePassword(passwordInput)].every(Boolean);
    if (!valid) return focusFirstInvalid(forms.signin);
    await withBusy(submitButton(forms.signin), 'Signing in…', async () => {
      const api = await getAuth();
      if (!api) return;
      const { error: signInError } = await api.signIn(emailFrom(forms.signin), passwordInput.value);
      if (signInError) { showError(friendlyError(signInError)); passwordInput.select(); }
      else location.href = 'index.html';
    });
  }
  async function submitSignUp(event) {
    event.preventDefault();
    hideMessages();
    const emailInput = $('#signup-email');
    const passwordInput = $('#signup-password');
    const valid = [validateEmail(emailInput), validatePassword(passwordInput, 10)].every(Boolean);
    if (!valid) return focusFirstInvalid(forms.signup);
    await withBusy(submitButton(forms.signup), 'Creating account…', async () => {
      const api = await getAuth();
      if (!api) return;
      const { data, error: signUpError } = await api.createAccount(emailFrom(forms.signup), passwordInput.value, $('#signup-name').value);
      if (signUpError) return showError(friendlyError(signUpError));
      if (data.session) { showStatus('Account created. Taking you to today…'); window.setTimeout(() => { location.href = 'index.html'; }, 700); }
      else {
        const email = emailFrom(forms.signup);
        forms.signup.reset();
        updateStrength();
        showStatus(`Almost done! We sent a confirmation link to ${email}. Open it, then sign in here.`);
      }
    });
  }
  async function submitReset(event) {
    event.preventDefault();
    hideMessages();
    if (!validateEmail($('#reset-email'))) return focusFirstInvalid(forms.reset);
    await withBusy(submitButton(forms.reset), 'Sending…', async () => {
      const api = await getAuth();
      if (!api) return;
      const { error: resetError } = await api.sendPasswordReset(emailFrom(forms.reset));
      if (resetError) showError(friendlyError(resetError)); else showStatus('If an account exists for that email, a reset link is on its way. Check your inbox.');
    });
  }
  async function submitRecovery(event) {
    event.preventDefault();
    hideMessages();
    const passwordInput = $('#recovery-password');
    if (!validatePassword(passwordInput, 10)) return focusFirstInvalid(forms.recovery);
    await withBusy(submitButton(forms.recovery), 'Saving…', async () => {
      const api = await getAuth();
      if (!api) return;
      const { error: updateError } = await api.supabase.auth.updateUser({ password: passwordInput.value });
      if (updateError) showError(friendlyError(updateError));
      else { showStatus('Password updated. Taking you to your account…'); window.setTimeout(() => { location.href = 'account.html'; }, 800); }
    });
  }
  async function sendMagic(event) {
    hideMessages();
    if (!validateEmail($('#signin-email'))) return focusFirstInvalid(forms.signin);
    await withBusy(event.currentTarget, 'Sending link…', async () => {
      const api = await getAuth();
      if (!api) return;
      const { error: linkError } = await api.sendMagicLink(emailFrom(forms.signin));
      if (linkError) showError(friendlyError(linkError)); else showStatus('Check your inbox: if that email is registered, a sign-in link is on its way.');
    });
  }
  async function googleSignIn(event) {
    hideMessages();
    await withBusy(event.currentTarget, 'Opening Google…', async () => {
      const api = await getAuth();
      if (!api) return;
      const { error: oauthError } = await api.signInWithGoogle();
      if (oauthError) showError(friendlyError(oauthError));
    });
  }
}

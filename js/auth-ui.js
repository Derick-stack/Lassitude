import { supabaseConfigured } from './config.js';
import { $, h, toast } from './ui.js';

let currentUser = null;
let client = null;
const syncingUsers = new Set();

export async function initAuthHeader() {
  const bar = $('.bar');
  if (!bar) return;
  const area = h('div', { id: 'auth-controls', class: 'auth-controls', 'aria-live': 'polite' });
  bar.append(area);
  const renderGuest = () => area.replaceChildren(h('a', { class: 'btn auth-link', href: 'login.html' }, 'Sign in / Sync'));
  const renderSignedIn = user => {
    currentUser = user;
    const name = user.user_metadata?.display_name || user.email || 'Account';
    const initial = name.trim().charAt(0).toUpperCase() || 'A';
    const signout = h('button', { type: 'button', class: 'ghost auth-signout' }, 'Sign out');
    signout.addEventListener('click', async () => {
      const { error } = await client.auth.signOut();
      if (error) toast(error.message); else { currentUser = null; renderGuest(); void import('./sync.js').then(module => module.stopAutoSync()); toast('Signed out. Guest mode remains available.'); }
    });
    area.replaceChildren(h('a', { class: 'account-chip', href: 'account.html' }, h('span', { class: 'avatar-initial', 'aria-hidden': 'true' }, initial), h('span', {}, name)), signout);
  };
  renderGuest();
  if (!supabaseConfigured) return;
  try {
    const auth = await import('./auth.js');
    client = auth.supabase;
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) { renderSignedIn(session.user); void migrateOrLoad(session.user); }
    client.auth.onAuthStateChange((_event, nextSession) => {
      currentUser = nextSession?.user || null;
      if (currentUser) { renderSignedIn(currentUser); window.setTimeout(() => { void migrateOrLoad(currentUser); }, 0); }
      else { renderGuest(); void import('./sync.js').then(module => module.stopAutoSync()); }
    });
  } catch {
    area.replaceChildren(h('a', { class: 'btn auth-link', href: 'login.html' }, 'Sign in / Sync'));
  }
}

async function migrateOrLoad(user) {
  if (syncingUsers.has(user.id)) return;
  if (sessionStorage.getItem('lassitude-sync-declined') === user.id) return;
  syncingUsers.add(user.id);
  try {
    const [{ syncOnSignIn }, { confirmDialog }] = await Promise.all([import('./sync.js'), import('./ui.js')]);
    const result = await syncOnSignIn(user, confirmDialog, toast);
    if (result.reason === 'declined') {
      sessionStorage.setItem('lassitude-sync-declined', user.id);
      if (result.accountSwitch) await client?.auth.signOut();
      return;
    }
  } catch {
    toast('Cloud sync is unavailable. Your local guest data is unchanged.');
  } finally {
    syncingUsers.delete(user.id);
  }
}

export function getSignedInUser() {
  return currentUser;
}

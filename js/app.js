import { mountShell } from './ui.js';
import { initHome } from './pages/home.js';
import { initFocus } from './pages/focus.js';
import { initCalendar } from './pages/calendar.js';
import { initWorkouts } from './pages/workouts.js';
import { initHabits } from './pages/habits.js';
import { initFaith } from './pages/faith.js';
import { initProgress } from './pages/progress.js';
import { initFuture } from './pages/future.js';
import { initStart } from './pages/start.js';
import { initSettings } from './pages/settings.js';
import { initHelp } from './pages/help.js';
import { initLogin } from './pages/login.js';
import { initAccount } from './pages/account.js';
import { showOnboardingIfNeeded, startReminderScheduler } from './pages/onboarding.js';
import { initAuthHeader } from './auth-ui.js';

mountShell();
initHelp();
void initAuthHeader();
const pages = {
  home: initHome,
  focusPage: initFocus,
  calendarPage: initCalendar,
  workoutsPage: initWorkouts,
  habitsPage: initHabits,
  faithPage: initFaith,
  progressPage: initProgress,
  futurePage: initFuture,
  startPage: initStart,
  settingsPage: initSettings,
  loginPage: initLogin,
  accountPage: initAccount
};
pages[document.body.dataset.page]?.();
if (document.body.dataset.page && !['loginPage', 'accountPage'].includes(document.body.dataset.page)) {
  startReminderScheduler();
  showOnboardingIfNeeded();
}

import { completeChallenge, getDayKey, getState, markDevotionalRead, recordWorkout, subscribe } from '../store.js';
import { $, $$, h, toast } from '../ui.js';

const verses = [
  ['Trust in the LORD with all thine heart; and lean not unto thine own understanding.', 'Proverbs 3:5'],
  ['I can do all things through Christ which strengtheneth me.', 'Philippians 4:13'],
  ['Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee.', 'Joshua 1:9'],
  ['Let us not be weary in well doing: for in due season we shall reap, if we faint not.', 'Galatians 6:9'],
  ['They that wait upon the LORD shall renew their strength; they shall run, and not be weary.', 'Isaiah 40:31'],
  ['What time I am afraid, I will trust in thee.', 'Psalm 56:3']
];
const quotes = ['Discipline beats motivation.', 'Small steps, repeated daily, change everything.', 'Rest is part of the work.', 'Show up first. Feel ready later.', 'Progress, not perfection.', 'Consistency creates greatness.'];
const workouts = [['Push-ups', '3 sets of 10 · chest, triceps · no equipment'], ['Bodyweight squats', '3 sets of 15 · legs · no equipment'], ['Plank', '3 × 30 seconds · core · no equipment'], ['Walking lunges', '3 sets of 10 per leg · legs · no equipment'], ['Shoulder taps', '3 sets of 20 · shoulders, core · no equipment'], ['Brisk walk', '20 minutes · full body · outdoors']];
const challenges = ['Work with no distractions for one hour', 'Pray or reflect for 10 minutes', 'Stretch for 15 minutes', 'Walk 20 minutes without your phone', 'Write down three things you’re grateful for', 'Drink 8 glasses of water', 'Call someone you haven’t spoken to in a while', 'Plan tomorrow’s top three tasks'];
const playlistIds = { focus: '37i9dQZF1DX4sWSpwq3LiO', lofi: '37i9dQZF1DX8Uebhn9wzrS', hype: '37i9dQZF1DX76Wlfdnj7AP', worship: '37i9dQZF1DXcfZ6moR6J0P' };
const todayPick = values => values[Math.floor(Date.now() / 864e5) % values.length];

export function initHome() {
  const goalLabels = { faith: 'Faith', fitness: 'Fitness', focus: 'Focus', habits: 'Habits' };
  const renderProfile = () => {
    const profile = getState();
    $('#greet').textContent = profile.name ? `Welcome back, ${profile.name}` : 'Faith, fitness and focus';
    $('#dashboard-priorities').textContent = profile.profileGoals.length ? `Your priorities: ${profile.profileGoals.map(goal => goalLabels[goal] || goal).join(' · ')}` : 'Choose a small action and build from there.';
    $('#workoutPersonalization').textContent = `${profile.workoutExperience} level · ${profile.workoutDays} training days per week`;
  };
  renderProfile();
  subscribe(renderProfile);
  let verseIndex = Math.floor(Date.now() / 864e5) % verses.length;
  const renderVerse = () => { $('#verse').textContent = verses[verseIndex][0]; $('#verseRef').textContent = verses[verseIndex][1]; };
  renderVerse();
  $('#newVerse').addEventListener('click', () => { verseIndex = (verseIndex + 1) % verses.length; renderVerse(); });
  const devotionalButton = $('#devotional-read');
  const renderDevotional = () => {
    const read = Boolean(getState().devotionalRead[getDayKey()]);
    devotionalButton.disabled = read;
    devotionalButton.textContent = read ? 'Completed today' : 'Mark devotional complete';
    $('#devotional-status').textContent = read ? 'Reading saved for today.' : '';
  };
  devotionalButton.addEventListener('click', () => { markDevotionalRead(); renderDevotional(); toast('Devotional reading saved.'); });
  renderDevotional();
  let quoteIndex = 0;
  const renderQuote = () => { $('#quote').textContent = quotes[(Math.floor(Date.now() / 864e5) + quoteIndex) % quotes.length]; };
  renderQuote();
  $('#newQuote').addEventListener('click', () => { quoteIndex += 1; renderQuote(); });
  let workoutIndex = 0;
  const renderWorkout = () => {
    const item = workouts[(Math.floor(Date.now() / 864e5) + workoutIndex) % workouts.length];
    $('#workoutName').textContent = item[0];
    $('#workoutNote').textContent = item[1];
  };
  renderWorkout();
  $('#newWorkout').addEventListener('click', () => { workoutIndex += 1; renderWorkout(); });
  $('#workoutLogForm').addEventListener('submit', event => {
    event.preventDefault();
    const minutes = Number.parseInt($('#workoutMinutes').value, 10);
    if (!minutes || minutes < 1) return;
    recordWorkout($('#workoutName').textContent, minutes);
    $('#workout-log-status').textContent = 'Workout saved on this device.';
    $('#workoutMinutes').value = '';
    toast('Workout logged.');
  });

  const challengeButton = $('#chalBtn');
  $('#chal').textContent = todayPick(challenges);
  const renderChallenge = () => {
    const done = Boolean(getState().chal[getDayKey()]);
    challengeButton.disabled = done;
    challengeButton.textContent = done ? 'Completed' : 'Mark complete (+20 XP)';
    $('#chalStatus').textContent = done ? 'Nice work. Come back tomorrow for a new one.' : '';
  };
  renderChallenge();
  challengeButton.addEventListener('click', () => {
    if (completeChallenge()) toast('Challenge completed. +20 XP');
    renderChallenge();
  });

  $$('[data-pl]').forEach(button => button.addEventListener('click', () => {
    const playlist = playlistIds[button.dataset.pl];
    if (!playlist) return;
    $('#player').replaceChildren(h('iframe', {
      src: `https://open.spotify.com/embed/playlist/${playlist}`,
      height: '352', title: `${button.textContent} playlist`, loading: 'lazy', allow: 'encrypted-media'
    }));
  }));

  const chat = $('#chat');
  const say = (text, isUser = false) => {
    chat.append(h('p', { class: isUser ? 'me' : '' }, text));
    chat.scrollTop = chat.scrollHeight;
  };
  say('Hi, I’m NADIR, an offline coach with ready-made guidance, not a real AI or medical professional. Ask about workouts, focus, faith or habits.');
  $('#chatForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#chatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    say(text, true);
    say(coach(text));
  });
  renderRing();
  subscribe(renderRing);
}

function renderRing() {
  const state = getState();
  const daily = state.habits[getDayKey()] || {};
  const count = Object.values(daily).filter(Boolean).length;
  const total = Math.max((state.starterHabits.length || 4) + state.custom.length, Object.keys(daily).length);
  const percent = Math.round(count / total * 100);
  const ring = $('[data-today-ring]');
  if (!ring) return;
  ring.style.setProperty('--ring-progress', `${percent}%`);
  ring.setAttribute('aria-valuenow', String(percent));
  $('[data-ring-label]').textContent = `${count} of ${total} habits`;
  $('[data-ring-percent]').textContent = `${percent}%`;
}

function coach(query) {
  const text = query.toLowerCase();
  if (/suicid|kill myself|end my life|self.?harm|want to die|hurt myself/.test(text)) return 'I’m glad you said something. You deserve support from a real person right now. In the U.S. call or text 988, or call 911 if you’re in immediate danger. If you can, tell someone near you how you’re feeling.';
  if (/workout|exercise|train|gym/.test(text)) return 'Start small: warm up for 5 minutes, then squats, push-ups and a plank. Stop if anything hurts. This is not medical advice.';
  if (/focus|study|distract/.test(text)) return 'Try a 25-minute session on the Focus page: one task, phone away, then a 5-minute break.';
  if (/faith|pray|scripture|god/.test(text)) return 'Take five quiet minutes today to read one verse and pray about one thing. Small and steady beats long and rare.';
  if (/tired|sleep|rest|sore/.test(text)) return 'Rest counts as training. Aim for 7–9 hours of sleep and swap today’s hard session for a walk or stretching.';
  if (/habit|streak|motivat/.test(text)) return 'Pick one habit you can finish in under two minutes and check it off today. The streak follows.';
  return 'I can help with workouts, focus, faith and habits. What would you like to work on?';
}

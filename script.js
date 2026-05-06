// Load or initialize stats from localStorage
let xp = parseInt(localStorage.getItem("xp")) || 0;
let level = parseInt(localStorage.getItem("level")) || 1;
let streak = parseInt(localStorage.getItem("streak")) || 0;
let timerInterval;

function saveStats() {
  localStorage.setItem("xp", xp);
  localStorage.setItem("level", level);
  localStorage.setItem("streak", streak);
}

function updateStatsDisplay() {
  xp = parseInt(localStorage.getItem("xp")) || 0;
  level = parseInt(localStorage.getItem("level")) || 1;
  streak = parseInt(localStorage.getItem("streak")) || 0;

  let xpEl = document.getElementById("xp");
  let levelEl = document.getElementById("level");
  let streakEl = document.getElementById("streak");

  if (xpEl) xpEl.textContent = xp;
  if (levelEl) levelEl.textContent = level;
  if (streakEl) streakEl.textContent = streak;
}

function completeTask() {
  xp += 10;
  streak++;
  if (xp >= level * 50) {
    level++;
  }
  saveStats();
  updateStatsDisplay();
}

function startTimer(durationSeconds = 25 * 60) {
  let timeLeft = durationSeconds;
  let timerEl = document.getElementById("timer");
  if (!timerEl) return;

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    let minutes = Math.floor(timeLeft / 60);
    let seconds = timeLeft % 60;
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerEl.textContent = "Done!";
      xp += 25;
      saveStats();
      updateStatsDisplay();
    }

    timeLeft--;
  }, 1000);
}

function startCustomTimer() {
  const input = document.getElementById('timerInput');
  if (!input) return;
  let minutes = parseInt(input.value, 10);
  if (!minutes || minutes <= 0) {
    alert('Enter a valid number of minutes.');
    return;
  }
  startTimer(minutes * 60);
}

function renderPageStats() {
  const statsElement = document.getElementById('stats');
  const statsBlock = document.getElementById('statsBlock');
  const xpValue = parseInt(localStorage.getItem('xp') || '0', 10);
  const levelValue = parseInt(localStorage.getItem('level') || '1', 10);
  const streakValue = parseInt(localStorage.getItem('streak') || '0', 10);

  if (statsElement) {
    statsElement.textContent = `XP: ${xpValue} | Level: ${levelValue} | Streak: ${streakValue}`;
  }

  if (statsBlock) {
    statsBlock.innerHTML = `
      <div class="stats-summary">
        <p><strong>XP:</strong> ${xpValue}</p>
        <p><strong>Level:</strong> ${levelValue}</p>
        <p><strong>Streak:</strong> ${streakValue}</p>
      </div>
      <p>Complete habits, keep your streak alive, and track your growth every day.</p>
    `;
  }
}

// Update display on page load
window.addEventListener("DOMContentLoaded", updateStatsDisplay);

function toggleTheme() {
  const body = document.body;
  const btn = document.getElementById('themeBtn');
  if (body.classList.contains('light-theme')) {
    body.classList.remove('light-theme');
    btn.textContent = '🌙';
    localStorage.setItem('theme', 'dark');
  } else {
    body.classList.add('light-theme');
    btn.textContent = '☀️';
    localStorage.setItem('theme', 'light');
  }
}

function loadSongOfDay() {
  const songs = songLibrary;
  const today = new Date().getDate();
  const song = songs[today % songs.length];
  document.getElementById('dailySong').innerHTML = `<a href="${song.spotify}" target="_blank">${song.title} by ${song.artist}</a>`;
}

function logRecovery() {
  const sleep = document.getElementById('sleepInput').value;
  const water = document.getElementById('waterInput').value;
  const soreness = document.getElementById('sorenessInput').value;
  const log = document.getElementById('recoveryLog');
  log.innerHTML = `Logged: Sleep ${sleep}h, Water ${water} glasses, Soreness ${soreness}/10. Great job tracking!`;
  localStorage.setItem('recovery', JSON.stringify({sleep, water, soreness}));
}

function startBreathing() {
  const prompt = document.getElementById('breathingPrompt');
  let step = 0;
  const steps = ['Breathe in...', 'Hold...', 'Breathe out...', 'Relax...'];
  const interval = setInterval(() => {
    prompt.textContent = steps[step % steps.length];
    step++;
    if (step > 16) clearInterval(interval); // 4 cycles
  }, 4000);
}

function logMeal() {
  const meal = document.getElementById('mealInput').value;
  const calories = document.getElementById('caloriesInput').value;
  const log = document.getElementById('mealLog');
  if (meal && calories) {
    log.innerHTML += `<div>${meal} - ${calories} cal</div>`;
    document.getElementById('mealInput').value = '';
    document.getElementById('caloriesInput').value = '';
  }
}

function suggestMeal(type) {
  const suggestions = {
    protein: ['Grilled chicken with veggies', 'Greek yogurt with nuts', 'Tuna salad'],
    carb: ['Oatmeal with fruit', 'Sweet potato with avocado', 'Whole grain pasta'],
    recovery: ['Banana with peanut butter', 'Smoothie with protein', 'Eggs and toast']
  };
  const meal = suggestions[type][Math.floor(Math.random() * suggestions[type].length)];
  document.getElementById('mealInput').value = meal;
}

function checkHabit(id) {
  const habit = document.getElementById(`habit${id}`);
  const streakEl = document.getElementById('habitStreak');
  let streak = parseInt(localStorage.getItem('habitStreak') || '0');
  if (habit.checked) {
    streak++;
    xp += 5;
    saveStats();
    updateStatsDisplay();
  }
  localStorage.setItem('habitStreak', streak);
  streakEl.textContent = `Streak: ${streak} days`;
}

function addGoal() {
  const goal = document.getElementById('goalInput').value;
  const list = document.getElementById('goalList');
  if (goal) {
    list.innerHTML += `<div class="goal-item">${goal} <button onclick="completeGoal(this)">Complete</button></div>`;
    document.getElementById('goalInput').value = '';
  }
}

function completeGoal(btn) {
  btn.parentElement.style.textDecoration = 'line-through';
  xp += 20;
  saveStats();
  updateStatsDisplay();
}

// Initialize theme and song of day
window.addEventListener("DOMContentLoaded", () => {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') toggleTheme();
  loadSongOfDay();
});

function performSearch() {
  const query = document.getElementById('globalSearch').value.toLowerCase();
  const results = [];
  if (query.includes('motivation')) results.push('Motivation quotes from Quotable API');
  if (query.includes('workout')) results.push('Workout plans in Training Library');
  if (query.includes('music')) results.push('Playlists in Music Library');
  alert('Search results: ' + results.join(', ') || 'No matches found');
}

function startGuidedWorkout(type) {
  const guide = document.getElementById('workoutGuide');
  const workouts = {
    strength: 'Warm up: 5 min jog. Main: Squats 3x10, Bench Press 3x8. Cool down: Stretch.',
    'faith-yoga': 'Breathe deeply. Pose 1: Warrior with prayer. Pose 2: Tree pose for balance.',
    hiit: '30s sprint, 30s rest. Repeat 8x. Finish with planks.'
  };
  guide.innerHTML = `<strong>${type.toUpperCase()} Workout:</strong><br>${workouts[type]}`;
}

function loadRecommendations() {
  const recs = document.getElementById('productRecs');
  recs.innerHTML = '<ul><li>Protein powder for recovery</li><li>Faith-based books like "The Purpose Driven Life"</li><li>Resistance bands for home workouts</li></ul>';
}

function loadChallenge(type) {
  const video = document.getElementById('challengeVideo');
  const challenges = {
    stretch: '<iframe src="https://www.youtube.com/embed/7LlpvN7QgzI" allowfullscreen></iframe><p>15s Shoulder Stretch</p>',
    prayer: '<p>Take 15s to pray: "Lord, guide my day."</p>',
    breathe: '<p>Inhale 4s, hold 4s, exhale 4s. Repeat.</p>'
  };
  video.innerHTML = challenges[type];
}

function postToFeed() {
  const post = document.getElementById('feedPost').value;
  const feed = document.getElementById('feedPosts');
  if (post) {
    feed.innerHTML += `<div class="feed-post">${post} - Just now</div>`;
    document.getElementById('feedPost').value = '';
  }
}

function loadBoard(type) {
  const content = document.getElementById('boardContent');
  const boards = {
    motivation: '<img src="https://via.placeholder.com/200x150?text=Motivational+Image" alt="Motivation"><p>Push through the pain!</p>',
    fitness: '<img src="https://via.placeholder.com/200x150?text=Fitness+Image" alt="Fitness"><p>Stronger every day.</p>',
    faith: '<img src="https://via.placeholder.com/200x150?text=Faith+Image" alt="Faith"><p>Trust in the Lord.</p>'
  };
  content.innerHTML = boards[type];
}

function showLyrics() {
  const lyricsDiv = document.getElementById('lyrics');
  if (lyricsDiv) {
    lyricsDiv.innerHTML = '<p><strong>Lyrics:</strong><br>Verse 1: This is a sample lyric line.<br>Chorus: Keep pushing forward!</p>';
  } else {
    alert('Lyrics: This is a sample lyric for the current song.');
  }
}

function addComment() {
  const commentInput = document.getElementById('commentInput');
  const commentsDiv = document.getElementById('commentsList');
  if (commentInput && commentsDiv && commentInput.value.trim()) {
    const comment = document.createElement('div');
    comment.className = 'comment';
    comment.textContent = commentInput.value;
    commentsDiv.appendChild(comment);
    commentInput.value = '';
  }
}

function saveProfile() {
  const name = document.getElementById('userName').value;
  const bio = document.getElementById('userBio').value;
  localStorage.setItem('profileName', name);
  localStorage.setItem('profileBio', bio);
  alert('Profile saved!');
}

// ===== HABIT GRID CALENDAR =====
function generateHabitGrid() {
  const calendar = document.getElementById('habitCalendar');
  if (!calendar) return;
  
  const today = new Date();
  const habit = localStorage.getItem('habitDays') ? JSON.parse(localStorage.getItem('habitDays')) : {};
  
  let grid = '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 1rem;">';
  
  for (let i = 120; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const isComplete = habit[dateStr] === true;
    
    grid += `<div style="width: 30px; height: 30px; background: ${isComplete ? 'linear-gradient(135deg, #D4AF37, #C89A2B)' : 'rgba(212, 175, 55, 0.1)'}; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; cursor: pointer;" onclick="toggleHabitDay('${dateStr}')" title="${dateStr}"></div>`;
  }
  
  grid += '</div>';
  calendar.innerHTML = grid;
}

function toggleHabitDay(dateStr) {
  const habit = localStorage.getItem('habitDays') ? JSON.parse(localStorage.getItem('habitDays')) : {};
  habit[dateStr] = !habit[dateStr];
  localStorage.setItem('habitDays', JSON.stringify(habit));
  generateHabitGrid();
}

// ===== WEEKLY REPORTS =====
function generateWeeklyReport() {
  const xp = parseInt(localStorage.getItem('xp')) || 0;
  const level = parseInt(localStorage.getItem('level')) || 1;
  const streak = parseInt(localStorage.getItem('streak')) || 0;
  const meals = parseInt(localStorage.getItem('hydration')) || 0;
  
  const lastWeekXP = xp * 0.7;
  const xpGrowth = Math.round((xp - lastWeekXP) / lastWeekXP * 100);
  
  const report = `
    <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(212, 175, 55, 0.05) 100%); padding: 2rem; border-radius: 16px; border: 1px solid rgba(212, 175, 55, 0.2);">
      <h3 style="color: #D4AF37; margin-bottom: 1rem; font-family: 'Playfair Display', serif;">This Week's Summary</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
        <div>
          <p style="color: #B0B0B0; margin: 0;">Total XP Earned</p>
          <p style="font-size: 2rem; color: #D4AF37; margin: 0.5rem 0 0 0; font-weight: bold;">${xp}</p>
          <p style="color: #00D4FF; font-size: 0.9rem;">+${xpGrowth}% from last week</p>
        </div>
        <div>
          <p style="color: #B0B0B0; margin: 0;">Current Streak</p>
          <p style="font-size: 2rem; color: #D4AF37; margin: 0.5rem 0 0 0; font-weight: bold;">${streak} 🔥</p>
          <p style="color: #E91E63; font-size: 0.9rem;">Keep it going!</p>
        </div>
        <div>
          <p style="color: #B0B0B0; margin: 0;">Level</p>
          <p style="font-size: 2rem; color: #D4AF37; margin: 0.5rem 0 0 0; font-weight: bold;">${level} 🎖️</p>
          <p style="color: #00D4FF; font-size: 0.9rem;">${100 - (xp % 50)}% to level ${level + 1}</p>
        </div>
        <div>
          <p style="color: #B0B0B0; margin: 0;">Hydration</p>
          <p style="font-size: 2rem; color: #D4AF37; margin: 0.5rem 0 0 0; font-weight: bold;">${meals} 💧</p>
          <p style="color: #00D4FF; font-size: 0.9rem;">Target: 8 glasses</p>
        </div>
      </div>
      <button onclick="downloadWeeklyReport()" class="card-btn" style="margin-top: 1.5rem; width: 100%;">📥 Download PDF</button>
    </div>
  `;
  
  const reportDiv = document.getElementById('weeklyReportDisplay');
  if (reportDiv) reportDiv.innerHTML = report;
}

function downloadWeeklyReport() {
  alert('Report will be downloaded as PDF. (Feature coming soon - integrates with jsPDF library)');
}

// ===== LEADERBOARDS & CHALLENGES =====
function displayLeaderboard() {
  const board = document.getElementById('leaderboard');
  if (!board) return;
  
  const mockLeaderboard = [
    { rank: 1, name: 'Sarah M.', xp: 5200, streak: 45 },
    { rank: 2, name: 'James T.', xp: 4800, streak: 38 },
    { rank: 3, name: 'Emma L.', xp: 4200, streak: 32 },
    { rank: 4, name: 'You', xp: parseInt(localStorage.getItem('xp')) || 0, streak: parseInt(localStorage.getItem('streak')) || 0, highlight: true }
  ];
  
  const html = mockLeaderboard.map(u => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: ${u.highlight ? 'linear-gradient(135deg, rgba(233, 30, 99, 0.1) 0%, rgba(212, 175, 55, 0.05) 100%)' : 'transparent'}; border-radius: 12px; border: ${u.highlight ? '1px solid rgba(233, 30, 99, 0.3)' : 'none'}; margin-bottom: 0.8rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="font-weight: bold; color: #D4AF37; font-size: 1.2rem; min-width: 40px;"><span style="color: #F0F0F0;">#${u.rank}</span></div>
        <div>
          <p style="margin: 0; font-weight: 600;">${u.name} ${u.highlight ? '👑' : ''}</p>
          <p style="margin: 0; font-size: 0.85rem; color: #B0B0B0;">Level ${Math.floor(parseInt(localStorage.getItem('xp') || u.xp) / 50) + 1}</p>
        </div>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0; font-weight: bold; color: #D4AF37;">${u.xp} XP</p>
        <p style="margin: 0; font-size: 0.85rem; color: #00D4FF;">${u.streak} 🔥 Streak</p>
      </div>
    </div>
  `).join('');
  
  board.innerHTML = html;
}

// ===== CUSTOM THEMES =====
function applyTheme(theme) {
  const root = document.documentElement;
  const themes = {
    'midnight-gold': {
      '--primary-dark': '#0A0E27',
      '--accent-gold': '#D4AF37'
    },
    'rose-twilight': {
      '--primary-dark': '#2A1825',
      '--accent-gold': '#E91E63'
    },
    'deep-ocean': {
      '--primary-dark': '#0D1B2A',
      '--accent-gold': '#00D4FF'
    },
    'emerald-night': {
      '--primary-dark': '#0A1F1A',
      '--accent-gold': '#10B981'
    }
  };
  
  const selectedTheme = themes[theme] || themes['midnight-gold'];
  Object.keys(selectedTheme).forEach(key => {
    root.style.setProperty(key, selectedTheme[key]);
  });
  
  localStorage.setItem('selectedTheme', theme);
}

function loadTheme() {
  const saved = localStorage.getItem('selectedTheme') || 'midnight-gold';
  applyTheme(saved);
}

// ===== USER PROFILES & FOLLOWING =====
function createUserProfile() {
  const name = prompt('Enter your name:');
  const bio = prompt('Enter your bio:');
  const avatar = String.fromCodePoint(0x1F600 + Math.floor(Math.random() * 60));
  
  const profile = {
    id: Date.now(),
    name: name || 'User',
    bio: bio || 'Passionate about fitness and growth!',
    avatar: avatar,
    joined: new Date().toLocaleDateString(),
    following: [],
    followers: [],
    xp: parseInt(localStorage.getItem('xp')) || 0,
    level: parseInt(localStorage.getItem('level')) || 1,
    streak: parseInt(localStorage.getItem('streak')) || 0
  };
  
  localStorage.setItem('userProfile', JSON.stringify(profile));
  displayUserProfile();
}

function displayUserProfile() {
  const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
  const profileDiv = document.getElementById('userProfileCard');
  
  if (profileDiv) {
    profileDiv.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">${profile.avatar || '👤'}</div>
        <h3 style="color: #D4AF37; margin: 0.5rem 0;">${profile.name || 'Create Profile'}</h3>
        <p style="color: #B0B0B0; margin: 0.5rem 0; font-size: 0.9rem;">${profile.bio || 'No bio yet'}</p>
        <p style="color: #00D4FF; font-size: 0.85rem; margin: 1rem 0;">Joined ${profile.joined || 'Today'}</p>
        <div style="display: flex; justify-content: center; gap: 2rem; margin: 1.5rem 0;">
          <div><p style="margin: 0; color: #B0B0B0; font-size: 0.85rem;">Level</p><p style="margin: 0; color: #D4AF37; font-weight: bold; font-size: 1.3rem;">${profile.level || 1}</p></div>
          <div><p style="margin: 0; color: #B0B0B0; font-size: 0.85rem;">Streak</p><p style="margin: 0; color: #D4AF37; font-weight: bold; font-size: 1.3rem;">${profile.streak || 0}🔥</p></div>
          <div><p style="margin: 0; color: #B0B0B0; font-size: 0.85rem;">Following</p><p style="margin: 0; color: #D4AF37; font-weight: bold; font-size: 1.3rem;">${profile.following?.length || 0}</p></div>
        </div>
        <button onclick="createUserProfile()" class="card-btn" style="width: 100%;">Edit Profile</button>
      </div>
    `;
  }
}

function followUser(userId) {
  const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
  if (!profile.following) profile.following = [];
  
  if (!profile.following.includes(userId)) {
    profile.following.push(userId);
    localStorage.setItem('userProfile', JSON.stringify(profile));
    alert('Now following! 🎉');
  }
}

function getAffirmation() {
  const affirmations = [
    "I am capable of achieving my goals.",
    "Every day, I grow stronger in faith and fitness.",
    "I choose progress over perfection.",
    "My potential is limitless.",
    "I am grateful for this moment and the journey ahead."
  ];
  const random = affirmations[Math.floor(Math.random() * affirmations.length)];
  document.getElementById('affirmationDisplay').textContent = random;
}

function startMeditation() {
  const guide = document.getElementById('meditationGuide');
  guide.innerHTML = '<p>Close your eyes, breathe deeply. Inhale for 4 counts, hold for 4, exhale for 4. Repeat for 1 minute. Focus on gratitude.</p><button onclick="completeMeditation()" class="card-btn">Done</button>';
}

function completeMeditation() {
  xp += 10;
  saveStats();
  updateStatsDisplay();
  document.getElementById('meditationGuide').innerHTML = 'Meditation complete! +10 XP';
}

function logHydration() {
  const glasses = parseInt(document.getElementById('hydrationInput').value) || 0;
  localStorage.setItem('hydration', glasses);
  document.getElementById('hydrationDisplay').textContent = `Logged ${glasses} glasses today.`;
}

function saveJournal() {
  const entry = document.getElementById('journalInput').value;
  if (entry.trim()) {
    const entries = JSON.parse(localStorage.getItem('journal') || '[]');
    entries.push({ date: new Date().toLocaleDateString(), text: entry });
    localStorage.setItem('journal', JSON.stringify(entries));
    document.getElementById('journalInput').value = '';
    displayJournal();
  }
}

function displayJournal() {
  const entries = JSON.parse(localStorage.getItem('journal') || '[]');
  const list = document.getElementById('journalList');
  list.innerHTML = entries.map(e => `<div class="journal-entry"><strong>${e.date}:</strong> ${e.text}</div>`).join('');
}

function showChart() {
  const xp = parseInt(localStorage.getItem('xp') || '0');
  const level = parseInt(localStorage.getItem('level') || '1');
  const streak = parseInt(localStorage.getItem('streak') || '0');
  document.getElementById('chartDisplay').innerHTML = `
    <p>XP Progress: ${xp}/100 (to next level)</p>
    <p>Current Level: ${level}</p>
    <p>Streak: ${streak} days</p>
    <div style="width: ${Math.min(xp, 100)}%; height: 20px; background: #4CAF50;"></div>
  `;
}

function loadSoundscape(type) {
  const player = document.getElementById('soundscapePlayer');
  const soundscapes = {
    rain: 'https://www.youtube.com/embed/8N-qO3s0OOg?autoplay=1&mute=1',
    ocean: 'https://www.youtube.com/embed/8N-qO3s0OOg?autoplay=1&mute=1', // placeholder
    forest: 'https://www.youtube.com/embed/8N-qO3s0OOg?autoplay=1&mute=1'
  };
  player.innerHTML = `<iframe width="100%" height="200" src="${soundscapes[type]}" frameborder="0" allow="autoplay"></iframe>`;
}

function addVisionItem() {
  const item = document.getElementById('visionInput').value;
  if (item.trim()) {
    const board = document.getElementById('visionBoard');
    board.innerHTML += `<div class="vision-item">${item}</div>`;
    document.getElementById('visionInput').value = '';
  }
}

function trackMilestone() {
  const milestone = document.getElementById('milestoneInput').value;
  if (milestone.trim()) {
    const list = document.getElementById('milestoneList');
    list.innerHTML += `<li>${milestone} - ${new Date().toLocaleDateString()}</li>`;
    document.getElementById('milestoneInput').value = '';
  }
}

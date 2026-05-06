// Get current user
function getCurrentUser() {
  return localStorage.getItem('currentUser') || null;
}

// Get users data
function getUsers() {
  return JSON.parse(localStorage.getItem('users') || '{}');
}

// Save users data
function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

// NADIR Memory Functions
function getNadirMemory() {
  const user = getCurrentUser();
  if (!user) return {};
  return JSON.parse(localStorage.getItem(`nadirMemory_${user}`) || '{}');
}

function saveNadirMemory(memory) {
  const user = getCurrentUser();
  if (!user) return;
  localStorage.setItem(`nadirMemory_${user}`, JSON.stringify(memory));
}

function updateNadirMemory(key, value) {
  const memory = getNadirMemory();
  memory[key] = value;
  saveNadirMemory(memory);
}

function logWorkout(completed, type, duration, notes = '') {
  const memory = getNadirMemory();
  if (!memory.workoutHistory) memory.workoutHistory = [];
  memory.workoutHistory.push({
    date: new Date().toISOString(),
    completed,
    type,
    duration,
    notes
  });
  // Keep last 30 entries
  if (memory.workoutHistory.length > 30) memory.workoutHistory.shift();
  saveNadirMemory(memory);
}

function logEnergyLevel(level, notes = '') {
  const memory = getNadirMemory();
  if (!memory.energyHistory) memory.energyHistory = [];
  memory.energyHistory.push({
    date: new Date().toISOString(),
    level, // 1-10
    notes
  });
  if (memory.energyHistory.length > 30) memory.energyHistory.shift();
  saveNadirMemory(memory);
}

// ===== API INTEGRATIONS =====

// ExerciseDB API - Get exercises by muscle group
async function getExercisesByMuscle(muscle, limit = 5) {
  try {
    const response = await fetch(`https://exercisedb.p.rapidapi.com/exercises/target/${muscle}?limit=${limit}`, {
      headers: {
        'X-RapidAPI-Key': 'YOUR_RAPIDAPI_KEY', // You'll need to add this
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
      }
    });
    const exercises = await response.json();
    return exercises;
  } catch (error) {
    console.error('ExerciseDB API error:', error);
    return [];
  }
}

// API Ninjas Exercises API - Alternative exercise source
async function getExercisesNinjas(muscle, difficulty = 'beginner') {
  try {
    const response = await fetch(`https://api.api-ninjas.com/v1/exercises?muscle=${muscle}&difficulty=${difficulty}`, {
      headers: {
        'X-Api-Key': 'YOUR_API_NINJAS_KEY' // You'll need to add this
      }
    });
    const exercises = await response.json();
    return exercises;
  } catch (error) {
    console.error('API Ninjas error:', error);
    return [];
  }
}

// Bible API - Get verse by reference
async function getBibleVerse(reference = 'john 3:16') {
  try {
    const response = await fetch(`https://bible-api.com/${reference}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Bible API error:', error);
    return { text: 'For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future. - Jeremiah 29:11' };
  }
}

// Free Use Bible API - Alternative bible source
async function getBibleVerseFreeUse(reference = 'john 3:16', translation = 'KJV') {
  try {
    const response = await fetch(`https://bible.helloao.org/api/${translation}/${reference}.json`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Free Use Bible API error:', error);
    return getBibleVerse(reference); // Fallback
  }
}

// MeaningCloud Sentiment Analysis
async function analyzeSentiment(text) {
  try {
    const response = await fetch('https://api.meaningcloud.com/sentiment-2.1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        key: 'YOUR_MEANINGCLOUD_KEY', // You'll need to add this
        txt: text,
        lang: 'en'
      })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Sentiment API error:', error);
    // Fallback to simple sentiment analysis
    return simpleSentimentAnalysis(text);
  }
}

// Simple sentiment analysis fallback (no API key needed)
function simpleSentimentAnalysis(text) {
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'love', 'happy', 'excited', 'motivated', 'strong', 'energized'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'tired', 'exhausted', 'weak', 'discouraged', 'frustrated', 'pain', 'sore'];
  
  const words = text.toLowerCase().split(' ');
  let score = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) score += 1;
    if (negativeWords.includes(word)) score -= 1;
  });
  
  let sentiment = 'neutral';
  if (score > 0) sentiment = 'positive';
  if (score < 0) sentiment = 'negative';
  
  return {
    score_tag: sentiment.toUpperCase(),
    confidence: Math.abs(score) * 20 // Rough confidence
  };
}

// Open-Meteo Weather API
async function getWeather(lat = 40.7128, lon = -74.0060) { // Default NYC
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Weather API error:', error);
    return { current_weather: { temperature: 72, weathercode: 0 } };
  }
}

// Get user's location (simplified - would need geolocation permission)
function getUserLocation() {
  // For demo, return NYC coordinates
  // In real app, use navigator.geolocation
  return { lat: 40.7128, lon: -74.0060 };
}

// ===== SMART NADIR AI LOGIC =====

// Enhanced NADIR AI with API integration
async function smartNadirAI() {
  const userInput = document.getElementById('userInput').value.toLowerCase();
  const chatMessages = document.getElementById('chat-messages');
  
  if (!userInput.trim()) return;
  
  // Add user message
  chatMessages.innerHTML += `<div class="message user-message">${userInput}</div>`;
  document.getElementById('userInput').value = '';
  
  // Show typing indicator
  chatMessages.innerHTML += `<div class="message nadir-message typing">NADIR is thinking...</div>`;
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  try {
    // Analyze sentiment
    const sentiment = await analyzeSentiment(userInput);
    
    // Get user context
    const context = getUserContext();
    
    // Get weather
    const location = getUserLocation();
    const weather = await getWeather(location.lat, location.lon);
    
    // Generate smart response
    const response = await generateSmartResponse(userInput, sentiment, context, weather);
    
    // Remove typing indicator and add response
    const messages = chatMessages.querySelectorAll('.message');
    messages[messages.length - 1].remove();
    
    chatMessages.innerHTML += `<div class="message nadir-message">${response}</div>`;
    
  } catch (error) {
    console.error('NADIR AI error:', error);
    chatMessages.innerHTML += `<div class="message nadir-message">Sorry, I'm having trouble connecting right now. Let's try again in a moment.</div>`;
  }
  
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Get comprehensive user context
function getUserContext() {
  const memory = getNadirMemory();
  const today = new Date().toDateString();
  
  return {
    energyHistory: memory.energyHistory || [],
    workoutHistory: memory.workoutHistory || [],
    lastWorkout: memory.workoutHistory ? memory.workoutHistory[memory.workoutHistory.length - 1] : null,
    habitStreak: parseInt(localStorage.getItem('habitStreak') || '0'),
    xp: parseInt(localStorage.getItem('xp') || '0'),
    level: parseInt(localStorage.getItem('level') || '1'),
    committedChallenges: JSON.parse(localStorage.getItem('committedChallenges') || '{}'),
    todayChallenge: JSON.parse(localStorage.getItem('committedChallenges') || '{}')[today],
    customHabits: JSON.parse(localStorage.getItem('customHabits') || '[]'),
    dailyHabits: JSON.parse(localStorage.getItem('dailyHabits') || '{}'),
    prayerStreak: parseInt(localStorage.getItem('prayerStreak') || '0')
  };
}

// Generate intelligent response based on all context
async function generateSmartResponse(userInput, sentiment, context, weather) {
  const input = userInput.toLowerCase();
  
  // Handle workout requests
  if (input.includes('workout') || input.includes('exercise') || input.includes('train')) {
    return await generateWorkoutResponse(context, weather, sentiment);
  }
  
  // Handle motivation/energy requests
  if (input.includes('motivation') || input.includes('energy') || input.includes('tired') || input.includes('discouraged')) {
    return await generateMotivationResponse(sentiment, context);
  }
  
  // Handle scripture requests
  if (input.includes('bible') || input.includes('scripture') || input.includes('verse') || input.includes('pray')) {
    return await generateScriptureResponse(context, sentiment);
  }
  
  // Handle progress requests
  if (input.includes('progress') || input.includes('habit') || input.includes('streak')) {
    return generateProgressResponse(context);
  }
  
  // Handle general conversation
  return await generateGeneralResponse(userInput, sentiment, context, weather);
}

// Smart workout generation
async function generateWorkoutResponse(context, weather, sentiment) {
  let response = "";
  const temp = weather.current_weather?.temperature || 72;
  
  // Adjust for weather
  if (temp > 85) {
    response += "🌡️ It's hot today (" + temp + "°F), so let's focus on indoor, low-intensity exercises to stay safe. ";
  } else if (temp < 50) {
    response += "❄️ It's chilly (" + temp + "°F), perfect for building heat through movement. ";
  }
  
  // Check recent workout history
  const lastWorkout = context.lastWorkout;
  if (lastWorkout) {
    const lastDate = new Date(lastWorkout.date);
    const daysSince = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
    
    if (daysSince === 0) {
      response += "I see you worked out today already! ";
      if (sentiment.score_tag === 'NEGATIVE') {
        response += "If you're feeling sore, let's focus on recovery and mobility. ";
      }
    } else if (daysSince === 1) {
      response += "Great job keeping the momentum going! ";
    } else if (daysSince > 3) {
      response += "It's been " + daysSince + " days since your last workout. ";
      if (sentiment.score_tag === 'NEGATIVE') {
        response += "That's okay - let's ease back in gently. ";
      }
    }
  }
  
  // Generate workout based on available data
  try {
    const exercises = await getExercisesByMuscle('chest', 3);
    if (exercises.length > 0) {
      response += "Here's a balanced upper body workout:\n\n";
      exercises.forEach((exercise, index) => {
        response += `${index + 1}. ${exercise.name}\n`;
        response += `   Equipment: ${exercise.equipment}\n`;
        response += `   Target: ${exercise.target}\n\n`;
      });
    }
  } catch (error) {
    response += "Here's a simple bodyweight workout:\n\n";
    response += "1. Push-ups (chest, triceps)\n";
    response += "2. Squats (legs, glutes)\n";
    response += "3. Planks (core)\n\n";
  }
  
  // Add encouragement based on sentiment
  if (sentiment.score_tag === 'NEGATIVE') {
    response += "Remember: Progress > perfection. Every rep counts toward your growth. 💪";
  } else {
    response += "You've got this! Each workout builds the discipline that changes everything. 🚀";
  }
  
  return response;
}

// Smart motivation response
async function generateMotivationResponse(sentiment, context) {
  let response = "";
  
  if (sentiment.score_tag === 'NEGATIVE') {
    response += "I hear that you're feeling discouraged. That's completely normal on this journey. ";
    
    // Get encouraging scripture
    try {
      const verse = await getBibleVerse('philippians 4:13');
      response += `Remember: "${verse.text}"\n\n`;
    } catch (error) {
      response += '"I can do all things through Christ who strengthens me." - Philippians 4:13\n\n';
    }
    
    response += "Let's break this down: What's one small step you can take today? ";
    response += "Sometimes the bravest thing is showing up, even when you don't feel like it.";
    
  } else {
    response += "That's the spirit! ";
    
    if (context.habitStreak > 0) {
      response += "Your " + context.habitStreak + "-day streak shows real discipline. ";
    }
    
    response += "Keep building that momentum - consistency compounds over time. ";
  }
  
  return response;
}

// Smart scripture response
async function generateScriptureResponse(context, sentiment) {
  let response = "Here's a verse that might speak to where you are today:\n\n";
  
  try {
    let reference = 'john 3:16'; // Default
    
    // Match verse to context
    if (sentiment.score_tag === 'NEGATIVE') {
      reference = 'isaiah 40:31'; // They that wait upon the Lord
    } else if (context.lastWorkout && context.lastWorkout.completed) {
      reference = 'philippians 3:14'; // Press toward the mark
    } else if (context.prayerStreak > 0) {
      reference = 'jeremiah 29:11'; // Plans for welfare
    }
    
    const verse = await getBibleVerse(reference);
    response += `"${verse.text}"\n`;
    response += `- ${verse.reference}\n\n`;
    
    // Add personal application
    if (sentiment.score_tag === 'NEGATIVE') {
      response += "When you're feeling weak, remember that God's strength shows up in your weakness.";
    } else {
      response += "Let this truth fuel your next step today.";
    }
    
  } catch (error) {
    response += '"Trust in the LORD with all your heart and lean not on your own understanding." - Proverbs 3:5\n\n';
    response += "Sometimes we need to trust more than we understand.";
  }
  
  return response;
}

// Progress analysis response
function generateProgressResponse(context) {
  let response = "Let's review your progress:\n\n";
  
  response += `📊 XP: ${context.xp} (Level ${context.level})\n`;
  response += `🔥 Habit Streak: ${context.habitStreak} days\n`;
  response += `🙏 Prayer Streak: ${context.prayerStreak} days\n\n`;
  
  // Analyze patterns
  const completedHabits = Object.values(context.dailyHabits).filter(Boolean).length;
  const totalHabits = context.customHabits.length || 4;
  
  if (completedHabits === totalHabits) {
    response += "🎉 Perfect day! You're building real consistency. ";
  } else if (completedHabits > 0) {
    response += "💪 Good progress today! ";
  } else {
    response += "🌱 Every journey starts with a single step. ";
  }
  
  // Challenge status
  if (context.todayChallenge) {
    if (context.todayChallenge.completed) {
      response += "✅ Challenge completed - that's the discipline that changes lives!";
    } else if (context.todayChallenge.committed) {
      response += "🎯 You've committed to today's challenge. Remember: done > perfect.";
    }
  }
  
  response += "\n\nKeep showing up - that's where transformation happens.";
  
  return response;
}

// General conversation with context awareness
async function generateGeneralResponse(userInput, sentiment, context, weather) {
  let response = "";
  
  // Acknowledge sentiment
  if (sentiment.score_tag === 'POSITIVE') {
    response += "I love hearing that positive energy! ";
  } else if (sentiment.score_tag === 'NEGATIVE') {
    response += "I hear you, and that's okay. ";
  }
  
  // Add context-aware insights
  if (context.habitStreak > 5) {
    response += "Your consistency is inspiring. ";
  }
  
  if (weather.current_weather) {
    const temp = weather.current_weather.temperature;
    if (temp > 80) {
      response += "Stay hydrated in this heat! ";
    } else if (temp < 60) {
      response += "Bundle up and keep moving! ";
    }
  }
  
  // Provide helpful response based on input
  if (userInput.includes('help') || userInput.includes('what can you do')) {
    response += "\n\nI can help with:\n";
    response += "💪 Workout planning (adjusted for weather & your history)\n";
    response += "📖 Scripture encouragement\n";
    response += "📊 Progress tracking & insights\n";
    response += "🙏 Prayer guidance\n";
    response += "🎯 Habit & challenge support\n\n";
    response += "What would you like to focus on today?";
  } else {
    response += "I'm here to support your faith-driven growth journey. ";
    response += "Whether you need workout guidance, spiritual encouragement, or just someone to talk to - I've got you. ";
    response += "What's on your mind?";
  }
  
  return response;
}

function logSleep(hours) {
  const memory = getNadirMemory();
  if (!memory.sleepHistory) memory.sleepHistory = [];
  memory.sleepHistory.push({
    date: new Date().toISOString(),
    hours
  });
  if (memory.sleepHistory.length > 30) memory.sleepHistory.shift();
  saveNadirMemory(memory);
}

function analyzePatterns() {
  const memory = getNadirMemory();
  const analysis = {};

  // Workout consistency
  if (memory.workoutHistory) {
    const recent = memory.workoutHistory.slice(-7);
    analysis.recentCompletionRate = recent.filter(w => w.completed).length / recent.length;
    analysis.missedWorkouts = recent.filter(w => !w.completed).length;
  }

  // Energy patterns
  if (memory.energyHistory) {
    const recentEnergy = memory.energyHistory.slice(-7);
    analysis.avgEnergy = recentEnergy.reduce((sum, e) => sum + e.level, 0) / recentEnergy.length;
    analysis.lowEnergyDays = recentEnergy.filter(e => e.level < 5).length;
  }

  // Sleep correlation
  if (memory.sleepHistory && memory.workoutHistory) {
    const sleepWorkoutPairs = [];
    memory.sleepHistory.forEach(sleep => {
      const workout = memory.workoutHistory.find(w =>
        new Date(w.date).toDateString() === new Date(sleep.date).toDateString()
      );
      if (workout) sleepWorkoutPairs.push({ sleep: sleep.hours, completed: workout.completed });
    });
    if (sleepWorkoutPairs.length > 3) {
      const lowSleepMissed = sleepWorkoutPairs.filter(p => p.sleep < 7 && !p.completed).length;
      analysis.sleepWorkoutCorrelation = lowSleepMissed / sleepWorkoutPairs.length;
    }
  }

  return analysis;
}

// Load or initialize stats from users data
let currentUser = getCurrentUser();
let users = getUsers();
let xp = currentUser && users[currentUser] ? users[currentUser].xp || 0 : 0;
let level = currentUser && users[currentUser] ? users[currentUser].level || 1 : 1;
let streak = currentUser && users[currentUser] ? users[currentUser].streak || 0 : 0;
let timerInterval;

function saveStats() {
  if (!currentUser) return;
  users = getUsers();
  if (!users[currentUser]) users[currentUser] = {};
  users[currentUser].xp = xp;
  users[currentUser].level = level;
  users[currentUser].streak = streak;
  saveUsers(users);
}

function updateStatsDisplay() {
  currentUser = getCurrentUser();
  users = getUsers();
  xp = currentUser && users[currentUser] ? users[currentUser].xp || 0 : 0;
  level = currentUser && users[currentUser] ? users[currentUser].level || 1 : 1;
  streak = currentUser && users[currentUser] ? users[currentUser].streak || 0 : 0;

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
  // Log workout completion
  logWorkout(true, 'general', 25); // Assume 25 min default
}

function startTimer(durationSeconds = 25 * 60) {
  let timeLeft = durationSeconds;
  let totalTime = durationSeconds;
  let timerEl = document.getElementById("timer");
  let progressBar = document.getElementById("timerProgress");
  if (!timerEl) return;

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    let minutes = Math.floor(timeLeft / 60);
    let seconds = timeLeft % 60;
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Update progress bar
    if (progressBar) {
      let progress = ((totalTime - timeLeft) / totalTime) * 100;
      progressBar.style.width = `${progress}%`;
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerEl.textContent = "Done!";
      if (progressBar) progressBar.style.width = "100%";
      xp += 25;
      saveStats();
      updateStatsDisplay();
      
      // Grow the plant for completed focus session
      growPlant();
      // Log focus session as a type of workout/activity
      logWorkout(true, 'focus', durationSeconds / 60);
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
  const currentUser = getCurrentUser();
  const users = getUsers();
  const userData = currentUser && users[currentUser] ? users[currentUser] : {xp: 0, level: 1, streak: 0};
  const xpValue = userData.xp || 0;
  const levelValue = userData.level || 1;
  const streakValue = userData.streak || 0;

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
window.addEventListener("DOMContentLoaded", function() {
  // Require login for all pages except login.html
  if (!window.location.pathname.includes('login.html') && !getCurrentUser()) {
    window.location.href = 'login.html';
    return;
  }
  updateStatsDisplay();
  updateNav();
  initializeNadir();
});

function updateNav() {
  const currentUser = getCurrentUser();
  const navs = document.querySelectorAll('nav');
  navs.forEach(nav => {
    const loginLink = nav.querySelector('a[href="login.html"]');
    if (currentUser) {
      if (loginLink) {
        loginLink.textContent = `Logout (${currentUser})`;
        loginLink.href = '#';
        loginLink.onclick = function(e) {
          e.preventDefault();
          logout();
        };
      }
    } else {
      if (loginLink) {
        loginLink.textContent = 'Login';
        loginLink.href = 'login.html';
        loginLink.onclick = null;
      }
    }
  });
}

function logout() {
  localStorage.removeItem('currentUser');
  location.reload();
}

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
  const today = new Date().toDateString();
  const lastLogin = localStorage.getItem('lastLoginDate');

  // If it's a new day, reset habits and update streak
  if (lastLogin !== today) {
    resetDailyHabits();
  }

  // Update today's habits
  const dailyHabits = JSON.parse(localStorage.getItem('dailyHabits') || '{}');
  dailyHabits[`habit${id}`] = habit.checked;
  localStorage.setItem('dailyHabits', JSON.stringify(dailyHabits));

  // Update streak
  updateHabitStreak();

  // Award XP for completing habit
  if (habit.checked) {
    xp += 5;
    saveStats();
    updateStatsDisplay();
  }
}

function resetDailyHabits() {
  const today = new Date().toDateString();
  
  // Check if yesterday's habits were completed for streak
  const yesterdayHabits = JSON.parse(localStorage.getItem('dailyHabits') || '{}');
  const completedYesterday = Object.values(yesterdayHabits).every(completed => completed);

  let currentStreak = parseInt(localStorage.getItem('habitStreak') || '0');
  if (completedYesterday && Object.keys(yesterdayHabits).length > 0) {
    currentStreak++;
  } else if (Object.keys(yesterdayHabits).length > 0) {
    currentStreak = 0; // Reset streak if yesterday wasn't complete
  }

  localStorage.setItem('habitStreak', currentStreak);
  localStorage.setItem('lastLoginDate', today);
  localStorage.setItem('dailyHabits', JSON.stringify({})); // Reset daily habits
  
  // Reset all checkboxes
  loadHabits();
}

function updateHabitStreak() {
  const streakEl = document.getElementById('habitStreak');
  const streak = parseInt(localStorage.getItem('habitStreak') || '0');
  if (streakEl) {
    streakEl.textContent = `Streak: ${streak} days`;
  }
}

function addCustomHabit() {
  const input = document.getElementById('newHabitInput');
  const habitText = input.value.trim();
  
  if (habitText) {
    const customHabits = JSON.parse(localStorage.getItem('customHabits') || '[]');
    const habitId = Date.now();
    
    customHabits.push({
      id: habitId,
      text: habitText,
      created: new Date().toISOString()
    });
    
    localStorage.setItem('customHabits', JSON.stringify(customHabits));
    input.value = '';
    loadHabits();
  }
}

function loadHabits() {
  const habitList = document.getElementById('habitList');
  if (!habitList) return;
  
  const customHabits = JSON.parse(localStorage.getItem('customHabits') || '[]');
  const dailyHabits = JSON.parse(localStorage.getItem('dailyHabits') || '{}');
  
  // Default habits if no custom ones
  const defaultHabits = [
    { id: 'default1', text: 'Workout Completed' },
    { id: 'default2', text: 'Read Scripture' },
    { id: 'default3', text: 'Hydrate (8+ glasses)' },
    { id: 'default4', text: 'Focus Session' }
  ];
  
  const allHabits = customHabits.length > 0 ? customHabits : defaultHabits;
  
  habitList.innerHTML = allHabits.map(habit => `
    <div class="habit-item">
      <input type="checkbox" id="habit${habit.id}" 
             onclick="checkHabit('${habit.id}'); event.stopPropagation()" 
             ${dailyHabits[`habit${habit.id}`] ? 'checked' : ''}>
      <label for="habit${habit.id}">${habit.text}</label>
      ${customHabits.some(h => h.id === habit.id) ? 
        `<button onclick="removeHabit(${habit.id})" style="margin-left: auto; background: none; border: none; color: var(--accent-rose); cursor: pointer;">×</button>` : 
        ''}
    </div>
  `).join('');
  
  updateHabitStreak();
}

function removeHabit(habitId) {
  const customHabits = JSON.parse(localStorage.getItem('customHabits') || '[]');
  const updatedHabits = customHabits.filter(habit => habit.id !== habitId);
  localStorage.setItem('customHabits', JSON.stringify(updatedHabits));
  
  // Remove from daily habits if exists
  const dailyHabits = JSON.parse(localStorage.getItem('dailyHabits') || '{}');
  delete dailyHabits[`habit${habitId}`];
  localStorage.setItem('dailyHabits', JSON.stringify(dailyHabits));
  
  loadHabits();
}

function addGoal() {
  const goal = document.getElementById('goalInput').value;
  const list = document.getElementById('goalList');
  if (goal.trim()) {
    const goalId = Date.now();
    const goalItem = document.createElement('div');
    goalItem.className = 'goal-item';
    goalItem.innerHTML = `
      <input type="checkbox" id="goal-${goalId}" onchange="completeGoal(${goalId})">
      <label for="goal-${goalId}">${goal}</label>
    `;
    list.appendChild(goalItem);
    document.getElementById('goalInput').value = '';
    saveGoals();
  }
}

function completeGoal(goalId) {
  const checkbox = document.getElementById(`goal-${goalId}`);
  const label = checkbox.nextElementSibling;
  if (checkbox.checked) {
    // Mark as completed and remove after animation
    label.style.textDecoration = 'line-through';
    label.style.opacity = '0.5';
    setTimeout(() => {
      checkbox.parentElement.remove();
      saveGoals();
      // Generate a new goal to replace it
      generateSingleGoal();
    }, 1000);
  }
}

function generateGoals() {
  const list = document.getElementById('goalList');
  const goalTemplates = [
    "Read scripture for 10 minutes daily",
    "Exercise for 30 minutes, 4 days this week",
    "Drink 8 glasses of water daily",
    "Meditate for 5 minutes each morning",
    "Write down 3 things I'm grateful for",
    "Learn one new thing about faith today",
    "Help someone in need this week",
    "Spend quality time with family",
    "Practice a new skill for 20 minutes",
    "Plan healthy meals for tomorrow",
    "Get 7-8 hours of sleep tonight",
    "Take a 10-minute walk outside",
    "Journal about your day",
    "Pray for guidance and wisdom",
    "Connect with a friend or mentor"
  ];

  // Clear existing goals and add 3-5 new ones
  list.innerHTML = '';
  const numGoals = Math.floor(Math.random() * 3) + 3; // 3-5 goals
  const shuffled = goalTemplates.sort(() => 0.5 - Math.random());

  for (let i = 0; i < numGoals; i++) {
    const goalId = Date.now() + i;
    const goalItem = document.createElement('div');
    goalItem.className = 'goal-item';
    goalItem.innerHTML = `
      <input type="checkbox" id="goal-${goalId}" onchange="completeGoal(${goalId})">
      <label for="goal-${goalId}">${shuffled[i]}</label>
    `;
    list.appendChild(goalItem);
  }
  saveGoals();
}

function generateSingleGoal() {
  const goalTemplates = [
    "Read scripture for 10 minutes daily",
    "Exercise for 30 minutes, 4 days this week",
    "Drink 8 glasses of water daily",
    "Meditate for 5 minutes each morning",
    "Write down 3 things I'm grateful for",
    "Learn one new thing about faith today",
    "Help someone in need this week",
    "Spend quality time with family",
    "Practice a new skill for 20 minutes",
    "Plan healthy meals for tomorrow",
    "Get 7-8 hours of sleep tonight",
    "Take a 10-minute walk outside",
    "Journal about your day",
    "Pray for guidance and wisdom",
    "Connect with a friend or mentor"
  ];

  const list = document.getElementById('goalList');
  const randomGoal = goalTemplates[Math.floor(Math.random() * goalTemplates.length)];
  const goalId = Date.now();
  const goalItem = document.createElement('div');
  goalItem.className = 'goal-item';
  goalItem.innerHTML = `
    <input type="checkbox" id="goal-${goalId}" onchange="completeGoal(${goalId})">
    <label for="goal-${goalId}">${randomGoal}</label>
  `;
  list.appendChild(goalItem);
  saveGoals();
}

function saveGoals() {
  const goals = [];
  const goalItems = document.querySelectorAll('.goal-item');
  goalItems.forEach(item => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    const label = item.querySelector('label');
    if (checkbox && label) {
      goals.push({
        id: checkbox.id,
        text: label.textContent,
        completed: checkbox.checked
      });
    }
  });
  localStorage.setItem('userGoals', JSON.stringify(goals));
}

// Initialize theme and song of day
window.addEventListener("DOMContentLoaded", () => {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') toggleTheme();
  loadTheme(); // Load custom theme colors
  loadSongOfDay();
});

function performSearch() {
  const query = document.getElementById('globalSearch').value.toLowerCase().trim();
  if (!query) {
    alert('Please enter a search term');
    return;
  }

  const results = [];

  // Search through quotes
  if (query.includes('motivation') || query.includes('quote') || query.includes('inspire')) {
    results.push('💪 Motivation quotes from Quotable API - Click any motivation card');
  }

  // Search through scripture
  if (query.includes('bible') || query.includes('scripture') || query.includes('verse') || query.includes('god')) {
    results.push('📖 Daily Scripture from Bible API - Click the Scripture card');
  }

  // Search through workouts
  if (query.includes('workout') || query.includes('exercise') || query.includes('fitness') || query.includes('train')) {
    results.push('🏋️ Exercise Generator from ExerciseDB API - Click the Workout card');
    results.push('🎥 Guided Workouts - Expand the Workout card');
  }

  // Search through music
  if (query.includes('music') || query.includes('song') || query.includes('spotify') || query.includes('playlist')) {
    results.push('🎵 Music Library with Spotify playlists - Click the Music card');
  }

  // Search through focus tools
  if (query.includes('focus') || query.includes('timer') || query.includes('pomodoro') || query.includes('study')) {
    results.push('⏰ Pomodoro Timer - Click the Focus card');
    results.push('🎯 15-second Challenges - Expand the Challenges card');
  }

  // Search through library
  if (query.includes('library') || query.includes('video') || query.includes('training')) {
    results.push('📚 Training Library with workout videos - Click the Library card');
  }

  // Search through community
  if (query.includes('community') || query.includes('feed') || query.includes('social')) {
    results.push('📱 Community Feed - Click the Community Feed card');
  }

  // Search through AI
  if (query.includes('ai') || query.includes('nadir') || query.includes('chat') || query.includes('help')) {
    results.push('🤖 NADIR AI Assistant - Use the chat in the sidebar');
  }

  // Search through GitHub
  if (query.includes('github') || query.includes('code') || query.includes('programming')) {
    results.push('💻 GitHub Stats - Click the GitHub card');
  }

  // Search through email
  if (query.includes('email') || query.includes('newsletter') || query.includes('subscribe')) {
    results.push('📧 Email Notifications - Click the Email card');
  }

  // Search through settings
  if (query.includes('setting') || query.includes('theme') || query.includes('profile') || query.includes('customize')) {
    results.push('⚙️ Settings - Click Settings in the navigation');
  }

  // Search through progress
  if (query.includes('progress') || query.includes('stats') || query.includes('xp') || query.includes('level')) {
    results.push('📊 Progress Tracking - Click Progress in the navigation');
  }

  // Show results
  if (results.length > 0) {
    const resultText = '🔍 Search Results:\n\n' + results.join('\n\n');
    alert(resultText);
  } else {
    alert('🔍 No results found for "' + query + '". Try searching for: motivation, workout, music, focus, ai, settings, etc.');
  }
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
  const workoutsCompleted = parseInt(localStorage.getItem('workoutsCompleted')) || 0;
  const scripturesRead = parseInt(localStorage.getItem('scripturesRead')) || 0;
  const focusSessions = parseInt(localStorage.getItem('focusSessions')) || 0;

  let recommendations = [];

  if (workoutsCompleted > 5) {
    recommendations.push('🏋️ Whey protein isolate for muscle recovery');
    recommendations.push('💪 Resistance bands for home workouts');
    recommendations.push('🧘 Foam roller for recovery');
  } else {
    recommendations.push('🎯 Beginner workout guide book');
    recommendations.push('🥤 Shaker bottle for protein shakes');
  }

  if (scripturesRead > 3) {
    recommendations.push('📖 "Jesus Calling" devotional book');
    recommendations.push('🙏 Prayer journal for daily reflection');
  } else {
    recommendations.push('📚 Study Bible with commentary');
    recommendations.push('✨ Faith-based planner');
  }

  if (focusSessions > 7) {
    recommendations.push('🎧 Noise-cancelling headphones');
    recommendations.push('☕ Focus-enhancing supplements');
  } else {
    recommendations.push('⏰ Pomodoro timer app');
    recommendations.push('📝 Productivity journal');
  }

  // Add some general recommendations
  recommendations.push('💧 Reusable water bottle');
  recommendations.push('🎵 Christian worship music subscription');

  recs.innerHTML = '<p>Based on your activity:</p><ul>' +
    recommendations.map(rec => `<li>${rec}</li>`).join('') +
    '</ul><p><em>These are general suggestions. Consult professionals for health/fitness advice.</em></p>';
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

// ===== DAILY CHALLENGES =====
function newChallenge() {
  const challenges = [
    "Complete a 10-minute meditation focusing on gratitude",
    "Write down 3 things you're thankful for today",
    "Do 50 push-ups throughout the day (break them up)",
    "Read one chapter from a personal development book",
    "Call a friend or family member you haven't spoken to in a while",
    "Spend 15 minutes in prayer, focusing on your goals",
    "Try a new healthy recipe for dinner",
    "Go for a 20-minute walk outside, no phone",
    "Write a letter to your future self (what you want to achieve)",
    "Practice a random act of kindness for someone today",
    "Spend 10 minutes stretching and breathing exercises",
    "Journal about one thing that challenged you this week and how you grew from it",
    "Learn something new - watch an educational video or read an article",
    "Hydrate properly - aim for 8 glasses of water today",
    "Do one thing that scares you a little bit today",
    "Spend quality time with loved ones without distractions",
    "Reflect on your progress - what worked well this week?",
    "Set a small goal for tomorrow and plan how to achieve it",
    "Practice positive affirmations - write 5 things you love about yourself",
    "Disconnect from social media for 2 hours today"
  ];
  
  const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
  const challengeText = document.getElementById('challengeText');
  if (challengeText) {
    challengeText.textContent = randomChallenge;
    // Reset commitment status when getting new challenge
    updateChallengeStatus();
  }
}

function commitToChallenge() {
  const today = new Date().toDateString();
  const committedChallenges = JSON.parse(localStorage.getItem('committedChallenges') || '{}');
  
  if (!committedChallenges[today]) {
    committedChallenges[today] = {
      challenge: document.getElementById('challengeText').textContent,
      committed: true,
      completed: false,
      committedAt: new Date().toISOString()
    };
    localStorage.setItem('committedChallenges', JSON.stringify(committedChallenges));
    
    // Award XP for committing
    xp += 10;
    saveStats();
    updateStatsDisplay();
    
    updateChallengeStatus();
  }
}

function completeChallenge() {
  const today = new Date().toDateString();
  const committedChallenges = JSON.parse(localStorage.getItem('committedChallenges') || '{}');
  
  if (committedChallenges[today] && !committedChallenges[today].completed) {
    committedChallenges[today].completed = true;
    committedChallenges[today].completedAt = new Date().toISOString();
    localStorage.setItem('committedChallenges', JSON.stringify(committedChallenges));
    
    // Award XP for completing
    xp += 25;
    saveStats();
    updateStatsDisplay();
    
    updateChallengeStatus();
  }
}

function updateChallengeStatus() {
  const today = new Date().toDateString();
  const committedChallenges = JSON.parse(localStorage.getItem('committedChallenges') || '{}');
  const statusDiv = document.getElementById('challengeStatus');
  const commitBtn = document.getElementById('commitBtn');
  
  if (!statusDiv || !commitBtn) return;
  
  const todayChallenge = committedChallenges[today];
  
  if (!todayChallenge) {
    statusDiv.textContent = "Click 'Commit' to take on this challenge today";
    statusDiv.style.color = "var(--text-muted)";
    commitBtn.textContent = "Commit to Challenge";
    commitBtn.onclick = commitToChallenge;
    commitBtn.style.background = "";
  } else if (todayChallenge.committed && !todayChallenge.completed) {
    statusDiv.textContent = "✅ Committed! Complete it to earn 25 XP";
    statusDiv.style.color = "var(--accent-gold)";
    commitBtn.textContent = "Mark Complete";
    commitBtn.onclick = completeChallenge;
    commitBtn.style.background = "linear-gradient(135deg, var(--accent-gold), var(--accent-rose))";
  } else if (todayChallenge.completed) {
    statusDiv.textContent = "🎉 Completed! Great job!";
    statusDiv.style.color = "var(--accent-cyan)";
    commitBtn.textContent = "Challenge Done";
    commitBtn.disabled = true;
    commitBtn.style.opacity = "0.6";
  }
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
    },
    'sunset-blaze': {
      '--primary-dark': '#2D1B1B',
      '--accent-gold': '#FF6B35'
    },
    'arctic-aurora': {
      '--primary-dark': '#0F1419',
      '--accent-gold': '#00FF88'
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

function logWater() {
  const glasses = parseInt(document.getElementById('waterInput').value) || 0;
  localStorage.setItem('dailyWater', glasses);
  updateWaterProgress();
  document.getElementById('waterInput').value = '';
}

function toggleNadir() {
  const sidebar = document.getElementById('nadir-sidebar');
  sidebar.classList.toggle('show');
}

function setNadirTone(tone) {
  localStorage.setItem('nadirFaithTone', tone);
  const toneSelect = document.getElementById('faithTone');
  if (toneSelect) toneSelect.value = tone;
  addChatMessage(`Faith tone set to ${tone}.`, 'nadir');
}

function getNadirTone() {
  return localStorage.getItem('nadirFaithTone') || 'Christian';
}

function addChatMessage(text, sender = 'nadir', isPlaceholder = false) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return null;
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${sender === 'user' ? 'user-message' : 'nadir-message'}`;
  if (isPlaceholder) messageDiv.classList.add('placeholder');
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageDiv;
}

function getNadirSystemPrompt() {
  const tone = getNadirTone();
  const memory = getNadirMemory();
  const analysis = analyzePatterns();

  let context = `You are NADIR, an intelligent AI coach for faith and fitness. You have long-term memory and can reason, adapt, and care. Speak with warmth, encouragement, and respect. Use a ${tone} tone.

PRINCIPLES TO FOLLOW:
- Consistency beats intensity: Focus on sustainable habits over extreme efforts.
- Rest is productive: Recovery builds strength, not just workouts.
- Shame never improves adherence: Use grace and encouragement after setbacks.
- The body is to care for, not punish: Promote stewardship and self-compassion.
- Small wins compound: Celebrate progress, not perfection.
- Faith and fitness grow together: Connect physical discipline with spiritual growth.

MEMORY AND PATTERNS:
- Fitness level: ${memory.fitnessLevel || 'Unknown'}
- Injuries/concerns: ${memory.injuries || 'None noted'}
- Preferred workout times: ${memory.preferredTimes || 'Flexible'}
- Faith preferences: ${memory.faithPrefs || 'Balanced'}
- Recent workout completion rate: ${(analysis.recentCompletionRate * 100 || 0).toFixed(0)}%
- Average energy level: ${analysis.avgEnergy ? analysis.avgEnergy.toFixed(1) : 'Unknown'}
- Missed workouts this week: ${analysis.missedWorkouts || 0}
- Low energy days: ${analysis.lowEnergyDays || 0}
- Sleep-workout correlation: ${analysis.sleepWorkoutCorrelation ? (analysis.sleepWorkoutCorrelation * 100).toFixed(0) + '%' : 'Unknown'}

REASONING GUIDELINES:
- Infer from patterns: If user mentions fatigue, check energy history. If they skip workouts, consider sleep or stress.
- Adapt plans: Reduce intensity after missed sessions, increase after consistency streaks.
- Be proactive: Suggest actions based on data, not just responses.
- Explain decisions: Always explain why you're recommending something.
- Combine domains: Link fitness logic with behavioral psychology and faith values.

RESPONSE STYLE:
- Keep responses 1-3 sentences, actionable, and encouraging.
- Use memory to personalize: Reference past patterns or preferences.
- If data suggests issues, address them gently with solutions.
- End with a question or next step to continue engagement.`;

  return context;
}

async function nadirAI() {
  // Use the new smart NADIR AI with API integrations
  await smartNadirAI();
}

  /* OLD NADIR CODE - COMMENTED OUT
  // Log the interaction
  const memory = getNadirMemory();
  if (!memory.interactions) memory.interactions = [];
  memory.interactions.push({
    date: new Date().toISOString(),
    input,
    type: 'user_message'
  });
  if (memory.interactions.length > 50) memory.interactions.shift();
  saveNadirMemory(memory);

  try {
    const GROQ_API_KEY = 'secret';
    if (!GROQ_API_KEY || GROQ_API_KEY === 'YOUR_GROQ_API_KEY') {
      provideFallbackResponse(input, pending);
      return;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          { role: 'system', content: getNadirSystemPrompt() },
          { role: 'user', content: input }
        ],
        max_tokens: 200
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const reply = data.choices[0].message.content.trim();
      if (pending) {
        pending.textContent = reply;
        pending.classList.remove('placeholder');
      } else {
        addChatMessage(reply, 'nadir');
      }

      // Log the response
      const memory = getNadirMemory();
      memory.interactions[memory.interactions.length - 1].response = reply;
      saveNadirMemory(memory);

      return;
    }

    provideFallbackResponse(input, pending);
  } catch (error) {
    provideFallbackResponse(input, pending);
  }
}

function provideFallbackResponse(input, placeholderMessage = null) {
  let reply = '';
  const normalized = input.toLowerCase();

  if (normalized.includes('workout') || normalized.includes('exercise') || normalized.includes('fitness')) {
    reply = 'Try a balanced routine with warm-up, strength moves, and recovery stretches. Start with your pace and build consistency over time.';
  } else if (normalized.includes('injury') || normalized.includes('pain') || normalized.includes('knees') || normalized.includes('back')) {
    reply = 'Listen to your body, reduce intensity, and choose pain-free variations. If discomfort continues, seek professional guidance.';
  } else if (normalized.includes('faith') || normalized.includes('pray') || normalized.includes('scripture')) {
    reply = 'Faith and fitness grow together when you stay consistent, grateful, and patient. Take a moment to reflect and center your heart.';
  } else if (normalized.includes('consistency') || normalized.includes('routine') || normalized.includes('habit')) {
    reply = 'Small daily actions add up. Focus on a simple habit today, and celebrate the progress it creates.';
  } else if (normalized.includes('rest') || normalized.includes('recover') || normalized.includes('sleep')) {
    reply = 'Rest is part of growth. Give your body time to recover, hydrate well, and allow your mind to reflect.';
  } else if (normalized.includes('motivation') || normalized.includes('encouragement')) {
    reply = 'You are making a strong choice by showing up. Keep going one step at a time, and remember: progress is steady, not perfect.';
  } else {
    reply = 'I’m here to help with safe workouts, faith-friendly encouragement, and daily consistency. Ask me for a beginner routine, a reflection prompt, or recovery tips.';
  }

  if (placeholderMessage) {
    placeholderMessage.textContent = reply;
    placeholderMessage.classList.remove('placeholder');
  } else {
    addChatMessage(reply, 'nadir');
  }
}

function generateProactiveSuggestion() {
  const analysis = analyzePatterns();
  const memory = getNadirMemory();
  const lastWorkout = memory.workoutHistory ? memory.workoutHistory[memory.workoutHistory.length - 1] : null;
  const daysSinceLast = lastWorkout ? Math.floor((new Date() - new Date(lastWorkout.date)) / (1000 * 60 * 60 * 24)) : null;

  let suggestion = '';

  if (analysis.missedWorkouts >= 2) {
    suggestion = `You've missed ${analysis.missedWorkouts} workouts this week. Based on your patterns, this often happens with stress or low energy. How about a gentle recovery session today to get back on track?`;
  } else if (analysis.lowEnergyDays >= 3) {
    suggestion = `Your energy has been low lately. Rest is productive—consider a lighter activity today, like walking or stretching, to care for your body as stewardship.`;
  } else if (analysis.recentCompletionRate >= 0.8 && daysSinceLast === 0) {
    suggestion = `Great consistency! You've completed workouts ${Math.round(analysis.recentCompletionRate * 100)}% of the time recently. Want to build on this momentum with a faith-focused reflection after your next session?`;
  } else if (daysSinceLast >= 2) {
    suggestion = `It's been ${daysSinceLast} days since your last workout. Small steps matter—start with 10 minutes today to maintain your habit without pressure.`;
  } else if (analysis.sleepWorkoutCorrelation > 0.5) {
    suggestion = `I've noticed your workouts often correlate with sleep quality. Prioritizing rest tonight could set you up for a stronger session tomorrow.`;
  } else {
    suggestion = `Welcome back! Based on your recent activity, you're building good habits. What's one small win you'd like to focus on today—fitness, faith, or both?`;
  }

  return suggestion;
}

function initializeNadir() {
  const toneSelect = document.getElementById('faithTone');
  if (toneSelect) toneSelect.value = getNadirTone();
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages && chatMessages.children.length === 0) {
    addChatMessage('Hi! I’m NADIR, your faith-friendly fitness companion. Ask me for a safe workout plan, a short reflection, or a daily structure to stay consistent.', 'nadir');
    addChatMessage('Try: “Give me a 20-minute beginner workout” or “Help me build a faith and fitness routine for the week.”', 'nadir');
  }
  const inputEl = document.getElementById('userInput');
  if (inputEl) {
    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        nadirAI();
      }
    });
  }
}

/* QUOTES API (Quotable.io) */
async function newQuote() {
  try {
    const response = await fetch('https://api.quotable.io/random?tags=motivational');
    const data = await response.json();
    const quoteElement = document.getElementById("quoteText");
    const authorElement = document.getElementById("quoteAuthor");
    if (quoteElement) {
      quoteElement.innerText = `"${data.content}"`;
    }
    if (authorElement) {
      authorElement.innerText = `— ${data.author}`;
    }
  } catch (error) {
    const quotes = [
      "The only competition you have is yourself.",
      "Discipline beats motivation.",
      "Consistency creates greatness.",
      "Faith over fear.",
      "No excuses. Just results.",
      "Your body can do it. It's your mind you have to convince.",
      "The pain you feel today will be the strength you feel tomorrow.",
      "Success is the sum of small efforts repeated day in and day out.",
      "Don't stop when you're tired. Stop when you're done.",
      "The harder you work, the luckier you get.",
      "Champions keep playing until they get it right.",
      "Strength doesn't come from what you can do. It comes from overcoming the things you once thought you couldn't.",
      "The only way to do great work is to love what you do.",
      "Believe you can and you're halfway there.",
      "The future belongs to those who believe in the beauty of their dreams.",
      "You miss 100% of the shots you don't take.",
      "The best way to predict the future is to create it.",
      "Don't watch the clock; do what it does. Keep going.",
      "The only limit to our realization of tomorrow will be our doubts of today.",
      "What lies behind us and what lies before us are tiny matters compared to what lies within us.",
      "The journey of a thousand miles begins with one step.",
      "Quality is not an act, it is a habit.",
      "The difference between ordinary and extraordinary is that little extra.",
      "Success is not final, failure is not fatal: It is the courage to continue that counts.",
      "The way to get started is to quit talking and begin doing."
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    const quoteElement = document.getElementById("quoteText");
    if (quoteElement) {
      quoteElement.innerText = q;
    }
  }
}

/* OLD NADIR CODE - COMMENTED OUT */


async function getBibleVerse() {
  try {
    const books = ['John', 'Proverbs', 'Psalms', 'Joshua', 'Timothy'];
    const book = books[Math.floor(Math.random() * books.length)];
    const chapter = Math.floor(Math.random() * 10) + 1;
    const verse = Math.floor(Math.random() * 20) + 1;

    const response = await fetch(`https://bible-api.com/${book}%20${chapter}:${verse}?translation=kjv`);
    const data = await response.json();
    const verseElement = document.getElementById("verseText");
    const refElement = document.getElementById("verseRef");
    if (verseElement) {
      verseElement.innerText = data.text;
    }
    if (refElement) {
      refElement.innerText = data.reference;
    }
  } catch (error) {
    const fallbackVerses = [
      { text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.", reference: "Proverbs 3:5-6" },
      { text: "I can do all things through Christ who strengthens me.", reference: "Philippians 4:13" },
      { text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", reference: "Joshua 1:9" },
      { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", reference: "Jeremiah 29:11" },
      { text: "The Lord is my strength and my shield; my heart trusts in him, and he helps me. My heart leaps for joy, and with my song I praise him.", reference: "Psalm 28:7" },
      { text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.", reference: "Isaiah 40:31" },
      { text: "Therefore, since we are surrounded by such a great cloud of witnesses, let us throw off everything that hinders and the sin that so easily entangles. And let us run with perseverance the race marked out for us.", reference: "Hebrews 12:1" },
      { text: "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.", reference: "Galatians 6:9" },
      { text: "Commit to the Lord whatever you do, and he will establish your plans.", reference: "Proverbs 16:3" },
      { text: "The righteous person may have many troubles, but the Lord delivers him from them all.", reference: "Psalm 34:19" },
      { text: "When I am afraid, I put my trust in you.", reference: "Psalm 56:3" },
      { text: "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.", reference: "John 14:27" },
      { text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.", reference: "Romans 8:28" },
      { text: "Cast all your anxiety on him because he cares for you.", reference: "1 Peter 5:7" },
      { text: "The Lord is close to the brokenhearted and saves those who are crushed in spirit.", reference: "Psalm 34:18" }
    ];
    const randomVerse = fallbackVerses[Math.floor(Math.random() * fallbackVerses.length)];
    const verseElement = document.getElementById("verseText");
    const refElement = document.getElementById("verseRef");
    if (verseElement) {
      verseElement.innerText = randomVerse.text;
    }
    if (refElement) {
      refElement.innerText = randomVerse.reference;
    }
  }
}

/* MUSIC LIBRARY */
const musicLibrary = {
  focus: { url: "37i9dQZF1DX4PP3DA4J0N8", title: "Deep Focus", description: "Instrumental concentration tracks" },
  hype: { url: "37i9dQZF1DX76Wlfdnj7AP", title: "Beast Mode", description: "High-energy workout anthems" },
  worship: { url: "37i9dQZF1DXcfZ6moR6J0P", title: "Christian Worship", description: "Contemporary worship music" },
  lofi: { url: "37i9dQZF1DWWQRwui0ExPn", title: "Lo-Fi Beats", description: "Chill beats for relaxed focus" }
};

function loadMusic(type) {
  const player = document.getElementById("musicPlayer");
  const meta = document.getElementById("musicMeta");
  const results = document.getElementById("musicResults");
  const selected = musicLibrary[type] || musicLibrary.focus;

  if (player) {
    player.innerHTML = `<iframe style="border-radius:12px" src="https://open.spotify.com/embed/playlist/${selected.url}?utm_source=generator" width="100%" height="380" frameborder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
  }
  if (meta) {
    meta.innerHTML = `<strong>${selected.title}</strong><br>${selected.description}`;
  }
  if (results) {
    results.innerHTML = '';
  }
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

function newReflectionPrompt() {
  const prompts = [
    "What is one thing you did today that moved you closer to your goals?",
    "What challenged you today, and how did you overcome it?",
    "What is one thing you're grateful for today?",
    "How did you practice self-discipline today?",
    "What is one area where you grew today?",
    "How did faith play a role in your decisions today?",
    "What is one habit you want to strengthen tomorrow?",
    "How did you show kindness to yourself or others today?",
    "What is one thing you learned about yourself today?",
    "How did you stay focused and productive today?",
    "What is one goal you're excited about achieving?",
    "How did you balance work, rest, and play today?",
    "What is one way you honored your body today?",
    "How did you contribute to something bigger than yourself today?",
    "What is one thing you want to celebrate about yourself today?"
  ];
  
  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  const promptText = document.getElementById('promptText');
  if (promptText) {
    promptText.textContent = randomPrompt;
  }
}

function logPrayer() {
  const minutes = parseInt(document.getElementById('prayerInput').value) || 0;
  if (minutes > 0) {
    const today = new Date().toDateString();
    const prayerLog = JSON.parse(localStorage.getItem('prayerLog') || '{}');
    
    if (!prayerLog[today]) {
      prayerLog[today] = { minutes: 0, logged: false };
    }
    
    if (!prayerLog[today].logged) {
      prayerLog[today].minutes = minutes;
      prayerLog[today].logged = true;
      localStorage.setItem('prayerLog', JSON.stringify(prayerLog));
      
      // Update prayer streak
      updatePrayerStreak();
      
      // Award XP
      xp += Math.min(minutes, 30); // Max 30 XP per day
      saveStats();
      updateStatsDisplay();
      
      document.getElementById('prayerInput').value = '';
      alert(`Prayer time logged! +${Math.min(minutes, 30)} XP`);
    } else {
      alert('Prayer already logged for today.');
    }
  }
}

function updatePrayerStreak() {
  const prayerLog = JSON.parse(localStorage.getItem('prayerLog') || '{}');
  const streakEl = document.getElementById('prayerStreak');
  if (!streakEl) return;
  
  let streak = 0;
  const today = new Date();
  
  for (let i = 0; i < 30; i++) { // Check last 30 days
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = checkDate.toDateString();
    
    if (prayerLog[dateStr] && prayerLog[dateStr].logged) {
      streak++;
    } else {
      break; // Streak broken
    }
  }
  
  localStorage.setItem('prayerStreak', streak);
  streakEl.textContent = `Prayer Streak: ${streak} days`;
}

function getPrayerPrompt() {
  const prompts = [
    "Pray for strength to overcome today's challenges.",
    "Thank God for the blessings in your life.",
    "Pray for wisdom in your decision-making.",
    "Ask for guidance in your personal growth journey.",
    "Pray for the people you care about most.",
    "Reflect on how faith has shaped your day.",
    "Pray for patience and perseverance.",
    "Thank God for your health and ability to grow.",
    "Pray for clarity in your goals and purpose.",
    "Ask for peace in areas of uncertainty."
  ];
  
  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  const display = document.getElementById('prayerPromptDisplay');
  if (display) {
    display.textContent = randomPrompt;
  }
}

function showChart() {
  const chartDisplay = document.getElementById('chartDisplay');
  if (!chartDisplay) return;
  
  // Get progress data for the last 7 days
  const progressData = getProgressData(7);
  
  if (progressData.length === 0) {
    chartDisplay.innerHTML = '<p style="color: var(--text-muted);">No progress data yet. Start tracking habits and challenges!</p>';
    return;
  }
  
  // Create a simple ASCII chart
  let chart = '<div style="font-family: monospace; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; margin: 1rem 0;">';
  chart += '<h4 style="color: var(--accent-gold); margin-bottom: 1rem;">7-Day Progress Overview</h4>';
  
  // Show XP progression
  chart += '<div style="margin-bottom: 1rem;"><strong style="color: var(--accent-cyan);">XP Growth:</strong><br>';
  progressData.forEach(day => {
    const xpBar = '█'.repeat(Math.min(Math.floor(day.xp / 10), 20));
    chart += `${day.date}: ${xpBar} ${day.xp} XP<br>`;
  });
  chart += '</div>';
  
  // Show habit completion
  chart += '<div style="margin-bottom: 1rem;"><strong style="color: var(--accent-cyan);">Habits Completed:</strong><br>';
  progressData.forEach(day => {
    const habitBar = '█'.repeat(day.habitsCompleted);
    chart += `${day.date}: ${habitBar} ${day.habitsCompleted}/${day.totalHabits}<br>`;
  });
  chart += '</div>';
  
  // Show challenges
  chart += '<div><strong style="color: var(--accent-cyan);">Challenges:</strong><br>';
  progressData.forEach(day => {
    const status = day.challengeCompleted ? '✅' : (day.challengeCommitted ? '🔶' : '⬜');
    chart += `${day.date}: ${status} ${day.challengeCompleted ? 'Completed' : (day.challengeCommitted ? 'Committed' : 'None')}<br>`;
  });
  chart += '</div>';
  
  chart += '</div>';
  chartDisplay.innerHTML = chart;
}

function getProgressData(days) {
  const data = [];
  const committedChallenges = JSON.parse(localStorage.getItem('committedChallenges') || '{}');
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toDateString();
    const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Get XP for that day (this is approximate since we don't store daily XP)
    const xp = parseInt(localStorage.getItem('xp')) || 0;
    
    // Get habits completed that day
    const dailyHabits = JSON.parse(localStorage.getItem('dailyHabits') || '{}');
    const habitsCompleted = Object.values(dailyHabits).filter(Boolean).length;
    const totalHabits = Object.keys(dailyHabits).length || 4; // Default to 4 if no data
    
    // Get challenge status
    const challengeData = committedChallenges[dateStr] || {};
    const challengeCommitted = challengeData.committed || false;
    const challengeCompleted = challengeData.completed || false;
    
    data.push({
      date: shortDate,
      xp: xp,
      habitsCompleted: habitsCompleted,
      totalHabits: totalHabits,
      challengeCommitted: challengeCommitted,
      challengeCompleted: challengeCompleted
    });
  }
  
  return data;
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

function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

function growPlant() {
  const plant = document.getElementById('plantGrow');
  if (!plant) return;
  
  const growthStages = ['🌱', '🌿', '🌳', '🌲', '🌴'];
  let currentStage = localStorage.getItem('plantStage') || 0;
  currentStage = (parseInt(currentStage) + 1) % growthStages.length;
  
  plant.textContent = growthStages[currentStage];
  plant.classList.add('growing');
  
  localStorage.setItem('plantStage', currentStage);
  
  setTimeout(() => {
    plant.classList.remove('growing');
  }, 1000);
}

// ===== LOGIN FUNCTIONALITY =====

// Tab switching for login/signup
function initLoginPage() {
  // Tab switching
  const signinTab = document.getElementById("signinTab");
  const signupTab = document.getElementById("signupTab");
  const signinForm = document.getElementById("signinForm");
  const signupForm = document.getElementById("signupForm");

  if (signinTab && signupTab) {
    signinTab.addEventListener("click", function() {
      signinTab.classList.add("active");
      signupTab.classList.remove("active");
      signinForm.classList.remove("hidden");
      signupForm.classList.add("hidden");
    });

    signupTab.addEventListener("click", function() {
      signupTab.classList.add("active");
      signinTab.classList.remove("active");
      signupForm.classList.remove("hidden");
      signinForm.classList.add("hidden");
    });
  }

  // Forgot password link
  const forgotLink = document.getElementById("forgotPasswordLink");
  const resetSection = document.getElementById("resetSection");
  const backLink = document.getElementById("backToLoginLink");

  if (forgotLink && resetSection) {
    forgotLink.addEventListener("click", function(e) {
      e.preventDefault();
      signinForm.classList.add("hidden");
      resetSection.classList.remove("hidden");
      // Reset to first step
      document.getElementById("resetMethodStep").classList.remove("hidden");
      document.getElementById("resetCodeStep").classList.add("hidden");
      // Reset form fields
      document.getElementById("resetEmail").value = '';
      document.getElementById("resetPhone").value = '';
      document.getElementById("resetCode").value = '';
      document.getElementById("newPassword").value = '';
      document.getElementById("confirmNewPassword").value = '';
    });
  }

  if (backLink && resetSection) {
    backLink.addEventListener("click", function(e) {
      e.preventDefault();
      resetSection.classList.add("hidden");
      signinForm.classList.remove("hidden");
      // Reset to first step
      document.getElementById("resetMethodStep").classList.remove("hidden");
      document.getElementById("resetCodeStep").classList.add("hidden");
      // Reset form fields
      document.getElementById("resetEmail").value = '';
      document.getElementById("resetPhone").value = '';
      document.getElementById("resetCode").value = '';
      document.getElementById("newPassword").value = '';
      document.getElementById("confirmNewPassword").value = '';
    });
  }

  // Login form submission
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function(e) {
      e.preventDefault();
      const username = document.getElementById("signinUsername").value.trim();
      const password = document.getElementById("signinPassword").value.trim();

      if (!username || !password) {
        alert("Please enter both username and password.");
        return;
      }

      const users = getUsers();
      if (users[username] && users[username].password === password) {
        localStorage.setItem("currentUser", username);
        window.location.href = "index.html";
      } else {
        alert("Invalid username or password.");
      }
    });
  }

  // Register form submission
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", function(e) {
      e.preventDefault();
      const username = document.getElementById("signupUsername").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const phone = document.getElementById("signupPhone").value.trim();
      const password = document.getElementById("signupPassword").value.trim();
      const confirmPassword = document.getElementById("confirmPassword").value.trim();

      if (!username || !password) {
        alert("Please enter username and password.");
        return;
      }

      if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
      }

      const users = getUsers();
      if (users[username]) {
        alert("Username already exists.");
        return;
      }

      // Create new user
      users[username] = {
        password: password,
        email: email || null,
        phone: phone || null,
        xp: 0,
        level: 1,
        streak: 0,
        created: new Date().toISOString()
      };

      saveUsers(users);
      localStorage.setItem("currentUser", username);
      window.location.href = "index.html";
    });
  }

  // Password reset - Choose method
  const resetViaEmailBtn = document.getElementById("resetViaEmailBtn");
  const resetViaSmsBtn = document.getElementById("resetViaSmsBtn");
  const emailResetGroup = document.getElementById("emailResetGroup");
  const smsResetGroup = document.getElementById("smsResetGroup");
  const sendResetCodeBtn = document.getElementById("sendResetCodeBtn");
  
  if (resetViaEmailBtn && resetViaSmsBtn) {
    resetViaEmailBtn.addEventListener("click", function() {
      resetViaEmailBtn.classList.add("active");
      resetViaSmsBtn.classList.remove("active");
      emailResetGroup.classList.remove("hidden");
      smsResetGroup.classList.add("hidden");
    });

    resetViaSmsBtn.addEventListener("click", function() {
      resetViaSmsBtn.classList.add("active");
      resetViaEmailBtn.classList.remove("active");
      smsResetGroup.classList.remove("hidden");
      emailResetGroup.classList.add("hidden");
    });
  }

  // Send reset code
  if (sendResetCodeBtn) {
    sendResetCodeBtn.addEventListener("click", function() {
      const isEmailMethod = resetViaEmailBtn && resetViaEmailBtn.classList.contains("active");
      const resetEmail = document.getElementById("resetEmail").value.trim();
      const resetPhone = document.getElementById("resetPhone").value.trim();

      if (isEmailMethod && !resetEmail) {
        alert("Please enter your email address.");
        return;
      }

      if (!isEmailMethod && !resetPhone) {
        alert("Please enter your phone number.");
        return;
      }

      // Show success message (in real implementation, would send code)
      const method = isEmailMethod ? "email" : "SMS";
      const contact = isEmailMethod ? resetEmail : resetPhone;
      alert(`Reset code sent to ${method}: ${contact}`);

      // Transition to next step
      document.getElementById("resetMethodStep").classList.add("hidden");
      document.getElementById("resetCodeStep").classList.remove("hidden");
    });
  }

  // Password reset - Enter new password
  const resetBtn = document.getElementById("resetPasswordBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", function() {
      const resetCode = document.getElementById("resetCode").value.trim();
      const newPassword = document.getElementById("newPassword").value.trim();
      const confirmNewPassword = document.getElementById("confirmNewPassword").value.trim();

      if (!resetCode || !newPassword) {
        alert("Please enter reset code and new password.");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        alert("Passwords do not match.");
        return;
      }

      // For now, just show a message (real implementation would verify reset code)
      alert("Password reset functionality not fully implemented yet. Please contact support.");
      
      // Reset the form
      document.getElementById("resetCode").value = '';
      document.getElementById("newPassword").value = '';
      document.getElementById("confirmNewPassword").value = '';
      document.getElementById("resetEmail").value = '';
      document.getElementById("resetPhone").value = '';
      document.getElementById("resetMethodStep").classList.remove("hidden");
      document.getElementById("resetCodeStep").classList.add("hidden");
      signinForm.classList.remove("hidden");
      resetSection.classList.add("hidden");
    });
  }
}
// Initialize theme and song of day
window.addEventListener("DOMContentLoaded", () => {
  const theme = localStorage.getItem("theme") || "dark";
  if (theme === "light") toggleTheme();
  loadTheme(); // Load custom theme colors
  loadSongOfDay();
  
  // Initialize login page if on login.html
  if (window.location.pathname.includes("login.html")) {
    initLoginPage();
  }
});


// Initialize theme and song of day
window.addEventListener("DOMContentLoaded", () => {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') toggleTheme();
  loadTheme(); // Load custom theme colors
  loadSongOfDay();
  
  // Initialize login page if on login.html
  if (window.location.pathname.includes('login.html')) {
    initLoginPage();
  }
});


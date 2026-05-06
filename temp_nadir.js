/* NADIR AI - Real AI Integration */
async function nadirAI() {
  let input = document.getElementById("userInput").value.toLowerCase().trim();
  if (!input) return;
  
  let panda = document.getElementById("pandaFace");
  panda.style.transform = "scale(1.2)";
  
  try {
    const GROQ_API_KEY = 'secret';
    
    if (GROQ_API_KEY === 'YOUR_GROQ_API_KEY') {
      provideFallbackResponse(input);
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
          {
            role: 'system',
            content: 'You are NADIR, a disciplined AI coach focused on faith, fitness, and personal growth. Keep responses short (1-2 sentences), motivational, and actionable.'
          },
          {
            role: 'user',
            content: input
          }
        ],
        max_tokens: 150
      })
    });
    
    const data = await response.json();
    if (data.choices && data.choices[0]) {
      let reply = data.choices[0].message.content;
      typeText(reply);
      gtag('event', 'nadir_query', {query: input});
    }
  } catch (error) {
    provideFallbackResponse(input);
  }
  
  setTimeout(() => {
    panda.style.transform = "scale(1)";
  }, 500);
}

function provideFallbackResponse(input) {
  let reply = "";
  
  if (input.includes("workout")) {
    reply = "Start with compound movements: squats, bench press, deadlifts. Consistency > Intensity.";
  } else if (input.includes("study")) {
    reply = "Use the Pomodoro technique: 25 min focus, 5 min break. Eliminate all distractions.";
  } else if (input.includes("discipline")) {
    reply = "Discipline is doing what's hard when it's hard. Build momentum with small wins daily.";
  } else if (input.includes("faith")) {
    reply = "Prayer and reflection strengthen faith. Start your day connecting with God.";
  } else if (input.includes("motivation")) {
    reply = "Motivation fades. Build systems and habits instead. Trust the process.";
  } else if (input.includes("streak")) {
    reply = "Every day you show up is money in the bank. Don't break the chain!";
  } else {
    reply = "Ask me about fitness, determination, faith, or personal growth. I'm here to push you forward.";
  }
  
  typeText(reply);
}

/* TYPING EFFECT */
function typeText(text) {
  let i = 0;
  let output = document.getElementById("botReply");
  output.innerHTML = "";

  let interval = setInterval(() => {
    output.innerHTML += text.charAt(i);
    i++;
    if (i >= text.length) clearInterval(interval);
  }, 25);
}

/* Initialize on page load */  
window.addEventListener("DOMContentLoaded", () => {
  newQuote();
  getBibleVerse();
  newChallenge();
  getWorkout();
});

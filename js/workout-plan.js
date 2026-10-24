// Workout plan helpers for the Workouts page coach: reading pasted routines,
// matching exercise names to the library, muscle groups, equipment swaps and
// weekly-plan estimates. Pure functions so they can be tested outside the browser.

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Chest', icon: '🏋️', muscles: ['Chest'] },
  { id: 'back', label: 'Back & Lats', icon: '🪵', muscles: ['Back', 'Upper back', 'Trapezius'] },
  { id: 'arms', label: 'Arms', icon: '🦾', muscles: ['Biceps', 'Triceps'] },
  { id: 'shoulders', label: 'Shoulders', icon: '🤸', muscles: ['Shoulders', 'Rotator cuff'] },
  { id: 'legs', label: 'Legs', icon: '🦵', muscles: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'] },
  { id: 'core', label: 'Core & Abs', icon: '🎯', muscles: ['Core'] }
];
export const groupOf = muscle => MUSCLE_GROUPS.find(group => group.muscles.includes(muscle)) || null;

const DAY_PATTERN = /^(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday|sday)?\b/i;
const DAY_INDEX = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const REST_WORDS = /\b(rest|off|recovery|recover|no training|day off)\b/i;
const SYNONYMS = [
  [/\bdb\b/g, 'dumbbell'], [/\bbb\b/g, 'barbell'], [/\bkb\b/g, 'kettlebell'], [/\bohp\b/g, 'overhead press'],
  [/\brdls?\b/g, 'romanian deadlift'], [/\bpull[ -]?ups?\b/g, 'pull-up'], [/\bchin[ -]?ups?\b/g, 'chin-up'], [/\bpush[ -]?ups?\b/g, 'push-up'],
  [/\bskull ?crushers?\b/g, 'lying triceps extension'], [/\bflyes\b/g, 'fly'], [/\bflies\b/g, 'fly'], [/\btricep\b/g, 'triceps'],
  [/\bbench\b(?! dip)(?!.*press)/g, 'bench press'], [/\blat pull ?downs?\b/g, 'lat pulldown'], [/\bpulldowns?\b/g, 'pulldown'],
  [/\bsit ?ups?\b/g, 'crunch'], [/\babs?\b/g, 'core'], [/\bjumping jacks?\b/g, 'jumping jack'], [/\bplanks?\b/g, 'plank'],
  [/\bhip thrusts?\b/g, 'hip thrust'], [/\bcalf raises?\b/g, 'calf raise'], [/\bleg curls?\b/g, 'hamstring curl'],
  [/\bwoodchoppers?\b/g, 'wood chop'], [/\bhanging leg raises?\b/g, 'hanging knee raise'], [/\bdips\b/g, 'dip'],
  [/\bbarbell squats?\b/g, 'barbell back squat']
];

const normalize = name => {
  let text = ` ${name.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')} `;
  SYNONYMS.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
  // Singularize: "raises" → "raise", "presses" → "press", "lunges" → "lunge".
  return text.replace(/-/g, ' ').split(/\s+/).filter(Boolean).map(word => word.length <= 3 ? word : word.endsWith('sses') ? word.slice(0, -2) : word.endsWith('ies') ? `${word.slice(0, -3)}y` : /[^s]s$/.test(word) ? word.slice(0, -1) : word);
};

/** Finds the closest library exercise for a free-typed name, or null. */
export function matchExercise(name, library) {
  const words = normalize(name);
  if (!words.length) return null;
  let best = null;
  let bestScore = 0;
  library.forEach(exercise => {
    const target = normalize(exercise.name);
    const shared = words.filter(word => target.includes(word)).length;
    if (!shared) return;
    const score = shared / (new Set([...words, ...target]).size) + (target.join(' ') === words.join(' ') ? 1 : 0) + (exercise.equipment === 'Bodyweight' || exercise.equipment === 'Barbell' ? 0.01 : 0);
    if (score > bestScore) { bestScore = score; best = exercise; }
  });
  return bestScore >= 0.45 ? best : null;
}

function parsePrescription(text) {
  const result = {};
  const sets = text.match(/(\d{1,2})\s*(?:x|×|\*|sets?\s*(?:of|x)?)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*(s|sec|secs|seconds|m|min|mins|minutes)?\b/i);
  if (sets) {
    result.sets = Number(sets[1]);
    result.reps = sets[3] ? Math.round((Number(sets[2]) + Number(sets[3])) / 2) : Number(sets[2]);
    result.repRange = sets[3] ? `${sets[2]}–${sets[3]}` : '';
    if (sets[4]) { result.unit = 'seconds'; if (/^m/i.test(sets[4])) result.reps *= 60; }
  } else {
    const reps = text.match(/(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*(reps?|rep|s|sec|seconds|min|minutes)\b/i);
    if (reps) {
      result.sets = 1;
      result.reps = Number(reps[1]);
      if (/^(s|sec|seconds)$/i.test(reps[3])) result.unit = 'seconds';
      if (/^min/i.test(reps[3])) { result.unit = 'seconds'; result.reps *= 60; }
    }
  }
  const rest = text.match(/(\d{1,3})\s*(s|sec|secs|seconds|m|min|mins|minutes)\s*rest|rest\s*(?:of\s*)?(\d{1,3})\s*(s|sec|secs|seconds|m|min|mins|minutes)?/i);
  if (rest) {
    const value = Number(rest[1] || rest[3]);
    const unit = rest[2] || rest[4] || 's';
    result.rest = /^m/i.test(unit) ? value * 60 : value;
  }
  const weight = text.match(/@?\s*(\d{1,3}(?:\.\d)?)\s*(kg|lbs?|pounds)\b/i);
  if (weight) result.weight = /kg/i.test(weight[2]) ? Number(weight[1]) : Math.round(Number(weight[1]) * 0.4536 * 2) / 2;
  return result;
}

// Removes sets, reps, times, weights and rest notes wherever they appear, leaving the exercise name.
const stripPrescription = line => line
  .replace(LIST_MARKER, '')
  .replace(/[(\[].*?[)\]]/g, ' ')
  .replace(/@?\s*\d+(?:\.\d)?\s*(?:kg|lbs?|pounds)\b/gi, ' ')
  .replace(/\d{1,2}\s*(?:x|×|\*)\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*(?:s|sec|secs|seconds|m|min|mins|minutes)?\b/gi, ' ')
  .replace(/\d{1,2}\s*sets?\s*(?:of|x)?\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*(?:reps?|s|sec|secs|seconds|min|mins|minutes)?/gi, ' ')
  .replace(/\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*(?:reps?|s|sec|secs|seconds|m|min|mins|minutes)\b/gi, ' ')
  .replace(/\brest\b.*$/i, ' ')
  .replace(/\b(?:each|per)\s+(?:leg|side|arm)\b/gi, ' ')
  .replace(/(?:^|\s)[-–:—,]+(?=\s|$)|[-–:—,]+$/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const LIST_MARKER = /^\s*(?:[-*•▪◦]|\d+[.)]|[a-z][.)])\s+/i;

export function defaultDays(count) {
  return ({ 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] })[Math.max(1, Math.min(7, count))];
}

/**
 * Reads a pasted routine in almost any format and returns
 * { routines: [{ title, days, exercises }], restDays: [dayIndex], unmatched: [names] }.
 */
export function parseRoutineText(text, library) {
  const lines = text.replace(/\r/g, '').split('\n').map(line => line.trim()).filter(Boolean);
  const blocks = [];
  const restDays = [];
  let current = null;
  const startBlock = (title, days = []) => { current = { title, days, lines: [] }; blocks.push(current); };
  for (const raw of lines) {
    const line = raw.replace(/^#+\s*/, '').replace(/\*\*/g, '');
    const content = line.replace(LIST_MARKER, '');
    const dayMatch = content.match(DAY_PATTERN);
    const hasPrescription = /\d\s*[x×*]\s*\d|\d+\s*(?:sets?|reps?)\b|\d+\s*(?:s|sec|secs|seconds|min|mins|minutes)\b/i.test(content);
    const looksLikeHeader = dayMatch || /^(day\s*\d+|day\s+[a-z]\b|week\s*\d+)/i.test(content) || (/:$/.test(content) && !hasPrescription) || (/^(push|pull|legs?|upper|lower|full body|arms|chest|back|shoulders|core|cardio)\b[^\d]*$/i.test(content) && content.split(/\s+/).length <= 6);
    if (looksLikeHeader && !(hasPrescription && !dayMatch)) {
      const days = [];
      if (dayMatch) {
        content.split(/[\/&,+]|\band\b/i).forEach(part => { const day = part.trim().match(DAY_PATTERN); if (day) days.push(DAY_INDEX[day[1].toLowerCase()]); });
      }
      const after = content.replace(/\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday|sday)?\b/gi, '').replace(/^[\s/&,+\-–:—]+/, '').replace(/^and\b\s*/i, '').replace(/:$/, '').trim();
      if (REST_WORDS.test(content) && !hasPrescription) { days.forEach(day => restDays.push(day)); current = null; continue; }
      if (dayMatch && hasPrescription) { startBlock(WEEKDAYS[days[0]], days); current.lines.push(after); continue; }
      const inlineExercises = after.includes(',') && after.split(',').length >= 2 && !/[()]/.test(after) && after.split(',').every(part => matchExercise(part, library));
      startBlock(dayMatch ? (inlineExercises ? WEEKDAYS[days[0]] : after || WEEKDAYS[days[0]]) : content.replace(/:$/, ''), days);
      if (inlineExercises) after.split(',').forEach(part => current.lines.push(part.trim()));
      continue;
    }
    // Before any day or heading, only keep lines that clearly are exercises (skips titles like "my gym plan").
    if (!current && !hasPrescription && !matchExercise(stripPrescription(content), library)) continue;
    if (!current) startBlock('My workout');
    current.lines.push(content);
  }
  const unmatched = [];
  const routines = blocks.map(block => {
    const exercises = block.lines.map(line => {
      const name = stripPrescription(line);
      if (!name || name.length < 3 || /^(warm ?up|cool ?down|notes?|stretch(ing)?)$/i.test(name) || /^\d/.test(name)) return null;
      const prescription = parsePrescription(line);
      let match = matchExercise(name, library);
      // A load means it isn't the bodyweight version ("Squats 5x5 @ 100kg" → barbell squat).
      if (match?.equipment === 'Bodyweight' && prescription.weight) match = matchExercise(`barbell ${name}`, library) || matchExercise(`dumbbell ${name}`, library) || match;
      if (!match) unmatched.push(name);
      const isTimed = prescription.unit === 'seconds' || (match && /plank|hold|walk|bike|rower|elliptical|jump rope|wall sit/i.test(match.name) && !prescription.reps);
      return {
        id: match ? match.id : `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        name: match ? match.name : name.replace(/^\w/, char => char.toUpperCase()),
        sets: prescription.sets || 3,
        reps: prescription.reps || (isTimed ? 30 : 10),
        repRange: prescription.repRange || '',
        unit: isTimed ? 'seconds' : 'reps',
        weight: prescription.weight || 0,
        rest: prescription.rest ?? (isTimed ? 30 : (prescription.reps || 10) <= 6 ? 150 : (prescription.reps || 10) <= 10 ? 90 : 60),
        notes: ''
      };
    }).filter(Boolean);
    return { title: block.title || 'Workout', days: block.days, exercises };
  }).filter(routine => routine.exercises.length);
  // Blocks without weekdays ("Day 1", "Push") get spread across the week.
  const undated = routines.filter(routine => !routine.days.length);
  if (undated.length) {
    const taken = new Set([...routines.flatMap(routine => routine.days), ...restDays]);
    const preferred = defaultDays(undated.length).filter(day => !taken.has(day));
    const free = [1, 2, 3, 4, 5, 6, 0].filter(day => !taken.has(day) && !preferred.includes(day));
    undated.forEach(routine => { routine.days = [preferred.shift() ?? free.shift() ?? 1]; });
  }
  return { routines, restDays: [...new Set(restDays)], unmatched };
}

/** Estimated minutes for a routine: warm-up plus work and rest for every set. */
export function estimateMinutes(routine) {
  const seconds = routine.exercises.reduce((sum, item) => {
    const work = item.unit === 'seconds' ? item.reps : item.reps * 3.5;
    return sum + item.sets * work + Math.max(0, item.sets - 1) * (item.rest || 60) + 45;
  }, 0);
  return Math.max(10, Math.round((seconds / 60 + 5) / 5) * 5);
}

/** Builds the Monday-first weekly plan: training, active recovery and rest days. */
export function weeklyPlan(routines) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const active = routines.filter(routine => routine.active !== false && routine.exercises?.length);
  return order.map((day, position) => {
    const sessions = active.filter(routine => routine.days.includes(day));
    if (sessions.length) return { day, type: 'train', sessions };
    const prev = active.some(routine => routine.days.includes(order[(position + 6) % 7]));
    const next = active.some(routine => routine.days.includes(order[(position + 1) % 7]));
    return { day, type: prev && next ? 'recovery' : 'rest', sessions: [] };
  });
}

/** Suggests same-muscle replacements that fit the available equipment. */
export function equipmentSwaps(routines, library, equipment) {
  const allowed = equipment === 'bodyweight' ? ['Bodyweight', 'Wall', 'Outdoors'] : ['Dumbbell', 'Bodyweight', 'Bench', 'Wall', 'Outdoors'];
  const movement = name => (name.toLowerCase().match(/press|row|curl|squat|lunge|deadlift|raise|fly|pulldown|pull-up|push-up|extension|bridge|thrust|plank|crunch|dip|shrug|split|step/) || [''])[0];
  const swaps = [];
  routines.forEach(routine => routine.exercises.forEach((item, index) => {
    const exercise = library.find(entry => entry.id === item.id);
    if (!exercise || allowed.includes(exercise.equipment)) return;
    // With dumbbells available, prefer dumbbell versions over bodyweight ones.
    const candidates = library.filter(entry => entry.muscle === exercise.muscle && allowed.includes(entry.equipment) && entry.id !== exercise.id)
      .sort((a, b) => Number(b.equipment === allowed[0]) - Number(a.equipment === allowed[0]));
    const kind = movement(exercise.name);
    const used = new Set([...routine.exercises.map(entry => entry.id), ...swaps.filter(swap => swap.routineId === routine.id).map(swap => swap.to.id)]);
    const pick = candidates.find(entry => kind && movement(entry.name) === kind && !used.has(entry.id)) || candidates.find(entry => !used.has(entry.id)) || candidates[0];
    if (pick) swaps.push({ routineId: routine.id, index, from: exercise, to: pick });
  }));
  return swaps;
}

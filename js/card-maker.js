// Turns ordinary notes into flashcards, entirely in the browser.
// Each rule looks for a pattern people already use when they take notes:
//   explicit "question :: answer" lines        Romans 8:28 – And we know…
//   "Term: definition" / "Term - definition"   In 1776, the colonies…
//   "X is/are/means/refers to Y" sentences     The **nucleus** holds DNA (cloze)
//   a heading followed by a short bullet list  Q: / A: pairs and "Question?" + next line

const MAX_CARDS = 60;
const STOP_TERMS = /^(it|this|that|these|those|there|he|she|they|we|i|you|which|what|who|one|some|many|most|all|each|here)$/i;
const SCRIPTURE = /^((?:[1-3]\s?)?[A-Z][a-z]+(?:\s(?:of\s)?[A-Z][a-z]+)?\.?\s\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?)\s*(?:[-–—:]\s*|\s+)(?:["“](.+?)["”]|(.{8,}))$/;
const LIST_MARKER = /^\s*(?:[-*•▪◦]|\d+[.)]|[a-z][.)])\s+(?:\[[ x]\]\s+)?/i;

const clean = text => text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\s+/g, ' ').trim();
const words = text => text.trim().split(/\s+/).filter(Boolean).length;
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
const trimEnd = text => text.replace(/[\s.;,]+$/, '');

function splitSentences(paragraph) {
  // Split on sentence punctuation without breaking "e.g.", "Dr.", verse references or decimals.
  const protectedText = paragraph.replace(/\b(e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|St|Jr|Sr|approx|No)\./g, '$1\u0000');
  return protectedText.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/).map(sentence => sentence.replace(/\u0000/g, '.').trim()).filter(Boolean);
}

function fromExplicit(line) {
  const match = line.match(/^(.+?)\s*::\s*(.+)$/);
  return match ? { front: clean(match[1]), back: clean(match[2]), kind: 'manual' } : null;
}

function fromScripture(line) {
  const match = line.match(SCRIPTURE);
  if (!match) return null;
  const text = clean(match[2] || match[3]);
  return words(text) >= 3 ? { front: match[1], back: text, kind: 'verse' } : null;
}

function fromQA(line, next) {
  const qa = line.match(/^(?:Q(?:uestion)?)[.:)]\s*(.+?)\s+A(?:nswer)?[.:)]\s*(.+)$/i);
  if (qa) return { front: clean(qa[1]), back: clean(qa[2]), kind: 'qa' };
  const q = line.match(/^(?:Q(?:uestion)?[.:)]\s*)?(.{6,160}\?)$/i);
  const a = next?.match(/^(?:A(?:nswer)?[.:)]\s*)?(.{2,400})$/i);
  if (q && a && !next.trim().endsWith('?') && !/^#/.test(next)) return { front: clean(q[1]), back: clean(a[1].replace(LIST_MARKER, '')), kind: 'qa', consumesNext: true };
  return null;
}

const GENERIC_LABELS = /^(main point|key point|big idea|summary|takeaway|key takeaway|theme|application|lesson|purpose|goal|conclusion|thesis)$/i;

function fromDefinition(line, context) {
  if (/^\d{1,2}:\d{2}\b/.test(line) || /https?:\/\//.test(line)) return null;
  const match = line.match(/^(\*\*.+?\*\*|[^:–—=]{2,60}?)\s*(?::|\s[-–—=]\s)\s*(.+)$/);
  if (!match) return null;
  const term = clean(match[1]);
  const definition = trimEnd(clean(match[2]));
  if (words(term) > 7 || words(definition) < 2 || /[.?!]$/.test(term) || STOP_TERMS.test(term) || /^(note|tip|example|date|time|todo|reminder|see|source)$/i.test(term)) return null;
  return { front: GENERIC_LABELS.test(term) && context ? `${context}: ${term.toLowerCase()}` : term, back: capitalize(definition), kind: 'definition' };
}

function fromSentence(sentence) {
  const text = clean(sentence);
  if (words(text) < 4 || words(text) > 40 || text.endsWith('?')) return null;
  const bold = sentence.match(/\*\*(.+?)\*\*/);
  if (bold && words(bold[1]) <= 5) return { front: trimEnd(clean(sentence.replace(bold[0], '\u0001'))).replace('\u0001', '_____'), back: bold[1], kind: 'cloze' };
  const year = text.match(/^(?:In|By|During|Around)\s+(\d{3,4}(?:\s?(?:BC|AD|BCE|CE))?),?\s+(.+)$/);
  if (year && words(year[2]) >= 3) return { front: `What happened in ${year[1]}?`, back: capitalize(trimEnd(year[2])), kind: 'date' };
  const meaning = text.match(/^(.{2,60}?)\s+(means|refers to|is defined as|is known as|stands for|describes)\s+(.+)$/i);
  if (meaning && words(meaning[1]) <= 6 && !STOP_TERMS.test(meaning[1].replace(/^(the|a|an)\s+/i, ''))) {
    return { front: `What does “${trimEnd(meaning[1])}” ${meaning[2].toLowerCase() === 'stands for' ? 'stand for' : 'mean'}?`, back: capitalize(trimEnd(meaning[3])), kind: 'definition' };
  }
  const isA = text.match(/^((?:the|a|an)\s+)?(.{2,50}?)\s+(is|are|was|were)\s+((?:the|a|an|one of|made of|responsible for|used to|known for)\b.+)$/i);
  if (isA && words(isA[2]) <= 6 && !STOP_TERMS.test(isA[2]) && words(isA[4]) >= 3) {
    // "The cell is…" → "What is the cell?"; "George Washington was…" → "Who was George Washington?"
    const nameWords = isA[2].split(/\s+/);
    const person = /^(?:the|a|an|one of the)\s+(?:\w+\s+){0,3}?(king|queen|president|apostle|prophet|disciple|man|woman|leader|author|writer|scientist|emperor|judge|priest|pastor|founder|inventor|general|ruler|pharaoh|son|daughter|father|mother)\b/i.test(isA[4]);
    const properName = !isA[1] && (person || (nameWords.length > 1 && nameWords.every(word => /^[A-Z]/.test(word))));
    const subject = isA[1] ? `${isA[1].toLowerCase()}${isA[2]}`.trim() : properName || /^[A-Z]{2,}$/.test(nameWords[0]) ? isA[2] : isA[2].charAt(0).toLowerCase() + isA[2].slice(1);
    return { front: `${properName ? 'Who' : 'What'} ${isA[3].toLowerCase()} ${subject}?`, back: capitalize(trimEnd(isA[4])), kind: 'definition' };
  }
  return null;
}

/** Extracts flashcards from free-form note text. Returns [{ front, back, kind }]. */
export function extractCards(text) {
  const cards = [];
  const seen = new Set();
  const add = card => {
    if (!card || !card.front || !card.back || card.front.length > 220 || card.back.length > 600) return;
    const key = card.front.toLowerCase();
    if (seen.has(key) || card.front.toLowerCase() === card.back.toLowerCase()) return;
    seen.add(key);
    cards.push({ front: card.front, back: card.back, kind: card.kind });
  };
  const lines = text.replace(/\r/g, '').split('\n');
  let heading = '';
  let bullets = [];
  let bulletDefinitions = 0;
  // A short first line is usually the note's title: use it as context, not as a card.
  const firstLine = lines.findIndex(line => line.trim());
  const title = firstLine >= 0 && lines.length > 2 && words(lines[firstLine]) <= 8 && !/::/.test(lines[firstLine]) ? clean(lines[firstLine].replace(/^#+\s*/, '')) : '';
  const flushList = () => {
    // Skip the list card when every bullet already became its own definition card.
    if (heading && bulletDefinitions < bullets.length && bullets.length >= 2 && bullets.length <= 8 && bullets.every(item => words(item) <= 14)) {
      add({ front: `${heading}: what are the key points?`, back: bullets.map(item => `• ${item}`).join('\n'), kind: 'list' });
    }
    bullets = [];
    bulletDefinitions = 0;
  };
  for (let index = 0; index < lines.length && cards.length < MAX_CARDS; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) { if (bullets.length) flushList(); continue; }
    if (index === firstLine && title) { heading = title; continue; }
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/) || (line.length <= 60 && /^[A-Z][^.!?:]*:$/.test(line) ? [line, line.slice(0, -1)] : null);
    if (headingMatch) { flushList(); heading = clean(headingMatch[1]).replace(/:$/, ''); continue; }
    const explicit = fromExplicit(line.replace(LIST_MARKER, ''));
    if (explicit) { add(explicit); continue; }
    const isBullet = LIST_MARKER.test(line);
    const content = line.replace(LIST_MARKER, '');
    const scripture = fromScripture(content);
    if (scripture) { add(scripture); continue; }
    const qa = fromQA(content, lines[index + 1]?.trim());
    if (qa) { add(qa); if (qa.consumesNext) index += 1; continue; }
    const definition = fromDefinition(content, heading || title);
    if (definition) { add(definition); if (isBullet) { bullets.push(clean(content)); bulletDefinitions += 1; } continue; }
    if (isBullet) bullets.push(clean(content));
    else if (bullets.length) flushList();
    splitSentences(content).forEach(sentence => add(fromSentence(sentence)));
  }
  flushList();
  return cards;
}

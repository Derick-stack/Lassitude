import { getState, update } from './store.js';
import { $, confirmDialog, h, toast } from './ui.js';

// Notes and spaced-repetition flashcards for the Focus page.
// Any note line written as "front :: back" becomes a flashcard automatically.

const DAY = 864e5;
const NEW_PER_SESSION = 20;
const PARKING_ID = 'parking-lot';
const TEMPLATES = [
  { id: 'blank', label: 'Blank note', title: '', body: '' },
  { id: 'lecture', label: 'Class notes', title: 'Class notes', body: '# Topic\n\n## Key ideas\n- \n\n## Flashcards\nQuestion :: Answer\n\n## Questions to ask\n- ' },
  { id: 'sermon', label: 'Sermon notes', title: 'Sermon notes', body: '# Passage\n\n## Main point\n\n## What stood out\n- \n\n## How I’ll apply it this week\n- [ ] \n\n## Verse to memorize\nReference :: Verse text' },
  { id: 'plan', label: 'Study plan', title: 'Study plan', body: '# Goal\n\n## This week\n- [ ] \n- [ ] \n\n## Resources\n- ' }
];

const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
const hash = text => [...text].reduce((value, char) => (Math.imul(31, value) + char.charCodeAt(0)) | 0, 0).toString(36);

export function cardsFromNote(note) {
  return note.body.split('\n').flatMap(line => {
    const match = line.match(/^\s*(?:[-*]\s+)?(.+?)\s*::\s*(.+?)\s*$/);
    if (!match) return [];
    return [{ id: `n:${note.id}:${hash(match[1].toLowerCase())}`, front: match[1], back: match[2], deck: note.notebook, noteId: note.id }];
  });
}

export function allCards(state = getState()) {
  const fromNotes = state.studyNotes.flatMap(cardsFromNote);
  const manual = Object.entries(state.studyCards).filter(([, card]) => card.manual).map(([id, card]) => ({ id, front: card.front, back: card.back, deck: card.deck || 'General' }));
  return [...fromNotes, ...manual].map(card => ({ ...card, schedule: state.studyCards[card.id] || null }));
}

const isDue = (card, now = Date.now()) => !card.schedule?.due || card.schedule.due <= now;
export function dueCount(state = getState()) {
  const cards = allCards(state);
  const reviews = cards.filter(card => card.schedule?.reps && isDue(card)).length;
  const fresh = Math.min(NEW_PER_SESSION, cards.filter(card => !card.schedule?.reps).length);
  return reviews + fresh;
}

// Simplified SM-2, the algorithm behind Anki's scheduling.
export function nextSchedule(previous, grade, now = Date.now()) {
  const card = { ease: 2.5, interval: 0, reps: 0, lapses: 0, ...previous };
  if (grade === 'again') return { ...card, ease: Math.max(1.3, card.ease - 0.2), interval: 0, reps: 0, lapses: card.lapses + 1, due: now + 60_000 };
  let interval;
  if (grade === 'hard') interval = Math.max(1, Math.round(card.interval * 1.2) || 1);
  else if (grade === 'good') interval = card.reps === 0 ? 1 : card.reps === 1 ? 3 : Math.round(card.interval * card.ease);
  else interval = card.reps === 0 ? 4 : Math.round(card.interval * card.ease * 1.3);
  const ease = grade === 'hard' ? Math.max(1.3, card.ease - 0.15) : grade === 'easy' ? card.ease + 0.15 : card.ease;
  return { ...card, ease, interval, reps: card.reps + 1, due: now + interval * DAY };
}
const describeInterval = schedule => schedule.interval === 0 ? '<1 min' : schedule.interval === 1 ? '1 day' : schedule.interval < 30 ? `${schedule.interval} days` : `${Math.round(schedule.interval / 30)} mo`;

export function addToParkingLot(text) {
  const time = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  update(state => {
    let note = state.studyNotes.find(item => item.id === PARKING_ID);
    if (!note) {
      note = { id: PARKING_ID, title: 'Parking lot', body: 'Thoughts parked during focus sessions. Deal with them later.\n', notebook: 'Parking lot', pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
      state.studyNotes.unshift(note);
    }
    note.body = `${note.body.replace(/\s*$/, '')}\n- [ ] ${text} (${time})`;
    note.updatedAt = Date.now();
    if (!state.studyNotebooks.includes('Parking lot')) state.studyNotebooks.push('Parking lot');
  });
  document.dispatchEvent(new CustomEvent('notes-changed'));
}

/* ---------------- Notes ---------------- */

export function initNotes() {
  let filter = 'All';
  let query = '';
  let currentId = null;
  let saveTimer = null;
  const layout = $('#notes-layout');

  $('#note-search').addEventListener('input', event => { query = event.target.value.trim().toLowerCase(); renderList(); });
  $('#new-note').addEventListener('click', () => { currentId = null; renderEditor(); layout.dataset.view = 'editor'; });
  document.addEventListener('notes-changed', () => { renderChips(); renderList(); if (currentId === PARKING_ID) renderEditor(); });
  document.addEventListener('open-note', event => { currentId = event.detail; renderList(); renderEditor(); layout.dataset.view = 'editor'; });
  renderChips();
  renderList();
  renderEditor();

  function notes() { return getState().studyNotes; }
  function renderChips() {
    const books = ['All', ...getState().studyNotebooks];
    const chips = books.map(book => {
      const button = h('button', { type: 'button', class: 'nb-chip', 'aria-pressed': String(book === filter) }, book);
      button.addEventListener('click', () => { filter = book; renderChips(); renderList(); });
      return button;
    });
    const add = h('button', { type: 'button', class: 'nb-chip nb-add', 'aria-label': 'New notebook' }, '+ Notebook');
    add.addEventListener('click', () => promptNotebook(name => { filter = name; renderChips(); renderList(); }));
    $('#notebook-chips').replaceChildren(...chips, add);
  }
  function renderList() {
    const items = notes()
      .filter(note => filter === 'All' || note.notebook === filter)
      .filter(note => !query || `${note.title} ${note.body}`.toLowerCase().includes(query))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
    const list = $('#note-list');
    list.replaceChildren();
    if (!items.length) {
      list.append(h('li', { class: 'empty' }, query ? 'No notes match your search.' : notes().length ? 'No notes in this notebook yet.' : 'No notes yet. Tap “New note” to start.'));
      return;
    }
    items.forEach(note => {
      const snippet = note.body.replace(/[#*>\-\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
      const cards = cardsFromNote(note).length;
      const button = h('button', { type: 'button', class: 'note-item', 'aria-current': String(note.id === currentId) },
        h('span', { class: 'note-item-title' }, note.pinned ? '📌 ' : '', note.title || 'Untitled'),
        h('span', { class: 'note-item-snippet' }, snippet || 'Empty note'),
        h('span', { class: 'note-item-meta' }, `${note.notebook} · ${new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${cards ? ` · ${cards} card${cards === 1 ? '' : 's'}` : ''}`));
      button.addEventListener('click', () => { currentId = note.id; renderList(); renderEditor(); layout.dataset.view = 'editor'; });
      list.append(h('li', {}, button));
    });
  }
  function createNote(template) {
    const notebook = filter === 'All' ? (getState().studyNotebooks[0] || 'General') : filter;
    const note = { id: uid('note'), title: template.title, body: template.body, notebook, pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
    update(state => { state.studyNotes.unshift(note); });
    currentId = note.id;
    renderList();
    renderEditor();
    $('#note-title')?.focus();
  }
  function renderEditor() {
    const editor = $('#note-editor');
    const note = notes().find(item => item.id === currentId);
    const back = h('button', { type: 'button', class: 'ghost note-back' }, '← All notes');
    back.addEventListener('click', () => { layout.dataset.view = 'list'; });
    if (!note) {
      editor.replaceChildren(back, h('div', { class: 'note-empty' },
        h('h2', {}, 'Start a note'),
        h('p', {}, 'Pick a starting point. You can change anything later.'),
        h('div', { class: 'template-grid' }, TEMPLATES.map(template => {
          const button = h('button', { type: 'button', class: 'template' }, h('strong', {}, template.label), h('span', {}, template.id === 'blank' ? 'Start from scratch' : template.id === 'lecture' ? 'Key ideas and flashcards' : template.id === 'sermon' ? 'Passage, takeaways, application' : 'Goals and checklist'));
          button.addEventListener('click', () => createNote(template));
          return button;
        })),
        h('p', { class: 'tip' }, h('strong', {}, 'Tip: '), 'Type ', h('code', {}, 'question :: answer'), ' on its own line and it becomes a flashcard in Study.')));
      return;
    }
    const title = h('input', { type: 'text', id: 'note-title', class: 'note-title', value: note.title, placeholder: 'Untitled', maxlength: '120', 'aria-label': 'Note title' });
    const notebook = h('select', { 'aria-label': 'Notebook' }, [...getState().studyNotebooks.map(book => h('option', { value: book }, book)), h('option', { value: '__new' }, '+ New notebook…')]);
    notebook.value = note.notebook;
    const pin = h('button', { type: 'button', class: 'icon-btn small', 'aria-pressed': String(note.pinned), 'aria-label': note.pinned ? 'Unpin note' : 'Pin note', title: 'Pin' }, '📌');
    const remove = h('button', { type: 'button', class: 'icon-btn small', 'aria-label': 'Delete note', title: 'Delete' }, '🗑');
    const body = h('textarea', { class: 'note-body', 'aria-label': 'Note text', placeholder: 'Start writing…\n\nTip: “question :: answer” makes a flashcard.' });
    body.value = note.body;
    const status = h('span', { class: 'save-status', 'aria-live': 'polite' }, 'Saved');
    const meta = h('span', { class: 'note-meta' });
    const preview = h('div', { class: 'note-preview', hidden: true });
    const previewToggle = h('button', { type: 'button', class: 'ghost small-btn', 'aria-pressed': 'false' }, 'Preview');
    const tools = [['B', 'Bold', '**', '**'], ['•', 'Bullet list', '\n- ', ''], ['☐', 'Checklist item', '\n- [ ] ', ''], ['H', 'Heading', '\n## ', ''], ['::', 'Make a flashcard', ' :: ', '']].map(([label, name, before, after]) => {
      const button = h('button', { type: 'button', class: 'tool', 'aria-label': name, title: name }, label);
      button.addEventListener('click', () => { insert(body, before, after); queueSave(); });
      return button;
    });
    const updateMeta = () => {
      const words = body.value.trim() ? body.value.trim().split(/\s+/).length : 0;
      const cards = cardsFromNote({ ...note, body: body.value }).length;
      meta.replaceChildren(`${words} word${words === 1 ? '' : 's'}`);
      if (cards) {
        const link = h('button', { type: 'button', class: 'link-btn' }, `${cards} flashcard${cards === 1 ? '' : 's'} → Study`);
        link.addEventListener('click', () => { location.hash = 'study'; });
        meta.append(' · ', link);
      }
    };
    function queueSave() {
      status.textContent = 'Saving…';
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        update(state => { const item = state.studyNotes.find(entry => entry.id === note.id); if (item) { item.title = title.value.trim(); item.body = body.value.slice(0, 20000); item.updatedAt = Date.now(); } });
        status.textContent = 'Saved';
        updateMeta();
        renderList();
        document.dispatchEvent(new CustomEvent('cards-changed'));
      }, 400);
    }
    title.addEventListener('input', queueSave);
    body.addEventListener('input', () => { queueSave(); updateMeta(); });
    body.addEventListener('keydown', event => { if (event.key === 'Enter') continueList(event, body) && queueSave(); });
    notebook.addEventListener('change', () => {
      if (notebook.value === '__new') { promptNotebook(name => { update(state => { state.studyNotes.find(item => item.id === note.id).notebook = name; }); renderChips(); renderList(); renderEditor(); }, () => { notebook.value = note.notebook; }); return; }
      update(state => { state.studyNotes.find(item => item.id === note.id).notebook = notebook.value; });
      renderList();
      toast(`Moved to ${notebook.value}`, { duration: 1500 });
    });
    pin.addEventListener('click', () => { update(state => { const item = state.studyNotes.find(entry => entry.id === note.id); item.pinned = !item.pinned; }); renderList(); renderEditor(); });
    remove.addEventListener('click', async () => {
      if (!await confirmDialog({ title: 'Delete this note?', message: `“${note.title || 'Untitled'}” and any flashcards in it will be removed. You can undo for 5 seconds.`, confirmLabel: 'Delete note', danger: true })) return;
      const saved = notes().find(item => item.id === note.id);
      update(state => { state.studyNotes = state.studyNotes.filter(item => item.id !== note.id); });
      currentId = null;
      renderList();
      renderEditor();
      layout.dataset.view = 'list';
      document.dispatchEvent(new CustomEvent('cards-changed'));
      toast('Note deleted', { actionLabel: 'Undo', duration: 5000, onAction: () => { update(state => { state.studyNotes.unshift(saved); }); currentId = saved.id; renderList(); renderEditor(); document.dispatchEvent(new CustomEvent('cards-changed')); } });
    });
    previewToggle.addEventListener('click', () => {
      const on = preview.hidden;
      preview.hidden = !on;
      body.hidden = on;
      previewToggle.setAttribute('aria-pressed', String(on));
      previewToggle.textContent = on ? 'Edit' : 'Preview';
      if (on) renderPreview(preview, body.value);
    });
    updateMeta();
    editor.replaceChildren(back,
      h('div', { class: 'note-head' }, title, h('div', { class: 'note-actions' }, pin, remove)),
      h('div', { class: 'note-bar' }, notebook, h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Formatting' }, tools), previewToggle),
      body, preview,
      h('div', { class: 'note-foot' }, meta, status));
  }
  function promptNotebook(onCreate, onCancel = () => {}) {
    const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'nb-title' });
    const input = h('input', { type: 'text', maxlength: '40', required: true, 'aria-label': 'Notebook name', placeholder: 'e.g. Biology, Romans study' });
    const form = h('form', { method: 'dialog' }, h('h2', { id: 'nb-title' }, 'New notebook'), input, h('div', { class: 'dialog-actions' }, h('button', { value: 'cancel', class: 'ghost', formnovalidate: true }, 'Cancel'), h('button', { value: 'ok' }, 'Create')));
    dialog.append(form);
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      const name = input.value.trim();
      dialog.remove();
      if (dialog.returnValue !== 'ok' || !name) { onCancel(); return; }
      update(state => { if (!state.studyNotebooks.includes(name)) state.studyNotebooks.push(name); });
      onCreate(name);
    });
    dialog.showModal();
    input.focus();
  }
}

function insert(textarea, before, after) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.slice(start, end);
  textarea.setRangeText(`${before}${selected}${after}`, start, end, 'end');
  if (!selected && after) textarea.setSelectionRange(start + before.length, start + before.length);
  textarea.focus();
}

// Pressing Enter on a list line continues the list, like most note apps.
function continueList(event, textarea) {
  const { selectionStart: position, value } = textarea;
  const lineStart = value.lastIndexOf('\n', position - 1) + 1;
  const line = value.slice(lineStart, position);
  const match = line.match(/^(\s*)(- \[[ x]\] |- |\* |\d+\. )/);
  if (!match) return false;
  event.preventDefault();
  if (line.trim() === match[2].trim()) { textarea.setRangeText('', lineStart, position, 'end'); return true; }
  const marker = match[2].startsWith('- [') ? '- [ ] ' : /^\d+\. /.test(match[2]) ? `${Number.parseInt(match[2], 10) + 1}. ` : match[2];
  textarea.setRangeText(`\n${match[1]}${marker}`, position, position, 'end');
  return true;
}

// Builds the preview with DOM nodes (never innerHTML), so note text can't inject markup.
function renderPreview(container, text) {
  container.replaceChildren();
  let list = null;
  const inline = line => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map(part => part.startsWith('**') && part.endsWith('**') ? h('strong', {}, part.slice(2, -2)) : part);
  };
  text.split('\n').forEach(raw => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*] (\[( |x)\] )?(.*)$/);
    if (bullet) {
      if (!list) { list = h('ul', {}); container.append(list); }
      const item = h('li', {}, inline(bullet[3]));
      if (bullet[1]) item.prepend(h('span', { class: 'check', 'aria-hidden': 'true' }, bullet[2] === 'x' ? '☑ ' : '☐ '));
      list.append(item);
      return;
    }
    list = null;
    const card = line.match(/^(.+?)\s*::\s*(.+)$/);
    if (card) { container.append(h('div', { class: 'preview-card' }, h('span', {}, card[1]), h('span', {}, card[2]))); return; }
    if (/^#{1,3} /.test(line)) { container.append(h(line.startsWith('# ') ? 'h2' : 'h3', {}, inline(line.replace(/^#+ /, '')))); return; }
    if (line.trim()) container.append(h('p', {}, inline(line)));
  });
  if (!container.childNodes.length) container.append(h('p', { class: 'empty' }, 'Nothing to preview yet.'));
}

/* ---------------- Study ---------------- */

export function initStudy(onChange = () => {}) {
  const root = $('#study-root');
  let session = null;
  document.addEventListener('cards-changed', () => { if (!session) renderOverview(); onChange(); });
  document.addEventListener('notes-changed', () => { if (!session) renderOverview(); onChange(); });
  document.addEventListener('focus-tab', event => { if (event.detail === 'study' && !session) renderOverview(); });
  document.addEventListener('keydown', handleKeys);
  renderOverview();

  function decks() {
    const cards = allCards();
    const names = [...new Set(cards.map(card => card.deck))];
    return names.map(name => {
      const deckCards = cards.filter(card => card.deck === name);
      return { name, total: deckCards.length, due: deckCards.filter(card => card.schedule?.reps && isDue(card)).length, fresh: deckCards.filter(card => !card.schedule?.reps).length };
    }).sort((a, b) => (b.due + b.fresh) - (a.due + a.fresh));
  }

  function renderOverview() {
    const cards = allCards();
    const due = cards.filter(card => card.schedule?.reps && isDue(card)).length;
    const fresh = cards.filter(card => !card.schedule?.reps).length;
    const ready = due + Math.min(NEW_PER_SESSION, fresh);
    const start = h('button', { type: 'button', class: 'start-btn', disabled: !ready }, ready ? `Study now · ${ready} card${ready === 1 ? '' : 's'}` : 'All caught up');
    start.addEventListener('click', () => startSession(null, false));
    const practice = h('button', { type: 'button', class: 'ghost', disabled: !cards.length }, 'Practice all (no scheduling)');
    practice.addEventListener('click', () => startSession(null, true));
    const deckList = decks();
    root.replaceChildren(
      h('section', { class: 'card study-hero' },
        h('div', {}, h('h2', {}, cards.length ? (ready ? 'Ready to review' : 'You’re all caught up') : 'Remember what you study'),
          h('p', {}, cards.length ? `${due} due · ${fresh} new · ${cards.length} total. Cards come back right before you’d forget them.` : 'Flashcards here are scheduled with spaced repetition, so you review each one right before you’d forget it.')),
        h('div', { class: 'study-hero-actions' }, start, practice)),
      cards.length ? null : h('section', { class: 'card study-how' },
        h('h3', {}, 'Two ways to make cards'),
        h('ol', {}, h('li', {}, 'In any note, write ', h('code', {}, 'question :: answer'), ' on its own line. It turns into a card automatically.'), h('li', {}, 'Or add one below.'))),
      deckList.length ? h('div', { class: 'deck-grid' }, deckList.map(deck => {
        const study = h('button', { type: 'button', class: deck.due + deck.fresh ? '' : 'ghost', disabled: !deck.total }, deck.due + deck.fresh ? 'Study' : 'Practice');
        study.addEventListener('click', () => startSession(deck.name, !(deck.due + deck.fresh)));
        return h('article', { class: 'deck' }, h('h3', {}, deck.name), h('p', {}, h('span', { class: 'due' }, `${deck.due} due`), ' · ', h('span', { class: 'new' }, `${deck.fresh} new`), ` · ${deck.total} total`), study);
      })) : null,
      addCardForm());
  }

  function addCardForm() {
    const front = h('textarea', { rows: '2', maxlength: '500', required: true, placeholder: 'e.g. What does “steward” mean?', id: 'card-front' });
    const back = h('textarea', { rows: '2', maxlength: '1000', required: true, placeholder: 'e.g. Someone who manages what belongs to another', id: 'card-back' });
    const deck = h('select', { id: 'card-deck' }, getState().studyNotebooks.map(book => h('option', { value: book }, book)));
    const form = h('form', { class: 'add-card' }, h('label', { for: 'card-front' }, 'Front'), front, h('label', { for: 'card-back' }, 'Back'), back, h('label', { for: 'card-deck' }, 'Deck'), deck, h('button', {}, 'Add card'));
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!front.value.trim() || !back.value.trim()) return;
      update(state => { state.studyCards[uid('c')] = { manual: true, front: front.value.trim(), back: back.value.trim(), deck: deck.value }; });
      front.value = '';
      back.value = '';
      front.focus();
      toast('Card added');
      onChange();
      document.dispatchEvent(new CustomEvent('cards-changed'));
    });
    return h('details', { class: 'card add-card-wrap' }, h('summary', {}, 'Add a card'), form);
  }

  function startSession(deckName, practice) {
    const now = Date.now();
    let cards = allCards().filter(card => !deckName || card.deck === deckName);
    if (!practice) {
      const reviews = cards.filter(card => card.schedule?.reps && isDue(card, now));
      const fresh = cards.filter(card => !card.schedule?.reps).slice(0, NEW_PER_SESSION);
      cards = [...reviews, ...fresh];
    }
    cards = cards.sort(() => Math.random() - 0.5);
    if (!cards.length) return;
    session = { queue: cards, done: 0, total: cards.length, practice, revealed: false, again: 0 };
    renderCard();
  }

  function renderCard() {
    const card = session.queue[0];
    if (!card) { renderFinished(); return; }
    const exit = h('button', { type: 'button', class: 'ghost' }, 'End session');
    exit.addEventListener('click', () => { session = null; renderOverview(); onChange(); });
    const progress = Math.round(session.done / session.total * 100);
    const face = h('div', { class: `flashcard${session.revealed ? ' is-revealed' : ''}` },
      h('p', { class: 'flash-label' }, card.deck),
      h('p', { class: 'flash-front' }, card.front),
      session.revealed ? h('div', { class: 'flash-back' }, card.back) : null);
    let actions;
    if (!session.revealed) {
      const show = h('button', { type: 'button', class: 'start-btn' }, 'Show answer');
      show.addEventListener('click', reveal);
      actions = h('div', { class: 'grade-row' }, show, h('small', { class: 'kbd-hint' }, 'or press Space'));
    } else if (session.practice) {
      const next = h('button', { type: 'button', class: 'start-btn' }, 'Next');
      next.addEventListener('click', () => grade('good'));
      actions = h('div', { class: 'grade-row' }, next);
    } else {
      actions = h('div', { class: 'grade-row grades' }, ['again', 'hard', 'good', 'easy'].map((id, index) => {
        const preview = nextSchedule(card.schedule, id);
        const button = h('button', { type: 'button', class: `grade grade-${id}` }, h('strong', {}, id[0].toUpperCase() + id.slice(1)), h('span', {}, describeInterval(preview)), h('kbd', { 'aria-hidden': 'true' }, String(index + 1)));
        button.addEventListener('click', () => grade(id));
        return button;
      }));
    }
    root.replaceChildren(h('section', { class: 'study-session' },
      h('div', { class: 'session-top' }, h('span', {}, `${session.done} / ${session.total}${session.practice ? ' · practice' : ''}`), exit),
      h('div', { class: 'meter', role: 'progressbar', 'aria-label': 'Session progress', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(progress) }, h('div', { style: `width:${progress}%` })),
      face, actions));
    $('.study-session button.start-btn, .study-session .grade-good')?.focus({ preventScroll: true });
  }
  function reveal() { session.revealed = true; renderCard(); }
  function grade(id) {
    const card = session.queue.shift();
    if (!session.practice) {
      const schedule = nextSchedule(card.schedule, id);
      update(state => { state.studyCards[card.id] = { ...(state.studyCards[card.id] || {}), ...schedule }; });
      if (id === 'again') { session.queue.push({ ...card, schedule }); session.again += 1; } else session.done += 1;
    } else session.done += 1;
    session.revealed = false;
    renderCard();
  }
  function renderFinished() {
    const { total, practice } = session;
    session = null;
    onChange();
    const upcoming = allCards().filter(card => card.schedule?.due).map(card => card.schedule.due).sort((a, b) => a - b)[0];
    const back = h('button', { type: 'button' }, 'Back to Study');
    back.addEventListener('click', renderOverview);
    root.replaceChildren(h('section', { class: 'card study-done' },
      h('div', { class: 'done-icon', 'aria-hidden': 'true' }, '🎉'),
      h('h2', {}, practice ? 'Practice complete' : 'Session complete'),
      h('p', {}, `You went through ${total} card${total === 1 ? '' : 's'}.${!practice && upcoming ? ` Next review: ${new Date(upcoming).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.` : ''}`),
      back));
    back.focus();
  }
  function handleKeys(event) {
    if (!session || $('#fpanel-study').hidden || event.target.closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
    if (event.code === 'Space' && !session.revealed) { event.preventDefault(); reveal(); }
    else if (session.revealed && !session.practice && ['1', '2', '3', '4'].includes(event.key)) grade(['again', 'hard', 'good', 'easy'][Number(event.key) - 1]);
    else if (session.revealed && session.practice && (event.code === 'Space' || event.key === 'Enter')) { event.preventDefault(); grade('good'); }
  }
}

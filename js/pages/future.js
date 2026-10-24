import { getState, update } from '../store.js';
import { $, h, toast } from '../ui.js';

export function initFuture() {
  bindList('goals', '#goalForm', '#goalList', { check: true, dueDate: true });
  bindList('miles', '#mileForm', '#mileList', { date: true });
  bindList('vision', '#visionForm', '#visionList');
}

function bindList(collection, formSelector, listSelector, options = {}) {
  const form = $(formSelector);
  const list = $(listSelector);
  const render = () => {
    const items = getState()[collection];
    list.replaceChildren();
    if (!items.length) list.append(h('li', { class: 'empty' }, 'Nothing here yet. Add an item above.'));
    items.forEach((item, index) => {
      const id = `${collection}-${index}`;
      const row = h('li');
      if (options.check) {
        const check = h('input', { type: 'checkbox', id, checked: Boolean(item.done) });
        check.addEventListener('change', () => { update(state => { state[collection][index].done = check.checked; }); toast('Goal updated.'); render(); });
        row.append(check, h('label', { for: id, class: item.done ? 'done' : '' }, item.title || item.t));
      } else {
        row.append(h('span', {}, `${item.title || item.t}${options.date ? ` · ${item.date || item.d}` : ''}${item.dueDate ? ` · due ${item.dueDate}` : ''}`));
      }
      const remove = h('button', { class: 'x', type: 'button', 'aria-label': `Delete ${item.title || item.t}` }, '×');
      remove.addEventListener('click', () => {
        update(state => { state[collection].splice(index, 1); });
        toast('Item deleted.', { actionLabel: 'Undo', duration: 5000, onAction: () => { update(state => state[collection].splice(index, 0, item)); render(); } });
        render();
      });
      row.append(remove);
      list.append(row);
    });
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector('input');
    const title = input.value.trim();
    if (!title) return;
    const dueDate = options.dueDate ? form.querySelector('input[type="date"]')?.value || '' : '';
    update(state => state[collection].push({ title, done: false, date: new Date().toISOString().slice(0, 10), dueDate }));
    input.value = '';
    toast('Saved on this device.');
    render();
  });
  render();
}

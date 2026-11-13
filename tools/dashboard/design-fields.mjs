import { escape } from './view.mjs';

function options(choices, current) {
  return Object.entries(choices).map(([value, label]) =>
    `<option value="${escape(value)}"${value === current ? ' selected' : ''}>${escape(label)}</option>`,
  ).join('');
}

export function select(label, name, choices, current) {
  return `<label>${label}<select name="${name}">${options(choices, current)}</select></label>`;
}

export function field(label, name, value, attributes = '') {
  return `<label>${label}<input name="${name}" value="${escape(value)}" ${attributes}></label>`;
}

export function action(label, value, attributes = '') {
  return `<button class="button" name="action" value="${value}" ${attributes}>${label}</button>`;
}

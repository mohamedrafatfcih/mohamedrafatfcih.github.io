import { attachmentFormat, fileSize, maxAttachments, maxMediaBytes } from '../../src/lib/media.mjs';
import { dashboardPage, escape } from './view.mjs';

const fileUrl = (id, download = false) => '/media/file?' + new URLSearchParams({ id, ...(download ? { download: '1' } : {}) });

export function mediaRow(file, field, checked = false) {
  const { kind } = attachmentFormat(file);
  const name = escape(file.name);
  const label = field
    ? `<label><input type="checkbox" name="${escape(field)}" value="${escape(file.id)}"${checked ? ' checked' : ''}> ${name}</label>`
    : `<strong>${name}</strong>`;
  const direct = kind === 'pdf' || kind === 'text';
  const preview = direct ? file.url || fileUrl(file.id) : '/media/preview?' + new URLSearchParams({ id: file.id });
  const link = file.missing ? '' : file.url && kind === 'download'
    ? `<a href="${escape(file.url)}" target="_blank" rel="noopener noreferrer">Open file</a>` : kind === 'download'
    ? `<a href="${escape(fileUrl(file.id, true))}" aria-label="Download ${name}">Download</a>`
    : `<a href="${escape(preview)}" target="_blank" rel="noopener noreferrer" aria-label="Preview ${name}">Preview</a>`;
  const insert = field && !file.missing ? `<button type="button" class="button" data-insert-attachment="${escape(file.id)}" aria-label="Insert ${name} at cursor">Insert here</button>` : '';
  return `<li class="media-row">${label} <small>${file.missing ? 'File unavailable' : file.url ? 'External link' : fileSize(file.bytes)}</small> ${link} ${insert}</li>`;
}

function filePicker(files, field, selected = []) {
  if (!Array.isArray(selected)) selected = [];
  const selectedIds = new Set(selected.map(({ id }) => id));
  const byId = new Map(files.map((file) => [file.id, file]));
  const ordered = [...selected.map((file) => byId.get(file.id) ?? { ...file, missing: true }),
    ...files.filter(({ id }) => !selectedIds.has(id))];
  return `<div class="media-picker" data-media-picker data-field="${escape(field)}" data-max-bytes="${maxMediaBytes}" data-max-attachments="${maxAttachments}">
    ${field ? `<input type="hidden" name="${escape(field)}.present" value="1">` : ''}
    <label>Upload files <input type="file" multiple data-media-input></label>
    <p class="muted">Up to 95 MiB per file${field ? ` and ${maxAttachments} attachments per page` : ''}.</p>
    <details class="external-link-editor"><summary>Add external file link</summary>
      <p class="muted">For larger files, paste a link from your file or video host. A direct file link enables playback when supported.</p>
      <div class="fields">
        <label>File label<input data-link-name maxlength="120" placeholder="Conference talk"></label>
        <label>HTTPS file URL<input data-link-url inputmode="url" maxlength="4096" placeholder="https://…"></label>
        <label>Preview type<select data-link-kind>
          <option value="auto">Detect from URL</option><option value="video">Video</option>
          <option value="audio">Audio</option><option value="image">Image</option>
          <option value="pdf">PDF</option><option value="text">Text</option><option value="download">Open file link</option>
        </select></label>
      </div>
      <button type="button" class="button" data-add-link>Add file link</button>
    </details>
    <p class="muted" data-media-status role="status"></p>
    <ul class="media-list" data-media-list>${ordered.map((file) => mediaRow(file, field, selectedIds.has(file.id))).join('')}</ul>
  </div>`;
}

export function attachmentPicker(files, field, selected) {
  return `<fieldset class="attachment-picker"><legend>Attachments</legend>
    <p class="muted">Upload a file, add a link, or check an existing file. Place the cursor in your text and choose Insert here to position it between paragraphs. Files without an insertion marker appear at the end.</p>
    ${filePicker(files, field, selected)}
  </fieldset>`;
}

export function renderMediaLibrary(files) {
  return dashboardPage('media', `<main class="shell media-page"><section class="panel">
    <h2>Media library</h2>
    <p class="muted">Preview files here or attach them while editing a page. New uploads stay on this Mac until you apply a draft that uses them.</p>
    ${filePicker(files, '')}
  </section></main>`);
}

export function renderMediaPreview(file) {
  const { kind } = attachmentFormat(file);
  const source = escape(file.url || fileUrl(file.id));
  const name = escape(file.name);
  const players = {
    image: `<img src="${source}" alt="${name}">`,
    video: `<video controls playsinline preload="metadata" src="${source}" aria-label="${name}"></video>`,
    audio: `<audio controls preload="metadata" src="${source}" aria-label="${name}"></audio>`,
  };
  return dashboardPage('media', `<main class="shell media-page"><section class="panel">
    <p><a href="/?section=media">← Media library</a></p>
    <h2>${name}</h2>
    <p class="muted">${file.url ? `Hosted on ${escape(new URL(file.url).hostname)}` : fileSize(file.bytes)} · ${file.published ? 'On local site' : 'Private attachment'}</p>
    <div class="media-player">${players[kind] ?? ''}</div>
    <div class="actions">
      ${file.url || kind !== 'download' ? `<a class="button" href="${source}" target="_blank" rel="noopener noreferrer">Open file</a>` : ''}
      ${!file.url ? `<a class="button" href="${escape(fileUrl(file.id, true))}">Download</a>` : ''}
    </div>
  </section></main>`);
}

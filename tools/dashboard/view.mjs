import { fieldValue, readSource, sections } from './fields.mjs';
import { groupByCategory } from '../../src/lib/content.mjs';

export const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function dashboardUrl(section, file, notice) {
  const query = new URLSearchParams({ section });
  if (file) query.set('file', file);
  if (notice) query.set('notice', notice);
  return '/?' + query;
}

function input(field, data, categoryLabels) {
  const [key, label, type = 'text', optional] = field;
  const value = escape(fieldValue(data, key, type));
  const wide = type === 'list' || key === 'description';
  return `<label${wide ? ' class="wide"' : ''}>${label}${optional ? ' <small>Optional</small>' : ''}
    ${type === 'list'
      ? `<textarea name="${key}" rows="3" placeholder="One per line">${value}</textarea>`
      : `<input type="${type}" name="${key}" value="${value}"${key === 'category' ? ' list="article-categories" placeholder="Choose or type a category"' : ''}>`}
    ${key === 'category' ? `<datalist id="article-categories">${categoryLabels.map((label) => `<option value="${escape(label)}"></option>`).join('')}</datalist>` : ''}
  </label>`;
}

function previewFrame(html) {
  const document = `<!doctype html><html lang="en"><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' https:; media-src 'self' https:; form-action 'none'; base-uri 'none'">
    <meta name="referrer" content="no-referrer"><link rel="stylesheet" href="/preview.css"><link rel="stylesheet" href="/katex.css">
    <style>body { padding: 1.5rem; overflow-wrap: anywhere } pre { overflow: auto }</style>
    <main class="prose">${html}</main></html>`;
  return `<section class="panel"><h2>Draft preview</h2>
    <p>Markdown, code, and equations are rendered here. Open the local site after applying the draft to see Mermaid diagrams, images, and MDX components.</p>
    <iframe title="Rendered draft preview" sandbox="allow-same-origin" srcdoc="${escape(document)}"></iframe></section>`;
}

export function dashboardPage(section, content) {
  const navigation = { ...sections, design: { label: 'Design' }, media: { label: 'Media' } };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Website dashboard</title>
  <link rel="stylesheet" href="/dashboard.css">
  <script src="/dashboard-media.js" defer></script>
</head>
<body>
  <header class="masthead"><div class="shell">
    <p class="eyebrow">Mohamed Rafat <span>·</span> Local workspace</p>
    <h1>Website dashboard</h1>
    <p>Edit your portfolio. Private drafts stay on this Mac.</p>
    <nav aria-label="Website tools">${Object.entries(navigation).map(([id, item]) =>
      `<a href="${escape(dashboardUrl(id))}"${section === id ? ' aria-current="page"' : ''}>${item.label}</a>`).join('')}</nav>
  </div></header>
  ${content}
</body>
</html>`;
}

export function feedback(notice, errors) {
  return `${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ''}
    ${errors.length ? `<div class="error" role="alert"><ul>${errors.map((error) => `<li>${escape(error)}</li>`).join('')}</ul></div>` : ''}`;
}

export function renderDashboard({ section, entries, file, entry, editor, notice, errors = [], preview, attachmentControls = '' }) {
  const config = sections[section];
  const title = file ? (editor?.data.title || editor?.data.name || file) : `New ${config.item}`;
  const hidden = `<input type="hidden" name="section" value="${section}">
    <input type="hidden" name="file" value="${escape(file)}">
    <input type="hidden" name="version" value="${escape(entry?.version)}">`;
  const removingDraft = Boolean(entry?.draft);
  const sidebarEntries = entries.map(({ name, value }) => ({
    name, isDraft: Boolean(value.draft), data: readSource(value.draft?.source ?? value.live).data,
  }));
  const categories = section === 'blog' ? groupByCategory(sidebarEntries) : [];
  const categoryLabels = categories.filter(({ slug }) => slug).map(({ label }) => label);
  const entryList = (items) => `<ul>${items.map(({ name, isDraft, data }) =>
    `<li><a href="${escape(dashboardUrl(section, name))}"${name === file ? ' aria-current="true"' : ''}>
      ${escape(data.title || data.name || name)}${isDraft ? '<small>Private draft</small>' : ''}
    </a></li>`).join('')}</ul>`;

  return dashboardPage(section, `<main class="shell layout">
    <aside class="panel entries"><h2>${config.label}</h2>
      ${!config.file ? `<a class="button" href="${escape(dashboardUrl(section))}">+ New ${config.item}</a>` : ''}
      ${categories.length ? categories.map(({ label, entries: items }) =>
        `<section class="entry-category"><h3>${escape(label)}</h3>${entryList(items)}</section>`).join('')
        : sidebarEntries.length ? entryList(sidebarEntries) : '<p class="muted">No entries yet.</p>'}
    </aside>
    <div class="workspace">
      <section class="panel editor">
        <div class="editor-heading"><h2>${escape(title)}</h2>
          <span class="badge">${entry?.draft ? 'Private draft' : entry?.live !== null && entry?.live !== undefined ? 'Site file' : 'New entry'}</span>
        </div>
        ${feedback(notice, errors)}
        <form method="post" action="/">
          ${hidden}
          <div class="fields">
            ${!file && !config.file ? `<label class="wide">URL name <small>Lowercase letters, numbers, and hyphens</small>
              <input name="slug" value="${escape(editor?.slug)}" placeholder="my-first-article" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required>
            </label>` : ''}
            ${config.fields.map((field) => input(field, editor?.data ?? {}, categoryLabels)).join('')}
            <label class="wide">Markdown <small>Use fenced code, Mermaid, and LaTeX as you do on the site</small>
              <textarea class="source" name="body" rows="14" spellcheck="false">
${escape(editor?.body)}</textarea>
            </label>
          </div>
          ${attachmentControls}
          <div class="actions">
            <button class="button primary" name="action" value="save">Save private draft</button>
            <button class="button" name="action" value="preview" formnovalidate>Preview draft</button>
            ${entry?.draft ? '<button class="button" name="action" value="apply">Apply to local site</button>' : ''}
          </div>
          <p class="muted">Apply a saved draft to update the site files on this Mac. To go live, review, commit, and push the changes to GitHub.</p>
          ${file ? `<p class="muted path">src/content/${section}/${escape(file)}</p>` : ''}
        </form>
        ${removingDraft || (entry?.live != null && !config.file) ? `<details class="remove"><summary>${removingDraft ? 'Discard private draft' : 'Remove from local site'}</summary>
          <form method="post" action="/">
            ${hidden}
            <label><input name="confirm" type="checkbox" value="yes" required>
              ${removingDraft ? 'I want to delete this private draft.' : 'I want to delete this content file from the local site.'}
            </label>
            <button class="button danger" name="action" value="${removingDraft ? 'discard' : 'remove'}">Confirm removal</button>
          </form>
        </details>` : ''}
      </section>
      ${preview !== undefined ? previewFrame(preview) : ''}
    </div>
  </main>`);
}

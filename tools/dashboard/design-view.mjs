import { colorLabels, fonts, layouts, limits, selectedTheme, spacing, surfaces, themeCss } from '../../src/lib/design.mjs';
import { dashboardPage, escape, feedback } from './view.mjs';
import { pageChoices } from '../../src/lib/navigation.mjs';
import { action, field, select } from './design-fields.mjs';
import { navigationFields, navigationPreview } from './navigation-view.mjs';

function paletteFields(prefix, theme, mode) {
  return `<fieldset class="palette"><legend>${mode === 'light' ? 'Light colors' : 'Dark colors'}</legend>
    <div class="color-grid">${Object.entries(colorLabels).map(([key, label]) =>
      field(label, `${prefix}.${mode}.${key}`, theme[mode][key], 'type="color"'),
    ).join('')}</div>
  </fieldset>`;
}

function themeFields(theme, index, active) {
  const prefix = `theme.${index}`;
  return `<details class="design-card"${active ? ' open' : ''}>
    <summary>${escape(theme.name || `Theme ${index + 1}`)}${active ? ' <span class="badge">Active</span>' : ''}</summary>
    <input type="hidden" name="themeId" value="${escape(theme.id)}">
    <div class="fields">
      ${field('Theme name', `${prefix}.name`, theme.name, 'maxlength="60"')}
      ${select('Typography', `${prefix}.font`, Object.fromEntries(Object.entries(fonts).map(([key, { label }]) => [key, label])), theme.font)}
      ${select('Section spacing', `${prefix}.spacing`, Object.fromEntries(Object.entries(spacing).map(([key, { label }]) => [key, label])), theme.spacing)}
      ${field('Content width (px)', `${prefix}.width`, theme.width, 'type="number" min="880" max="1440"')}
      ${field('Corner radius (px)', `${prefix}.radius`, theme.radius, 'type="number" min="0" max="36"')}
      ${field('Base text size (px)', `${prefix}.textSize`, theme.textSize, 'type="number" min="14" max="20"')}
    </div>
    <div class="palette-grid">${paletteFields(prefix, theme, 'light')}${paletteFields(prefix, theme, 'dark')}</div>
    <div class="actions">${action('Remove theme', `remove-theme:${index}`, 'formnovalidate formaction="/#themes"')}</div>
  </details>`;
}

function componentFields(component, index, total, pages) {
  const prefix = `component.${index}`;
  return `<details class="design-card" open>
    <summary>${escape(component.title || `Component ${index + 1}`)}</summary>
    <div class="fields">
      ${field('Heading', `${prefix}.title`, component.title, 'maxlength="120"')}
      ${field('Small label (optional)', `${prefix}.eyebrow`, component.eyebrow, 'maxlength="70"')}
      ${select('Layout', `${prefix}.layout`, layouts, component.layout)}
      ${select('Background', `${prefix}.surface`, surfaces, component.surface)}
      <label class="wide">Text<textarea name="${prefix}.body" rows="3" maxlength="1200">
${escape(component.body)}</textarea></label>
      ${field('Button label (optional)', `${prefix}.linkText`, component.linkText, 'maxlength="60"')}
      ${field('Button link (optional)', `${prefix}.linkUrl`, component.linkUrl, 'maxlength="300" placeholder="/projects/"')}
    </div>
    <fieldset class="placement"><legend>Show on</legend>
      <div class="check-list">${Object.entries(pages).map(([page, label]) =>
        `<label><input type="checkbox" name="${prefix}.pages" value="${escape(page)}"${component.pages.includes(page) ? ' checked' : ''}> ${escape(label)}</label>`,
      ).join('')}</div>
      <label><input type="checkbox" name="${prefix}.afterIntro"${component.afterIntro ? ' checked' : ''}> Place after the intro on Home</label>
      <p class="muted">Components appear near the bottom of the other selected pages. Leave all unchecked to keep this component in your library.</p>
    </fieldset>
    <div class="actions">
      ${index > 0 ? action('Move up', `move-up:${index}`, 'formnovalidate formaction="/#components"') : ''}
      ${index < total - 1 ? action('Move down', `move-down:${index}`, 'formnovalidate formaction="/#components"') : ''}
      ${action('Remove component', `remove-component:${index}`, 'formnovalidate formaction="/#components"')}
    </div>
  </details>`;
}

function preview(design, mode) {
  const components = design.components.length ? design.components : [{
    layout: 'card', surface: 'paper', eyebrow: 'Sample component', title: 'Room for a new idea',
    body: 'Use this preview to check the colors, typography, and spacing.', linkText: 'Sample button',
  }];
  const document = `<!doctype html><html lang="en" data-custom-theme data-theme="${mode}"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/preview.css"><style>${themeCss(selectedTheme(design))}
      .menu-preview { display:flex; padding-inline:24px; border-bottom:1px solid var(--line); }
      .menu-preview-tab,.menu-preview .site-dropdown-links span { font-size:.78rem; padding:8px; }
    </style>
    ${navigationPreview(design)}
    <main class="container design-components">${components.map((item) => `
      <section class="design-component" data-layout="${item.layout}" data-surface="${item.surface}">
        <div class="design-component-heading">${item.eyebrow ? `<p class="eyebrow">${escape(item.eyebrow)}</p>` : ''}<h2>${escape(item.title)}</h2></div>
        <div class="design-component-content"><p>${escape(item.body)}</p>
          ${item.linkText ? `<span class="button">${escape(item.linkText)}</span>` : ''}
        </div>
      </section>`).join('')}</main></html>`;
  return `<section class="panel" id="design-preview"><h2>${mode === 'dark' ? 'Dark' : 'Light'} preview</h2>
    <p class="muted">Preview of the selected theme, menu, and components. Apply the draft and open the local site to preview full pages.</p>
    <iframe title="Website design preview" sandbox="allow-same-origin" srcdoc="${escape(document)}"></iframe></section>`;
}

export function renderDesign({ design, entry, notice, errors = [], previewMode, media = [] }) {
  const choices = Object.fromEntries([['editorial', 'Editorial (built in)'], ...design.themes.map(({ id, name }) => [id, name || 'Untitled theme'])]);
  const pages = pageChoices(design);
  const hidden = `<input type="hidden" name="section" value="design">
    <input type="hidden" name="version" value="${escape(entry.version)}">`;
  return dashboardPage('design', `<main class="shell layout">
    <aside class="panel entries"><h2>Design</h2>
      <ul><li><a href="#themes">Themes</a></li><li><a href="#pages">Pages</a></li><li><a href="#navigation">Navigation</a></li><li><a href="#components">Components</a></li></ul>
      <p class="muted">Save changes privately, then apply them to preview the whole site locally.</p>
    </aside>
    <div class="workspace">
      ${previewMode ? preview(design, previewMode) : ''}
      <section class="panel editor">
        <div class="editor-heading"><h2>Website design</h2><span class="badge">${entry.draft ? 'Private draft' : 'Site design'}</span></div>
        ${feedback(notice, errors)}
        <form method="post" action="/">
          ${hidden}
          <input type="hidden" name="componentCount" value="${design.components.length}">
          <div class="actions design-actions">
            <button class="button primary" name="action" value="save">Save private draft</button>
            ${action('Preview light', 'preview-light', 'formaction="/#design-preview"')}
            ${action('Preview dark', 'preview-dark', 'formaction="/#design-preview"')}
            ${entry.draft ? action('Apply to local site', 'apply') : ''}
          </div>
          <section class="design-group" id="themes">
            <h3>Themes</h3>
            <p class="muted">Choose the theme used on the site. Visitors can switch between its light and dark colors.</p>
            <div class="fields">${select('Active theme', 'activeTheme', choices, design.activeTheme)}</div>
            ${design.themes.map((theme, index) => themeFields(theme, index, theme.id === design.activeTheme)).join('')}
            ${design.themes.length < limits.themes ? action('Add theme from current selection', 'add-theme', 'formnovalidate formaction="/#themes"') : ''}
          </section>
          ${navigationFields(design, pages, media)}
          <section class="design-group" id="components">
            <h3>Components</h3>
            <p class="muted">Build sections with a heading, text, and an optional button. You can reuse each section on several pages.</p>
            ${design.components.map((item, index) => componentFields(item, index, design.components.length, pages)).join('')}
            ${design.components.length < limits.components ? action('Add component', 'add-component', 'formnovalidate formaction="/#components"') : ''}
          </section>
        </form>
        ${entry.draft ? `<details class="remove"><summary>Discard private design draft</summary>
          <form method="post" action="/">${hidden}
            <label><input name="confirm" type="checkbox" value="yes" required> I want to delete this draft.</label>
            ${action('Confirm discard', 'discard')}
          </form></details>` : ''}
      </section>
    </div>
  </main>`);
}

import { builtInPages, menuLimits, optionalPages, visibleNavigation } from '../../src/lib/navigation.mjs';
import { action, field, select } from './design-fields.mjs';
import { escape } from './view.mjs';
import { attachmentPicker } from './media-view.mjs';

const buttonAt = (label, value, anchor) => action(label, value, `formnovalidate formaction="/#${anchor}"`);

function pageFields(page, index, isHome, media) {
  const prefix = `page.${index}`;
  const path = isHome ? '/' : page.slug ? `/${page.slug}/` : '';
  return `<details class="design-card" open>
    <summary>${escape(page.title || 'New page')}${path ? ` <small>${escape(path)}</small>` : ''}</summary>
    <input type="hidden" name="pageId" value="${escape(page.id)}">
    <div class="fields">
      ${field('Page title', `${prefix}.title`, page.title, 'maxlength="100"')}
      ${field('URL name', `${prefix}.slug`, page.slug, 'maxlength="80" placeholder="my-page"')}
      ${field('Description (optional)', `${prefix}.description`, page.description, 'maxlength="200"')}
      <label class="wide">Page content (Markdown)<textarea name="${prefix}.body" rows="7" maxlength="24000" spellcheck="false">
${escape(page.body)}</textarea></label>
    </div>
    ${attachmentPicker(media, `${prefix}.attachments`, page.attachments)}
    ${buttonAt('Remove page', `remove-page:${index}`, 'pages')}
  </details>`;
}

function linkFields(link, prefix, pages) {
  return `<div class="fields">
    ${select('Destination page', `${prefix}.page`, pages, link.page)}
    ${field('Menu label (optional)', `${prefix}.label`, link.label, 'maxlength="40" placeholder="Use the page title"')}
  </div>`;
}

function menuFields(item, index, total, pages) {
  const prefix = `menu.${index}`;
  const dropdown = item.kind === 'dropdown';
  const title = dropdown ? item.label || 'Dropdown' : item.label || pages[item.page] || 'Tab';
  return `<details class="design-card" open>
    <summary>${escape(title)} <span class="badge">${dropdown ? 'Dropdown' : 'Tab'}</span></summary>
    <input type="hidden" name="menuKind" value="${item.kind}">
    ${dropdown ? `<div class="fields">${field('Dropdown name', `${prefix}.label`, item.label, 'maxlength="40"')}</div>
      <input type="hidden" name="${prefix}.linkCount" value="${item.links.length}">
      ${item.links.map((link, linkIndex) => `<fieldset class="menu-child"><legend>Dropdown link ${linkIndex + 1}</legend>
        ${linkFields(link, `${prefix}.link.${linkIndex}`, pages)}
        <div class="actions">
          ${linkIndex > 0 ? buttonAt('Move link up', `move-link-up:${index}:${linkIndex}`, 'navigation') : ''}
          ${linkIndex < item.links.length - 1 ? buttonAt('Move link down', `move-link-down:${index}:${linkIndex}`, 'navigation') : ''}
          ${buttonAt('Remove link', `remove-menu-link:${index}:${linkIndex}`, 'navigation')}
        </div>
      </fieldset>`).join('')}
      ${item.links.length < menuLimits.links ? buttonAt('Add dropdown link', `add-menu-link:${index}`, 'navigation') : ''}
      ` : linkFields(item, prefix, pages)}
    <div class="actions">
      ${index > 0 ? buttonAt('Move menu item up', `move-menu-up:${index}`, 'navigation') : ''}
      ${index < total - 1 ? buttonAt('Move menu item down', `move-menu-down:${index}`, 'navigation') : ''}
      ${buttonAt(dropdown ? 'Remove dropdown' : 'Remove tab', `remove-menu-item:${index}`, 'navigation')}
    </div>
  </details>`;
}

export function navigationFields(design, pages, media) {
  const destinations = Object.fromEntries(Object.entries(pages).map(([id, title]) =>
    [id, design.hiddenPages.includes(id) ? `${title} (off site)` : title],
  ));
  const homeOptions = {
    home: 'Built-in homepage', landing: 'Simple landing page',
    ...Object.fromEntries(design.pages.map(({ id }) => [id, pages[id]])),
  };
  return `<section class="design-group" id="pages">
    <h3>Pages</h3>
    <p class="muted">Create pages with Markdown and add reusable sections under Components. Remove built-in pages from the site by checking them below. You can restore them later.</p>
    <div class="fields">${select('Homepage', 'homePage', homeOptions, design.homePage)}</div>
    <p class="muted">A page selected as the homepage uses the root address while it is selected.</p>
    <fieldset class="placement"><legend>Remove built-in pages from the site</legend>
      <div class="check-list">${optionalPages.map((id) =>
        `<label><input type="checkbox" name="hiddenPages" value="${id}"${design.hiddenPages.includes(id) ? ' checked' : ''}> ${builtInPages[id]}</label>`,
      ).join('')}</div>
    </fieldset>
    ${design.pages.map((page, index) => pageFields(page, index, page.id === design.homePage, media)).join('')}
    ${design.pages.length < menuLimits.pages ? buttonAt('Add page', 'add-page', 'pages') : ''}
  </section>
  <section class="design-group" id="navigation">
    <h3>Navigation</h3>
    <p class="muted">Tabs link directly to pages. Dropdowns group several links. Removing a menu item keeps its destination page.</p>
    <input type="hidden" name="navigationForm" value="yes">
    ${design.navigation.map((item, index) => menuFields(item, index, design.navigation.length, destinations)).join('')}
    ${design.navigation.length < menuLimits.items ? `<div class="actions">
      ${buttonAt('Add tab', 'add-tab', 'navigation')}
      ${buttonAt('Add dropdown', 'add-dropdown', 'navigation')}
    </div>` : ''}
  </section>`;
}

export function navigationPreview(design) {
  const items = visibleNavigation(design);
  return items.length ? `<nav class="desktop-nav menu-preview" aria-label="Menu preview">${items.map((item) =>
    item.kind === 'tab' ? `<span class="menu-preview-tab">${escape(item.label)}</span>` :
      `<details class="site-dropdown"><summary>${escape(item.label)} <span aria-hidden="true">▾</span></summary>
        <div class="site-dropdown-links">${item.links.map(({ label }) => `<span>${escape(label)}</span>`).join('')}</div></details>`,
  ).join('')}</nav>` : '';
}

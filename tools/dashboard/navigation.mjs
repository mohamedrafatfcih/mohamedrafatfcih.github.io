import { randomUUID } from 'node:crypto';
import { defaultNavigation, menuLimits } from '../../src/lib/navigation.mjs';
import { DashboardError } from './storage.mjs';

export function readNavigationForm(form, media) {
  const get = (key) => form.get(key) ?? '';
  const pageIds = form.getAll('pageId');
  const kinds = form.getAll('menuKind');
  if (pageIds.length > menuLimits.pages || kinds.length > menuLimits.items) throw new DashboardError('There are too many pages or menu items.');
  const link = (prefix) => ({ page: get(`${prefix}.page`), label: get(`${prefix}.label`) });

  return {
    homePage: get('homePage') || 'home',
    hiddenPages: form.getAll('hiddenPages'),
    pages: pageIds.map((id, index) => {
      const prefix = `page.${index}`;
      const field = `${prefix}.attachments`;
      return {
        id, slug: get(`${prefix}.slug`), title: get(`${prefix}.title`),
        description: get(`${prefix}.description`), body: get(`${prefix}.body`).replace(/\r\n/g, '\n'),
        attachments: media.readSelection(form, field),
      };
    }),
    navigation: form.has('navigationForm') ? kinds.map((kind, index) => {
      const prefix = `menu.${index}`;
      if (kind === 'tab') return { kind, ...link(prefix) };
      if (kind !== 'dropdown') throw new DashboardError('Choose a valid menu item.');
      const count = Number(get(`${prefix}.linkCount`));
      if (!Number.isInteger(count) || count < 0 || count > menuLimits.links) throw new DashboardError('The dropdown has too many links.');
      return {
        kind, label: get(`${prefix}.label`),
        links: Array.from({ length: count }, (_, index) => link(`${prefix}.link.${index}`)),
      };
    }) : structuredClone(defaultNavigation),
  };
}

function removePage(design, index) {
  const [page] = design.pages.splice(index, 1);
  if (!page) throw new DashboardError('Choose an existing page.');
  if (design.homePage === page.id) design.homePage = 'landing';
  design.navigation = design.navigation
    .filter((item) => item.kind !== 'tab' || item.page !== page.id)
    .map((item) => item.kind === 'dropdown' ? { ...item, links: item.links.filter(({ page: id }) => id !== page.id) } : item);
  for (const component of design.components) {
    component.pages = component.pages.filter((id) => id !== page.id);
    const [path] = component.linkUrl.split(/[?#]/, 1);
    if (page.slug && path.replace(/\/$/, '') === `/${page.slug.trim()}`) {
      component.linkText = '';
      component.linkUrl = '';
    }
  }
}

function move(items, from, offset) {
  const to = from + offset;
  if (!items[from] || !items[to]) throw new DashboardError('Choose a valid position in the menu.');
  [items[from], items[to]] = [items[to], items[from]];
}

const newLink = () => ({ page: 'home', label: '' });

export function editNavigation(design, action) {
  if (action === 'add-page' && design.pages.length < menuLimits.pages) {
    design.pages.push({ id: randomUUID(), title: '', slug: '', description: '', body: '' });
    return true;
  }
  if (action === 'add-tab' && design.navigation.length < menuLimits.items) {
    design.navigation.push({ kind: 'tab', ...newLink() });
    return true;
  }
  if (action === 'add-dropdown' && design.navigation.length < menuLimits.items) {
    design.navigation.push({ kind: 'dropdown', label: '', links: [] });
    return true;
  }

  const match = /^(remove-page|remove-menu-item|move-menu-up|move-menu-down|add-menu-link|remove-menu-link|move-link-up|move-link-down):(\d+)(?::(\d+))?$/.exec(action);
  if (!match) return false;
  const [, operation, rawIndex, rawChild] = match;
  const index = Number(rawIndex);
  if (operation === 'remove-page') {
    removePage(design, index);
    return true;
  }
  const item = design.navigation[index];
  if (!item) throw new DashboardError('Choose an existing menu item.');
  if (operation === 'remove-menu-item') {
    design.navigation.splice(index, 1);
  } else if (operation.startsWith('move-menu')) {
    move(design.navigation, index, operation.endsWith('up') ? -1 : 1);
  } else {
    if (item.kind !== 'dropdown') throw new DashboardError('Choose an existing dropdown.');
    const child = Number(rawChild);
    if (operation === 'add-menu-link' && item.links.length < menuLimits.links) {
      item.links.push(newLink());
    } else if (!item.links[child]) {
      throw new DashboardError('Choose an existing dropdown link.');
    } else if (operation === 'remove-menu-link') {
      item.links.splice(child, 1);
    } else {
      move(item.links, child, operation.endsWith('up') ? -1 : 1);
    }
  }
  return true;
}

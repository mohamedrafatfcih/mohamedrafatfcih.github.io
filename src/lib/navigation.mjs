import { z } from 'astro/zod';
import { attachmentsSchema } from './media.mjs';

export const builtInPages = {
  home: 'Home', resume: 'Resume', research: 'Research', projects: 'Projects', blog: 'Blog', contact: 'Contact',
};

export const optionalPages = Object.keys(builtInPages).filter((page) => page !== 'home');
export const menuLimits = { pages: 20, items: 12, links: 12 };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reservedSlugs = new Set([...Object.keys(builtInPages), '404', 'index']);
const page = z.object({
  id: z.uuid(),
  slug: z.string().trim().max(80).regex(slugPattern, 'Use lowercase letters, numbers, and hyphens in the URL name.')
    .refine((slug) => !reservedSlugs.has(slug), 'This URL name is reserved by the site.'),
  title: z.string().trim().min(1, 'Enter a page title.').max(100),
  description: z.string().trim().max(200),
  body: z.string().max(24000),
  attachments: attachmentsSchema,
});
const link = z.object({ page: z.string(), label: z.string().trim().max(40) });
const menuItem = z.discriminatedUnion('kind', [
  link.extend({ kind: z.literal('tab') }),
  z.object({
    kind: z.literal('dropdown'),
    label: z.string().trim().min(1, 'Enter a dropdown name.').max(40),
    links: z.array(link).max(menuLimits.links),
  }),
]);

export const defaultNavigation = Object.keys(builtInPages).map((page) => ({ kind: /** @type {const} */ ('tab'), page, label: '' }));
export const navigationFields = {
  homePage: z.string().default('home'),
  hiddenPages: z.array(z.enum(optionalPages)).default([]),
  pages: z.array(page).max(menuLimits.pages).default([]),
  navigation: z.array(menuItem).max(menuLimits.items).default(defaultNavigation),
};

/** @typedef {{homePage: string, hiddenPages: string[], pages: z.infer<typeof page>[], navigation: z.infer<typeof menuItem>[]}} Navigation */

export function validateNavigation(design, context) {
  const customIds = new Set();
  const slugs = new Set();
  design.pages.forEach(({ id, slug }, index) => {
    if (customIds.has(id)) context.addIssue({ code: 'custom', path: ['pages', index], message: 'Page IDs must be unique.' });
    if (slugs.has(slug)) context.addIssue({ code: 'custom', path: ['pages', index, 'slug'], message: 'Another page already uses this URL name.' });
    customIds.add(id);
    slugs.add(slug);
  });
  if (!['home', 'landing'].includes(design.homePage) && !customIds.has(design.homePage)) {
    context.addIssue({ code: 'custom', path: ['homePage'], message: 'Choose an existing page for Home.' });
  }
  const pageIds = new Set([...Object.keys(builtInPages), ...customIds]);
  design.navigation.forEach((item, index) => {
    const links = item.kind === 'tab' ? [item] : item.links;
    if (links.some(({ page }) => !pageIds.has(page))) {
      context.addIssue({ code: 'custom', path: ['navigation', index], message: 'Choose an existing page for each link.' });
    }
  });
  design.components.forEach(({ pages }, index) => {
    if (pages.some((id) => !pageIds.has(id))) {
      context.addIssue({ code: 'custom', path: ['components', index, 'pages'], message: 'Choose existing pages for this component.' });
    }
  });
}

/** @param {Navigation} design */
export function pageChoices(design) {
  return { ...builtInPages, ...Object.fromEntries(design.pages.map(({ id, title }) => [id, title || 'Untitled page'])) };
}

/** @param {Navigation} design @param {string} id */
export function pagePath(design, id) {
  if (id === 'home' || id === design.homePage) return '';
  if (Object.hasOwn(builtInPages, id)) return design.hiddenPages.includes(id) ? null : id + '/';
  const page = design.pages.find((page) => page.id === id);
  return page ? page.slug + '/' : null;
}

/** @param {Navigation} design @param {string} relativePath */
export function currentPage(design, relativePath) {
  if (relativePath === '') return design.homePage === 'landing' ? 'home' : design.homePage;
  const slug = relativePath.replace(/\/$/, '');
  if (optionalPages.includes(slug)) return slug;
  return design.pages.find((page) => page.slug === slug)?.id;
}

/** @param {Navigation} design */
export function visibleNavigation(design) {
  const labels = pageChoices(design);
  const toLink = ({ page, label }) => {
    const path = pagePath(design, page);
    return path === null ? [] : [{ path, label: label || labels[page] }];
  };
  /** @type {Array<{kind: 'tab', path: string, label: string} | {kind: 'dropdown', label: string, links: Array<{path: string, label: string}>}>} */
  const items = [];
  for (const item of design.navigation) {
    if (item.kind === 'tab') {
      for (const link of toLink(item)) items.push({ kind: 'tab', ...link });
    } else {
      const links = item.links.flatMap(toLink);
      if (links.length) items.push({ kind: 'dropdown', label: item.label, links });
    }
  }
  return items;
}

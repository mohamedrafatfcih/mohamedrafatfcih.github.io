import { getEntry, getCollection } from 'astro:content';
import { isPublished, newestFirst } from './content.mjs';
import designData from '../design.json';
import { designSchema, emptyDesign } from './design.mjs';

// Keep the fixture build independent of which pages are enabled on the real site.
export const design = designSchema.parse(process.env.VERIFY_SITE === 'true' ? emptyDesign : designData);
export const pageEnabled = (id: string) => !design.hiddenPages.includes(id);

export async function getProfile() {
  const profile = await getEntry('profile', 'about');
  if (!profile) throw new Error('Add src/content/profile/about.md before building.');
  return profile;
}

export async function getPosts() {
  if (!pageEnabled('blog')) return [];
  return (await getCollection('blog')).filter((entry) => isPublished(entry)).sort(newestFirst);
}

export async function getResearch() {
  if (!pageEnabled('research')) return [];
  return (await getCollection('research')).filter((entry) => isPublished(entry)).sort((a, b) => b.data.year - a.data.year || a.data.title.localeCompare(b.data.title));
}

export async function getProjects() {
  if (!pageEnabled('projects')) return [];
  return (await getCollection('projects')).filter((entry) => isPublished(entry)).sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
}

export function href(path = '') {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function componentHref(url: string) {
  if (!url.startsWith('/')) return url;
  const [path] = url.split(/[?#]/, 1);
  const [section] = path.split('/').filter(Boolean);
  if (section && !pageEnabled(section)) return undefined;
  const home = design.pages.find(({ id }) => id === design.homePage);
  return home && path.replace(/\/$/, '') === `/${home.slug}` ? href() + url.slice(path.length) : href(url);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

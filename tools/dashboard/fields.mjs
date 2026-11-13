import { parseFrontmatter } from '@astrojs/markdown-remark';
import { contentSchemas } from '../../src/lib/content-schemas.mjs';

export const sections = {
  blog: { label: 'Articles', item: 'article', fields: [
    ['title', 'Title'], ['description', 'Summary'], ['date', 'Publication date', 'date'],
    ['category', 'Category', 'text', true], ['tags', 'Technology tags', 'list'],
  ] },
  projects: { label: 'Projects', item: 'project', fields: [
    ['title', 'Title'], ['description', 'Summary'], ['context', 'Context'], ['period', 'Period'],
    ['tags', 'Technologies', 'list'], ['order', 'Sort order', 'number', true],
    ['repository', 'Repository URL', 'url', true], ['demo', 'Demo URL', 'url', true],
  ] },
  research: { label: 'Research', item: 'publication', fields: [
    ['title', 'Title'], ['description', 'Summary'], ['authors', 'Authors', 'list'],
    ['year', 'Publication year', 'number'], ['venue', 'Venue', 'text', true],
    ['paper', 'Paper URL', 'url', true], ['code', 'Code URL', 'url', true],
  ] },
  profile: { label: 'Bio & contact', item: 'profile', file: 'about.md', fields: [
    ['name', 'Name'], ['role', 'Role'], ['location', 'Location'], ['email', 'Email', 'email'],
    ['description', 'Site description'], ['current', 'Current work'], ['experience', 'Experience'],
    ['study.degree', 'Degree'], ['study.university', 'University'], ['study.period', 'Study period'],
    ['study.status', 'Study status'], ['github', 'GitHub URL', 'url', true],
    ['linkedin', 'LinkedIn URL', 'url', true], ['scholar', 'Google Scholar URL', 'url', true],
  ] },
  resume: { label: 'Resume', item: 'resume', file: 'resume.md', fields: [['title', 'Title']] },
};

export const supportsAttachments = (section) => Object.hasOwn(contentSchemas[section].shape, 'attachments');

export function readSource(source) {
  const { frontmatter: data, content } = parseFrontmatter(source ?? '');
  return { data, body: content.replace(/^\r?\n/, '').replace(/\r\n/g, '\n') };
}

export function fieldValue(data, key, type) {
  const [group, name] = key.split('.');
  const value = name ? data[group]?.[name] : data[group];
  if (type === 'list') return value?.join('\n') ?? '';
  if (type === 'date' && value) return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
  return value ?? '';
}

export function readForm(section, form, previous) {
  const { data } = readSource(previous);
  delete data.draft;
  for (const [key, , type] of sections[section].fields) {
    const [group, name] = key.split('.');
    const fields = name ? (data[group] ??= {}) : data;
    const value = String(form.get(key) ?? '').trim();
    if (!value) delete fields[name ?? group];
    else if (type === 'list') fields[key] = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    else if (type === 'number' && Number.isFinite(Number(value))) fields[key] = Number(value);
    else fields[name ?? group] = value;
  }
  const body = String(form.get('body') ?? '').replace(/\r\n/g, '\n');
  return { data, body };
}

export function writeSource({ data, body }) {
  const header = Object.entries(data).map(([key, value]) =>
    `${JSON.stringify(key)}: ${JSON.stringify(value)}`,
  ).join('\n');
  return `---\n${header}\n---\n${body}${body && !body.endsWith('\n') ? '\n' : ''}`;
}

export function readyToApply(section, source) {
  const entry = readSource(source);
  const result = contentSchemas[section].safeParse(entry.data);
  if (!result.success) {
    const fields = new Map(sections[section].fields.map(([name, label]) => [name, label]));
    return result.error.issues.map(({ path, message }) => `${fields.get(path.join('.')) ?? path.join('.')}: ${message}`);
  }
  if (entry.data.draft) return ['This file is marked as an Astro draft. Clear that flag before applying.'];
  if (section === 'blog' && result.data.date > new Date()) return ['Choose today or an earlier publication date. Future posts are hidden by the site.'];
  if (!entry.body.trim()) return ['Write some content before applying this draft.'];
  return [];
}

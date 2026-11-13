export function isPublished(entry, now = new Date()) {
  return !entry.data.draft && (!entry.data.date || new Date(entry.data.date) <= now);
}

export function newestFirst(a, b) {
  return new Date(b.data.date).getTime() - new Date(a.data.date).getTime() || a.id.localeCompare(b.id);
}

export function tagSlug(tag) {
  return tag.trim().normalize('NFC').toLowerCase()
    .replace(/\+/g, '-plus').replace(/#/g, '-sharp').replace(/&/g, '-and-')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'topic';
}

export function collectTags(entries) {
  const tags = new Map();
  for (const entry of entries) {
    for (const raw of entry.data.tags) {
      const label = raw.trim();
      const slug = tagSlug(label);
      const found = tags.get(slug);
      if (found) found.count += 1;
      else tags.set(slug, { label, slug, count: 1 });
    }
  }
  return [...tags.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * @template {{ data: { category?: string } }} Entry
 * @param {Entry[]} entries
 */
export function groupByCategory(entries) {
  /** @type {Map<string, { slug: string, label: string, entries: Entry[] }>} */
  const groups = new Map();
  for (const entry of entries) {
    const category = entry.data.category;
    const label = typeof category === 'string' ? category.trim() : '';
    const slug = label ? tagSlug(label) : '';
    const group = groups.get(slug);
    if (group) group.entries.push(entry);
    else groups.set(slug, { slug, label: label || 'No category', entries: [entry] });
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

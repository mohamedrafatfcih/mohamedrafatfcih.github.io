import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sections } from './fields.mjs';
import { DashboardError } from './errors.mjs';
import { openMedia } from './media.mjs';
export { DashboardError } from './errors.mjs';

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function realDirectory(path) {
  if (!lstatSync(path).isDirectory()) throw new Error('Dashboard directories must be real folders.');
  return path;
}

function readFile(path) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isFile()) throw new DashboardError('Choose a regular content file.');
  return readFileSync(path, 'utf8');
}

function replaceFile(path, source, mode) {
  const temp = join(dirname(path), `.dashboard-${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, source, { flag: 'wx', mode });
    renameSync(temp, path);
  } finally {
    if (lstatSync(temp, { throwIfNoEntry: false })) unlinkSync(temp);
  }
}

function listFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || /[\\\x00-\x1f\x7f]/u.test(entry.name)) return [];
    const path = prefix + entry.name;
    if (entry.isDirectory()) return listFiles(join(directory, entry.name), path + '/');
    return entry.isFile() && /\.mdx?$/.test(entry.name) ? [path] : [];
  });
}

export function openStorage(root) {
  const site = realpathSync(root);
  const privateDirectory = join(dirname(site), 'MyWebsite-private');
  if (!lstatSync(privateDirectory, { throwIfNoEntry: false })) mkdirSync(privateDirectory, { mode: 0o700 });
  realDirectory(privateDirectory);
  if (privateDirectory === site || (lstatSync(privateDirectory).mode & 0o077)) {
    throw new Error('MyWebsite-private must be outside the site repository and accessible only to your Mac account.');
  }
  const draftPath = join(privateDirectory, 'dashboard-drafts.json');
  const src = realDirectory(join(site, 'src'));
  const content = realDirectory(join(src, 'content'));
  const drafts = () => JSON.parse(readFile(draftPath) ?? '{}');
  const save = (value) => replaceFile(draftPath, JSON.stringify(value, null, 2) + '\n', 0o600);
  const directory = (section) => realDirectory(join(content, section));

  function record(section, file) {
    const config = sections[section];
    const parts = file.split('/');
    if (parts.some((part) => !part || part.startsWith('.') || /[\\\x00-\x1f\x7f]/u.test(part))
        || !/\.mdx?$/.test(file) || (config.file && file !== config.file)) {
      throw new DashboardError('Choose a valid content file.');
    }
    const name = parts.pop();
    const folder = parts.reduce((parent, part) => realDirectory(join(parent, part)), directory(section));
    return document(join(folder, name), section + '/' + file);
  }

  function document(path, key) {
    const live = readFile(path);
    const saved = drafts();
    const draft = saved[key] ?? null;
    const liveVersion = digest(live);
    return { path, live, saved, key, draft, liveVersion, version: digest([liveVersion, draft]) };
  }

  return {
    media: openMedia(src, privateDirectory),
    list(section) {
      const config = sections[section];
      const files = config.file ? [config.file] : listFiles(directory(section));
      const prefix = section + '/';
      const privateFiles = Object.keys(drafts()).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
      return [...new Set([...files, ...privateFiles])].sort();
    },
    record,
    designRecord: () => document(join(src, 'design.json'), 'design/site.json'),
    saveDraft(entry, source) {
      entry.saved[entry.key] = { source, base: entry.draft?.base ?? entry.liveVersion };
      save(entry.saved);
    },
    discardDraft(entry) {
      delete entry.saved[entry.key];
      save(entry.saved);
    },
    applyDraft(entry, prepare) {
      const changed = entry.live !== entry.draft.source;
      if (changed && entry.draft.base !== entry.liveVersion) {
        throw new DashboardError('The site file changed after this draft was started. Copy your draft text somewhere safe, then discard it and start again from the latest site file.', 409);
      }
      const undo = prepare?.();
      if (changed) {
        try {
          replaceFile(entry.path, entry.draft.source, 0o644);
        } catch (error) {
          undo?.();
          throw error;
        }
      }
      this.discardDraft(entry);
    },
    removeFromSite(entry) {
      if (!entry.live || entry.draft) throw new DashboardError('Discard or apply the private draft before removing the site file.');
      unlinkSync(entry.path);
    },
  };
}

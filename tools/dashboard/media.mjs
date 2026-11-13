import { randomUUID } from 'node:crypto';
import { copyFileSync, createReadStream, createWriteStream, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { attachmentSchema, byteRange, externalAttachmentSchema, maxAttachments, maxMediaBytes, mediaFormat, mediaHeaders, mediaId, mediaName } from '../../src/lib/media.mjs';
import { DashboardError } from './errors.mjs';

function directory(path, create = false, mode = 0o700) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat) {
    if (!stat.isDirectory()) throw new DashboardError('The media folder must be a real directory.');
    return true;
  }
  if (create) mkdirSync(path, { mode });
  return create;
}

function record(root, id) {
  const folder = join(root, id);
  if (!directory(folder)) return null;
  const entries = readdirSync(folder, { withFileTypes: true });
  if (!entries.length) return null;
  if (entries.length !== 1 || !entries[0].isFile()) {
    throw new DashboardError('A media folder contains an unexpected file.');
  }
  if (entries[0].name === '.external.json') {
    const path = join(folder, '.external.json');
    const result = externalAttachmentSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    if (!result.success || result.data.id !== id) throw new DashboardError('An external file link has invalid details.');
    return { ...result.data, path };
  }
  if (!mediaName.safeParse(entries[0].name).success) throw new DashboardError('Choose a file with a valid name.');
  const name = entries[0].name;
  const path = join(folder, name);
  return { id, name, path, bytes: lstatSync(path).size };
}

const metadata = (file) => file.url
  ? { id: file.id, name: file.name, url: file.url, kind: file.kind }
  : { id: file.id, name: file.name, bytes: file.bytes };

export function openMedia(src, privateDirectory) {
  const privateRoot = join(privateDirectory, 'dashboard-media');
  const siteRoot = join(src, 'media');

  function get(id) {
    if (!mediaId.safeParse(id).success) return null;
    const published = directory(siteRoot) ? record(siteRoot, id) : null;
    if (published) return { ...published, published: true };
    const draft = directory(privateRoot) ? record(privateRoot, id) : null;
    return draft && { ...draft, published: false };
  }

  return {
    get,
    list() {
      const roots = [privateRoot, siteRoot].filter((root) => directory(root));
      const ids = new Set(roots.flatMap((root) => readdirSync(root).filter((id) => mediaId.safeParse(id).success)));
      return [...ids].map(get).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    },
    readSelection(form, field) {
      const ids = [...new Set(form.getAll(field))];
      if (ids.length > maxAttachments) throw new DashboardError(`Choose up to ${maxAttachments} files per page.`);
      return ids.map((id) => {
        const file = get(id);
        if (!file) throw new DashboardError('An attachment is missing. Reopen the editor and choose an available file.');
        return metadata(file);
      });
    },
    async upload(request, rawName) {
      const name = rawName?.normalize('NFC').trim();
      if (!mediaName.safeParse(name).success) throw new DashboardError('Choose a file with a valid name.');
      const length = Number(request.headers['content-length']);
      if (length > maxMediaBytes) throw new DashboardError('Files must be 95 MiB or smaller.', 413);
      if (request.headers['content-type'] !== 'application/octet-stream') throw new DashboardError('Choose a file to upload.', 415);

      directory(privateRoot, true);
      const id = randomUUID();
      const temp = join(privateRoot, `.${id}.tmp`);
      directory(temp, true);
      let bytes = 0;
      try {
        await pipeline(request, async function* (chunks) {
          for await (const chunk of chunks) {
            bytes += chunk.length;
            if (bytes > maxMediaBytes) throw new DashboardError('Files must be 95 MiB or smaller.', 413);
            yield chunk;
          }
        }, createWriteStream(join(temp, name), { flags: 'wx', mode: 0o600 }));
        if (!bytes) throw new DashboardError('Choose a file that is not empty.');
        renameSync(temp, join(privateRoot, id));
        return { id, name, bytes };
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    },
    addLink({ name = '', url = '', kind = 'auto' }) {
      const id = randomUUID();
      if (kind === 'auto') {
        try { kind = mediaFormat(new URL(url).pathname).kind; }
        catch { throw new DashboardError('Enter a valid HTTPS file URL.'); }
      }
      const result = externalAttachmentSchema.safeParse({ id, name: name.trim(), url: url.trim(), kind });
      if (!result.success) throw new DashboardError(result.error.issues[0].message);
      directory(privateRoot, true);
      const temp = join(privateRoot, `.${id}.tmp`);
      directory(temp, true);
      try {
        writeFileSync(join(temp, '.external.json'), JSON.stringify(result.data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
        renameSync(temp, join(privateRoot, id));
        return result.data;
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    },
    prepare(attachments) {
      const sources = new Map();
      for (const attachment of attachments) {
        const file = get(attachment.id);
        if (!file || JSON.stringify(metadata(file)) !== JSON.stringify(attachmentSchema.parse(attachment))) {
          throw new DashboardError('An attachment is missing or has changed. Choose the file again before applying.');
        }
        if (!file.published) sources.set(file.id, file);
      }

      const copied = [];
      const undo = () => copied.forEach((folder) => rmSync(folder, { recursive: true, force: true }));
      try {
        for (const file of sources.values()) {
          directory(siteRoot, true, 0o755);
          const target = join(siteRoot, file.id);
          const temp = join(siteRoot, `.${file.id}.${randomUUID()}.tmp`);
          directory(temp, true, 0o755);
          try {
            copyFileSync(file.path, join(temp, basename(file.path)));
            renameSync(temp, target);
            copied.push(target);
          } finally {
            rmSync(temp, { recursive: true, force: true });
          }
        }
      } catch (error) {
        undo();
        throw error;
      }
      return undo;
    },
  };
}

export async function serveMedia(request, response, file, download) {
  const range = byteRange(request.headers.range, file.bytes);
  if (range === false) {
    response.writeHead(416, { 'Content-Range': `bytes */${file.bytes}` });
    response.end();
    return;
  }
  response.writeHead(range ? 206 : 200, mediaHeaders(file, range, download));
  if (request.method === 'HEAD') response.end();
  else await pipeline(createReadStream(file.path, range ?? {}), response);
}

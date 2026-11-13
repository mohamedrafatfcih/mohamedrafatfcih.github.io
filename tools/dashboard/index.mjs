import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownProcessor, shikiConfig } from '../../src/lib/markdown.mjs';
import { readForm, readSource, readyToApply, sections, supportsAttachments, writeSource } from './fields.mjs';
import { DashboardError, openStorage } from './storage.mjs';
import { dashboardUrl, renderDashboard } from './view.mjs';
import { handleDesign } from './design.mjs';
import { serveMedia } from './media.mjs';
import { attachmentPicker, mediaRow, renderMediaLibrary, renderMediaPreview } from './media-view.mjs';

const host = '127.0.0.1';
const siteRoot = fileURLToPath(new URL('../../', import.meta.url));
const katexDirectory = dirname(createRequire(import.meta.url).resolve('katex/dist/katex.min.css'));
const assets = new Map([
  ['/dashboard.css', new URL('./dashboard.css', import.meta.url)],
  ['/preview.css', new URL('../../src/styles/global.css', import.meta.url)],
  ['/katex.css', join(katexDirectory, 'katex.min.css')],
]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maxFormBytes = 6 * 1024 * 1024;

async function readFields(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
    throw new DashboardError('Use the dashboard form to submit changes.', 415);
  }
  if (Number(request.headers['content-length']) > maxFormBytes) throw new DashboardError('This form is too large.', 413);
  let body = '';
  let size = 0;
  request.setEncoding('utf8');
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk);
    if (size > maxFormBytes) throw new DashboardError('This form is too large.', 413);
    body += chunk;
  }
  return new URLSearchParams(body);
}

export function createDashboard(root = siteRoot) {
  const storage = openStorage(root);
  let renderer;

  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; script-src 'self'; connect-src 'self'; img-src 'self' https:; media-src 'self' https:");
    const send = (status, content, type = 'text/plain; charset=utf-8') => {
      response.writeHead(status, { 'Content-Type': type });
      response.end(content);
    };

    const authority = `${host}:${request.socket.localPort}`;
    const origin = 'http://' + authority;
    if (request.socket.remoteAddress !== host || request.headers.host !== authority
        || ['cross-site', 'same-site'].includes(request.headers['sec-fetch-site'])
        || (request.method === 'POST' && request.headers.origin !== origin)) {
      send(403, 'Open the dashboard directly on your Mac.');
      return;
    }

    try {
      const url = new URL(request.url, origin);
      if (request.method === 'GET' && url.pathname === '/dashboard-media.js') {
        send(200, readFileSync(new URL('./media-client.js', import.meta.url)), 'text/javascript; charset=utf-8');
        return;
      }
      if (request.method === 'POST' && ['/media/upload', '/media/link'].includes(url.pathname)) {
        const field = url.searchParams.get('field') || '';
        if (field && !/^(?:attachments|page\.\d+\.attachments)$/.test(field)) throw new DashboardError('Choose a valid attachment field.');
        const file = url.pathname === '/media/upload'
          ? await storage.media.upload(request, url.searchParams.get('name'))
          : storage.media.addLink(Object.fromEntries(await readFields(request)));
        send(201, mediaRow(file, field, url.searchParams.get('select') === '1'), 'text/html; charset=utf-8');
        return;
      }
      if (['GET', 'HEAD'].includes(request.method) && ['/media/file', '/media/preview'].includes(url.pathname)) {
        const file = storage.media.get(url.searchParams.get('id'));
        if (!file) throw new DashboardError('Attachment not found.', 404);
        if (url.pathname === '/media/file' && file.url) {
          response.writeHead(302, { Location: file.url });
          response.end();
        } else if (url.pathname === '/media/file') await serveMedia(request, response, file, url.searchParams.has('download'));
        else send(200, renderMediaPreview(file), 'text/html; charset=utf-8');
        return;
      }
      if (request.method === 'GET' && assets.has(url.pathname)) {
        const css = readFileSync(assets.get(url.pathname), 'utf8');
        // Reuse the site's typography without loading third-party fonts in the dashboard.
        send(200, url.pathname === '/preview.css' ? css.replace(/^@import .*;$/gm, '') : css, 'text/css; charset=utf-8');
        return;
      }
      if (request.method === 'GET' && /^\/fonts\/KaTeX_[a-zA-Z-]+\.woff2$/.test(url.pathname)) {
        send(200, readFileSync(join(katexDirectory, url.pathname)), 'font/woff2');
        return;
      }
      if (url.pathname !== '/') {
        send(404, 'Page not found.');
        return;
      }
      if (!['GET', 'POST'].includes(request.method)) {
        send(405, 'Method not allowed.');
        return;
      }

      const form = request.method === 'POST' ? await readFields(request) : url.searchParams;
      const section = form.get('section') ?? 'blog';
      if (section === 'media' && request.method === 'GET') {
        send(200, renderMediaLibrary(storage.media.list()), 'text/html; charset=utf-8');
        return;
      }
      if (section === 'design') {
        const result = handleDesign(storage, form, request.method === 'POST');
        if (result.location) {
          response.writeHead(303, { Location: result.location });
          response.end();
        } else {
          send(result.status, result.html, 'text/html; charset=utf-8');
        }
        return;
      }
      if (!Object.hasOwn(sections, section)) throw new DashboardError('Content section not found.', 404);
      const config = sections[section];
      let file = config.file ?? (form.get('file') || '');
      let entry = file ? storage.record(section, file) : null;
      if (file && entry.live === null && !entry.draft && !config.file) {
        throw new DashboardError('Content file not found.', 404);
      }

      const previous = entry?.draft?.source ?? entry?.live;
      let editor = readSource(previous);
      let preview;
      const errors = [];
      let notice = request.method === 'GET' ? url.searchParams.get('notice') : null;

      if (request.method === 'POST') {
        const action = form.get('action');
        const redirect = (message) => {
          response.writeHead(303, { Location: dashboardUrl(section, file, message) });
          response.end();
        };
        if (!['save', 'preview', 'apply', 'discard', 'remove'].includes(action)) {
          throw new DashboardError('Choose a dashboard action.');
        }
        if (['save', 'preview', 'apply'].includes(action)) {
          editor = { ...readForm(section, form, previous), slug: form.get('slug') };
          if (supportsAttachments(section) && form.has('attachments.present')) {
            const selected = storage.media.readSelection(form, 'attachments');
            if (selected.length) editor.data.attachments = selected;
            else delete editor.data.attachments;
          }
        }
        if (entry && entry.version !== form.get('version')) {
          // Preserve the submitted form, but require a fresh copy before changing the file.
          entry = { ...entry, version: form.get('version') };
          errors.push('This entry changed while you were editing. Copy any unsaved text, then reopen the entry.');
        } else if (action === 'preview') {
          renderer ??= markdownProcessor({ allowDangerousHtml: false }, { dashboard: true }).createRenderer({ shikiConfig });
          try {
            preview = (await (await renderer).render(editor.body, { frontmatter: editor.data })).code;
          } catch {
            errors.push('The draft could not be rendered. Check the Markdown and try again.');
          }
        } else if (action === 'save') {
          if (!file) {
            const slug = editor.slug?.trim() ?? '';
            const newFile = slug + '.md';
            if (!slugPattern.test(slug) || slug.length > 100) {
              errors.push('Use a URL name of up to 100 lowercase letters, numbers, or hyphens.');
            } else if (storage.list(section).some((name) => name.toLowerCase().replace(/\.mdx$/, '.md') === newFile)) {
              errors.push('An entry already uses this URL name. Choose another or open the existing entry.');
            } else {
              entry = storage.record(section, newFile);
              file = newFile;
            }
          }
          if (!errors.length) {
            storage.saveDraft(entry, writeSource(editor));
            redirect('Draft saved on this Mac.');
            return;
          }
        } else if (action === 'apply') {
          if (!entry?.draft || entry.draft.source !== writeSource(editor)) {
            errors.push('Save your latest edits as a private draft before applying.');
          } else {
            errors.push(...readyToApply(section, entry.draft.source));
          }
          if (!errors.length) {
            try {
              storage.applyDraft(entry, () => storage.media.prepare(editor.data.attachments ?? []));
              redirect('Local site updated. Review the site before committing and pushing to GitHub.');
              return;
            } catch (error) {
              if (!(error instanceof DashboardError)) throw error;
              errors.push(error.message);
            }
          }
        } else {
          if (form.get('confirm') !== 'yes') throw new DashboardError('Confirm removal before continuing.');
          if (action === 'discard' && entry?.draft) {
            storage.discardDraft(entry);
            if (entry.live === null && !config.file) file = '';
          } else if (action === 'remove' && entry && !config.file) {
            storage.removeFromSite(entry);
            file = '';
          } else {
            throw new DashboardError('This entry cannot be removed.');
          }
          notice = action === 'discard' ? 'Private draft discarded.' : 'Local site file removed. Push the deletion to update the live site.';
          redirect(notice);
          return;
        }
      }

      const entries = storage.list(section).map((name) => ({ name, value: storage.record(section, name) }));
      const attachmentControls = supportsAttachments(section)
        ? attachmentPicker(storage.media.list(), 'attachments', editor.data.attachments) : '';
      send(errors.length ? 422 : 200, renderDashboard({ section, entries, file, entry, editor, notice, errors, preview, attachmentControls }), 'text/html; charset=utf-8');
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy();
      } else if (error instanceof DashboardError) {
        send(error.status, error.message);
      } else {
        console.error(error);
        send(500, 'The dashboard could not complete this request. See the Terminal for details.');
      }
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createDashboard().listen(4322, host, () => {
    console.log('Website dashboard: http://127.0.0.1:4322/');
  });
}

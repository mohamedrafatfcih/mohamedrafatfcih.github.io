import { z } from 'astro/zod';

export const maxMediaBytes = 95 * 1024 * 1024;
export const maxAttachments = 12;
export const mediaId = z.uuid();
export const mediaName = z.string().min(1).refine((name) =>
  name === name.trim() && !name.startsWith('.') && !/[\/\\\p{Cc}]/u.test(name)
  && new TextEncoder().encode(name).length <= 220,
);
export const uploadedAttachmentSchema = z.object({
  id: mediaId,
  name: mediaName,
  bytes: z.number().int().min(1).max(maxMediaBytes),
}).strict();
export const externalAttachmentSchema = z.object({
  id: mediaId,
  name: z.string().trim().min(1, 'Enter a file label.').max(160),
  url: z.url().max(4096).refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }, 'Use a direct HTTPS link without a username or password.'),
  kind: z.enum(['image', 'video', 'audio', 'pdf', 'text', 'download']),
}).strict();
export const attachmentSchema = z.union([externalAttachmentSchema, uploadedAttachmentSchema]);
export const attachmentsSchema = z.array(attachmentSchema).max(maxAttachments).default([]);

const formats = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
  flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
  pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', log: 'text/plain; charset=utf-8',
  csv: 'text/plain; charset=utf-8', json: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8',
};

export function mediaFormat(name) {
  const suffix = /\.([^.]+)$/.exec(name)?.[1].toLowerCase();
  if (!suffix || !Object.hasOwn(formats, suffix)) return { kind: 'download', extension: 'bin', mime: 'application/octet-stream' };
  const mime = formats[suffix];
  const kind = suffix === 'pdf' ? 'pdf' : mime.split('/')[0];
  return { kind, extension: kind === 'text' ? 'txt' : suffix, mime };
}

export function attachmentFormat(file) {
  return file.url ? { kind: file.kind } : mediaFormat(file.name);
}

/** @typedef {z.infer<typeof attachmentSchema>} Attachment */

export function mediaPath(file) {
  return `attachments/${file.id}.${mediaFormat(file.name).extension}`;
}

export function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A single range is enough for the browser's media player and PDF viewer.
export function byteRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || start >= size || end < start) return false;
  return { start, end };
}

export function mediaHeaders(file, range, download = false) {
  const { kind, mime } = mediaFormat(file.name);
  const encoded = encodeURIComponent(file.name).replace(/['()*]/g, (character) => '%' + character.charCodeAt(0).toString(16));
  const headers = {
    'Content-Type': mime,
    'Content-Disposition': `${download || kind === 'download' ? 'attachment' : 'inline'}; filename*=UTF-8''${encoded}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(range ? range.end - range.start + 1 : file.bytes),
    'X-Content-Type-Options': 'nosniff',
  };
  if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${file.bytes}`;
  return headers;
}

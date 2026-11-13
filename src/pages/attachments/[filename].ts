import type { APIRoute, GetStaticPaths } from 'astro';
import { createReadStream, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { mediaHeaders, mediaPath } from '../../lib/media.mjs';
import { design, getPosts, getProjects, getResearch } from '../../lib/site';

export const getStaticPaths = (async () => {
  const entries = (await Promise.all([getPosts(), getProjects(), getResearch()])).flat();
  const attachments = [...entries.flatMap(({ data }) => data.attachments), ...design.pages.flatMap(({ attachments }) => attachments)];
  const files = new Map(attachments.filter((file) => !('url' in file)).map((file) => [mediaPath(file), file]));
  return [...files].map(([path, file]) => ({
    params: { filename: path.slice('attachments/'.length) },
    props: { file },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { file } = props;
  const source = resolve('src/media', file.id, file.name);
  const stat = lstatSync(source, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.size !== file.bytes) {
    throw new Error(`Missing or changed attachment "${file.name}". Include its file from src/media when publishing.`);
  }
  const stream = Readable.toWeb(createReadStream(source)) as ReadableStream<Uint8Array>;
  const headers = new Headers(mediaHeaders(file, null));
  headers.delete('Accept-Ranges');
  return new Response(stream, { headers });
};

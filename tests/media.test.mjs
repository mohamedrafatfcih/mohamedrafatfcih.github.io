import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { mediaPath } from '../src/lib/media.mjs';
import { readSource } from '../tools/dashboard/fields.mjs';
import { createDashboard } from '../tools/dashboard/index.mjs';

test('media stays private until an attached draft is applied and supports ranged previews', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'portfolio-media-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const site = join(folder, 'site');
  const blog = join(site, 'src/content/blog');
  await mkdir(blog, { recursive: true });
  const server = createDashboard(site);
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const origin = 'http://127.0.0.1:' + server.address().port;
  const upload = (name, body, requestOrigin = origin) => fetch(origin + '/media/upload?' + new URLSearchParams({ name, field: 'attachments', select: '1' }), {
    method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/octet-stream' }, body,
  });
  assert.equal((await upload('clip.mp4', '1234567890', 'https://example.org')).status, 403);
  assert.equal((await upload('../unwanted.txt', 'test')).status, 400);
  const uploaded = await upload('clip.mp4', '1234567890');
  assert.equal(uploaded.status, 201);
  const id = (await uploaded.text()).match(/name="attachments" value="([^"]+)" checked/)[1];
  const privateFile = join(folder, 'MyWebsite-private/dashboard-media', id, 'clip.mp4');
  const localFile = join(site, 'src/media', id, 'clip.mp4');
  assert.equal((await stat(privateFile)).mode & 0o777, 0o600);
  await assert.rejects(access(localFile), { code: 'ENOENT' });

  const fileUrl = origin + '/media/file?id=' + id;
  const partial = await fetch(fileUrl, { headers: { Range: 'bytes=2-5' } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(partial.headers.get('content-type'), 'video/mp4');
  assert.equal(await partial.text(), '3456');
  const invalidRange = await fetch(fileUrl, { headers: { Range: 'bytes=100-' } });
  assert.equal(invalidRange.status, 416);
  assert.equal(invalidRange.headers.get('content-range'), 'bytes */10');
  const download = await fetch(fileUrl + '&download=1');
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.equal(await download.text(), '1234567890');

  const post = (data) => fetch(origin, {
    method: 'POST', headers: { Origin: origin }, redirect: 'manual', body: new URLSearchParams(data),
  });
  const fields = {
    section: 'blog', slug: 'media-check', title: 'Media check', description: 'Attachment check.',
    date: '2025-01-01', body: 'Attached file.', 'attachments.present': '1', attachments: id,
  };
  const saved = await post({ ...fields, action: 'save' });
  assert.equal(saved.status, 303, await saved.text());
  await assert.rejects(access(localFile), { code: 'ENOENT' });
  const editor = await (await fetch(origin + saved.headers.get('location'))).text();
  const version = editor.match(/name="version" value="([^"]+)"/)[1];
  const applied = await post({ ...fields, file: 'media-check.md', version, action: 'apply' });
  assert.equal(applied.status, 303, await applied.text());
  assert.equal(await readFile(localFile, 'utf8'), '1234567890');
  const { data } = readSource(await readFile(join(blog, 'media-check.md'), 'utf8'));
  assert.deepEqual(data.attachments, [{ id, name: 'clip.mp4', bytes: 10 }]);

  await rm(localFile);
  const current = await (await fetch(origin + applied.headers.get('location'))).text();
  const currentVersion = current.match(/name="version" value="([^"]+)"/)[1];
  const resaved = await post({ ...fields, file: 'media-check.md', version: currentVersion, action: 'save' });
  assert.equal(resaved.status, 303);
  const reopened = await (await fetch(origin + resaved.headers.get('location'))).text();
  const reopenedVersion = reopened.match(/name="version" value="([^"]+)"/)[1];
  const repaired = await post({ ...fields, file: 'media-check.md', version: reopenedVersion, action: 'apply' });
  assert.equal(repaired.status, 303);
  assert.equal(await readFile(localFile, 'utf8'), '1234567890');

  const htmlUpload = await upload('example.html', '<script>throw new Error()</script>');
  const htmlId = (await htmlUpload.text()).match(/name="attachments" value="([^"]+)"/)[1];
  const inactive = await fetch(origin + '/media/file?id=' + htmlId);
  assert.equal(inactive.headers.get('content-type'), 'application/octet-stream');
  assert.match(inactive.headers.get('content-disposition'), /^attachment;/);
  assert.equal(mediaPath({ id: htmlId, name: 'example.html' }), `attachments/${htmlId}.bin`);
  await inactive.arrayBuffer();

  const addLink = (url) => fetch(origin + '/media/link?' + new URLSearchParams({ field: 'attachments', select: '1' }), {
    method: 'POST', headers: { Origin: origin },
    body: new URLSearchParams({ name: 'Large video', url, kind: 'video' }),
  });
  assert.equal((await addLink('javascript:alert(1)')).status, 400);
  assert.equal((await addLink('https://user:password@example.org/video.mp4')).status, 400);
  const remoteUrl = 'https://not-contacted.example.org/video.mp4';
  const added = await addLink(remoteUrl);
  assert.equal(added.status, 201, await added.clone().text());
  const externalId = (await added.text()).match(/name="attachments" value="([^"]+)" checked/)[1];
  const openLink = await fetch(origin + '/media/file?id=' + externalId, { redirect: 'manual' });
  assert.equal(openLink.status, 302);
  assert.equal(openLink.headers.get('location'), remoteUrl);
  await assert.rejects(access(join(site, 'src/media', externalId)), { code: 'ENOENT' });
  const linkDraft = await post({ ...fields, slug: 'external-file', attachments: externalId, action: 'save' });
  assert.equal(linkDraft.status, 303, await linkDraft.text());
  const linkEditor = await (await fetch(origin + linkDraft.headers.get('location'))).text();
  const linkVersion = linkEditor.match(/name="version" value="([^"]+)"/)[1];
  const linkApplied = await post({ ...fields, slug: 'external-file', file: 'external-file.md', version: linkVersion, attachments: externalId, action: 'apply' });
  assert.equal(linkApplied.status, 303, await linkApplied.text());
  const external = JSON.parse(await readFile(join(site, 'src/media', externalId, '.external.json'), 'utf8'));
  assert.deepEqual(external, { id: externalId, name: 'Large video', url: remoteUrl, kind: 'video' });
});

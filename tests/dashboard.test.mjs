import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readSource } from '../tools/dashboard/fields.mjs';
import { createDashboard } from '../tools/dashboard/index.mjs';

test('the loopback dashboard keeps drafts private and applies only explicit, valid changes', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'portfolio-dashboard-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const site = join(folder, 'site');
  const content = join(site, 'src', 'content');
  const draftPath = join(folder, 'MyWebsite-private', 'dashboard-drafts.json');
  for (const section of ['blog', 'profile', 'projects', 'research', 'resume']) {
    await mkdir(join(content, section), { recursive: true });
  }
  const article = join(content, 'blog', 'my-first-article.md');
  const project = join(content, 'projects', 'original.mdx');
  const originalProject = '---\ntitle: Original\ndescription: A project\ncontext: Personal\nperiod: 2026\nslug: original-url\n---\n\n<Example label="Test" />\n';
  await writeFile(project, originalProject);

  const server = createDashboard(site);
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const get = (query = '', headers = {}) => fetch(origin + '/' + query, { headers });
  const post = (fields, requestOrigin = origin) => fetch(origin, {
    method: 'POST', headers: { Origin: requestOrigin }, redirect: 'manual',
    body: new URLSearchParams(fields),
  });
  const version = (html) => html.match(/name="version" value="([a-f0-9]*)"/)[1];
  const redirected = async (response) => {
    assert.equal(response.status, 303, await response.text());
    return (await fetch(new URL(response.headers.get('location'), origin))).text();
  };

  const start = await get();
  assert.match(await start.text(), /Save private draft/);
  assert.match(start.headers.get('cache-control'), /no-store/);
  assert.match(start.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await get('?section=blog', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await get('?section=blog&file=..%2Fabout.md')).status, 400);
  assert.equal((await fetch(origin + '/dashboard-drafts.json')).status, 404);
  assert.doesNotMatch(await (await fetch(origin + '/preview.css')).text(), /fonts\.googleapis\.com/);
  await symlink(project, join(content, 'blog', 'linked.md'));
  assert.equal((await get('?section=blog&file=linked.md')).status, 400);

  const fields = {
    section: 'blog', slug: 'my-first-article', title: 'My first article', description: 'A technical post.',
    date: '2025-01-01', category: 'Engineering', tags: 'Swift\nArchitecture',
    body: 'Private marker.\n\n```swift\nlet answer = 42\n```\n\n```mermaid\ngraph LR\nA --> B\n```\n\nInline $E=mc^2$.\n\n$$\nx=1\n$$\n\n<script>maliciousPreview()</script>\n',
  };
  assert.equal((await post({ ...fields, action: 'save' }, 'https://example.org')).status, 403);
  const preview = await post({ ...fields, action: 'preview' });
  assert.equal(preview.status, 200);
  const html = await preview.text();
  assert.match(html, /sandbox="allow-same-origin" srcdoc/);
  assert.match(html, /astro-code/);
  assert.match(html, /mermaid-source/);
  assert.match(html, /katex-display/);
  assert.doesNotMatch(html.split('sandbox="allow-same-origin" srcdoc=')[1], /maliciousPreview/);
  await assert.rejects(access(draftPath), { code: 'ENOENT' });
  const draft = await redirected(await post({ ...fields, action: 'save' }));
  assert.match(draft, /Draft saved on this Mac/);
  assert.match(draft, /name="category" value="Engineering"/);
  assert.match(draft, /<h3>Engineering<\/h3>/);
  assert.match(draft, /<datalist id="article-categories"><option value="Engineering">/);
  assert.match(await readFile(draftPath, 'utf8'), /Private marker/);
  assert.equal((await stat(draftPath)).mode & 0o777, 0o600);
  assert.equal((await stat(join(folder, 'MyWebsite-private'))).mode & 0o777, 0o700);
  await assert.rejects(access(article), { code: 'ENOENT' });

  const saved = { ...fields, file: 'my-first-article.md', version: version(draft) };
  const invalid = await post({ ...saved, title: '', action: 'save' });
  const invalidDraft = await redirected(invalid);
  const failed = await post({ ...saved, version: version(invalidDraft), title: '', action: 'apply' });
  assert.equal(failed.status, 422);
  assert.match(await failed.text(), /Title:/);
  await assert.rejects(access(article), { code: 'ENOENT' });

  const stale = await post({ ...saved, title: 'Stale editor', action: 'save' });
  assert.equal(stale.status, 422);
  assert.match(await stale.text(), /changed while you were editing/);
  const updated = await redirected(await post({ ...saved, version: version(invalidDraft), title: 'Updated article', action: 'save' }));
  const applied = await redirected(await post({ ...saved, version: version(updated), title: 'Updated article', action: 'apply' }));
  assert.match(applied, /Local site updated/);
  const published = readSource(await readFile(article, 'utf8'));
  assert.equal(published.data.title, 'Updated article');
  assert.equal(published.data.category, 'Engineering');
  assert.deepEqual(published.data.tags, ['Swift', 'Architecture']);
  assert.equal(published.body, fields.body);
  assert.doesNotMatch(await readFile(draftPath, 'utf8'), /Private marker/);

  const editArticle = { ...saved, title: 'Revised article', category: 'iOS Development', body: 'Updated body.' };
  const newDraft = await redirected(await post({ ...editArticle, version: version(applied), action: 'save' }));
  assert.match(newDraft, /<h3>iOS Development<\/h3>/);
  assert.deepEqual(readSource(await readFile(article, 'utf8')), published);
  const revised = await redirected(await post({ ...editArticle, version: version(newDraft), action: 'apply' }));
  const revisedPost = readSource(await readFile(article, 'utf8'));
  assert.equal(revisedPost.data.category, 'iOS Development');
  assert.equal(revisedPost.data.title, 'Revised article');
  assert.equal(revisedPost.body.trim(), 'Updated body.');
  const removal = { section: 'blog', file: saved.file, version: version(revised), action: 'remove' };
  assert.equal((await post(removal)).status, 400);
  await redirected(await post({ ...removal, confirm: 'yes' }));
  await assert.rejects(access(article), { code: 'ENOENT' });

  const projectPage = await (await get('?section=projects&file=original.mdx')).text();
  assert.match(projectPage, /Original/);
  const edit = {
    section: 'projects', file: 'original.mdx', title: 'Edited', description: 'A project',
    context: 'Personal', period: '2026', body: readSource(originalProject).body,
  };
  const projectDraft = await redirected(await post({ ...edit, version: version(projectPage), action: 'save' }));
  assert.equal(await readFile(project, 'utf8'), originalProject);
  const externalEdit = originalProject.replace('title: Original', 'title: Changed externally');
  await writeFile(project, externalEdit);
  const refreshed = await (await get('?section=projects&file=original.mdx')).text();
  const conflict = await post({ ...edit, version: version(refreshed), action: 'apply' });
  assert.equal(conflict.status, 422);
  assert.match(await conflict.text(), /site file changed after this draft was started/);
  assert.equal(await readFile(project, 'utf8'), externalEdit);
  assert.match(await readFile(draftPath, 'utf8'), /Edited/);
  await redirected(await post({ ...edit, version: version(refreshed), action: 'discard', confirm: 'yes' }));
  assert.equal(await readFile(project, 'utf8'), externalEdit);
  assert.notEqual(version(projectDraft), version(refreshed));
});

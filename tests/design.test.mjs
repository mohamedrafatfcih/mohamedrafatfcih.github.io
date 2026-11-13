import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { componentsFor, designSchema, editorial, emptyDesign } from '../src/lib/design.mjs';
import { visibleNavigation } from '../src/lib/navigation.mjs';
import { handleDesign } from '../tools/dashboard/design.mjs';
import { editNavigation } from '../tools/dashboard/navigation.mjs';
import { openStorage } from '../tools/dashboard/storage.mjs';

test('design previews and drafts preserve site files until a validated apply', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'portfolio-design-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const site = join(folder, 'site');
  const siteFile = join(site, 'src', 'design.json');
  await mkdir(join(site, 'src', 'content'), { recursive: true });
  const initial = JSON.stringify(emptyDesign);
  await writeFile(siteFile, initial);
  const storage = openStorage(site);
  const firstVersion = storage.designRecord().version;

  const themeId = '11111111-1111-4111-8111-111111111111';
  const fields = new URLSearchParams({
    version: firstVersion, themeId, activeTheme: themeId, componentCount: '1',
    'theme.0.name': 'Ocean', 'theme.0.font': 'system', 'theme.0.spacing': 'compact',
    'theme.0.width': '1120', 'theme.0.radius': '12', 'theme.0.textSize': '17',
    'component.0.title': 'Custom section', 'component.0.body': 'A section reused on two pages.',
    'component.0.layout': 'split', 'component.0.surface': 'surface', 'component.0.afterIntro': 'on',
    'component.0.linkText': 'View projects', 'component.0.linkUrl': '/projects/',
  });
  fields.append('component.0.pages', 'home');
  fields.append('component.0.pages', 'projects');
  for (const mode of ['light', 'dark']) {
    for (const [key, value] of Object.entries(editorial[mode])) fields.set(`theme.0.${mode}.${key}`, value);
  }
  fields.set('theme.0.dark.bg', '#15293d');
  const submit = (action, overrides = {}) => {
    const form = new URLSearchParams(fields);
    form.set('action', action);
    for (const [key, value] of Object.entries(overrides)) form.set(key, value);
    return handleDesign(storage, form, true);
  };

  const preview = submit('preview-dark');
  assert.equal(preview.status, 200);
  assert.match(preview.html, /--bg: #15293d/);
  assert.match(preview.html, /Custom section/);
  assert.equal(storage.designRecord().draft, null);
  assert.equal(submit('save', { 'component.0.linkUrl': 'javascript:alert(1)' }).status, 422);
  assert.equal(submit('preview-light', { 'theme.0.light.bg': '</style>' }).status, 422);
  assert.match(submit('save').location, /Design\+draft\+saved/);
  assert.equal(await readFile(siteFile, 'utf8'), initial);
  assert.equal(submit('apply').status, 409);

  const version = storage.designRecord().version;
  assert.equal(submit('apply', { version, 'theme.0.radius': '20' }).status, 422);
  assert.match(submit('apply', { version }).location, /Local\+site\+design\+updated/);
  const applied = JSON.parse(await readFile(siteFile, 'utf8'));
  assert.equal(applied.activeTheme, themeId);
  assert.equal(applied.themes[0].dark.bg, '#15293d');
  assert.equal(componentsFor(applied, 'home', true)[0].title, 'Custom section');
  assert.equal(componentsFor(applied, 'home', false).length, 0);
  assert.equal(componentsFor(applied, 'projects', false).length, 1);
  assert.equal(componentsFor(applied, 'resume', false).length, 0);
  assert.equal(storage.designRecord().draft, null);
});

test('removing a page clears its menu and component references while removing a tab keeps its page', () => {
  const id = '22222222-2222-4222-8222-222222222222';
  const design = designSchema.parse({
    ...emptyDesign,
    homePage: id,
    hiddenPages: ['contact'],
    pages: [{ id, title: 'Resources', slug: 'resources', body: '', description: '' }],
    navigation: [
      { kind: 'tab', page: 'resume', label: '' },
      { kind: 'tab', page: 'contact', label: '' },
      { kind: 'dropdown', label: 'Explore', links: [{ page: id, label: '' }, { page: 'projects', label: '' }] },
    ],
    components: [{ title: 'Section', eyebrow: '', body: 'Text', layout: 'card', surface: 'paper', pages: [id], afterIntro: false, linkText: 'Resources', linkUrl: '/resources/' }],
  });
  assert.equal(visibleNavigation(design)[1].links[0].path, '');
  design.components.push({ ...design.components[0], pages: ['home', id], afterIntro: true });
  assert.equal(componentsFor(design, id, true).length, 1);
  editNavigation(design, 'remove-menu-item:0');
  assert.deepEqual(design.hiddenPages, ['contact']);
  assert.equal(design.pages.length, 1);

  editNavigation(design, 'remove-page:0');
  assert.equal(design.homePage, 'landing');
  assert.deepEqual(visibleNavigation(design), [{ kind: 'dropdown', label: 'Explore', links: [{ path: 'projects/', label: 'Projects' }] }]);
  assert.deepEqual(design.components[0].pages, []);
  assert.equal(design.components[0].linkUrl, '');
  assert.equal(designSchema.safeParse(design).success, true);
});

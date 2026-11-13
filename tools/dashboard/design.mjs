import { randomUUID } from 'node:crypto';
import { colorLabels, designSchema, emptyDesign, limits, selectedTheme } from '../../src/lib/design.mjs';
import { renderDesign } from './design-view.mjs';
import { DashboardError } from './storage.mjs';
import { dashboardUrl } from './view.mjs';
import { editNavigation, readNavigationForm } from './navigation.mjs';

const newComponent = {
  title: '', eyebrow: '', body: '', layout: 'card', surface: 'paper', pages: ['home'],
  afterIntro: false, linkText: '', linkUrl: '',
};

function readDesignForm(form, media) {
  const themeIds = form.getAll('themeId');
  const componentCount = Number(form.get('componentCount'));
  if (themeIds.length > limits.themes || !Number.isInteger(componentCount) || componentCount < 0 || componentCount > limits.components) {
    throw new DashboardError('The design has too many entries.');
  }
  const get = (key) => form.get(key) ?? '';
  return {
    activeTheme: get('activeTheme'),
    themes: themeIds.map((id, index) => {
      const prefix = `theme.${index}`;
      const palette = (mode) => Object.fromEntries(Object.keys(colorLabels).map((key) => [key, get(`${prefix}.${mode}.${key}`)]));
      const number = (key) => {
        const value = get(`${prefix}.${key}`);
        return value.trim() && Number.isFinite(Number(value)) ? Number(value) : value;
      };
      return {
        id, name: get(`${prefix}.name`), light: palette('light'), dark: palette('dark'),
        font: get(`${prefix}.font`), spacing: get(`${prefix}.spacing`),
        width: number('width'), radius: number('radius'), textSize: number('textSize'),
      };
    }),
    components: Array.from({ length: componentCount }, (_, index) => {
      const prefix = `component.${index}`;
      return {
        title: get(`${prefix}.title`), eyebrow: get(`${prefix}.eyebrow`),
        body: get(`${prefix}.body`).replace(/\r\n/g, '\n'),
        layout: get(`${prefix}.layout`), surface: get(`${prefix}.surface`),
        pages: form.getAll(`${prefix}.pages`), afterIntro: form.has(`${prefix}.afterIntro`),
        linkText: get(`${prefix}.linkText`), linkUrl: get(`${prefix}.linkUrl`),
      };
    }),
    ...readNavigationForm(form, media),
  };
}

function editDesign(design, action) {
  if (editNavigation(design, action)) return;
  if (action === 'add-theme' && design.themes.length < limits.themes) {
    const theme = { ...selectedTheme(design), id: randomUUID(), name: 'New theme' };
    design.themes.push(theme);
    design.activeTheme = theme.id;
    return;
  }
  if (action === 'add-component' && design.components.length < limits.components) {
    design.components.push(newComponent);
    return;
  }

  const match = /^(remove-theme|remove-component|move-up|move-down):(\d+)$/.exec(action);
  if (!match) throw new DashboardError('Choose a design action.');
  const [, operation, rawIndex] = match;
  const index = Number(rawIndex);
  const items = operation === 'remove-theme' ? design.themes : design.components;
  if (index >= items.length) throw new DashboardError('Choose an existing design entry.');
  if (operation.startsWith('remove')) {
    const [removed] = items.splice(index, 1);
    if (removed.id === design.activeTheme) design.activeTheme = 'editorial';
    return;
  }
  const destination = index + (operation === 'move-up' ? -1 : 1);
  if (destination < 0 || destination >= items.length) throw new DashboardError('The component is already at the end of the list.');
  [items[index], items[destination]] = [items[destination], items[index]];
}

function errorMessage(issue) {
  const [group, index, ...field] = issue.path;
  const labels = { themes: 'Theme', components: 'Component', pages: 'Page', navigation: 'Menu item' };
  if (Object.hasOwn(labels, group)) {
    const label = labels[group];
    return index === undefined ? issue.message : `${label} ${Number(index) + 1} (${field.join(' ') || 'details'}) · ${issue.message}`;
  }
  return issue.message;
}

export function handleDesign(storage, form, isPost) {
  const entry = storage.designRecord();
  const redirect = (message) => ({ location: dashboardUrl('design', null, message) });
  const source = entry.draft?.source ?? entry.live;
  if (!isPost) {
    const design = designSchema.parse(source ? JSON.parse(source) : emptyDesign);
    return { status: 200, html: renderDesign({ design, entry, notice: form.get('notice'), media: storage.media.list() }) };
  }

  const action = form.get('action');
  if (action === 'discard') {
    if (entry.version !== form.get('version')) throw new DashboardError('The design changed. Reopen the design tab before discarding.', 409);
    if (!entry.draft || form.get('confirm') !== 'yes') throw new DashboardError('Confirm that you want to discard the saved draft.');
    storage.discardDraft(entry);
    return redirect('Private design draft discarded.');
  }

  const design = readDesignForm(form, storage.media);
  const render = (settings, status = 200) => ({ status, html: renderDesign({ design, entry, media: storage.media.list(), ...settings }) });
  if (entry.version !== form.get('version')) {
    entry.version = form.get('version');
    return render({ errors: ['The design changed while you were editing. Copy any unsaved text, then reopen Design.'] }, 409);
  }
  if (!['save', 'apply', 'preview-light', 'preview-dark'].includes(action)) {
    editDesign(design, action);
    return render({});
  }

  const result = designSchema.safeParse(design);
  if (!result.success) return render({ errors: result.error.issues.map(errorMessage) }, 422);
  if (action.startsWith('preview-')) return render({ design: result.data, previewMode: action === 'preview-dark' ? 'dark' : 'light' });
  const updated = JSON.stringify(result.data, null, 2) + '\n';
  if (action === 'save') {
    storage.saveDraft(entry, updated);
    return redirect('Design draft saved on this Mac.');
  }
  const saved = entry.draft && designSchema.safeParse(JSON.parse(entry.draft.source));
  if (!saved?.success || JSON.stringify(saved.data) !== JSON.stringify(result.data)) {
    return render({ errors: ['Save your latest changes as a private draft before applying.'] }, 422);
  }
  try {
    storage.applyDraft(entry, () => storage.media.prepare(result.data.pages.flatMap(({ attachments }) => attachments)));
    return redirect('Local site design updated. Review it before publishing.');
  } catch (error) {
    if (!(error instanceof DashboardError)) throw error;
    return render({ errors: [error.message] }, error.status);
  }
}

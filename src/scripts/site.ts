const root = document.documentElement;
const toggle = document.querySelector<HTMLButtonElement>('.theme-toggle');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let preference: string | null = null;
try { preference = localStorage.getItem('theme'); } catch { /* Private browsing can disable storage. */ }

function syncThemeColor() {
  const background = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
}

function applyTheme(theme: 'light' | 'dark') {
  root.dataset.theme = theme;
  toggle?.setAttribute('aria-pressed', String(theme === 'dark'));
  syncThemeColor();
  document.dispatchEvent(new Event('theme:change'));
}
syncThemeColor();

if (toggle) {
  toggle.hidden = false;
  toggle.setAttribute('aria-label', 'Dark theme');
  toggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  toggle.addEventListener('click', () => {
    preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', preference); } catch { /* Keep the toggle usable without storage. */ }
    applyTheme(preference as 'light' | 'dark');
  });
}
systemTheme.addEventListener('change', (event) => {
  if (preference !== 'light' && preference !== 'dark') applyTheme(event.matches ? 'dark' : 'light');
});

const header = document.querySelector('.site-header');
header?.addEventListener('keydown', (event) => {
  if (!(event instanceof KeyboardEvent) || event.key !== 'Escape' || !(event.target instanceof Element)) return;
  const openMenu = event.target.closest<HTMLDetailsElement>('details[open]');
  if (!openMenu) return;
  openMenu.open = false;
  openMenu.querySelector('summary')?.focus();
});
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Node)) return;
  const target = event.target;
  header?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
    if (!menu.contains(target)) menu.open = false;
  });
});

for (const block of document.querySelectorAll<HTMLPreElement>('pre.astro-code')) {
  const code = block.querySelector('code');
  if (!code || !navigator.clipboard) continue;
  const toolbar = document.createElement('div');
  toolbar.className = 'code-toolbar';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-code';
  button.textContent = 'Copy code';
  button.setAttribute('aria-live', 'polite');
  button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code.textContent || ''); button.textContent = 'Copied'; }
    catch { button.textContent = 'Could not copy'; }
    window.setTimeout(() => { button.textContent = 'Copy code'; }, 2000);
  });
  toolbar.append(button);
  block.before(toolbar);
}

const diagrams = [...document.querySelectorAll<HTMLElement>('.diagram')];
if (diagrams.length) {
  let queued = Promise.resolve();
  let renderNumber = 0;
  const module = import('mermaid');
  const renderDiagrams = () => {
    queued = queued.then(async () => {
      const { default: mermaid } = await module;
      const styles = getComputedStyle(root);
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        theme: root.dataset.theme === 'dark' ? 'dark' : 'neutral',
        themeVariables: { fontFamily: styles.getPropertyValue('--body').trim(), primaryColor: styles.getPropertyValue('--surface').trim(), primaryTextColor: styles.getPropertyValue('--ink').trim(), lineColor: styles.getPropertyValue('--accent').trim() },
      });
      for (const figure of diagrams) {
        const source = figure.querySelector<HTMLPreElement>('.mermaid-source');
        if (!source) continue;
        try {
          const { svg } = await mermaid.render(`diagram-${++renderNumber}`, source.textContent || '');
          let output = figure.querySelector<HTMLDivElement>('.diagram-output');
          if (!output) { output = document.createElement('div'); output.className = 'diagram-output'; source.after(output); }
          output.innerHTML = svg;
          source.hidden = true;
        } catch {
          source.hidden = false;
          figure.querySelector('.diagram-output')?.remove();
          const caption = figure.querySelector('figcaption');
          if (caption) caption.textContent = 'Diagram could not be rendered. Its source is shown above.';
        }
      }
    }).catch(() => {
      // Keep readable diagram source when the renderer cannot load.
      for (const figure of diagrams) {
        const caption = figure.querySelector('figcaption');
        if (caption) caption.textContent = 'Diagram source (renderer unavailable)';
      }
    });
  };
  renderDiagrams();
  document.addEventListener('theme:change', renderDiagrams);
}

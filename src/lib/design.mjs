import { z } from 'astro/zod';
import { navigationFields, validateNavigation } from './navigation.mjs';

export const colorLabels = {
  bg: 'Page background',
  surface: 'Raised surface',
  paper: 'Card background',
  ink: 'Main text',
  muted: 'Secondary text',
  accent: 'Accent',
  'accent-hover': 'Accent on hover',
  line: 'Borders',
  'soft-accent': 'Accent tint',
};

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, 'Choose a six-digit hex color.');
const palette = z.object(Object.fromEntries(Object.keys(colorLabels).map((key) => [key, hex])));

export const fonts = {
  editorial: { label: 'Editorial', heading: "'Newsreader', Georgia, serif", body: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  system: { label: 'System sans serif', heading: 'system-ui, sans-serif', body: 'system-ui, sans-serif' },
  classic: { label: 'Classic serif', heading: 'Georgia, serif', body: 'Georgia, serif' },
};

export const spacing = {
  compact: { label: 'Compact', desktop: 54, mobile: 38 },
  standard: { label: 'Standard', desktop: 77, mobile: 55 },
  spacious: { label: 'Spacious', desktop: 100, mobile: 70 },
};

export const layouts = { card: 'Card', banner: 'Banner', split: 'Split' };
export const surfaces = { paper: 'Card', surface: 'Raised', tint: 'Accent tint' };

export const editorial = {
  id: 'editorial',
  name: 'Editorial',
  light: { bg: '#f7f4ed', surface: '#f0ece3', paper: '#fcfaf5', ink: '#302d28', muted: '#726a60', accent: '#a64e35', 'accent-hover': '#833a27', line: '#d9d2c5', 'soft-accent': '#ead7c8' },
  dark: { bg: '#1d1f1d', surface: '#252823', paper: '#222420', ink: '#eee9df', muted: '#b4aea1', accent: '#e1a082', 'accent-hover': '#f2bb9f', line: '#414238', 'soft-accent': '#453a30' },
  font: 'editorial',
  spacing: 'standard',
  width: 1200,
  radius: 3,
  textSize: 16,
};

export const emptyDesign = { activeTheme: 'editorial', themes: [], components: [] };
export const limits = { themes: 8, components: 20 };

const theme = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, 'Enter a theme name.').max(60),
  light: palette,
  dark: palette,
  font: z.enum(Object.keys(fonts)),
  spacing: z.enum(Object.keys(spacing)),
  width: z.number().int().min(880).max(1440),
  radius: z.number().int().min(0).max(36),
  textSize: z.number().int().min(14).max(20),
});

function validLink(value) {
  if (!value) return true;
  if (/^\/(?![\/\\])[^\\\s]*$/u.test(value)) return true;
  return /^https?:\/\//i.test(value) && URL.canParse(value);
}

const component = z.object({
  title: z.string().trim().min(1, 'Enter a component heading.').max(120),
  eyebrow: z.string().trim().max(70),
  body: z.string().trim().min(1, 'Enter the component text.').max(1200),
  layout: z.enum(Object.keys(layouts)),
  surface: z.enum(Object.keys(surfaces)),
  pages: z.array(z.string()),
  afterIntro: z.boolean(),
  linkText: z.string().trim().max(60),
  linkUrl: z.string().trim().max(300).refine(validLink, 'Use a site path like /projects/ or a full HTTP or HTTPS URL.'),
}).refine(({ linkText, linkUrl }) => Boolean(linkText) === Boolean(linkUrl), {
  path: ['linkText'], message: 'Enter both a button label and a destination, or leave both blank.',
});

export const designSchema = z.object({
  activeTheme: z.string(),
  themes: z.array(theme).max(limits.themes),
  components: z.array(component).max(limits.components),
  ...navigationFields,
}).superRefine((design, context) => {
  const { activeTheme, themes } = design;
  const ids = new Set(themes.map(({ id }) => id));
  if (ids.size !== themes.length) context.addIssue({ code: 'custom', path: ['themes'], message: 'Theme IDs must be unique.' });
  if (activeTheme !== 'editorial' && !ids.has(activeTheme)) {
    context.addIssue({ code: 'custom', path: ['activeTheme'], message: 'Choose a theme from your library.' });
  }
  validateNavigation(design, context);
});

/** @param {z.infer<typeof designSchema>} design */
export function selectedTheme(design) {
  return design.themes.find(({ id }) => id === design.activeTheme) ?? editorial;
}

function paletteCss(palette) {
  return Object.keys(colorLabels).map((key) => `--${key}: ${palette[key]};`).join(' ');
}

// Call only with a theme from the validated design.
export function themeCss(theme) {
  const font = fonts[theme.font];
  const space = spacing[theme.spacing];
  return `:root[data-custom-theme] { ${paletteCss(theme.light)}
    --heading: ${font.heading}; --body: ${font.body}; --layout-width: ${theme.width}px;
    --radius: ${theme.radius}px; --base-text-size: ${theme.textSize}px;
    --section-spacing: ${space.desktop}px; --section-spacing-mobile: ${space.mobile}px;
  }
  :root[data-custom-theme][data-theme='dark'] { ${paletteCss(theme.dark)} }
  @media (prefers-color-scheme: dark) {
    :root[data-custom-theme]:not([data-theme]) { ${paletteCss(theme.dark)} }
  }`;
}

/**
 * @param {z.infer<typeof designSchema>} design
 * @param {string} page
 * @param {boolean} afterIntro
 */
export function componentsFor(design, page, afterIntro) {
  const onHome = page === 'home' || page === design.homePage;
  return design.components.filter((component) =>
    (component.pages.includes(page) || (onHome && component.pages.includes('home')))
    && (onHome && component.afterIntro) === afterIntro,
  );
}

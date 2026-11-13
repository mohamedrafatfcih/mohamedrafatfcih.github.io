import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkMermaid } from './remark-mermaid.mjs';
import { remarkAttachments } from './remark-attachments.mjs';

/** @type {import('@astrojs/markdown-remark').ShikiConfig} */
export const shikiConfig = {
  themes: { light: 'github-light', dark: 'github-dark' },
  defaultColor: false,
};

export function markdownProcessor(remarkRehype, attachments = {}) {
  return unified({
    remarkPlugins: [remarkMath, remarkMermaid, [remarkAttachments, attachments]],
    rehypePlugins: [[rehypeKatex, { strict: 'warn', trust: false }]],
    remarkRehype,
  });
}

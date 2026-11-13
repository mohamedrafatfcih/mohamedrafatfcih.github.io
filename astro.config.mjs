import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { deployment } from './src/lib/deployment.mjs';
import { markdownProcessor, shikiConfig } from './src/lib/markdown.mjs';

const { site, base } = deployment(process.env);

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  outDir: process.env.VERIFY_SITE === 'true' ? './.verification-dist' : './dist',
  integrations: [mdx(), sitemap()],
  markdown: { processor: markdownProcessor(undefined, { base }), shikiConfig },
  vite: { build: { chunkSizeWarningLimit: 800 } },
});

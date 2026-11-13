import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { contentSchemas } from './lib/content-schemas.mjs';

const contentRoot = process.env.VERIFY_SITE === 'true' ? './tests/fixtures/content' : './src/content';

export const collections = {
  profile: defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/profile' }),
    schema: contentSchemas.profile,
  }),
  resume: defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/resume' }),
    schema: contentSchemas.resume,
  }),
  blog: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: `${contentRoot}/blog` }),
    schema: contentSchemas.blog,
  }),
  research: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: `${contentRoot}/research` }),
    schema: contentSchemas.research,
  }),
  projects: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: `${contentRoot}/projects` }),
    schema: contentSchemas.projects,
  }),
};

import { z } from 'astro/zod';
import { attachmentsSchema } from './media.mjs';

const text = z.string().trim().min(1);
const tags = z.array(text).transform((values) => [...new Map(values.map((value) => [value.toLowerCase(), value])).values()]);
const link = z.url().refine((value) => /^https?:\/\//.test(value), 'Use an HTTP or HTTPS URL');
const visibility = { draft: z.boolean().default(false) };

export const contentSchemas = {
  profile: z.object({ name: text, role: text, location: text, email: z.email(), description: text, current: text, experience: text, study: z.object({ degree: text, university: text, period: text, status: text }), github: link.optional(), linkedin: link.optional(), scholar: link.optional() }),
  resume: z.object({ title: text }),
  blog: z.object({ title: text, description: text, date: z.coerce.date(), category: text.optional(), tags: tags.default([]), attachments: attachmentsSchema, ...visibility }),
  research: z.object({ title: text, description: text, authors: z.array(text).min(1), year: z.number().int(), venue: text.optional(), paper: link.optional(), code: link.optional(), attachments: attachmentsSchema, ...visibility }),
  projects: z.object({ title: text, description: text, context: text, period: text, tags: tags.default([]), order: z.number().default(0), repository: link.optional(), demo: link.optional(), attachments: attachmentsSchema, ...visibility }),
};

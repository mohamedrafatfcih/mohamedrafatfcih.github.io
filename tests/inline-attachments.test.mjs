import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markdownProcessor, shikiConfig } from '../src/lib/markdown.mjs';

test('insertion markers render selected attachments in place and keep unplaced files at the end', async () => {
  const local = { id: '11111111-1111-4111-8111-111111111111', name: 'demo.mp4', bytes: 10 };
  const external = { id: '22222222-2222-4222-8222-222222222222', name: 'More information', url: 'https://example.org/file', kind: 'download' };
  const renderer = await markdownProcessor({ allowDangerousHtml: false }, { base: '/portfolio/', development: false }).createRenderer({ shikiConfig });
  const marker = `[[attachment:${local.id}]]`;
  const render = (body, files = [local, external]) => renderer.render(body, { frontmatter: { attachments: files } });
  const result = await render('Before.\n\n' + marker + '\n\nAfter.');
  assert.equal((result.code.match(/<video /g) || []).length, 1);
  assert.ok(result.code.indexOf('Before.') < result.code.indexOf('<video '));
  assert.ok(result.code.indexOf('<video ') < result.code.indexOf('After.'));
  assert.ok(result.code.indexOf('After.') < result.code.indexOf('More information'));
  assert.match(result.code, /src="\/portfolio\/attachments\/11111111-1111-4111-8111-111111111111.mp4"/);
  const example = await render('```text\n' + marker + '\n```');
  assert.match(example.code, /\[\[attachment:/);
  assert.equal((example.code.match(/<video /g) || []).length, 1);
  assert.ok(example.code.indexOf('astro-code') < example.code.indexOf('<video '));
  const removed = await render(marker, []);
  assert.doesNotMatch(removed.code, /attachment:|video/);
});

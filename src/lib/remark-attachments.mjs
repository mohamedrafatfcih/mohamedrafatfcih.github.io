import { attachmentFormat, attachmentsSchema, fileSize, mediaPath } from './media.mjs';
import { deployment } from './deployment.mjs';

const text = (value) => ({ type: 'text', value });

function element(tag, properties, children = []) {
  return { type: 'blockquote', data: { hName: tag, hProperties: properties }, children };
}

function attachmentNode(file, source) {
  const { kind } = attachmentFormat(file);
  const caption = element('figcaption', { className: ['attachment-name'] }, [
    element('strong', {}, [text(file.name)]),
    text(' '),
    element('span', { className: ['meta'] }, [text(file.url ? 'External link' : fileSize(file.bytes))]),
  ]);
  const children = [caption];
  if (kind === 'image') {
    children.push(element('img', { src: source, alt: file.name, loading: 'lazy' }));
  } else if (kind === 'video' || kind === 'audio') {
    children.push(element(kind, {
      src: source, controls: true, preload: 'metadata', ...(kind === 'video' ? { playsInline: true } : {}),
      ariaLabel: file.name,
    }));
  }

  const links = [];
  if (kind !== 'download' || file.url) {
    const label = kind === 'pdf' ? 'Open PDF' : kind === 'video' || kind === 'audio' ? 'Open player' : file.url && kind === 'download' ? 'Open file' : 'Preview';
    links.push(element('a', {
      href: source, target: '_blank', rel: ['noopener', 'noreferrer'], ariaLabel: `Open ${file.name}`,
    }, [text(label)]));
  }
  if (!file.url) {
    links.push(element('a', { href: source, download: file.name, ariaLabel: `Download ${file.name}` }, [text('Download')]));
  }
  children.push(element('div', { className: ['attachment-links'] }, links));
  return element('figure', { className: ['attachment-item'], dataAttachmentId: file.id }, children);
}

export function remarkAttachments(options = {}) {
  return function transform(tree, file) {
    const attachments = attachmentsSchema.parse(file.data.astro?.frontmatter?.attachments);
    const byId = new Map(attachments.map((attachment) => [attachment.id, attachment]));
    const placed = new Set();
    const base = options.base ?? deployment(process.env).base;
    const development = options.development ?? (process.env.NODE_ENV === 'development' || process.argv.includes('dev'));
    const source = (attachment) => {
      if (attachment.url) return attachment.url;
      if (options.dashboard) return '/media/file?' + new URLSearchParams({ id: attachment.id });
      return base + mediaPath(attachment) + (development ? '/' : '');
    };

    function visit(parent) {
      if (!parent.children) return;
      parent.children = parent.children.flatMap((node) => {
        const match = node.type === 'paragraph' && node.children?.length === 1
          && node.children[0].type === 'text'
          && /^\[\[attachment:([a-f0-9-]{36})\]\]$/i.exec(node.children[0].value.trim());
        if (match) {
          const attachment = byId.get(match[1]);
          // Unchecking an attachment also removes its placed copies from the page.
          if (!attachment) return [];
          placed.add(attachment.id);
          return [attachmentNode(attachment, source(attachment))];
        }
        visit(node);
        return [node];
      });
    }
    visit(tree);

    const remaining = attachments.filter(({ id }) => !placed.has(id));
    if (remaining.length) {
      tree.children.push(element('section', { className: ['attachments'], ariaLabel: 'Attachments' }, [
        { type: 'heading', depth: 2, children: [text('Attachments')] },
        ...remaining.map((attachment) => attachmentNode(attachment, source(attachment))),
      ]));
    }
  };
}

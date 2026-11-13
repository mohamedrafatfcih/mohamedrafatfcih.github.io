for (const picker of document.querySelectorAll('[data-media-picker]')) {
  const maxBytes = Number(picker.dataset.maxBytes);
  const maxAttachments = Number(picker.dataset.maxAttachments);
  const input = picker.querySelector('[data-media-input]');
  const status = picker.querySelector('[data-media-status]');
  const list = picker.querySelector('[data-media-list]');
  const field = picker.dataset.field;
  const linkButton = picker.querySelector('[data-add-link]');
  let uploading = false;

  picker.addEventListener('change', (event) => {
    if (event.target.type === 'checkbox' && list.querySelectorAll('input:checked').length > maxAttachments) {
      event.target.checked = false;
      status.textContent = `Choose up to ${maxAttachments} files per page.`;
    }
  });

  picker.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-insert-attachment]');
    if (!button) return;
    const row = button.closest('.media-row');
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (!checkbox.checked && list.querySelectorAll('input:checked').length >= maxAttachments) {
      status.textContent = `Choose up to ${maxAttachments} files per page.`;
      return;
    }
    const textarea = picker.closest('form')?.elements.namedItem(field === 'attachments' ? 'body' : field.replace(/attachments$/, 'body'));
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    checkbox.checked = true;
    const marker = `\n\n[[attachment:${button.dataset.insertAttachment}]]\n\n`;
    textarea.setRangeText(marker, textarea.selectionStart, textarea.selectionEnd, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
    status.textContent = 'Attachment inserted. Move its marker in the text to reposition it.';
  });

  picker.querySelector('.external-link-editor').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      linkButton.click();
    }
  });

  linkButton.addEventListener('click', async () => {
    if (uploading) return;
    const name = picker.querySelector('[data-link-name]');
    const url = picker.querySelector('[data-link-url]');
    const kind = picker.querySelector('[data-link-kind]');
    if (!name.value.trim() || !url.value.trim()) {
      status.textContent = 'Enter a file label and HTTPS URL.';
      return;
    }
    const selected = Boolean(field) && list.querySelectorAll('input:checked').length < maxAttachments;
    const query = new URLSearchParams({ field: field || '', select: selected ? '1' : '0' });
    uploading = true;
    input.disabled = true;
    linkButton.disabled = true;
    try {
      const response = await fetch('/media/link?' + query, {
        method: 'POST', body: new URLSearchParams({ name: name.value, url: url.value, kind: kind.value }),
      });
      if (!response.ok) {
        status.textContent = await response.text();
        return;
      }
      list.insertAdjacentHTML('beforeend', await response.text());
      name.value = '';
      url.value = '';
      status.textContent = selected ? 'File link added and selected for this page.' : 'File link saved in the library.';
    } catch {
      status.textContent = 'The file link could not be saved. Try again.';
    } finally {
      uploading = false;
      input.disabled = false;
      linkButton.disabled = false;
    }
  });

  picker.closest('form')?.addEventListener('submit', (event) => {
    if (uploading) {
      event.preventDefault();
      status.textContent = 'Wait for the uploads to finish.';
    }
  });

  input.addEventListener('change', async () => {
    const files = [...input.files];
    input.disabled = true;
    linkButton.disabled = true;
    uploading = true;
    const failures = [];
    let attached = 0;

    try {
      for (const file of files) {
        if (!file.size || file.size > maxBytes) {
          failures.push(`${file.name} must be between 1 byte and 95 MiB.`);
          continue;
        }
        status.textContent = `Uploading ${file.name}…`;
        const select = Boolean(field) && list.querySelectorAll('input:checked').length < maxAttachments;
        const query = new URLSearchParams({ name: file.name, field: field || '', select: select ? '1' : '0' });
        try {
          const response = await fetch('/media/upload?' + query, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file,
          });
          if (!response.ok) {
            failures.push(`${file.name}: ${await response.text()}`);
            continue;
          }
          list.insertAdjacentHTML('beforeend', await response.text());
          if (select) attached += 1;
        } catch {
          failures.push(`Could not upload ${file.name}.`);
        }
      }
      const uploaded = files.length - failures.length;
      const summary = uploaded ? `${uploaded} uploaded${field ? `, ${attached} selected for this page` : ''}.` : '';
      status.textContent = [summary, ...failures].filter(Boolean).join(' ');
    } finally {
      uploading = false;
      input.value = '';
      input.disabled = false;
      linkButton.disabled = false;
    }
  });
}

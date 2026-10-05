export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function openPrintDocument(title, text) {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(text);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${safeTitle}</title>
    <style>
      body { font-family: "Segoe UI", system-ui, sans-serif; margin: 24px; color: #142033; line-height: 1.45; }
      h1 { font-size: 1.35rem; }
      pre { white-space: pre-wrap; font-family: inherit; font-size: 1rem; }
    </style></head><body><h1>${safeTitle}</h1><pre>${safeBody}</pre></body></html>`;
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) return false;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 200);
  return true;
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

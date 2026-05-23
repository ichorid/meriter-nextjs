function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
}

/**
 * Renders community `futureVisionText` mirror (API `concatOfficialPlainText`) as simple HTML
 * when the collaborative document is not loaded yet.
 */
export function futureVisionMirrorPlainTextToHtml(plain: string): string {
  const trimmed = plain.trim();
  if (!trimmed) {
    return '';
  }

  const hasSectionHeaders = /^# .+/m.test(trimmed) || trimmed.includes('\n\n# ');
  if (!hasSectionHeaders) {
    return trimmed
      .split(/\n\n+/)
      .map(paragraphHtml)
      .filter(Boolean)
      .join('');
  }

  const chunks = trimmed.split(/\n\n(?=# )/);
  const htmlParts: string[] = [];

  for (const chunk of chunks) {
    const sectionMatch = chunk.match(/^# (.+?)(?:\n\n([\s\S]*))?$/);
    if (sectionMatch) {
      const title = sectionMatch[1]?.trim();
      if (title) {
        htmlParts.push(`<h2>${escapeHtml(title)}</h2>`);
      }
      const body = sectionMatch[2]?.trim();
      if (body) {
        htmlParts.push(
          ...body
            .split(/\n\n+/)
            .map(paragraphHtml)
            .filter(Boolean),
        );
      }
      continue;
    }

    htmlParts.push(
      ...chunk
        .split(/\n\n+/)
        .map(paragraphHtml)
        .filter(Boolean),
    );
  }

  return htmlParts.join('');
}

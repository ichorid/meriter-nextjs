/**
 * Parser for Meriter_Demo_Projects.tsv (Google Sheets export).
 * Tab-separated UTF-8; first line is header.
 */

export interface MeriterDemoProjectRow {
  /** 1-based row index in sheet (column №) */
  sheetIndex: number;
  author: string;
  company: string;
  title: string;
  body: string;
  /** Project URL or "-" / empty */
  projectUrl: string | null;
  /** Raw "Ценности" column (comma-separated Russian labels) */
  valuesRaw: string;
  imageUrl: string | null;
}

function splitTsvLine(line: string): string[] {
  return line.split('\t').map((c) => c.trim());
}

/** Strip zero-width / format chars sometimes present in sheet exports (e.g. T⁠-⁠Банк). */
export function normalizeCompanyName(raw: string): string {
  return raw
    .replace(/[\u200b\u200c\u200d\ufeff\u2060]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseMeriterDemoProjectsTsv(content: string): MeriterDemoProjectRow[] {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const header = lines[0].replace(/\r/g, '').trim();
  if (!header.includes('Заголовок') && !header.startsWith('№')) {
    throw new Error(
      'Unexpected TSV header. Expected Meriter_Demo_Projects export (columns № … Заголовок поста …).',
    );
  }

  const rows: MeriterDemoProjectRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitTsvLine(lines[i]);
    if (parts.length < 5) {
      continue;
    }
    const sheetIndex = parseInt(parts[0] ?? '', 10);
    const author = parts[1] ?? '';
    const company = normalizeCompanyName(parts[2] ?? '');
    const title = parts[3] ?? '';
    const body = parts[4] ?? '';
    const linkRaw = (parts[5] ?? '').trim();
    const valuesRaw = parts[6] ?? '';
    const imageRaw = (parts[7] ?? '').trim();

    if (!title || !company) {
      continue;
    }

    const projectUrl = linkRaw.length > 0 && linkRaw !== '-' ? linkRaw : null;

    rows.push({
      sheetIndex: Number.isFinite(sheetIndex) ? sheetIndex : i,
      author: author.trim(),
      company,
      title: title.trim(),
      body: body.trim(),
      projectUrl,
      valuesRaw: valuesRaw.trim(),
      imageUrl: imageRaw.length > 0 ? imageRaw : null,
    });
  }
  return rows;
}

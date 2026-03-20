/**
 * Parser for marketing TSV: Образ будущего | Школа | иллюстрации | Публикации
 * First line is header; tab-separated; UTF-8.
 */

export interface FutureVisionMarketingRow {
  visionText: string;
  school: string;
  /** Raw filename from sheet, if any; seed may map to placeholder URLs */
  illustrationFilename: string | null;
  /** Reference URL from marketing (stored as description hint in seed) */
  publicationUrl: string | null;
}

function splitTsvLine(line: string): string[] {
  return line.split('\t').map((c) => c.trim());
}

export function parseFutureVisionsMarketingTsv(content: string): FutureVisionMarketingRow[] {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const header = lines[0].replace(/\r/g, '').trim();
  if (!header.startsWith('Образ будущего')) {
    throw new Error(
      'Unexpected TSV header. First column must be "Образ будущего".',
    );
  }

  const rows: FutureVisionMarketingRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitTsvLine(lines[i]);
    if (parts.length < 2) {
      continue;
    }
    const visionText = parts[0] ?? '';
    const school = parts[1] ?? '';
    const illRaw = parts[2]?.trim() ?? '';
    const pubRaw = parts[3]?.trim() ?? '';
    if (!visionText || !school) {
      continue;
    }
    rows.push({
      visionText,
      school,
      illustrationFilename: illRaw.length > 0 ? illRaw : null,
      publicationUrl: pubRaw.length > 0 ? pubRaw : null,
    });
  }
  return rows;
}

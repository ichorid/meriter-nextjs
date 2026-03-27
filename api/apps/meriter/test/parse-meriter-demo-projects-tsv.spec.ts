import { readFileSync } from 'fs';
import {
  normalizeCompanyName,
  parseMeriterDemoProjectsTsv,
} from '../src/seed-data/parse-meriter-demo-projects-tsv';
import { resolveMeriterDemoProjectsTsvPath } from '../src/seed-data/resolve-seed-data-path';

describe('parseMeriterDemoProjectsTsv', () => {
  it('parses header and rows', () => {
    const raw =
      '№\tАвтор\tКомпания\tЗаголовок поста\tТекст поста\tСсылка\tЦенности\tКартинка\n' +
      '1\tВладислав\tБанк А\tЗаголовок\tТекст\t-\tЖизнь, Достоинство\thttps://ex/img.png\n';
    const rows = parseMeriterDemoProjectsTsv(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sheetIndex: 1,
      author: 'Владислав',
      company: 'Банк А',
      title: 'Заголовок',
      body: 'Текст',
      projectUrl: null,
      valuesRaw: 'Жизнь, Достоинство',
      imageUrl: 'https://ex/img.png',
    });
  });

  it('normalizes company names with zero-width chars', () => {
    expect(normalizeCompanyName('Т\u200b-\u200bБанк')).toBe('Т-Банк');
  });

  it('parses bundled Meriter_Demo_Projects.tsv with 41 data rows', () => {
    const raw = readFileSync(resolveMeriterDemoProjectsTsvPath(), 'utf-8');
    const rows = parseMeriterDemoProjectsTsv(raw);
    expect(rows).toHaveLength(41);
  });
});

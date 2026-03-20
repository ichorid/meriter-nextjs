import { parseFutureVisionsMarketingTsv } from '../src/seed-data/parse-future-visions-marketing-tsv';

describe('parseFutureVisionsMarketingTsv', () => {
  it('parses header and rows', () => {
    const raw =
      'Образ будущего\tШкола\tиллюстрации\tПубликации\n' +
      'Vision one\tSchool A\timg.png\thttps://example.com/a\n' +
      'Vision two\tSchool B\t\thttps://example.com/b\n';
    const rows = parseFutureVisionsMarketingTsv(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      visionText: 'Vision one',
      school: 'School A',
      illustrationFilename: 'img.png',
      publicationUrl: 'https://example.com/a',
    });
    expect(rows[1]).toMatchObject({
      visionText: 'Vision two',
      school: 'School B',
      illustrationFilename: null,
      publicationUrl: 'https://example.com/b',
    });
  });
});

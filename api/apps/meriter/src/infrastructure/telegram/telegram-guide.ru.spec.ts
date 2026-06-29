import { buildTelegramGuideMessage } from './telegram-guide.ru';

describe('buildTelegramGuideMessage', () => {
  it('includes formatted sections and tips', () => {
    const text = buildTelegramGuideMessage();
    expect(text).toContain('<b>Гайд по Meriter в Telegram</b>');
    expect(text).toContain('<b>1. ПЕРВЫЙ ЗАПУСК</b>');
    expect(text).toContain('<b>9. ШПАРГАЛКА</b>');
    expect(text).toContain('<i>Если у группы длинное название');
    expect(text).toContain('<i>(Хэштег может быть другой');
    expect(text).toContain('/guide — этот гайд в личку');
    expect(text).toContain('для @username');
    expect(text).toContain('получатель заслуг');
    expect(text.length).toBeLessThan(4096);
  });
});

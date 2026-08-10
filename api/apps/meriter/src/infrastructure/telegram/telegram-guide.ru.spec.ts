import { buildTelegramGuideMessage } from './telegram-guide.ru';

describe('buildTelegramGuideMessage', () => {
  it('includes formatted sections and reaction voting by default', () => {
    const text = buildTelegramGuideMessage();
    expect(text).toContain('<b>Гайд по Meriter в Telegram</b>');
    expect(text).toContain('<b>1. ПЕРВЫЙ ЗАПУСК</b>');
    expect(text).toContain('<b>9. ШПАРГАЛКА</b>');
    expect(text).toContain('#заслуга Предлагаю собраться в субботу');
    expect(text).toContain('Голосуйте реакциями:');
    expect(text).toContain('👍 — быстро +1 заслуга автору');
    expect(text).toContain('Голос → 👍 / ❤️ / 👎 или +3 / -2');
    expect(text).not.toContain('кнопки под постом');
    expect(text.length).toBeLessThan(4096);
  });

  it('uses panel voting copy when vote panel is enabled', () => {
    const text = buildTelegramGuideMessage({ votePanelEnabled: true, hashtags: ['заслуга'] });
    expect(text).toContain('Под постами — кнопки начисления заслуг:');
    expect(text).toContain('Своя сумма — ввести число');
    expect(text).not.toContain('Голосуйте реакциями:');
    expect(text).toContain('Голос → кнопки под постом (+1, своя сумма, против)');
  });

  it('uses configured hashtag in examples', () => {
    const text = buildTelegramGuideMessage({ hashtags: ['предложение'] });
    expect(text).toContain('#предложение Предлагаю собраться в субботу');
    expect(text).toContain('«#предложение для @username …»');
  });
});

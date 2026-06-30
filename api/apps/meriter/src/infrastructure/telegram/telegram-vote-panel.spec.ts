import {
  buildVotePanelKeyboard,
  buildVotePanelMessageText,
  metricsFromPublicationDoc,
  parseVotePanelCallback,
} from './telegram-vote-panel';

describe('telegram-vote-panel', () => {
  it('builds nomination panel text', () => {
    const text = buildVotePanelMessageText({
      displayName: 'Пётр',
      isNomination: true,
      nominatorDisplayName: 'Иван',
    });
    expect(text).toContain('Пётр');
    expect(text).toContain('номинация от Иван');
  });

  it('keyboard shows up total on +1 button', () => {
    const kb = buildVotePanelKeyboard('pub-1', { upMerits: 12, downMerits: 3 });
    expect(kb.inline_keyboard[0][0].text).toBe('+1 — 12');
    expect(kb.inline_keyboard[1][1].text).toBe('Против — 3');
    expect(kb.inline_keyboard[0][0].callback_data).toBe('vp:pub-1:up:1');
    expect(kb.inline_keyboard[1][0].callback_data).toBe('vp:pub-1:up:custom');
  });

  it('parses vote panel callbacks', () => {
    expect(parseVotePanelCallback('vp:abc:up:3')).toEqual({
      publicationId: 'abc',
      direction: 'up',
      amount: 3,
    });
    expect(parseVotePanelCallback('vp:abc:up:custom')).toEqual({
      publicationId: 'abc',
      direction: 'up',
      custom: true,
    });
    expect(parseVotePanelCallback('settings:toggle:vote_panel:x')).toBeNull();
  });

  it('reads metrics from publication doc', () => {
    expect(metricsFromPublicationDoc({ metrics: { upvotes: 5, downvotes: 2 } })).toEqual({
      upMerits: 5,
      downMerits: 2,
    });
  });
});

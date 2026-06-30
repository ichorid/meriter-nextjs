import {
  buildVotePanelKeyboard,
  buildVotePanelMessageText,
  metricsFromPublicationDoc,
  netMerits,
  parseVotePanelCallback,
} from './telegram-vote-panel';

describe('telegram-vote-panel', () => {
  it('builds nomination panel text with net merits', () => {
    const text = buildVotePanelMessageText(
      {
        displayName: 'Пётр',
        isNomination: true,
        nominatorDisplayName: 'Иван',
      },
      { upMerits: 5, downMerits: 2 },
    );
    expect(text).toContain('Пётр');
    expect(text).toContain('номинация от Иван');
    expect(text).toContain('Сейчас заслуг: 3');
  });

  it('keyboard uses plain labels without merit counters', () => {
    const kb = buildVotePanelKeyboard('pub-1');
    expect(kb.inline_keyboard[0][0].text).toBe('+1');
    expect(kb.inline_keyboard[1][1].text).toBe('Против');
    expect(kb.inline_keyboard[0][0].callback_data).toBe('vp:pub-1:up:1');
    expect(kb.inline_keyboard[1][0].callback_data).toBe('vp:pub-1:up:custom');
  });

  it('netMerits subtracts downvotes from upvotes', () => {
    expect(netMerits({ upMerits: 12, downMerits: 3 })).toBe(9);
    expect(netMerits({ upMerits: 2, downMerits: 5 })).toBe(-3);
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

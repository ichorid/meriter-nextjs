import {
  parseVoteAmountReply,
  resolveVoteAmountDirection,
} from './telegram-vote-amount-parse';

describe('parseVoteAmountReply', () => {
  it('accepts plain numbers', () => {
    expect(parseVoteAmountReply('10')).toEqual({ ok: true, amount: 10, explicitDirection: undefined });
    expect(parseVoteAmountReply('10.5')).toEqual({ ok: true, amount: 10.5, explicitDirection: undefined });
    expect(parseVoteAmountReply('10,5')).toEqual({ ok: true, amount: 10.5, explicitDirection: undefined });
  });

  it('accepts signed numbers and merit suffix', () => {
    expect(parseVoteAmountReply('+10')).toEqual({ ok: true, amount: 10, explicitDirection: 'up' });
    expect(parseVoteAmountReply('-10')).toEqual({ ok: true, amount: 10, explicitDirection: 'down' });
    expect(parseVoteAmountReply('10 заслуг')).toEqual({
      ok: true,
      amount: 10,
      explicitDirection: undefined,
    });
    expect(parseVoteAmountReply('+10 заслуг')).toEqual({
      ok: true,
      amount: 10,
      explicitDirection: 'up',
    });
  });

  it('finds the first number in longer phrases', () => {
    expect(parseVoteAmountReply('поставлю 10 заслуг автору')).toEqual({
      ok: true,
      amount: 10,
      explicitDirection: undefined,
    });
  });

  it('rejects empty and non-numeric input', () => {
    expect(parseVoteAmountReply('')).toEqual({ ok: false });
    expect(parseVoteAmountReply('заслуг')).toEqual({ ok: false });
    expect(parseVoteAmountReply('0')).toEqual({ ok: false });
  });
});

describe('resolveVoteAmountDirection', () => {
  it('keeps pending direction without explicit sign', () => {
    expect(resolveVoteAmountDirection('up')).toEqual({ direction: 'up', flipped: false });
  });

  it('flips when explicit sign overrides pending direction', () => {
    expect(resolveVoteAmountDirection('up', 'down')).toEqual({ direction: 'down', flipped: true });
    expect(resolveVoteAmountDirection('down', 'up')).toEqual({ direction: 'up', flipped: true });
    expect(resolveVoteAmountDirection('down', 'down')).toEqual({ direction: 'down', flipped: false });
  });
});

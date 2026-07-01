export type ParsedVoteAmountReply =
  | {
      ok: true;
      amount: number;
      /** Set when user prefixed the number with + or −. */
      explicitDirection?: 'up' | 'down';
    }
  | { ok: false };

const VOTE_AMOUNT_TOKEN =
  /([+-]?)(\d+(?:[.,]\d+)?)(?:\s*(?:заслуг(?:а|и|у|ами|ах)?|merit(?:s)?))?/i;

/** Parse free-form vote amount replies (10, +10, 10 заслуг, «поставлю 10 заслуг», …). */
export function parseVoteAmountReply(text: string): ParsedVoteAmountReply {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false };
  }

  const match = trimmed.match(VOTE_AMOUNT_TOKEN);
  if (!match) {
    return { ok: false };
  }

  const sign = match[1] ?? '';
  const amount = parseFloat(match[2].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false };
  }

  let explicitDirection: 'up' | 'down' | undefined;
  if (sign === '-') {
    explicitDirection = 'down';
  } else if (sign === '+') {
    explicitDirection = 'up';
  }

  return { ok: true, amount, explicitDirection };
}

export function resolveVoteAmountDirection(
  pendingDirection: 'up' | 'down',
  explicitDirection?: 'up' | 'down',
): { direction: 'up' | 'down'; flipped: boolean } {
  if (explicitDirection == null) {
    return { direction: pendingDirection, flipped: false };
  }
  return {
    direction: explicitDirection,
    flipped: explicitDirection !== pendingDirection,
  };
}

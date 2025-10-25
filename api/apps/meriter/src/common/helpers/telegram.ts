/**
 * Encode a deep link for Telegram
 * @param action - The action type (e.g., 'publication', 'community', 'poll')
 * @param id - Optional ID to include
 * @returns Encoded deep link string
 */
export function encodeTelegramDeepLink(action: string, id?: string): string {
  const data = id ? `${action}:${id}` : action;
  return Buffer.from(data).toString('base64url');
}

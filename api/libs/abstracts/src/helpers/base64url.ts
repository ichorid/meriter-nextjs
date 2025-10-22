/**
 * Base64URL encoding utilities for Telegram deep links
 * Base64URL is URL-safe base64 encoding that replaces:
 * - '+' with '-'
 * - '/' with '_' 
 * - Removes padding '='
 */

export function base64urlEncode(str: string): string {
  // Convert string to base64
  const base64 = Buffer.from(str, 'utf8').toString('base64');
  
  // Convert to base64url
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function base64urlDecode(str: string): string {
  // Convert from base64url to base64
  let base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  
  // Decode from base64
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Encode deep link parameters for Telegram
 * @param action - The action (e.g., 'publication', 'poll', 'community')
 * @param id - The identifier (e.g., 'communities/-1003040721280/posts/77c7b4d9')
 * @returns Base64URL encoded string
 */
export function encodeTelegramDeepLink(action: string, id?: string): string {
  const data = id ? `${action}:${id}` : action;
  return base64urlEncode(data);
}

/**
 * Decode Telegram deep link parameters
 * @param encodedData - Base64URL encoded string from Telegram start_param
 * @returns Object with action and id
 */
export function decodeTelegramDeepLink(encodedData: string): { action: string; id?: string } {
  try {
    const decoded = base64urlDecode(encodedData);
    const colonIndex = decoded.indexOf(':');
    
    if (colonIndex === -1) {
      // No colon found, it's just an action
      return { action: decoded };
    }
    
    const action = decoded.substring(0, colonIndex);
    const id = decoded.substring(colonIndex + 1);
    
    return { action, id };
  } catch (error) {
    console.error('Failed to decode Telegram deep link:', error);
    // Fallback: treat as simple action
    return { action: encodedData };
  }
}

/**
 * Check if a string looks like it could be base64url encoded
 * @param str - String to check
 * @returns true if string looks like base64url
 */
export function looksLikeBase64url(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  
  // Must contain only valid base64url characters
  if (!/^[A-Za-z0-9_-]*$/.test(str)) return false;
  
  // Must be reasonably long (base64url encoded data is usually longer)
  if (str.length < 8) return false;
  
  // Must contain base64url-specific characters (- or _) or be long enough to be encoded data
  return str.includes('-') || str.includes('_') || str.length > 20;
}

export function base64urlEncode(str: string): string {
  // Convert string to base64
  const base64 = btoa(str);
  
  // Convert to base64url
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function base64urlDecode(str: string): string {
  // Validate input
  if (!str || typeof str !== 'string') {
    throw new Error('Invalid input: string required');
  }
  
  // Check for valid base64url characters
  if (!/^[A-Za-z0-9_-]*$/.test(str)) {
    throw new Error('Invalid base64url characters');
  }
  
  // Convert from base64url to base64
  let base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  
  // Validate base64 format before decoding
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error('Invalid base64 format');
  }
  
  try {
    // Decode from base64
    return atob(base64);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Base64 decode failed: ${message}`);
  }
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
    // Validate input
    if (!encodedData || typeof encodedData !== 'string') {
      console.warn('Invalid Telegram deep link data:', encodedData);
      return { action: 'login' }; // Default fallback
    }
    
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
    console.error('Original data:', encodedData);
    
    // Fallback: treat as simple action if it looks like a valid action
    if (typeof encodedData === 'string' && /^[a-zA-Z-]+$/.test(encodedData)) {
      return { action: encodedData };
    }
    
    // Ultimate fallback: redirect to login
    return { action: 'login' };
  }
}

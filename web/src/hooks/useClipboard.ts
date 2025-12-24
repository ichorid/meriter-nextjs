import { useState, useCallback } from 'react';

export function useClipboard(timeout: number = 2000) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      
      if (timeout > 0) {
        setTimeout(() => setCopied(false), timeout);
      }
      
      return true;
    } catch {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, [timeout]);

  const reset = useCallback(() => {
    setCopied(false);
  }, []);

  return { copied, copyToClipboard, reset };
}

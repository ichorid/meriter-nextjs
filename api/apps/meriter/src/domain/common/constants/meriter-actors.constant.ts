/**
 * Synthetic actor id for automated document operations (e.g. §12.2 auto-apply).
 * Not a row in `users` — display layers should treat as «system».
 */
export const MERITER_DOCUMENT_AUTO_APPLY_USER_ID = '__meriter_auto_document__' as const;

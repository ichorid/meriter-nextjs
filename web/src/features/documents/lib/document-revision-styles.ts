import { cn } from '@/lib/utils';

export const DOC_REVISION_DELETE_CLASS = 'doc-revision-del';
export const DOC_REVISION_INSERT_CLASS = 'doc-revision-ins';

/** TipTap often wraps li text in <p> — list markers/spacing live in globals.css. */
export const documentRichListProseClass = cn(
  '[&_li]:leading-relaxed',
  '[&_li>p]:my-0',
  '[&_li>p:first-child]:mt-0',
  '[&_li>p:last-child]:mb-0',
);

/** Prose wrapper for rich preview with <del>/<ins> revision marks. */
export const documentRevisionMarkupProseClass = cn(
  '[&_.doc-revision-del]:rounded-sm [&_.doc-revision-del]:bg-error/30 [&_.doc-revision-del]:px-1',
  '[&_.doc-revision-del]:font-medium [&_.doc-revision-del]:text-error',
  '[&_.doc-revision-del]:line-through [&_.doc-revision-del]:decoration-error',
  '[&_.doc-revision-del]:decoration-2',
  '[&_.doc-revision-ins]:rounded-sm [&_.doc-revision-ins]:bg-amber-400/25 [&_.doc-revision-ins]:px-1',
  '[&_.doc-revision-ins]:font-semibold [&_.doc-revision-ins]:text-base-content',
  '[&_.doc-revision-ins]:no-underline [&_.doc-revision-ins]:ring-1 [&_.doc-revision-ins]:ring-inset',
  '[&_.doc-revision-ins]:ring-amber-400/45',
  '[&_li.doc-revision-ins]:rounded-sm',
);

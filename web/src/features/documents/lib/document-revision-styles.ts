import { cn } from '@/lib/utils';

export const DOC_REVISION_DELETE_CLASS = 'doc-revision-del';
export const DOC_REVISION_INSERT_CLASS = 'doc-revision-ins';

/** Keep list markers inside padded content (avoids bullets past card edge). */
export const documentRichListProseClass = cn(
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-1',
  '[&_li]:break-words [&_li]:pl-0.5',
);

/** Prose wrapper for rich preview with <del>/<ins> revision marks. */
export const documentRevisionMarkupProseClass = cn(
  documentRichListProseClass,
  '[&_.doc-revision-del]:rounded-sm [&_.doc-revision-del]:bg-error/30 [&_.doc-revision-del]:px-1',
  '[&_.doc-revision-del]:font-medium [&_.doc-revision-del]:text-error',
  '[&_.doc-revision-del]:line-through [&_.doc-revision-del]:decoration-error',
  '[&_.doc-revision-del]:decoration-2',
  '[&_.doc-revision-ins]:rounded-sm [&_.doc-revision-ins]:bg-primary/25 [&_.doc-revision-ins]:px-1',
  '[&_.doc-revision-ins]:font-semibold [&_.doc-revision-ins]:text-base-content',
  '[&_.doc-revision-ins]:no-underline [&_.doc-revision-ins]:ring-1 [&_.doc-revision-ins]:ring-inset',
  '[&_.doc-revision-ins]:ring-primary/40',
);

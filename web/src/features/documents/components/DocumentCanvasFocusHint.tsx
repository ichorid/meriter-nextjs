'use client';

import { useTranslations } from 'next-intl';
import { DismissibleHint } from '@/components/molecules/DismissibleHint/DismissibleHint';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';

const HINT_STORAGE_KEY = 'document-canvas-block-panel';

export function DocumentCanvasFocusHint() {
  const tCanvas = useTranslations('pages.documents.canvas');
  const focus = useDocumentCanvasFocus();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  if (!isDesktop || !focus || focus.focusedBlockId) {
    return null;
  }

  return (
    <DismissibleHint
      storageKey={HINT_STORAGE_KEY}
      dismissText={tCanvas('dontShowAgain')}
      className="mb-4"
    >
      {tCanvas('focusHint')}
    </DismissibleHint>
  );
}

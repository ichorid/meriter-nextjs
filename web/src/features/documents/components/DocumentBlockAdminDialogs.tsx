'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { RichTextEditor } from '@/components/molecules/RichTextEditor';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import {
  MAX_VARIANT_HTML_LENGTH,
  historyReasonLabelKey,
  isEmptyTipTapHtml,
  parseDateMs,
} from '@/features/documents/lib/document-canvas-shared';

export function DocumentBlockAdminDialogs() {
  const focus = useDocumentCanvasFocus();
  const t = useTranslations('pages.documents');
  const utils = trpc.useUtils();

  const adminOverrideRef = useRef('');
  const [adminOverrideResetKey, setAdminOverrideResetKey] = useState(0);

  if (!focus) {
    return null;
  }

  const { adminDialog, closeAdminDialog, documentId, addToast, getBlock } = focus;

  const blockId =
    adminDialog.kind === 'history' || adminDialog.kind === 'adminOverride'
      ? adminDialog.blockId
      : null;
  const block = blockId ? getBlock(blockId) : null;

  const adminOverrideMutation = trpc.documents.applyAdminOverride.useMutation({
    onSuccess: async () => {
      addToast(t('adminOverrideSuccess'), 'success');
      closeAdminDialog();
      adminOverrideRef.current = '';
      setAdminOverrideResetKey((k) => k + 1);
      if (blockId) {
        await utils.documents.getById.invalidate({ id: documentId });
        await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
      }
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const historyEntries = [...(block?.editHistory ?? [])].sort((a, b) => {
    const ta = parseDateMs(a.changedAt) ?? 0;
    const tb = parseDateMs(b.changedAt) ?? 0;
    return tb - ta;
  });

  const submitAdminOverride = () => {
    if (!blockId) return;
    const trimmed = adminOverrideRef.current.trim();
    if (isEmptyTipTapHtml(trimmed)) return;
    if (trimmed.length > MAX_VARIANT_HTML_LENGTH) {
      addToast(t('proposalTooLong', { max: MAX_VARIANT_HTML_LENGTH }), 'error');
      return;
    }
    adminOverrideMutation.mutate({
      documentId,
      blockId,
      newContent: trimmed,
    });
  };

  return (
    <>
      <Dialog
        open={adminDialog.kind === 'adminOverride'}
        onOpenChange={(open) => {
          if (!open) closeAdminDialog();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('adminOverrideTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-base-content/70">{t('adminOverrideHelp')}</p>
          <RichTextEditor
            key={`admin-override-${blockId ?? 'none'}-${adminOverrideResetKey}`}
            content={block?.officialContent ?? ''}
            onChange={(html) => {
              adminOverrideRef.current = html;
            }}
            editable={!adminOverrideMutation.isPending}
            className="[&_.ProseMirror]:min-h-[160px]"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => closeAdminDialog()}
            >
              {t('adminOverrideCancel')}
            </Button>
            <Button
              type="button"
              className="rounded-lg"
              disabled={adminOverrideMutation.isPending}
              onClick={submitAdminOverride}
            >
              {t('adminOverrideSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adminDialog.kind === 'history'}
        onOpenChange={(open) => {
          if (!open) closeAdminDialog();
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('historyTitle')}</DialogTitle>
          </DialogHeader>
          {historyEntries.length === 0 ? (
            <p className="text-sm text-base-content/60">{t('historyEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {historyEntries.map((entry, idx) => (
                <li
                  key={`${parseDateMs(entry.changedAt) ?? idx}-${entry.changedBy}`}
                  className="rounded-lg border border-base-300 p-3"
                >
                  <div className="mb-2 flex flex-wrap gap-2 text-xs text-base-content/60">
                    <Badge variant="secondary" className="rounded-md font-normal">
                      {t(historyReasonLabelKey(entry.reason))}
                    </Badge>
                    <span>
                      {entry.changedAt ? new Date(entry.changedAt).toLocaleString() : ''}
                    </span>
                  </div>
                  <DocumentRichContent html={entry.previousContent} className="text-sm" />
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

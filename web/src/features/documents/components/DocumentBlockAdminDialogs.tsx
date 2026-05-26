'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { RichTextEditor } from '@/components/molecules/RichTextEditor';
import { DocumentBlockHistoryPanel } from '@/features/documents/components/DocumentBlockHistoryPanel';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import {
  MAX_VARIANT_HTML_LENGTH,
  isEmptyTipTapHtml,
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
        await utils.documentVariants.getBlockGovernanceHistory.invalidate({ documentId, blockId });
      }
    },
    onError: (err) => addToast(err.message, 'error'),
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
          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-sm">
            <p className="leading-relaxed text-base-content/85">{t('adminOverrideHelpLead')}</p>
            <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-base-content/65">
              <li>{t('adminOverrideHelpItemAccess')}</li>
              <li>{t('adminOverrideHelpItemVariants')}</li>
              <li>{t('adminOverrideHelpItemHistory')}</li>
            </ul>
          </div>
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
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('historyTitle')}</DialogTitle>
          </DialogHeader>
          {block ? (
            <DocumentBlockHistoryPanel documentId={documentId} block={block} />
          ) : (
            <p className="text-sm text-base-content/60">{t('historyEmpty')}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

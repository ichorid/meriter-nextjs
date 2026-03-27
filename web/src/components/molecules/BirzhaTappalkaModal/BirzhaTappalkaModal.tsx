'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/shadcn/dialog';
import { TappalkaScreen } from '@/features/tappalka';
import { useTranslations } from 'next-intl';

interface BirzhaTappalkaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** marathon-of-good (Birzha) community id */
  communityId: string | null;
}

/**
 * Full-screen tappalka mining UI for the Birzha community, without leaving the current page.
 */
export function BirzhaTappalkaModal({ open, onOpenChange, communityId }: BirzhaTappalkaModalProps) {
  const tCommunities = useTranslations('pages.communities');

  if (!communityId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto p-0 bg-base-200 sm:rounded-lg"
          onInteractOutside={(e) => {
            e.preventDefault();
          }}
        >
          <DialogTitle className="sr-only">{tCommunities('tappalka')}</DialogTitle>
          <TappalkaScreen communityId={communityId} onClose={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
      {open && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              [data-radix-dialog-overlay][data-state="open"] {
                background-color: rgba(0, 0, 0, 0.4) !important;
              }
            `,
          }}
        />
      )}
    </>
  );
}

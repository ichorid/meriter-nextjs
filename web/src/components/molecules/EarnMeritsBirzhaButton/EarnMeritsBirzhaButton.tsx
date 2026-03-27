'use client';

import { useState } from 'react';
import { Scale } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { useBirzhaCommunityId } from '@/hooks/useBirzhaCommunityId';
import { BirzhaTappalkaModal } from '@/components/molecules/BirzhaTappalkaModal/BirzhaTappalkaModal';
import { cn } from '@/lib/utils';

interface EarnMeritsBirzhaButtonProps {
  className?: string;
  /** Hide label on narrow screens (icon + short layout). */
  label?: 'always' | 'smAndUp';
}

/**
 * Opens Birzha (marathon-of-good) tappalka mining in a modal without navigating away.
 */
export function EarnMeritsBirzhaButton({
  className,
  label = 'smAndUp',
}: EarnMeritsBirzhaButtonProps) {
  const t = useTranslations('common');
  const birzhaId = useBirzhaCommunityId();
  const [open, setOpen] = useState(false);

  if (!birzhaId) return null;

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          'rounded-xl active:scale-[0.98] px-3 h-9 text-sm font-semibold shadow-sm',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'inline-flex items-center justify-center gap-2 whitespace-nowrap',
          className,
        )}
        aria-label={t('earnMerits')}
      >
        <Scale size={16} className="shrink-0" aria-hidden />
        {label === 'smAndUp' ? (
          <span className="hidden sm:inline">{t('earnMerits')}</span>
        ) : (
          <span>{t('earnMerits')}</span>
        )}
      </Button>
      <BirzhaTappalkaModal open={open} onOpenChange={setOpen} communityId={birzhaId} />
    </>
  );
}

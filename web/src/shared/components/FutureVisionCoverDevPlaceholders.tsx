'use client';

import config from '@/config';
import { Button } from '@/components/ui/shadcn/button';
import { useTranslations } from 'next-intl';

const COVER_PLACEHOLDER_SIZES = [
  { w: 400, h: 225, label: '400×225' },
  { w: 800, h: 450, label: '800×450' },
  { w: 1200, h: 675, label: '1200×675' },
] as const;

function getPlaceholderUrl(width: number, height: number, seed: string): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

export interface FutureVisionCoverDevPlaceholdersProps {
  onSelectUrl: (url: string) => void;
  disabled?: boolean;
}

/**
 * Dev-only: preset placeholder image buttons for Future Vision cover (16:9).
 * Renders only when config.app.isDevelopment is true.
 */
export function FutureVisionCoverDevPlaceholders({
  onSelectUrl,
  disabled = false,
}: FutureVisionCoverDevPlaceholdersProps) {
  const t = useTranslations('projects');

  if (!config.app.isDevelopment) return null;

  return (
    <div className="rounded-xl border border-dashed border-base-300 bg-base-200/30 p-4 space-y-3">
      <p className="text-sm font-medium text-base-content/80">
        {t('devCoverPlaceholdersTitle', { defaultValue: 'Add placeholder cover (dev only)' })}
      </p>
      <div className="flex flex-wrap gap-2">
        {COVER_PLACEHOLDER_SIZES.map(({ w, h, label }) => (
          <Button
            key={`${w}x${h}`}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={disabled}
            onClick={() => onSelectUrl(getPlaceholderUrl(w, h, `ob-cover-${w}-${h}`))}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

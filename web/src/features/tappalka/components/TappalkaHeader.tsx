'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';
import { formatMerits } from '@/lib/utils/currency';

interface TappalkaHeaderProps {
  currentComparisons: number;
  comparisonsRequired: number;
  meritBalance: number;
  onBack?: () => void;
  showBackButton?: boolean;
  className?: string;
}

export const TappalkaHeader: React.FC<TappalkaHeaderProps> = ({
  currentComparisons,
  comparisonsRequired,
  meritBalance,
  onBack,
  showBackButton = false,
  className,
}) => {
  const tAria = useTranslations('common.ariaLabels');
  const t = useTranslations('postCarousel');
  // Calculate progress percentage
  const progressPercent = comparisonsRequired > 0
    ? Math.min(100, (currentComparisons / comparisonsRequired) * 100)
    : 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 bg-base-100 border-b border-base-300 dark:border-base-700 p-4',
        className,
      )}
    >
      {/* Top row: Back button (if shown) and title */}
      <div className="flex items-center gap-3">
        {showBackButton && onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 w-8 p-0 rounded-full hover:bg-base-200 dark:hover:bg-base-800"
            aria-label={tAria('back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-lg font-semibold text-base-content flex-1">
          {t('comparePostsTitle')}
        </h1>
        {/* Balance on the right - with padding to avoid overlap with close button */}
        <div className="flex items-center gap-1.5 text-sm pr-12">
          <span className="text-base-content/60">Баланс:</span>
          <span className="font-semibold text-base-content">
            {meritBalance > 0 ? `+${formatMerits(meritBalance)}` : formatMerits(meritBalance)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-base-content/70">
            Прогресс: {currentComparisons} / {comparisonsRequired}
          </span>
          <span className="text-base-content/60 font-medium">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="relative h-3 bg-base-200 dark:bg-base-800 rounded-full overflow-hidden">
          {/* Progress fill */}
          <div
            className={cn(
              'absolute left-0 top-0 bottom-0 transition-all duration-300 rounded-full',
              progressPercent >= 100
                ? 'bg-green-500'
                : 'bg-blue-500',
            )}
            style={{
              width: `${progressPercent}%`,
            }}
          />
          {/* Progress indicator line */}
          {progressPercent > 0 && progressPercent < 100 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-base-content/20"
              style={{
                left: `${progressPercent}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};


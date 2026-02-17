'use client';

import React, { useState } from 'react';
import { Scale } from 'lucide-react';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { formatMerits } from '@/lib/utils/currency';

interface QuotaDisplayProps {
  balance?: number;
  quotaRemaining?: number;
  quotaMax?: number;
  currencyIconUrl?: string;
  isMarathonOfGood?: boolean;
  showPermanent?: boolean;
  showDaily?: boolean;
  compact?: boolean;
  className?: string;
  /** When provided, shows "Earn merits" button at bottom of hint dialog; called on click (e.g. open tappalka). */
  onEarnMeritsClick?: () => void;
}

export function QuotaDisplay({
  balance,
  quotaRemaining = 0,
  quotaMax = 0,
  currencyIconUrl,
  isMarathonOfGood = false,
  showPermanent = true,
  showDaily = true,
  compact = false,
  className = '',
  onEarnMeritsClick,
}: QuotaDisplayProps) {
  const tCommon = useTranslations('common');
  const tCommunities = useTranslations('communities');
  const [showQuotaHint, setShowQuotaHint] = useState(false);
  const earnMeritsLabel = tCommon('earnMerits');

  const handleEarnMeritsClick = () => {
    setShowQuotaHint(false);
    onEarnMeritsClick?.();
  };

  const hasPermanent = showPermanent && balance !== undefined;
  const hasDaily = showDaily && quotaMax > 0;

  if (!hasPermanent && !hasDaily) {
    return null;
  }

  const handleClick = () => {
    if (hasDaily || hasPermanent) {
      setShowQuotaHint(true);
    }
  };

  if (compact) {
    return (
      <>
        <div 
          className={`flex items-center gap-2 text-xs cursor-pointer hover:opacity-80 transition-opacity ${className}`}
          onClick={handleClick}
        >
          {hasDaily ? (
            <>
              <span className="text-base-content/70">{tCommon('youHave')}</span>
              <DailyQuotaRing
                remaining={quotaRemaining}
                max={quotaMax}
                className="w-4 h-4 flex-shrink-0"
                asDiv={true}
                variant={isMarathonOfGood ? 'golden' : 'default'}
              />
              {hasPermanent && balance !== undefined && (
                <span className="text-base-content/70">
                  {(() => {
                    const text = tCommon('andMoreMerits', { count: balance });
                    // Replace the number with a bold version
                    const parts = text.split(String(balance));
                    if (parts.length === 2) {
                      return (
                        <>
                          {parts[0]}
                          <span className="font-semibold">{formatMerits(balance)}</span>
                          {parts[1]}
                        </>
                      );
                    }
                    return text;
                  })()}
                </span>
              )}
            </>
          ) : (
            hasPermanent && balance !== undefined && (
              <span className="text-base-content/70">
                {(() => {
                  const text = tCommon('youHaveMerits', { count: balance });
                  // Replace the number with a bold version
                  const parts = text.split(String(balance));
                    if (parts.length === 2) {
                      return (
                        <>
                          {parts[0]}
                          <span className="font-semibold">{formatMerits(balance)}</span>
                          {parts[1]}
                        </>
                      );
                    }
                    return text;
                })()}
              </span>
            )
          )}
        </div>
        {/* Merits and Quota Hint Dialog */}
        <Dialog open={showQuotaHint} onOpenChange={setShowQuotaHint}>
          <DialogContent className="sm:max-w-md bg-base-200 border-base-300 shadow-lg sm:rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-left text-base-content">
                {tCommon('meritsAndQuota')}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {tCommon('meritsAndQuota')}
              </DialogDescription>
              <div className="text-left text-base-content/80 pt-2 space-y-3">
                {(hasDaily
                  ? tCommon('meritsAndQuotaDescriptionWithQuota')
                  : tCommon('meritsAndQuotaDescriptionNoQuota')
                )
                  .split('\n\n')
                  .filter((p) => p.trim())
                  .map((paragraph, index) => (
                    <p key={index} className="text-sm leading-relaxed text-base-content/80">
                      {paragraph.trim()}
                    </p>
                  ))}
              </div>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              {/* Quota explanation with visual — only when quota is enabled */}
              {hasDaily && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-base-300/50 border border-base-300">
                  <DailyQuotaRing
                    remaining={quotaRemaining}
                    max={quotaMax}
                    className="w-6 h-6 flex-shrink-0 mt-0.5"
                    asDiv={true}
                    variant={isMarathonOfGood ? 'golden' : 'default'}
                  />
                  <div className="flex-1 text-sm text-base-content/80">
                    <p className="font-medium text-base-content mb-1">{tCommon('dailyMerits')}</p>
                    <p className="text-xs">{tCommon('quotaExplanation')}</p>
                  </div>
                </div>
              )}
              {/* Permanent merits explanation */}
              {hasPermanent && balance !== undefined && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-base-300/50 border border-base-300">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {currencyIconUrl ? (
                      <img
                        src={currencyIconUrl}
                        alt={tCommunities('currency')}
                        className="w-5 h-5"
                      />
                    ) : (
                      <span className="text-lg">💰</span>
                    )}
                  </div>
                  <div className="flex-1 text-sm text-base-content/80">
                    <p className="font-medium text-base-content mb-1">
                      {tCommon('permanentMeritsWallet')}
                    </p>
                    <p className="text-xs">{tCommon('permanentMeritsExplanation')}</p>
                  </div>
                </div>
              )}
              {onEarnMeritsClick && (
                <div className="mt-4 pt-3 border-t border-base-300 flex flex-col items-center gap-2">
                  <p className="text-sm text-base-content/80 text-center">
                    {tCommon('meritsAndQuotaEarnHint')}
                  </p>
                  <Button
                    onClick={handleEarnMeritsClick}
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-input bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-base-content text-base-content dark:text-base-content/70 h-9 rounded-xl px-3 gap-2"
                    aria-label={earnMeritsLabel}
                  >
                    <Scale size={16} />
                    {earnMeritsLabel}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className={`flex items-center gap-4 ${className}`}>
        {hasDaily && (
          <div 
            className="flex items-center gap-1.5 text-sm cursor-pointer"
            onClick={handleClick}
            title={tCommon('meritsAndQuota')}
          >
            <DailyQuotaRing
              remaining={quotaRemaining}
              max={quotaMax}
              className="w-6 h-6 flex-shrink-0"
              asDiv={true}
              variant={isMarathonOfGood ? 'golden' : 'default'}
            />
          </div>
        )}
        {hasPermanent && (
          <div 
            className="flex items-center gap-1.5 text-sm cursor-pointer"
            onClick={handleClick}
            title={tCommon('meritsAndQuota')}
          >
            <span className="text-base-content/60">{tCommon('yourMerits')}:</span>
            <span className="font-semibold text-base-content">{formatMerits(balance)}</span>
            {currencyIconUrl && (
              <img
                src={currencyIconUrl}
                alt={tCommunities('currency')}
                className="w-4 h-4 flex-shrink-0"
              />
            )}
          </div>
        )}
      </div>
      {/* Merits and Quota Hint Dialog */}
      <Dialog open={showQuotaHint} onOpenChange={setShowQuotaHint}>
        <DialogContent className="sm:max-w-md bg-base-200 border-base-300 shadow-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-left text-base-content">
              {tCommon('meritsAndQuota')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {tCommon('meritsAndQuota')}
            </DialogDescription>
            <div className="text-left text-base-content/80 pt-2 space-y-3">
              {(hasDaily
                ? tCommon('meritsAndQuotaDescriptionWithQuota')
                : tCommon('meritsAndQuotaDescriptionNoQuota')
              )
                .split('\n\n')
                .filter((p) => p.trim())
                .map((paragraph, index) => (
                  <p key={index} className="text-sm leading-relaxed text-base-content/80">
                    {paragraph.trim()}
                  </p>
                ))}
            </div>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            {/* Quota explanation with visual — only when quota is enabled */}
            {hasDaily && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-base-300/50 border border-base-300">
                <DailyQuotaRing
                  remaining={quotaRemaining}
                  max={quotaMax}
                  className="w-6 h-6 flex-shrink-0 mt-0.5"
                  asDiv={true}
                  variant={isMarathonOfGood ? 'golden' : 'default'}
                />
                <div className="flex-1 text-sm text-base-content/80">
                  <p className="font-medium text-base-content mb-1">{tCommon('dailyMerits')}</p>
                  <p className="text-xs">{tCommon('quotaExplanation')}</p>
                </div>
              </div>
            )}
            {/* Permanent merits explanation */}
            {hasPermanent && balance !== undefined && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-base-300/50 border border-base-300">
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {currencyIconUrl ? (
                    <img
                      src={currencyIconUrl}
                      alt={tCommunities('currency')}
                      className="w-5 h-5"
                    />
                  ) : (
                    <span className="text-lg">💰</span>
                  )}
                </div>
                <div className="flex-1 text-sm text-base-content/80">
                  <p className="font-medium text-base-content mb-1">
                    {tCommon('permanentMeritsWallet')}
                  </p>
                  <p className="text-xs">{tCommon('permanentMeritsExplanation')}</p>
                </div>
              </div>
            )}
            {onEarnMeritsClick && (
              <div className="mt-4 pt-3 border-t border-base-300 flex flex-col items-center gap-2">
                <p className="text-sm text-base-content/80 text-center">
                  {tCommon('meritsAndQuotaEarnHint')}
                </p>
                <Button
                  onClick={handleEarnMeritsClick}
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-input bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-base-content text-base-content dark:text-base-content/70 h-9 rounded-xl px-3 gap-2"
                  aria-label={earnMeritsLabel}
                >
                  <Scale size={16} />
                  {earnMeritsLabel}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


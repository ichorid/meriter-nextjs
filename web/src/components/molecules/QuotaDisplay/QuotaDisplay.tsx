'use client';

import React, { useState } from 'react';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
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
}: QuotaDisplayProps) {
  const tCommon = useTranslations('common');
  const tCommunities = useTranslations('communities');
  const [showQuotaHint, setShowQuotaHint] = useState(false);

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
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-left">
                {tCommon('meritsAndQuota')}
              </DialogTitle>
              <DialogDescription className="text-left text-base-content/80 pt-2 [&]:text-base-content/80">
                {(() => {
                  const description = tCommon('meritsAndQuotaDescription');
                  const parts = description.split('\n');
                  return (
                    <div className="space-y-2">
                      {parts.map((part, index) => {
                        const trimmedPart = part.trim();
                        // Check if this is a note (contains "Есть исключение" or "There is an exception")
                        if (trimmedPart.includes('Есть исключение') || trimmedPart.includes('There is an exception') || trimmedPart.includes('исключение') || trimmedPart.includes('exception')) {
                          return (
                            <p key={index} className="text-xs text-base-content/50 italic bg-base-200/50 px-2 py-1 rounded border border-base-300/30">
                              {trimmedPart}
                            </p>
                          );
                        }
                        return (
                          <p key={index} className="text-sm">
                            {trimmedPart || '\u00A0'}
                          </p>
                        );
                      })}
                    </div>
                  );
                })()}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              {/* Quota explanation with visual */}
              {hasDaily && (
                <div className="flex items-start gap-3">
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
                <div className="flex items-start gap-3">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-left">
              {tCommon('meritsAndQuota')}
            </DialogTitle>
            <DialogDescription className="text-left text-base-content/80 pt-2 [&]:text-base-content/80">
              {(() => {
                const description = tCommon('meritsAndQuotaDescription');
                const parts = description.split('\n');
                return (
                  <div className="space-y-2">
                    {parts.map((part, index) => {
                      const trimmedPart = part.trim();
                      // Check if this is a note (contains "Есть исключение" or "There is an exception")
                      if (trimmedPart.includes('Есть исключение') || trimmedPart.includes('There is an exception') || trimmedPart.includes('исключение') || trimmedPart.includes('exception')) {
                        return (
                          <p key={index} className="text-xs text-base-content/50 italic bg-base-200/50 px-2 py-1 rounded border border-base-300/30">
                            {trimmedPart}
                          </p>
                        );
                      }
                      return (
                        <p key={index} className="text-sm">
                          {trimmedPart || '\u00A0'}
                        </p>
                      );
                    })}
                  </div>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            {/* Quota explanation with visual */}
            {hasDaily && (
              <div className="flex items-start gap-3">
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
              <div className="flex items-start gap-3">
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


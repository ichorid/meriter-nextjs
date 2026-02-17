'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { cn } from '@/lib/utils';

interface TappalkaOnboardingProps {
  text: string;
  onDismiss: () => void;
  className?: string;
  /** If true, renders without BottomPortal and backdrop (for use inside Dialog) */
  inline?: boolean;
}

export const TappalkaOnboarding: React.FC<TappalkaOnboardingProps> = ({
  text,
  onDismiss,
  className,
  inline = false,
}) => {
  const t = useTranslations('postCarousel');

  const bodyContent = text ? (
    <p className="whitespace-pre-line leading-relaxed">{text}</p>
  ) : (
    <div className="space-y-3">
      <p>{t('onboardingIntro')}</p>
      <p>
        <strong>{t('onboardingHowItWorks')}</strong>
      </p>
      <ol className="list-decimal list-inside space-y-2 ml-2">
        <li>{t('onboardingStep1')}</li>
        <li>{t('onboardingStep2')}</li>
        <li>{t('onboardingStep3')}</li>
      </ol>
      <p>{t('onboardingCta')}</p>
    </div>
  );

  const inner = (
    <>
      {!inline && (
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-base-content/20 rounded-full" />
        </div>
      )}
      {!inline && (
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 text-base-content/50 hover:text-base-content rounded-full hover:bg-base-content/5 transition-colors z-10"
          aria-label={t('closeAria')}
        >
          <X size={20} />
        </button>
      )}
      <div className={inline ? '' : 'px-6 pb-6 pt-2'}>
        <h2 className="text-2xl font-bold text-base-content mb-4 pr-8">
          {t('onboardingTitle')}
        </h2>
        <div className="prose prose-sm dark:prose-invert max-w-none text-base-content/80 mb-6">
          {bodyContent}
        </div>
        <Button
          onClick={onDismiss}
          className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-3 rounded-xl"
          size="lg"
        >
          {t('onboardingButton')}
        </Button>
      </div>
    </>
  );

  if (inline) {
    return (
      <div
        className={cn('relative w-full px-6 pb-6 pt-4', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {inner}
      </div>
    );
  }

  const content = (
    <div
      className={cn(
        'relative w-full max-w-2xl bg-base-100 rounded-t-3xl shadow-2xl',
        'transform transition-transform duration-300 ease-out translate-y-0',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {inner}
    </div>
  );

  // Render with portal and backdrop (standalone)
  return (
    <BottomPortal>
      <div className="fixed inset-0 z-50 pointer-events-auto flex items-end justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onDismiss}
          aria-hidden="true"
        />
        
        {/* Bottom sheet card */}
        {content}
      </div>
    </BottomPortal>
  );
};


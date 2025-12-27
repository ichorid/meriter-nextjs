'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { InviteInput } from '@/components/molecules/InviteInput/InviteInput';

export function FoldableInviteInput() {
  const t = useTranslations('settings');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
      >
        <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
          {t('inviteSection')}
        </h2>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-brand-text-secondary" />
        ) : (
          <ChevronDown className="w-5 h-5 text-brand-text-secondary" />
        )}
      </button>
      {isExpanded && (
        <div className="animate-in fade-in duration-200">
          <InviteInput />
        </div>
      )}
    </div>
  );
}


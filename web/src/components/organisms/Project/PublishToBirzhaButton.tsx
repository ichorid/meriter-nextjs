'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { PublishToBirzhaDialog } from './PublishToBirzhaDialog';
import { TrendingUp } from 'lucide-react';

interface PublishToBirzhaButtonProps {
  projectId: string;
  investorSharePercent?: number;
  /** Only render when true (lead). Caller is responsible for passing isLead. */
  isLead: boolean;
}

export function PublishToBirzhaButton({
  projectId,
  investorSharePercent = 20,
  isLead,
}: PublishToBirzhaButtonProps) {
  const t = useTranslations('projects');
  const [open, setOpen] = useState(false);

  if (!isLead) return null;

  return (
    <>
      <Button size="sm" variant="default" onClick={() => setOpen(true)}>
        <TrendingUp className="mr-1 h-4 w-4" />
        {t('publishToBirzha', { defaultValue: 'Publish to Birzha' })}
      </Button>
      <PublishToBirzhaDialog
        projectId={projectId}
        open={open}
        onOpenChange={setOpen}
        defaultInvestorSharePercent={investorSharePercent}
      />
    </>
  );
}

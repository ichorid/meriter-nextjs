'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { PublishToBirzhaDialog } from './PublishToBirzhaDialog';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublishToBirzhaButtonProps {
  projectId: string;
  /** Only render when true (lead). Caller is responsible for passing isLead. */
  isLead: boolean;
  className?: string;
}

export function PublishToBirzhaButton({
  projectId,
  isLead,
  className,
}: PublishToBirzhaButtonProps) {
  const t = useTranslations('projects');
  const [open, setOpen] = useState(false);

  if (!isLead) return null;

  return (
    <>
      <Button
        size="sm"
        variant="default"
        className={cn(
          'w-full rounded-xl px-3 py-3 h-auto font-medium bg-green-600 text-white hover:bg-green-600/90',
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <TrendingUp className="mr-2 h-4 w-4 shrink-0" />
        {t('publishToBirzha', { defaultValue: 'Publish to Birzha' })}
      </Button>
      <PublishToBirzhaDialog projectId={projectId} open={open} onOpenChange={setOpen} />
    </>
  );
}

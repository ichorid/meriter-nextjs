'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { useAuth } from '@/contexts/AuthContext';
import { MeritTransferDialog } from './MeritTransferDialog';
import type { ButtonProps } from '@/components/ui/shadcn/button';

export interface MeritTransferButtonProps {
  receiverId: string;
  receiverDisplayName: string;
  communityContextId: string;
  onSuccess?: () => void;
  buttonText?: string;
  /** Compact icon button for dense member rows (tooltip = transfer merits). */
  iconOnly?: boolean;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  disabled?: boolean;
}

export function MeritTransferButton({
  receiverId,
  receiverDisplayName,
  communityContextId,
  onSuccess,
  buttonText,
  iconOnly = false,
  variant = 'outline',
  size = 'sm',
  className,
  disabled = false,
}: MeritTransferButtonProps) {
  const t = useTranslations('meritTransfer');
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user?.id || user.id === receiverId) {
    return null;
  }

  const label = buttonText ?? t('transferMerits');

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? 'icon' : size}
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
        title={iconOnly ? label : undefined}
        aria-label={iconOnly ? label : undefined}
      >
        {iconOnly ? <SendHorizontal className="h-4 w-4" aria-hidden /> : label}
      </Button>
      <MeritTransferDialog
        open={open}
        onOpenChange={setOpen}
        receiverId={receiverId}
        receiverDisplayName={receiverDisplayName}
        communityContextId={communityContextId}
        onSuccess={onSuccess}
      />
    </>
  );
}

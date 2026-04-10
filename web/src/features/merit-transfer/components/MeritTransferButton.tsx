'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
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

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {buttonText ?? t('transferMerits')}
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

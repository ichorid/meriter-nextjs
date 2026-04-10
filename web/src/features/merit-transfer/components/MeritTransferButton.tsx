'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { useAuth } from '@/contexts/AuthContext';
import { MeritTransferDialog } from './MeritTransferDialog';
import type { ButtonProps } from '@/components/ui/shadcn/button';
import type { MeritTransferProfileContextConfig } from '../lib/profile-merit-transfer-context';

type MeritTransferButtonBaseProps = {
  receiverId: string;
  receiverDisplayName: string;
  onSuccess?: () => void;
  buttonText?: string;
  /** Compact icon button for dense member rows (tooltip = transfer merits). */
  iconOnly?: boolean;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  disabled?: boolean;
};

export type MeritTransferButtonProps = MeritTransferButtonBaseProps &
  (
    | { communityContextId: string; profileContext?: never }
    | { profileContext: MeritTransferProfileContextConfig; communityContextId?: never }
  );

export function MeritTransferButton({
  receiverId,
  receiverDisplayName,
  communityContextId,
  profileContext,
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

  const hasCommunity = Boolean(communityContextId);
  const hasProfile = Boolean(profileContext);
  if (hasCommunity === hasProfile) {
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
        profileContext={profileContext}
        onSuccess={onSuccess}
      />
    </>
  );
}

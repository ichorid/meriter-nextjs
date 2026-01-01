'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLeadCommunities } from '@/hooks/api/useProfile';
import { useCreateInvite } from '@/hooks/api/useInvites';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { Label } from '@/components/ui/shadcn/label';
import { Loader2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/shadcn/select';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { cn } from '@/lib/utils';

export default function CreateInvitePage() {
  const router = useRouter();
  const t = useTranslations('invites.create');
  const { user } = useAuth();

  const { data: leadCommunities, isLoading: communitiesLoading } = useLeadCommunities(user?.id || '');
  const createInvite = useCreateInvite();

  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [inviteType, setInviteType] = useState<'superadmin-to-lead' | 'lead-to-participant'>('lead-to-participant');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>(30);
  const [generatedInvites, setGeneratedInvites] = useState<Array<{ code: string; communityId: string }>>([]);

  // Check if user has permission to create invites
  const hasPermission = leadCommunities && leadCommunities.length > 0;

  const handleToggleCommunity = (communityId: string) => {
    setSelectedCommunities((prev) =>
      prev.includes(communityId)
        ? prev.filter((id) => id !== communityId)
        : [...prev, communityId]
    );
  };

  const handleCreateInvites = async () => {
    if (selectedCommunities.length === 0) {
      return;
    }

    // Calculate expiration date
    let expiresAt: string | undefined;
    if (expiresInDays && expiresInDays > 0) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresInDays);
      expiresAt = expirationDate.toISOString();
    }

    const invites: Array<{ code: string; communityId: string }> = [];

    for (const communityId of selectedCommunities) {
      try {
        const inviteData: any = {
          type: inviteType,
          communityId,
          expiresAt,
        };

        const invite = await createInvite.mutateAsync(inviteData);
        invites.push({ code: invite.code, communityId });
      } catch (error) {
        console.error(`Failed to create invite for community ${communityId}:`, error);
      }
    }

    setGeneratedInvites(invites);

    // Copy all invite codes to clipboard
    if (invites.length > 0) {
      const codes = invites.map((inv) => `${inv.communityId}: ${inv.code}`).join('\n');
      navigator.clipboard.writeText(codes);
    }
  };

  return (
    <AdaptiveLayout
      stickyHeader={<SimpleStickyHeader title={t('title')} showBack={true} asStickyHeader={true} />}
    >
      <div className="space-y-6">
        {!communitiesLoading && !hasPermission && (
          <div className="p-4 bg-yellow-50 shadow-none rounded-xl">
            <p className="font-bold text-yellow-800 mb-2">{t('noPermission')}</p>
            <p className="text-sm text-yellow-700">{t('noPermissionDescription')}</p>
          </div>
        )}

        {hasPermission && (
          <>
            <BrandFormControl label={t('inviteType')}>
              <Select
                value={inviteType}
                onValueChange={(value) => setInviteType(value as any)}
              >
                <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead-to-participant">{t('leadToParticipant')}</SelectItem>
                  <SelectItem value="superadmin-to-lead">{t('superadminToLead')}</SelectItem>
                </SelectContent>
              </Select>
            </BrandFormControl>

            <BrandFormControl
              label={t('expiresInDays')}
              helperText={t('expiresInDaysHelp')}
            >
              <Input
                type="number"
                value={expiresInDays.toString()}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  setExpiresInDays(isNaN(num) ? '' : num);
                }}
                placeholder={t('expiresInDaysPlaceholder')}
                className="h-11 rounded-xl w-full"
              />
            </BrandFormControl>

            <div className="space-y-3">
              <h2 className="text-base font-semibold text-brand-text-primary">
                {t('selectCommunities')}
              </h2>
              {communitiesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
              ) : !leadCommunities || leadCommunities.length === 0 ? (
                <p className="text-brand-text-secondary">{t('noCommunities')}</p>
              ) : (
                <div className="space-y-2">
                  {leadCommunities.map((community) => (
                    <div key={community.id} className="flex items-center gap-2.5">
                      <Checkbox
                        id={`community-${community.id}`}
                        checked={selectedCommunities.includes(community.id)}
                        onCheckedChange={() => handleToggleCommunity(community.id)}
                      />
                      <Label
                        htmlFor={`community-${community.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {community.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {generatedInvites.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-brand-text-primary">
                  {t('generatedInvites')}
                </h2>
                <div className="space-y-2">
                  {generatedInvites.map((invite) => (
                    <div
                      key={invite.communityId}
                      className="p-3 bg-green-50 shadow-none rounded-lg"
                    >
                      <p className="font-bold text-brand-text-primary">{invite.communityId}</p>
                      <p className="font-mono text-sm text-brand-text-secondary">{invite.code}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-green-600">
                  {t('invitesCopied')}
                </p>
              </div>
            )}

            <Button
              variant="default"
              size="lg"
              className="rounded-xl active:scale-[0.98] w-full"
              onClick={handleCreateInvites}
              disabled={
                selectedCommunities.length === 0 ||
                createInvite.isPending
              }
            >
              {createInvite.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {createInvite.isPending ? t('creating') : t('create')}
            </Button>
          </>
        )}
      </div>
    </AdaptiveLayout>
  );
}

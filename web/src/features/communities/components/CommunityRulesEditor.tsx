'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { Label } from '@/components/ui/shadcn/label';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { Check, RotateCcw, Eye, EyeOff, Download, Upload, History, Loader2 } from 'lucide-react';
import type { CommunityWithComputedFields, LegacyPostingRules, LegacyVotingRules, LegacyVisibilityRules, LegacyMeritRules } from '@/types/api-v1';
import { useToastStore } from '@/shared/stores/toast.store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/shadcn/select';
import { useResetDailyQuota } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { cn } from '@/lib/utils';

const TEAM_ROLES = ['lead', 'participant'] as const;

interface CommunityRulesEditorProps {
  community: CommunityWithComputedFields;
  onSave: (rules: {
    postingRules?: LegacyPostingRules;
    votingRules?: LegacyVotingRules;
    visibilityRules?: LegacyVisibilityRules;
    meritRules?: LegacyMeritRules;
    linkedCurrencies?: string[];
    settings?: {
      dailyEmission?: number;
      postCost?: number;
      pollCost?: number;
      forwardCost?: number;
    };
    votingSettings?: {
      votingRestriction?: 'any' | 'not-own' | 'not-same-group';
    };
  }) => Promise<void>;
}

export const CommunityRulesEditor: React.FC<CommunityRulesEditorProps> = ({
  community,
  onSave,
}) => {
  const t = useTranslations('communities.rules');

  const [postingRules, setPostingRules] = useState<LegacyPostingRules>(community.postingRules || {
    allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
    requiresTeamMembership: false,
    onlyTeamLead: false,
    autoMembership: false,
  });

  const [votingRules, setVotingRules] = useState<LegacyVotingRules>(community.votingRules || {
    allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
    canVoteForOwnPosts: false,
    participantsCannotVoteForLead: false,
    spendsMerits: true,
    awardsMerits: true,
  });

  const [visibilityRules, setVisibilityRules] = useState<LegacyVisibilityRules>(community.visibilityRules || {
    visibleToRoles: ['superadmin', 'lead', 'participant', 'viewer'],
    isHidden: false,
    teamOnly: false,
  });

  const [meritRules, setMeritRules] = useState<LegacyMeritRules>(community.meritRules || {
    dailyQuota: 100,
    quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'],
    canEarn: true,
    canSpend: true,
  });

  const [linkedCurrencies, setLinkedCurrencies] = useState<string[]>(
    community.linkedCurrencies || []
  );
  const [newCurrency, setNewCurrency] = useState('');

  // Additional settings fields
  const [dailyEmission, setDailyEmission] = useState<string>(
    String(community.settings?.dailyEmission || community.meritRules?.dailyQuota || 100)
  );
  const [postCost, setPostCost] = useState<string>(
    String(community.settings?.postCost ?? 1)
  );
  const [pollCost, setPollCost] = useState<string>(
    String(community.settings?.pollCost ?? 1)
  );
  const [forwardCost, setForwardCost] = useState<string>(
    String(community.settings?.forwardCost ?? 1)
  );
  const [votingRestriction, setVotingRestriction] = useState<'any' | 'not-own' | 'not-same-group'>(
    (community.votingSettings?.votingRestriction as 'any' | 'not-own' | 'not-same-group') || 'not-own'
  );

  const { user } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const isSuperadmin = user?.globalRole === 'superadmin';
  const isUserLead = userRoles.some((r) => r.communityId === community.id && r.role === 'lead');
  const canResetQuota = isSuperadmin || isUserLead;
  const resetDailyQuota = useResetDailyQuota();
  const tSettings = useTranslations('pages.communitySettings');

  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  // Store original rules for reset functionality
  const [originalRules, setOriginalRules] = useState({
    postingRules: { ...postingRules },
    votingRules: { ...votingRules },
    visibilityRules: { ...visibilityRules },
    meritRules: { ...meritRules },
    linkedCurrencies: [...linkedCurrencies],
  });

  // History of rule changes
  interface RulesHistoryEntry {
    id: string;
    timestamp: string;
    rules: {
      postingRules: any;
      votingRules: any;
      visibilityRules: any;
      meritRules: any;
      linkedCurrencies: string[];
    };
  }

  const getHistoryKey = () => `community_rules_history_${community.id}`;

  const getHistory = (): RulesHistoryEntry[] => {
    try {
      const historyKey = getHistoryKey();
      const saved = localStorage.getItem(historyKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const saveToHistory = (rules: {
    postingRules: any;
    votingRules: any;
    visibilityRules: any;
    meritRules: any;
    linkedCurrencies: string[];
  }) => {
    const history = getHistory();
    const entry: RulesHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      rules: JSON.parse(JSON.stringify(rules)), // Deep clone
    };

    // Keep only last 10 entries
    const newHistory = [entry, ...history].slice(0, 10);
    const historyKey = getHistoryKey();
    localStorage.setItem(historyKey, JSON.stringify(newHistory));
  };

  const restoreFromHistory = (entry: RulesHistoryEntry) => {
    setPostingRules(JSON.parse(JSON.stringify(entry.rules.postingRules)));
    setVotingRules(JSON.parse(JSON.stringify(entry.rules.votingRules)));
    setVisibilityRules(JSON.parse(JSON.stringify(entry.rules.visibilityRules)));
    setMeritRules(JSON.parse(JSON.stringify(entry.rules.meritRules)));
    setLinkedCurrencies([...entry.rules.linkedCurrencies]);
    setValidationErrors({});
    addToast(t('historyRestored'), 'success');
  };

  // Initialize original rules when community changes
  useEffect(() => {
    const initialPostingRules = community.postingRules || {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      requiresTeamMembership: false,
      onlyTeamLead: false,
      autoMembership: false,
    };
    const initialVotingRules = community.votingRules || {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      canVoteForOwnPosts: false,
      participantsCannotVoteForLead: false,
      spendsMerits: true,
      awardsMerits: true,
    };
    const initialVisibilityRules = community.visibilityRules || {
      visibleToRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      isHidden: false,
      teamOnly: false,
    };
    const initialMeritRules = community.meritRules || {
      dailyQuota: 100,
      quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'],
      canEarn: true,
      canSpend: true,
    };
    const initialLinkedCurrencies = community.linkedCurrencies || [];

    setOriginalRules({
      postingRules: JSON.parse(JSON.stringify(initialPostingRules)),
      votingRules: JSON.parse(JSON.stringify(initialVotingRules)),
      visibilityRules: JSON.parse(JSON.stringify(initialVisibilityRules)),
      meritRules: JSON.parse(JSON.stringify(initialMeritRules)),
      linkedCurrencies: [...initialLinkedCurrencies],
    });
  }, [community.id]); // Only when community changes

  const validateRules = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate posting rules
    if (postingRules.requiresTeamMembership && postingRules.allowedRoles) {
      // If requiresTeamMembership is true, allowedRoles should only include team roles
      const hasNonTeamRole = postingRules.allowedRoles.some((role: string) => !TEAM_ROLES.includes(role as typeof TEAM_ROLES[number]));
      if (hasNonTeamRole) {
        errors.postingRules = t('validationErrors.requiresTeamMembershipConflict');
      }
    }

    if (postingRules.onlyTeamLead && !postingRules.requiresTeamMembership) {
      errors.postingRules = t('validationErrors.onlyTeamLeadRequiresMembership');
    }

    // Validate voting rules
    if (votingRules.participantsCannotVoteForLead && !votingRules.allowedRoles?.includes('participant')) {
      errors.votingRules = t('validationErrors.participantsCannotVoteConflict');
    }

    // Validate visibility rules
    if (visibilityRules.isHidden && visibilityRules.visibleToRoles && visibilityRules.visibleToRoles.length > 0) {
      errors.visibilityRules = t('validationErrors.hiddenButVisible');
    }

    if (visibilityRules.teamOnly && visibilityRules.visibleToRoles) {
      const hasNonTeamRole = visibilityRules.visibleToRoles.some((role: string) => !TEAM_ROLES.includes(role as typeof TEAM_ROLES[number]));
      if (hasNonTeamRole) {
        errors.visibilityRules = t('validationErrors.teamOnlyConflict');
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateRules()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        postingRules,
        votingRules,
        visibilityRules,
        meritRules,
        linkedCurrencies,
        settings: {
          dailyEmission: parseInt(dailyEmission, 10),
          postCost: parseInt(postCost, 10),
          pollCost: parseInt(pollCost, 10),
          forwardCost: parseInt(forwardCost, 10),
        },
        votingSettings: {
          votingRestriction,
        },
      });
      setValidationErrors({});
      // Update original rules after successful save
      const savedRules = {
        postingRules: { ...postingRules },
        votingRules: { ...votingRules },
        visibilityRules: { ...visibilityRules },
        meritRules: { ...meritRules },
        linkedCurrencies: [...linkedCurrencies],
      };
      setOriginalRules(savedRules);
      // Save to history
      saveToHistory(savedRules);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDailyQuota = async () => {
    if (!confirm(tSettings('resetQuotaConfirm'))) return;

    try {
      await resetDailyQuota.mutateAsync(community.id);
      addToast(tSettings('resetQuotaSuccess'), 'success');
    } catch (error) {
      console.error('Failed to reset daily quota:', error);
      addToast(tSettings('resetQuotaError'), 'error');
    }
  };

  const handleReset = () => {
    setPostingRules({ ...originalRules.postingRules });
    setVotingRules({ ...originalRules.votingRules });
    setVisibilityRules({ ...originalRules.visibilityRules });
    setMeritRules({ ...originalRules.meritRules });
    setLinkedCurrencies([...originalRules.linkedCurrencies]);
    setValidationErrors({});
  };

  const hasChanges = () => {
    return (
      JSON.stringify(postingRules) !== JSON.stringify(originalRules.postingRules) ||
      JSON.stringify(votingRules) !== JSON.stringify(originalRules.votingRules) ||
      JSON.stringify(visibilityRules) !== JSON.stringify(originalRules.visibilityRules) ||
      JSON.stringify(meritRules) !== JSON.stringify(originalRules.meritRules) ||
      JSON.stringify(linkedCurrencies) !== JSON.stringify(originalRules.linkedCurrencies)
    );
  };

  const exportRules = () => {
    const rulesData = {
      communityId: community.id,
      communityName: community.name,
      postingRules,
      votingRules,
      visibilityRules,
      meritRules,
      linkedCurrencies,
      exportedAt: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(rulesData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `community-rules-${community.id}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast(t('rulesExported'), 'success');
  };

  const importRules = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const rulesData = JSON.parse(content);

          // Validate imported data
          if (!rulesData.postingRules || !rulesData.votingRules || !rulesData.visibilityRules || !rulesData.meritRules) {
            throw new Error('Invalid rules format');
          }

          setPostingRules(rulesData.postingRules);
          setVotingRules(rulesData.votingRules);
          setVisibilityRules(rulesData.visibilityRules);
          setMeritRules(rulesData.meritRules);
          setLinkedCurrencies(rulesData.linkedCurrencies || []);
          setValidationErrors({});

          addToast(t('rulesImported'), 'success');
        } catch (error) {
          console.error('Failed to import rules:', error);
          addToast(t('rulesImportError'), 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };


  const addCurrency = () => {
    if (newCurrency.trim() && !linkedCurrencies.includes(newCurrency.trim())) {
      setLinkedCurrencies([...linkedCurrencies, newCurrency.trim()]);
      setNewCurrency('');
    }
  };

  const removeCurrency = (currency: string) => {
    setLinkedCurrencies(linkedCurrencies.filter(c => c !== currency));
  };

  return (
    <div className="space-y-8">
      {Object.keys(validationErrors).length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 font-bold mb-2">{t('validationErrors.title')}</p>
          <div className="space-y-1">
            {Object.entries(validationErrors).map(([key, message]) => (
              <p key={key} className="text-red-600 text-sm">• {message}</p>
            ))}
          </div>
        </div>
      )}

      {/* Posting Rules */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary">{t('postingRules')}</h2>
        {validationErrors.postingRules && (
          <p className="text-red-600 text-sm">{validationErrors.postingRules}</p>
        )}

        <BrandFormControl label={t('allowedRoles')}>
          <div className="space-y-2">
            {(['superadmin', 'lead', 'participant', 'viewer'] as const).map((role) => {
              const checkboxId = `posting-role-${role}`;
              return (
                <div key={role} className="flex items-center gap-2.5">
                  <Checkbox
                    id={checkboxId}
                    checked={postingRules.allowedRoles.includes(role)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const currentRoles = postingRules.allowedRoles || [];
                        if (!currentRoles.includes(role)) {
                          setPostingRules({ ...postingRules, allowedRoles: [...currentRoles, role] });
                        }
                      } else {
                        const currentRoles = postingRules.allowedRoles || [];
                        setPostingRules({ ...postingRules, allowedRoles: currentRoles.filter((r: string) => r !== role) });
                      }
                    }}
                  />
                  <Label htmlFor={checkboxId} className="text-sm cursor-pointer">
                    {t(`roles.${role}`)}
                  </Label>
                </div>
              );
            })}
          </div>
        </BrandFormControl>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="requiresTeamMembership"
            checked={postingRules.requiresTeamMembership}
            onCheckedChange={(checked) => setPostingRules({ ...postingRules, requiresTeamMembership: checked as boolean })}
          />
          <Label htmlFor="requiresTeamMembership" className="text-sm cursor-pointer">
            {t('requiresTeamMembership')}
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="onlyTeamLead"
            checked={postingRules.onlyTeamLead}
            onCheckedChange={(checked) => setPostingRules({ ...postingRules, onlyTeamLead: checked as boolean })}
          />
          <Label htmlFor="onlyTeamLead" className="text-sm cursor-pointer">
            {t('onlyTeamLead')}
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="autoMembership"
            checked={postingRules.autoMembership}
            onCheckedChange={(checked) => setPostingRules({ ...postingRules, autoMembership: checked as boolean })}
          />
          <Label htmlFor="autoMembership" className="text-sm cursor-pointer">
            {t('autoMembership')}
          </Label>
        </div>
      </div>

      {/* Voting Rules */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary">{t('votingRules')}</h2>
        {validationErrors.votingRules && (
          <p className="text-red-600 text-sm">{validationErrors.votingRules}</p>
        )}

        <BrandFormControl label={t('allowedRoles')}>
          <div className="space-y-2">
            {(['superadmin', 'lead', 'participant', 'viewer'] as const).map((role) => {
              const checkboxId = `voting-role-${role}`;
              return (
                <div key={role} className="flex items-center gap-2.5">
                  <Checkbox
                    id={checkboxId}
                    checked={votingRules.allowedRoles.includes(role)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const currentRoles = votingRules.allowedRoles || [];
                        if (!currentRoles.includes(role)) {
                          setVotingRules({ ...votingRules, allowedRoles: [...currentRoles, role] });
                        }
                      } else {
                        const currentRoles = votingRules.allowedRoles || [];
                        setVotingRules({ ...votingRules, allowedRoles: currentRoles.filter((r: string) => r !== role) });
                      }
                    }}
                  />
                  <Label htmlFor={checkboxId} className="text-sm cursor-pointer">
                    {t(`roles.${role}`)}
                  </Label>
                </div>
              );
            })}
          </div>
        </BrandFormControl>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="canVoteForOwnPosts"
            checked={votingRules.canVoteForOwnPosts}
            onCheckedChange={(checked) => setVotingRules({ ...votingRules, canVoteForOwnPosts: checked as boolean })}
          />
          <Label htmlFor="canVoteForOwnPosts" className="text-sm cursor-pointer">
            {t('canVoteForOwnPosts')}
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="participantsCannotVoteForLead"
            checked={votingRules.participantsCannotVoteForLead}
            onCheckedChange={(checked) => setVotingRules({ ...votingRules, participantsCannotVoteForLead: checked as boolean })}
          />
          <Label htmlFor="participantsCannotVoteForLead" className="text-sm cursor-pointer">
            {t('participantsCannotVoteForLead')}
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="spendsMerits"
            checked={votingRules.spendsMerits}
            onCheckedChange={(checked) => setVotingRules({ ...votingRules, spendsMerits: checked as boolean })}
          />
          <Label htmlFor="spendsMerits" className="text-sm cursor-pointer">
            {t('spendsMerits')}
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="awardsMerits"
            checked={votingRules.awardsMerits}
            onCheckedChange={(checked) => setVotingRules({ ...votingRules, awardsMerits: checked as boolean })}
          />
          <Label htmlFor="awardsMerits" className="text-sm cursor-pointer">
            {t('awardsMerits')}
          </Label>
        </div>
      </div>

      {/* Visibility Rules */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary">{t('visibilityRules')}</h2>
        {validationErrors.visibilityRules && (
          <p className="text-red-600 text-sm">{validationErrors.visibilityRules}</p>
        )}

        <BrandFormControl label={t('visibleToRoles')}>
          <div className="space-y-2">
            {(['superadmin', 'lead', 'participant', 'viewer'] as const).map((role) => {
              const checkboxId = `visibility-role-${role}`;
              return (
                <div key={role} className="flex items-center gap-2.5">
                  <Checkbox
                    id={checkboxId}
                    checked={visibilityRules.visibleToRoles.includes(role)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const currentRoles = visibilityRules.visibleToRoles || [];
                        if (!currentRoles.includes(role)) {
                          setVisibilityRules({ ...visibilityRules, visibleToRoles: [...currentRoles, role] });
                        }
                      } else {
                        const currentRoles = visibilityRules.visibleToRoles || [];
                        setVisibilityRules({ ...visibilityRules, visibleToRoles: currentRoles.filter((r: string) => r !== role) });
                      }
                    }}
                  />
                  <Label htmlFor={checkboxId} className="text-sm cursor-pointer">
                    {t(`roles.${role}`)}
                  </Label>
                </div>
              );
            })}
          </div>
        </BrandFormControl>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="isHidden"
            checked={visibilityRules.isHidden}
            onCheckedChange={(checked) => setVisibilityRules({ ...visibilityRules, isHidden: checked as boolean })}
          />
          <Label htmlFor="isHidden" className="text-sm cursor-pointer">
            {t('isHidden')}
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="teamOnly"
            checked={visibilityRules.teamOnly}
            onCheckedChange={(checked) => setVisibilityRules({ ...visibilityRules, teamOnly: checked as boolean })}
          />
          <Label htmlFor="teamOnly" className="text-sm cursor-pointer">
            {t('teamOnly')}
          </Label>
        </div>
      </div>

      {/* Merit Rules */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary">{t('meritRules')}</h2>

        <BrandFormControl label={tSettings('dailyEmission')} helperText={tSettings('dailyEmissionHelp')}>
          <Input
            value={dailyEmission}
            onChange={(e) => {
              setDailyEmission(e.target.value);
              // Also update meritRules.dailyQuota to keep them in sync
              const value = parseInt(e.target.value, 10) || 0;
              setMeritRules({ ...meritRules, dailyQuota: value });
            }}
            type="number"
            className="h-11 rounded-xl w-full"
          />
        </BrandFormControl>

        <BrandFormControl label={t('quotaRecipients')}>
          <div className="space-y-2">
            {(['superadmin', 'lead', 'participant', 'viewer'] as const).map((role) => {
              const checkboxId = `merit-role-${role}`;
              return (
                <div key={role} className="flex items-center gap-2.5">
                  <Checkbox
                    id={checkboxId}
                    checked={meritRules.quotaRecipients.includes(role)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const currentRoles = meritRules.quotaRecipients || [];
                        if (!currentRoles.includes(role)) {
                          setMeritRules({ ...meritRules, quotaRecipients: [...currentRoles, role] });
                        }
                      } else {
                        const currentRoles = meritRules.quotaRecipients || [];
                        setMeritRules({ ...meritRules, quotaRecipients: currentRoles.filter((r: string) => r !== role) });
                      }
                    }}
                  />
                  <Label htmlFor={checkboxId} className="text-sm cursor-pointer">
                    {t(`roles.${role}`)}
                  </Label>
                </div>
              );
            })}
          </div>
        </BrandFormControl>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="canEarn"
            checked={meritRules.canEarn}
            onCheckedChange={(checked) => setMeritRules({ ...meritRules, canEarn: checked as boolean })}
          />
          <Label htmlFor="canEarn" className="text-sm cursor-pointer">
            {t('canEarn')}
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="canSpend"
            checked={meritRules.canSpend}
            onCheckedChange={(checked) => setMeritRules({ ...meritRules, canSpend: checked as boolean })}
          />
          <Label htmlFor="canSpend" className="text-sm cursor-pointer">
            {t('canSpend')}
          </Label>
        </div>
      </div>

      {/* Quota and Cost Settings */}
      <div className="space-y-4 border-t border-base-300 pt-6">
        <h2 className="text-lg font-semibold text-brand-text-primary">{tSettings('configuration')}</h2>

        {(isSuperadmin || isUserLead) && (
          <>
            <BrandFormControl
              label={tSettings('postCost')}
              helperText={tSettings('postCostHelp')}
            >
              <Input
                type="number"
                min="0"
                value={postCost}
                onChange={(e) => setPostCost(e.target.value)}
                className="h-11 rounded-xl w-full"
              />
            </BrandFormControl>

            <BrandFormControl
              label={tSettings('pollCost')}
              helperText={tSettings('pollCostHelp')}
            >
              <Input
                type="number"
                min="0"
                value={pollCost}
                onChange={(e) => setPollCost(e.target.value)}
                className="h-11 rounded-xl w-full"
              />
            </BrandFormControl>

            <BrandFormControl
              label={tSettings('forwardCost')}
              helperText={tSettings('forwardCostHelp')}
            >
              <Input
                type="number"
                min="0"
                value={forwardCost}
                onChange={(e) => setForwardCost(e.target.value)}
                className="h-11 rounded-xl w-full"
              />
            </BrandFormControl>
          </>
        )}

        {canResetQuota && (
          <BrandFormControl
            label={tSettings('resetQuota')}
            helperText={tSettings('resetQuotaDescription')}
          >
            <Button
              variant="outline"
              size="md"
              onClick={handleResetDailyQuota}
              disabled={resetDailyQuota.isPending}
              className="rounded-xl active:scale-[0.98]"
            >
              {resetDailyQuota.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {resetDailyQuota.isPending
                ? tSettings('saving')
                : tSettings('resetQuota')}
            </Button>
          </BrandFormControl>
        )}

        <BrandFormControl
          label={tSettings('votingRestriction')}
          helperText={tSettings('votingRestrictionHelp')}
        >
          <Select
            value={votingRestriction}
            onValueChange={(value) => setVotingRestriction(value as 'any' | 'not-own' | 'not-same-group')}
          >
            <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{tSettings('votingRestrictionOptions.any')}</SelectItem>
              <SelectItem value="not-own">{tSettings('votingRestrictionOptions.notOwn')}</SelectItem>
              <SelectItem value="not-same-group">{tSettings('votingRestrictionOptions.notSameGroup')}</SelectItem>
            </SelectContent>
          </Select>
        </BrandFormControl>
      </div>

      {/* Linked Currencies */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary">{t('linkedCurrencies')}</h2>

        <div className="space-y-2">
          {linkedCurrencies.map((currency) => (
            <div key={currency} className="flex items-center justify-between p-2 bg-base-200 rounded-md border border-base-300">
              <span className="text-sm text-brand-text-primary">{currency}</span>
              <Button size="sm" variant="outline" onClick={() => removeCurrency(currency)} className="rounded-xl active:scale-[0.98]">
                {t('remove')}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value)}
              placeholder={t('enterCurrencyId')}
              className="h-11 rounded-xl w-full"
            />
          </div>
          <Button onClick={addCurrency} disabled={!newCurrency.trim()} className="rounded-xl active:scale-[0.98]">
            {t('add')}
          </Button>
        </div>
      </div>

      {/* Preview Toggle and Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="outline"
          onClick={() => setShowPreview(!showPreview)}
          className="rounded-xl active:scale-[0.98]"
        >
          {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
          {showPreview ? t('hidePreview') : t('showPreview')}
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowHistory(!showHistory)}
          className="rounded-xl active:scale-[0.98]"
        >
          <History size={16} />
          {showHistory ? t('hideHistory') : t('showHistory')}
        </Button>

        <Button
          variant="outline"
          onClick={exportRules}
          className="rounded-xl active:scale-[0.98]"
        >
          <Download size={16} />
          {t('exportRules')}
        </Button>

        <Button
          variant="outline"
          onClick={importRules}
          className="rounded-xl active:scale-[0.98]"
        >
          <Upload size={16} />
          {t('importRules')}
        </Button>

        {hasChanges() && (
          <Button
            variant="outline"
            onClick={handleReset}
            className="rounded-xl active:scale-[0.98]"
          >
            <RotateCcw size={16} />
            {t('resetChanges')}
          </Button>
        )}

        <Button
          variant="default"
          onClick={handleSave}
          disabled={isSaving || !hasChanges()}
          className="rounded-xl active:scale-[0.98] ml-auto"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('save')}
        </Button>
      </div>

      {/* History */}
      {showHistory && (
        <div className="border border-brand-border rounded-xl overflow-hidden bg-base-100">
          <div className="p-4 border-b border-brand-border">
            <h3 className="text-lg font-semibold text-brand-text-primary">{t('history')}</h3>
          </div>
          <div className="p-4">
            {getHistory().length === 0 ? (
              <p className="text-brand-text-secondary">{t('noHistory')}</p>
            ) : (
              <div className="space-y-3">
                {getHistory().map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 border border-base-300 rounded-md flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-bold text-brand-text-primary">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-base-content/60">
                        {t('historyEntry')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreFromHistory(entry)}
                      className="rounded-xl active:scale-[0.98]"
                    >
                      {t('restore')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {showPreview && (
        <div className="border border-brand-border rounded-xl overflow-hidden bg-base-100">
          <div className="p-4 border-b border-brand-border">
            <h3 className="text-lg font-semibold text-brand-text-primary">{t('preview')}</h3>
          </div>
          <div className="p-4 space-y-6">
            {/* Posting Rules Preview */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-brand-text-primary">{t('postingRules')}</h4>
              <pre className="text-xs bg-base-200 p-2 rounded border border-base-300 overflow-auto">
                {JSON.stringify(postingRules, null, 2)}
              </pre>
            </div>

            {/* Voting Rules Preview */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-brand-text-primary">{t('votingRules')}</h4>
              <pre className="text-xs bg-base-200 p-2 rounded border border-base-300 overflow-auto">
                {JSON.stringify(votingRules, null, 2)}
              </pre>
            </div>

            {/* Visibility Rules Preview */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-brand-text-primary">{t('visibilityRules')}</h4>
              <pre className="text-xs bg-base-200 p-2 rounded border border-base-300 overflow-auto">
                {JSON.stringify(visibilityRules, null, 2)}
              </pre>
            </div>

            {/* Merit Rules Preview */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-brand-text-primary">{t('meritRules')}</h4>
              <pre className="text-xs bg-base-200 p-2 rounded border border-base-300 overflow-auto">
                {JSON.stringify(meritRules, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

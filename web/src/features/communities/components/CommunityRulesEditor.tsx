'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { Label } from '@/components/ui/shadcn/label';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { Check, RotateCcw, Eye, EyeOff, Download, Upload, History, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { CommunityWithComputedFields, PermissionRule } from '@/types/api-v1';
import { useToastStore } from '@/shared/stores/toast.store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/shadcn/select';
import { useResetDailyQuota } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { cn } from '@/lib/utils';

const TEAM_ROLES = ['lead', 'participant'] as const;

// ActionType constants (matching backend)
const ActionType = {
  POST_PUBLICATION: 'post_publication',
  CREATE_POLL: 'create_poll',
  EDIT_PUBLICATION: 'edit_publication',
  DELETE_PUBLICATION: 'delete_publication',
  VOTE: 'vote',
  COMMENT: 'comment',
  EDIT_COMMENT: 'edit_comment',
  DELETE_COMMENT: 'delete_comment',
  EDIT_POLL: 'edit_poll',
  DELETE_POLL: 'delete_poll',
  VIEW_COMMUNITY: 'view_community',
} as const;

type Role = 'superadmin' | 'lead' | 'participant' | 'viewer';
type ActionTypeValue = typeof ActionType[keyof typeof ActionType];

interface CommunityRulesEditorProps {
  community: CommunityWithComputedFields;
  onSave: (rules: {
    permissionRules?: PermissionRule[];
    meritSettings?: {
      dailyQuota?: number;
      quotaRecipients?: Role[];
      canEarn?: boolean;
      canSpend?: boolean;
      startingMerits?: number;
    };
    linkedCurrencies?: string[];
    settings?: {
      dailyEmission?: number;
      postCost?: number;
      pollCost?: number;
      forwardCost?: number;
      editWindowMinutes?: number;
      allowEditByOthers?: boolean;
      allowWithdraw?: boolean;
      forwardRule?: 'standard' | 'project';
    };
    votingSettings?: {
      votingRestriction?: 'any' | 'not-same-team';
      currencySource?: 'quota-and-wallet' | 'quota-only' | 'wallet-only';
    };
  }) => Promise<void>;
}

// Helper functions for working with permissionRules
function getRuleKey(role: Role, action: string): string {
  return `${role}:${action}`;
}

function findRule(rules: PermissionRule[], role: Role, action: string): PermissionRule | undefined {
  return rules.find(r => r.role === role && r.action === action);
}

function getRuleAllowed(rules: PermissionRule[], role: Role, action: string): boolean {
  const rule = findRule(rules, role, action);
  return rule?.allowed ?? false;
}

function updateRule(
  rules: PermissionRule[],
  role: Role,
  action: string,
  updates: { allowed?: boolean; conditions?: PermissionRule['conditions'] }
): PermissionRule[] {
  const key = getRuleKey(role, action);
  const existingRule = findRule(rules, role, action);
  // Merge conditions: if updates.conditions is provided, merge with existing conditions
  let mergedConditions: PermissionRule['conditions'] | undefined;
  if (updates.conditions !== undefined) {
    mergedConditions = { ...existingRule?.conditions, ...updates.conditions };
    // Remove undefined values from conditions, but keep false values
    if (mergedConditions) {
      Object.keys(mergedConditions).forEach(key => {
        const value = mergedConditions![key as keyof typeof mergedConditions];
        if (value === undefined) {
          delete mergedConditions![key as keyof typeof mergedConditions];
        }
      });
    }
  } else {
    mergedConditions = existingRule?.conditions;
  }

  const newRule: PermissionRule = {
    role,
    action,
    allowed: updates.allowed ?? existingRule?.allowed ?? false,
    conditions: mergedConditions && Object.keys(mergedConditions).length > 0 
      ? mergedConditions 
      : undefined,
  };

  if (existingRule) {
    return rules.map(r => (r.role === role && r.action === action) ? newRule : r);
  } else {
    return [...rules, newRule];
  }
}

function getAllowedRolesForAction(rules: PermissionRule[], action: string): Role[] {
  const roles: Role[] = ['superadmin', 'lead', 'participant', 'viewer'];
  return roles.filter(role => getRuleAllowed(rules, role, action));
}

function setAllowedRolesForAction(
  rules: PermissionRule[],
  action: string,
  allowedRoles: Role[]
): PermissionRule[] {
  const roles: Role[] = ['superadmin', 'lead', 'participant', 'viewer'];
  let updatedRules = [...rules];

  for (const role of roles) {
    const isAllowed = allowedRoles.includes(role);
    const currentAllowed = getRuleAllowed(updatedRules, role, action);
    
    if (isAllowed !== currentAllowed) {
      updatedRules = updateRule(updatedRules, role, action, { allowed: isAllowed });
    }
  }

  return updatedRules;
}

// Helper function to determine default currencySource
function getDefaultCurrencySource(
  votingSettings?: { currencySource?: 'quota-and-wallet' | 'quota-only' | 'wallet-only' },
  typeTag?: string
): 'quota-and-wallet' | 'quota-only' | 'wallet-only' {
  if (votingSettings?.currencySource) {
    return votingSettings.currencySource;
  }
  // Backward compatibility: use typeTag defaults
  if (typeTag === 'marathon-of-good') return 'quota-only';
  if (typeTag === 'future-vision') return 'wallet-only';
  return 'quota-and-wallet';
}

export const CommunityRulesEditor: React.FC<CommunityRulesEditorProps> = ({
  community,
  onSave,
}) => {
  const t = useTranslations('communities.rules');

  // Initialize permissionRules from community
  const initialPermissionRules = useMemo(() => {
    return community.permissionRules || [];
  }, [community.permissionRules]);

  const [permissionRules, setPermissionRules] = useState<PermissionRule[]>(initialPermissionRules);
  
  // Settings state
  const [startingMerits, setStartingMerits] = useState<string>(
    String(community.meritSettings?.startingMerits ?? community.meritSettings?.dailyQuota ?? 100)
  );
  
  const [quotaRecipients, setQuotaRecipients] = useState<Role[]>(
    (community.meritSettings?.quotaRecipients as Role[]) || ['superadmin', 'lead', 'participant', 'viewer']
  );

  const [linkedCurrencies, setLinkedCurrencies] = useState<string[]>(
    community.linkedCurrencies || []
  );
  const [newCurrency, setNewCurrency] = useState('');

  // Additional settings fields
  const [dailyEmission, setDailyEmission] = useState<string>(
    String(community.settings?.dailyEmission || community.meritSettings?.dailyQuota || 100)
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
  const [editWindowMinutes, setEditWindowMinutes] = useState<string>(
    String(community.settings?.editWindowMinutes ?? 30)
  );
  const [allowEditByOthers, setAllowEditByOthers] = useState<boolean>(
    community.settings?.allowEditByOthers ?? false
  );
  const [allowWithdraw, setAllowWithdraw] = useState<boolean>(
    community.settings?.allowWithdraw ?? true
  );
  const [votingRestriction, setVotingRestriction] = useState<'any' | 'not-same-team'>(
    (community.votingSettings?.votingRestriction as 'any' | 'not-same-team') || 'any'
  );
  
  const [currencySource, setCurrencySource] = useState<'quota-and-wallet' | 'quota-only' | 'wallet-only'>(
    getDefaultCurrencySource(community.votingSettings, community.typeTag)
  );
  
  const [forwardRule, setForwardRule] = useState<'standard' | 'project'>(
    (community.settings?.forwardRule as 'standard' | 'project') || 'standard'
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
  
  // Collapsible sections state
  const [isPostingRulesOpen, setIsPostingRulesOpen] = useState(true);
  const [isVotingRulesOpen, setIsVotingRulesOpen] = useState(true);
  const [isVisibilityRulesOpen, setIsVisibilityRulesOpen] = useState(true);
  const [isMeritSettingsOpen, setIsMeritSettingsOpen] = useState(true);
  const [isConfigurationOpen, setIsConfigurationOpen] = useState(true);
  const [isLinkedCurrenciesOpen, setIsLinkedCurrenciesOpen] = useState(true);

  // Store original permissionRules for reset functionality
  const [originalPermissionRules, setOriginalPermissionRules] = useState<PermissionRule[]>(
    JSON.parse(JSON.stringify(initialPermissionRules))
  );

  // Store original settings for change detection
  const [originalSettings, setOriginalSettings] = useState({
    permissionRules: JSON.parse(JSON.stringify(initialPermissionRules)),
    linkedCurrencies: [...(community.linkedCurrencies || [])],
    dailyEmission: String(community.settings?.dailyEmission || community.meritSettings?.dailyQuota || 100),
    postCost: String(community.settings?.postCost ?? 1),
    pollCost: String(community.settings?.pollCost ?? 1),
    forwardCost: String(community.settings?.forwardCost ?? 1),
    editWindowMinutes: String(community.settings?.editWindowMinutes ?? 30),
    allowEditByOthers: community.settings?.allowEditByOthers ?? false,
    allowWithdraw: community.settings?.allowWithdraw ?? true,
    forwardRule: (community.settings?.forwardRule as 'standard' | 'project') || 'standard',
    votingRestriction: (community.votingSettings?.votingRestriction as 'any' | 'not-same-team') || 'any',
    currencySource: getDefaultCurrencySource(community.votingSettings, community.typeTag),
    startingMerits: String(community.meritSettings?.startingMerits ?? community.meritSettings?.dailyQuota ?? 100),
    quotaRecipients: (community.meritSettings?.quotaRecipients as Role[]) || ['superadmin', 'lead', 'participant', 'viewer'],
  });

  // History of rule changes
  interface RulesHistoryEntry {
    id: string;
    timestamp: string;
    permissionRules: PermissionRule[];
    linkedCurrencies: string[];
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

  const saveToHistory = (permissionRules: PermissionRule[], linkedCurrencies: string[]) => {
    const history = getHistory();
    const entry: RulesHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      permissionRules: JSON.parse(JSON.stringify(permissionRules)),
      linkedCurrencies: JSON.parse(JSON.stringify(linkedCurrencies)),
    };

    // Keep only last 10 entries
    const newHistory = [entry, ...history].slice(0, 10);
    const historyKey = getHistoryKey();
    localStorage.setItem(historyKey, JSON.stringify(newHistory));
  };

  const restoreFromHistory = (entry: RulesHistoryEntry) => {
    setPermissionRules(JSON.parse(JSON.stringify(entry.permissionRules)));
    setLinkedCurrencies([...entry.linkedCurrencies]);
    setValidationErrors({});
    addToast(t('historyRestored'), 'success');
  };

  // Use ref to track previous community data to avoid unnecessary updates
  const prevCommunityRef = useRef<string>('');
  
  // Initialize state when community changes
  useEffect(() => {
    const communityKey = JSON.stringify({
      id: community.id,
      permissionRules: community.permissionRules,
      linkedCurrencies: community.linkedCurrencies,
      settings: community.settings,
      meritSettings: community.meritSettings,
      votingSettings: community.votingSettings,
    });
    
    // Only update if community data actually changed
    if (prevCommunityRef.current === communityKey) {
      return;
    }
    
    prevCommunityRef.current = communityKey;
    
    const initialRules = community.permissionRules || [];
    setPermissionRules(JSON.parse(JSON.stringify(initialRules)));
    setLinkedCurrencies([...(community.linkedCurrencies || [])]);
    setDailyEmission(String(community.settings?.dailyEmission || community.meritSettings?.dailyQuota || 100));
    setPostCost(String(community.settings?.postCost ?? 1));
    setPollCost(String(community.settings?.pollCost ?? 1));
    setForwardCost(String(community.settings?.forwardCost ?? 1));
    setEditWindowMinutes(String(community.settings?.editWindowMinutes ?? 30));
    setAllowEditByOthers(community.settings?.allowEditByOthers ?? false);
    setAllowWithdraw(community.settings?.allowWithdraw ?? true);
    setForwardRule((community.settings?.forwardRule as 'standard' | 'project') || 'standard');
    setVotingRestriction((community.votingSettings?.votingRestriction as 'any' | 'not-same-team') || 'any');
    setCurrencySource(getDefaultCurrencySource(community.votingSettings, community.typeTag));
    setStartingMerits(String(community.meritSettings?.startingMerits ?? community.meritSettings?.dailyQuota ?? 100));
    setQuotaRecipients((community.meritSettings?.quotaRecipients as Role[]) || ['superadmin', 'lead', 'participant', 'viewer']);

    // Update original state
    setOriginalPermissionRules(JSON.parse(JSON.stringify(initialRules)));
    setOriginalSettings({
      permissionRules: JSON.parse(JSON.stringify(initialRules)),
      linkedCurrencies: [...(community.linkedCurrencies || [])],
      dailyEmission: String(community.settings?.dailyEmission || community.meritSettings?.dailyQuota || 100),
      postCost: String(community.settings?.postCost ?? 1),
      pollCost: String(community.settings?.pollCost ?? 1),
      forwardCost: String(community.settings?.forwardCost ?? 1),
      editWindowMinutes: String(community.settings?.editWindowMinutes ?? 30),
      allowEditByOthers: community.settings?.allowEditByOthers ?? false,
      allowWithdraw: community.settings?.allowWithdraw ?? true,
      forwardRule: (community.settings?.forwardRule as 'standard' | 'project') || 'standard',
      votingRestriction: (community.votingSettings?.votingRestriction as 'any' | 'not-same-team') || 'any',
      currencySource: getDefaultCurrencySource(community.votingSettings, community.typeTag),
      startingMerits: String(community.meritSettings?.startingMerits ?? community.meritSettings?.dailyQuota ?? 100),
      quotaRecipients: (community.meritSettings?.quotaRecipients as Role[]) || ['superadmin', 'lead', 'participant', 'viewer'],
    });
  }, [community]);

  const validateRules = (): boolean => {
    const errors: Record<string, string> = {};
    // Add validation logic if needed
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateRules()) {
      return;
    }

    setIsSaving(true);
    try {
      const editWindowMinutesValue = Number.parseInt(editWindowMinutes, 10);
      const settingsToSave: any = {
        dailyEmission: parseInt(dailyEmission, 10),
        postCost: parseInt(postCost, 10),
        pollCost: parseInt(pollCost, 10),
        forwardCost: parseInt(forwardCost, 10),
        editWindowMinutes: Number.isFinite(editWindowMinutesValue) ? editWindowMinutesValue : 30,
        allowEditByOthers,
        allowWithdraw,
        forwardRule,
      };
      
      const dataToSave = {
        permissionRules,
        meritSettings: {
          dailyQuota: parseInt(dailyEmission, 10) || 100,
          quotaRecipients: quotaRecipients,
          canEarn: true, // These are controlled by permissionRules now
          canSpend: true,
          startingMerits: parseInt(startingMerits, 10) || parseInt(dailyEmission, 10) || 100,
        },
        linkedCurrencies,
        settings: settingsToSave,
        votingSettings: {
          votingRestriction,
          currencySource,
        },
      };
      
      console.log('[CommunityRulesEditor] Saving data:', JSON.stringify(dataToSave, null, 2));
      console.log('[CommunityRulesEditor] currencySource value:', currencySource);
      console.log('[CommunityRulesEditor] votingSettings:', JSON.stringify(dataToSave.votingSettings, null, 2));
      
      await onSave(dataToSave);
      setValidationErrors({});
      // Update original state after successful save
      setOriginalPermissionRules(JSON.parse(JSON.stringify(permissionRules)));
      setOriginalSettings({
        permissionRules: JSON.parse(JSON.stringify(permissionRules)),
        linkedCurrencies: [...linkedCurrencies],
        dailyEmission,
        postCost,
        pollCost,
        forwardCost,
        editWindowMinutes,
        allowEditByOthers,
        allowWithdraw,
        forwardRule,
        votingRestriction,
        currencySource,
        startingMerits,
        quotaRecipients: [...quotaRecipients],
      });
      // Save to history
      saveToHistory(permissionRules, linkedCurrencies);
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
    setPermissionRules(JSON.parse(JSON.stringify(originalPermissionRules)));
    setLinkedCurrencies([...originalSettings.linkedCurrencies]);
    setDailyEmission(originalSettings.dailyEmission);
    setPostCost(originalSettings.postCost);
    setPollCost(originalSettings.pollCost);
    setForwardCost(originalSettings.forwardCost);
    setEditWindowMinutes(originalSettings.editWindowMinutes);
    setAllowEditByOthers(originalSettings.allowEditByOthers);
    setAllowWithdraw(originalSettings.allowWithdraw);
    setForwardRule(originalSettings.forwardRule);
    setVotingRestriction(originalSettings.votingRestriction);
    setCurrencySource(originalSettings.currencySource);
    setStartingMerits(originalSettings.startingMerits);
    setQuotaRecipients([...originalSettings.quotaRecipients]);
    setValidationErrors({});
  };

  const hasChanges = () => {
    const rulesChanged = JSON.stringify(permissionRules) !== JSON.stringify(originalPermissionRules);
    const linkedCurrenciesChanged = JSON.stringify(linkedCurrencies) !== JSON.stringify(originalSettings.linkedCurrencies);
    const settingsChanged = (
      dailyEmission !== originalSettings.dailyEmission ||
      postCost !== originalSettings.postCost ||
      pollCost !== originalSettings.pollCost ||
      forwardCost !== originalSettings.forwardCost ||
      editWindowMinutes !== originalSettings.editWindowMinutes ||
      allowEditByOthers !== originalSettings.allowEditByOthers ||
      allowWithdraw !== originalSettings.allowWithdraw ||
      forwardRule !== originalSettings.forwardRule ||
      votingRestriction !== originalSettings.votingRestriction ||
      currencySource !== originalSettings.currencySource ||
      startingMerits !== originalSettings.startingMerits ||
      JSON.stringify(quotaRecipients.sort()) !== JSON.stringify(originalSettings.quotaRecipients.sort())
    );

    return rulesChanged || linkedCurrenciesChanged || settingsChanged;
  };

  const exportRules = () => {
    const rulesData = {
      communityId: community.id,
      communityName: community.name,
      permissionRules,
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
          if (!rulesData.permissionRules || !Array.isArray(rulesData.permissionRules)) {
            throw new Error('Invalid rules format');
          }

          setPermissionRules(rulesData.permissionRules);
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

  // Computed values for UI
  const postingAllowedRoles = getAllowedRolesForAction(permissionRules, ActionType.POST_PUBLICATION);
  const votingAllowedRoles = getAllowedRolesForAction(permissionRules, ActionType.VOTE);
  const viewAllowedRoles = getAllowedRolesForAction(permissionRules, ActionType.VIEW_COMMUNITY);

  // Get conditions for POST_PUBLICATION action (using first role that has the action)
  const postingRule = permissionRules.find(r => r.action === ActionType.POST_PUBLICATION);
  const postingRequiresTeamMembership = postingRule?.conditions?.requiresTeamMembership ?? false;
  const postingOnlyTeamLead = postingRule?.conditions?.onlyTeamLead ?? false;

  // Get conditions for VOTE action
  const voteRule = permissionRules.find(r => r.action === ActionType.VOTE);
  const canVoteForOwnPosts = voteRule?.conditions?.canVoteForOwnPosts ?? false;
  const participantsCannotVoteForLead = voteRule?.conditions?.participantsCannotVoteForLead ?? false;

  // Get conditions for VIEW_COMMUNITY action
  const viewRule = permissionRules.find(r => r.action === ActionType.VIEW_COMMUNITY);
  const isHidden = viewRule?.conditions?.isHidden ?? false;
  const teamOnly = viewRule?.conditions?.teamOnly ?? false;

  return (
    <div className="space-y-6">
      {Object.keys(validationErrors).length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 shadow-none rounded-xl">
          <p className="text-red-600 dark:text-red-400 font-bold mb-2">{t('validationErrors.title')}</p>
          <div className="space-y-1">
            {Object.entries(validationErrors).map(([key, message]) => (
              <p key={key} className="text-red-600 dark:text-red-400 text-sm">• {message}</p>
            ))}
          </div>
        </div>
      )}

      {/* Posting Rules */}
      <div className="bg-base-100 rounded-xl border border-base-300/50 overflow-hidden">
        <button
          onClick={() => setIsPostingRulesOpen(!isPostingRulesOpen)}
          className="w-full p-5 border-b border-base-300/50 flex items-center justify-between hover:bg-base-200/50 transition-colors"
        >
          <h2 className="text-lg font-semibold text-brand-text-primary">{t('postingRules')}</h2>
          {isPostingRulesOpen ? (
            <ChevronUp className="w-5 h-5 text-base-content/50" />
          ) : (
            <ChevronDown className="w-5 h-5 text-base-content/50" />
          )}
        </button>
        {isPostingRulesOpen && (
        <div className="p-5 space-y-5">

        <BrandFormControl label={t('allowedRoles')}>
          <div className="space-y-2">
            {(['superadmin', 'lead', 'participant', 'viewer'] as const).map((role) => {
              const checkboxId = `posting-role-${role}`;
              return (
                <div key={role} className="flex items-center gap-2.5">
                  <Checkbox
                    id={checkboxId}
                    checked={postingAllowedRoles.includes(role)}
                    onCheckedChange={(checked) => {
                      const newAllowedRoles = checked
                        ? [...postingAllowedRoles, role]
                        : postingAllowedRoles.filter(r => r !== role);
                      setPermissionRules(setAllowedRolesForAction(permissionRules, ActionType.POST_PUBLICATION, newAllowedRoles));
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

        <div className="space-y-3 pt-2 border-t border-base-300/30">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="requiresTeamMembership"
              checked={postingRequiresTeamMembership}
              onCheckedChange={(checked) => {
                // Update conditions for all roles that have POST_PUBLICATION rules
                let updatedRules = permissionRules;
                const roles: Role[] = ['superadmin', 'lead', 'participant', 'viewer'];
                for (const role of roles) {
                  const rule = findRule(updatedRules, role, ActionType.POST_PUBLICATION);
                  if (rule) {
                    updatedRules = updateRule(updatedRules, role, ActionType.POST_PUBLICATION, {
                      conditions: { requiresTeamMembership: checked as boolean },
                    });
                  }
                }
                setPermissionRules(updatedRules);
              }}
            />
            <Label htmlFor="requiresTeamMembership" className="text-sm cursor-pointer">
              {t('requiresTeamMembership')}
            </Label>
          </div>

          <div className="flex items-center gap-2.5">
            <Checkbox
              id="onlyTeamLead"
              checked={postingOnlyTeamLead}
              onCheckedChange={(checked) => {
                let updatedRules = permissionRules;
                const roles: Role[] = ['superadmin', 'lead', 'participant', 'viewer'];
                for (const role of roles) {
                  const rule = findRule(updatedRules, role, ActionType.POST_PUBLICATION);
                  if (rule) {
                    updatedRules = updateRule(updatedRules, role, ActionType.POST_PUBLICATION, {
                      conditions: { onlyTeamLead: checked as boolean },
                    });
                  }
                }
                setPermissionRules(updatedRules);
              }}
            />
            <Label htmlFor="onlyTeamLead" className="text-sm cursor-pointer">
              {t('onlyTeamLead')}
            </Label>
          </div>
        </div>

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

            <BrandFormControl
              label={tSettings('forwardRule')}
              helperText={tSettings('forwardRuleHelp')}
            >
              <Select
                value={forwardRule}
                onValueChange={(value) => setForwardRule(value as 'standard' | 'project')}
              >
                <SelectTrigger className="h-11 rounded-xl w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">{tSettings('forwardRuleOptions.standard')}</SelectItem>
                  <SelectItem value="project">{tSettings('forwardRuleOptions.project')}</SelectItem>
                </SelectContent>
              </Select>
            </BrandFormControl>
          </>
        )}
        </div>
        )}
      </div>

      {/* Voting Rules */}
      <div className="bg-base-100 rounded-xl border border-base-300/50 overflow-hidden">
        <button
          onClick={() => setIsVotingRulesOpen(!isVotingRulesOpen)}
          className="w-full p-5 border-b border-base-300/50 flex items-center justify-between hover:bg-base-200/50 transition-colors"
        >
          <h2 className="text-lg font-semibold text-brand-text-primary">{t('votingRules')}</h2>
          {isVotingRulesOpen ? (
            <ChevronUp className="w-5 h-5 text-base-content/50" />
          ) : (
            <ChevronDown className="w-5 h-5 text-base-content/50" />
          )}
        </button>
        {isVotingRulesOpen && (
        <div className="p-5 space-y-5">

        <BrandFormControl label={t('allowedRoles')}>
          <div className="space-y-2.5">
            {(['superadmin', 'lead', 'participant', 'viewer'] as const).map((role) => {
              const checkboxId = `voting-role-${role}`;
              return (
                <div key={role} className="flex items-center gap-2.5">
                  <Checkbox
                    id={checkboxId}
                    checked={votingAllowedRoles.includes(role)}
                    onCheckedChange={(checked) => {
                      const newAllowedRoles = checked
                        ? [...votingAllowedRoles, role]
                        : votingAllowedRoles.filter(r => r !== role);
                      setPermissionRules(setAllowedRolesForAction(permissionRules, ActionType.VOTE, newAllowedRoles));
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

        <div className="space-y-3 pt-2 border-t border-base-300/30">
        <div className="flex items-center gap-2.5">
          <Checkbox
            id="canVoteForOwnPosts"
            checked={canVoteForOwnPosts}
            onCheckedChange={(checked) => {
              let updatedRules = permissionRules;
              // Update conditions for all roles - create rules if they don't exist
              const roles: Role[] = ['superadmin', 'lead', 'participant', 'viewer'];
              for (const role of roles) {
                const rule = findRule(updatedRules, role, ActionType.VOTE);
                // If rule exists, update it; if not, create it with default allowed=true
                updatedRules = updateRule(updatedRules, role, ActionType.VOTE, {
                  allowed: rule?.allowed ?? true,
                  conditions: { canVoteForOwnPosts: checked as boolean },
                });
              }
              setPermissionRules(updatedRules);
            }}
          />
          <Label htmlFor="canVoteForOwnPosts" className="text-sm cursor-pointer">
            {t('canVoteForOwnPosts')}
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="participantsCannotVoteForLead"
            checked={participantsCannotVoteForLead}
            onCheckedChange={(checked) => {
              let updatedRules = permissionRules;
              // Update conditions for all roles that have VOTE rules
              const roles: Role[] = ['superadmin', 'lead', 'participant', 'viewer'];
              for (const role of roles) {
                const rule = findRule(updatedRules, role, ActionType.VOTE);
                if (rule) {
                  updatedRules = updateRule(updatedRules, role, ActionType.VOTE, {
                    conditions: { participantsCannotVoteForLead: checked as boolean },
                  });
                }
              }
              setPermissionRules(updatedRules);
            }}
          />
          <Label htmlFor="participantsCannotVoteForLead" className="text-sm cursor-pointer">
            {t('participantsCannotVoteForLead')}
          </Label>
        </div>
        </div>

        <BrandFormControl
          label={tSettings('votingRestriction')}
          helperText={tSettings('votingRestrictionHelp')}
        >
          <Select
            value={votingRestriction}
            onValueChange={(value) => setVotingRestriction(value as 'any' | 'not-same-team')}
          >
            <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{tSettings('votingRestrictionOptions.any')}</SelectItem>
              <SelectItem value="not-same-team">{tSettings('votingRestrictionOptions.notSameTeam')}</SelectItem>
            </SelectContent>
          </Select>
        </BrandFormControl>

        <BrandFormControl
          label={tSettings('currencySource')}
          helperText={tSettings('currencySourceHelp')}
        >
          <Select
            value={currencySource}
            onValueChange={(value) => setCurrencySource(value as 'quota-and-wallet' | 'quota-only' | 'wallet-only')}
          >
            <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quota-and-wallet">{tSettings('currencySourceOptions.quotaAndWallet')}</SelectItem>
              <SelectItem value="quota-only">{tSettings('currencySourceOptions.quotaOnly')}</SelectItem>
              <SelectItem value="wallet-only">{tSettings('currencySourceOptions.walletOnly')}</SelectItem>
            </SelectContent>
          </Select>
        </BrandFormControl>
        </div>
        )}
      </div>

      {/* Visibility Rules */}
      <div className="bg-base-100 rounded-xl border border-base-300/50 overflow-hidden">
        <button
          onClick={() => setIsVisibilityRulesOpen(!isVisibilityRulesOpen)}
          className="w-full p-5 border-b border-base-300/50 flex items-center justify-between hover:bg-base-200/50 transition-colors"
        >
          <h2 className="text-lg font-semibold text-brand-text-primary">{t('visibilityRules')}</h2>
          {isVisibilityRulesOpen ? (
            <ChevronUp className="w-5 h-5 text-base-content/50" />
          ) : (
            <ChevronDown className="w-5 h-5 text-base-content/50" />
          )}
        </button>
        {isVisibilityRulesOpen && (
        <div className="p-5 space-y-5">

        <BrandFormControl label={t('visibleToRoles')}>
          <div className="space-y-2.5">
            {(['superadmin', 'lead', 'participant', 'viewer'] as const).map((role) => {
              const checkboxId = `visibility-role-${role}`;
              return (
                <div key={role} className="flex items-center gap-2.5">
                  <Checkbox
                    id={checkboxId}
                    checked={viewAllowedRoles.includes(role)}
                    onCheckedChange={(checked) => {
                      const newAllowedRoles = checked
                        ? [...viewAllowedRoles, role]
                        : viewAllowedRoles.filter(r => r !== role);
                      setPermissionRules(setAllowedRolesForAction(permissionRules, ActionType.VIEW_COMMUNITY, newAllowedRoles));
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

        <div className="space-y-3 pt-2 border-t border-base-300/30">
        <div className="flex items-center gap-2.5">
          <Checkbox
            id="isHidden"
            checked={isHidden}
            onCheckedChange={(checked) => {
              let updatedRules = permissionRules;
              const roles: Role[] = ['superadmin', 'lead', 'participant', 'viewer'];
              for (const role of roles) {
                const rule = findRule(updatedRules, role, ActionType.VIEW_COMMUNITY);
                if (rule) {
                  updatedRules = updateRule(updatedRules, role, ActionType.VIEW_COMMUNITY, {
                    conditions: { isHidden: checked as boolean },
                  });
                }
              }
              setPermissionRules(updatedRules);
            }}
          />
          <Label htmlFor="isHidden" className="text-sm cursor-pointer">
            {t('isHidden')}
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="teamOnly"
            checked={teamOnly}
            onCheckedChange={(checked) => {
              let updatedRules = permissionRules;
              const roles: Role[] = ['superadmin', 'lead', 'participant', 'viewer'];
              for (const role of roles) {
                const rule = findRule(updatedRules, role, ActionType.VIEW_COMMUNITY);
                if (rule) {
                  updatedRules = updateRule(updatedRules, role, ActionType.VIEW_COMMUNITY, {
                    conditions: { teamOnly: checked as boolean },
                  });
                }
              }
              setPermissionRules(updatedRules);
            }}
          />
          <Label htmlFor="teamOnly" className="text-sm cursor-pointer">
            {t('teamOnly')}
          </Label>
        </div>
        </div>
        </div>
        )}
      </div>

      {/* Merit Settings */}
      <div className="bg-base-100 rounded-xl border border-base-300/50 overflow-hidden">
        <button
          onClick={() => setIsMeritSettingsOpen(!isMeritSettingsOpen)}
          className="w-full p-5 border-b border-base-300/50 flex items-center justify-between hover:bg-base-200/50 transition-colors"
        >
          <h2 className="text-lg font-semibold text-brand-text-primary">{t('meritRules')}</h2>
          {isMeritSettingsOpen ? (
            <ChevronUp className="w-5 h-5 text-base-content/50" />
          ) : (
            <ChevronDown className="w-5 h-5 text-base-content/50" />
          )}
        </button>
        {isMeritSettingsOpen && (
        <div className="p-5 space-y-5">

        <BrandFormControl label={tSettings('dailyEmission')} helperText={tSettings('dailyEmissionHelp')}>
          <Input
            value={dailyEmission}
            onChange={(e) => setDailyEmission(e.target.value)}
            type="number"
            className="h-11 rounded-xl w-full"
          />
        </BrandFormControl>

        <BrandFormControl label={t('startingMerits') || 'Starting Merits'} helperText={t('startingMeritsHelp') || 'Amount of merits new members receive when invited to this group'}>
          <Input
            value={startingMerits}
            onChange={(e) => setStartingMerits(e.target.value)}
            type="number"
            className="h-11 rounded-xl w-full"
          />
        </BrandFormControl>

        <BrandFormControl label={t('quotaRecipients')}>
          <div className="space-y-2.5">
            {(['superadmin', 'lead', 'participant', 'viewer'] as const).map((role) => {
              const checkboxId = `merit-role-${role}`;
              const isAllowed = quotaRecipients.includes(role);
              return (
                <div key={role} className="flex items-center gap-2.5">
                  <Checkbox
                    id={checkboxId}
                    checked={isAllowed}
                    onCheckedChange={(checked) => {
                      const newQuotaRecipients = checked
                        ? [...quotaRecipients, role]
                        : quotaRecipients.filter(r => r !== role);
                      setQuotaRecipients(newQuotaRecipients);
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
        </div>
        )}
      </div>

      {/* Configuration Settings */}
      <div className="bg-base-100 rounded-xl border border-base-300/50 overflow-hidden">
        <button
          onClick={() => setIsConfigurationOpen(!isConfigurationOpen)}
          className="w-full p-5 border-b border-base-300/50 flex items-center justify-between hover:bg-base-200/50 transition-colors"
        >
          <h2 className="text-lg font-semibold text-brand-text-primary">{tSettings('configuration')}</h2>
          {isConfigurationOpen ? (
            <ChevronUp className="w-5 h-5 text-base-content/50" />
          ) : (
            <ChevronDown className="w-5 h-5 text-base-content/50" />
          )}
        </button>
        {isConfigurationOpen && (
        <div className="p-5 space-y-5">

        {(isSuperadmin || isUserLead) && (
          <>
            <BrandFormControl
              label={t('editWindowMinutes')}
              helperText={t('editWindowMinutesHelp')}
            >
              <Input
                type="number"
                min="0"
                value={editWindowMinutes}
                onChange={(e) => setEditWindowMinutes(e.target.value)}
                className="h-11 rounded-xl w-full"
              />
            </BrandFormControl>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="allowEditByOthers"
                checked={allowEditByOthers}
                onCheckedChange={(checked) => setAllowEditByOthers(checked as boolean)}
              />
              <Label htmlFor="allowEditByOthers" className="text-sm cursor-pointer">
                {t('allowEditByOthers')}
              </Label>
            </div>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="allowWithdraw"
                checked={allowWithdraw}
                onCheckedChange={(checked) => setAllowWithdraw(checked as boolean)}
              />
              <Label htmlFor="allowWithdraw" className="text-sm cursor-pointer">
                {t('allowWithdraw')}
              </Label>
            </div>
          </>
        )}

        {canResetQuota && (
          <BrandFormControl
            label={tSettings('resetQuota')}
            helperText={tSettings('resetQuotaDescription')}
          >
            <Button
              variant="outline"
              size="default"
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
        </div>
        )}
      </div>

      {/* Linked Currencies */}
      <div className="bg-base-100 rounded-xl border border-base-300/50 overflow-hidden">
        <div className="p-5 border-b border-base-300/50">
          <h2 className="text-lg font-semibold text-brand-text-primary">{t('linkedCurrencies')}</h2>
        </div>
        <div className="p-5 space-y-4">
        <div className="space-y-2">
          {linkedCurrencies.map((currency) => (
            <div key={currency} className="flex items-center justify-between p-2 bg-base-200 rounded-md shadow-none">
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
        )}
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
        <div className="shadow-none rounded-xl overflow-hidden bg-base-100">
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
                    className="p-3 shadow-none rounded-md flex items-center justify-between"
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
        <div className="shadow-none rounded-xl overflow-hidden bg-base-100">
          <div className="p-4 border-b border-brand-border">
            <h3 className="text-lg font-semibold text-brand-text-primary">{t('preview')}</h3>
          </div>
          <div className="p-4 space-y-6">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-brand-text-primary">Permission Rules</h4>
              <pre className="text-xs bg-base-200 p-2 rounded shadow-none overflow-auto">
                {JSON.stringify(permissionRules, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

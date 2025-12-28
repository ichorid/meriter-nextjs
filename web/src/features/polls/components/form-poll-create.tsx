'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from 'next-intl';
import { initDataRaw, useSignal, mainButton, backButton } from '@telegram-apps/sdk-react';
import { useCreatePoll, useUpdatePoll } from '@/hooks/api/usePolls';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useWallet } from '@/hooks/api/useWallet';
import type { Poll } from '@/types/api-v1';
import { safeHapticFeedback } from '@/shared/lib/utils/haptic-utils';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';
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
import { Plus, Trash2 } from 'lucide-react';

interface IPollOption {
    id: string;
    text: string;
}

interface IFormPollCreateProps {
    wallets?: any[];
    communityId?: string;
    onSuccess?: (pollId: string) => void;
    onCancel?: () => void;
    pollId?: string;
    initialData?: Poll;
}

export const FormPollCreate = ({
    wallets = [],
    communityId,
    onSuccess,
    onCancel,
    pollId,
    initialData,
}: IFormPollCreateProps) => {
    const t = useTranslations('polls');
    const rawData = useSignal(initDataRaw);
    const isInTelegram = !!rawData;
    const isMountedRef = useRef(true);
    const updatePoll = useUpdatePoll();
    const createPoll = useCreatePoll();
    const isEditMode = !!pollId && !!initialData;
    const currentCommunityId = communityId || initialData?.communityId || '';
    const { data: community } = useCommunity(currentCommunityId);
    const { data: quotaData } = useUserQuota(currentCommunityId);
    const { data: wallet } = useWallet(currentCommunityId || undefined);

    // Get poll cost from community settings (default to 1 if not set)
    const pollCost = community?.settings?.pollCost ?? 1;

    // Check if payment is required (not future-vision and cost > 0)
    const requiresPayment = community?.typeTag !== 'future-vision' && pollCost > 0;
    const quotaRemaining = quotaData?.remainingToday ?? 0;
    const walletBalance = wallet?.balance ?? 0;

    // Automatic payment method selection: quota first, then wallet
    const willUseQuota = requiresPayment && quotaRemaining >= pollCost;
    const willUseWallet = requiresPayment && quotaRemaining < pollCost && walletBalance >= pollCost;
    const hasInsufficientPayment = requiresPayment && quotaRemaining < pollCost && walletBalance < pollCost;

    // Calculate timeValue and timeUnit from expiresAt if editing
    const calculateTimeFromExpiresAt = (expiresAt: string): { value: string; unit: "minutes" | "hours" | "days" } => {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diffMs = expires.getTime() - now.getTime();

        if (diffMs <= 0) {
            return { value: "24", unit: "hours" };
        }

        const diffMinutes = Math.floor(diffMs / (60 * 1000));
        const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

        if (diffDays >= 1) {
            return { value: diffDays.toString(), unit: "days" };
        } else if (diffHours >= 1) {
            return { value: diffHours.toString(), unit: "hours" };
        } else {
            return { value: diffMinutes.toString(), unit: "minutes" };
        }
    };

    const initialTime = initialData?.expiresAt
        ? calculateTimeFromExpiresAt(initialData.expiresAt)
        : { value: "24", unit: "hours" as const };

    const [title, setTitle] = useState(initialData?.question || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [options, setOptions] = useState<IPollOption[]>(
        initialData?.options?.map(opt => ({ id: opt.id, text: opt.text })) || [
            { id: "1", text: "" },
            { id: "2", text: "" },
        ]
    );
    const [timeValue, setTimeValue] = useState(initialTime.value);
    const [timeUnit, setTimeUnit] = useState<"minutes" | "hours" | "days">(initialTime.unit);
    const [selectedWallet, setSelectedWallet] = useState(communityId || initialData?.communityId || "");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState("");

    // Track component mount status
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const addOption = () => {
        if (options.length >= 10) {
            setError(t('errorMaxOptions'));
            return;
        }
        const newId = (Math.max(...options.map((o) => parseInt(o.id))) + 1).toString();
        setOptions([...options, { id: newId, text: "" }]);
        setError("");
    };

    const removeOption = (id: string) => {
        if (options.length <= 2) {
            setError(t('errorMinOptions'));
            return;
        }
        setOptions(options.filter((opt) => opt.id !== id));
        setError("");
    };

    const updateOption = (id: string, text: string) => {
        setOptions(options.map((opt) => (opt.id === id ? { ...opt, text } : opt)));
    };

    const validate = () => {
        if (!title.trim()) {
            setError(t('errorTitleRequired'));
            return false;
        }

        const filledOptions = options.filter((opt) => opt.text.trim());
        if (filledOptions.length < 2) {
            setError(t('errorMinOptionsFilled'));
            return false;
        }

        if (!selectedWallet) {
            setError(t('errorSelectCommunity'));
            return false;
        }

        const timeVal = parseInt(timeValue);
        if (isNaN(timeVal) || timeVal <= 0) {
            setError(t('errorInvalidTime'));
            return false;
        }

        // Check payment if required
        if (hasInsufficientPayment) {
            setError(t('insufficientPayment'));
            return false;
        }

        return true;
    };

    const handleCreate = useCallback(async () => {
        if (!validate()) {
            safeHapticFeedback('error', isInTelegram);
            return;
        }

        setIsCreating(true);
        setError("");

        if (isInTelegram && isMountedRef.current) {
            try {
                mainButton.setParams({ isLoaderVisible: true });
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.warn('MainButton already unmounted:', message);
            }
        }

        try {
            // Calculate expiration time in milliseconds
            let durationMs = parseInt(timeValue);
            switch (timeUnit) {
                case "minutes":
                    durationMs *= 60 * 1000;
                    break;
                case "hours":
                    durationMs *= 60 * 60 * 1000;
                    break;
                case "days":
                    durationMs *= 24 * 60 * 60 * 1000;
                    break;
            }

            const expiresAt = new Date(Date.now() + durationMs);

            const filledOptions = options
                .filter((opt) => opt.text.trim())
                .map((opt) => ({
                    id: opt.id,
                    text: opt.text.trim(),
                }));

            // Automatic payment (quota first, then wallet)
            const quotaAmount = willUseQuota ? pollCost : 0;
            const walletAmount = willUseWallet ? pollCost : 0;

            const payload = {
                question: title.trim(),
                description: description.trim() || undefined,
                options: filledOptions,
                expiresAt: expiresAt.toISOString(),
                communityId: selectedWallet,
                quotaAmount: quotaAmount > 0 ? quotaAmount : undefined,
                walletAmount: walletAmount > 0 ? walletAmount : undefined,
            };

            console.log('📊 Creating poll with payload:', payload);

            let poll;
            if (isEditMode && pollId) {
                // Update existing poll
                poll = await updatePoll.mutateAsync({
                    id: pollId,
                    data: payload,
                });
                console.log('📊 Poll update response:', poll);
            } else {
                // Create new poll
                poll = await createPoll.mutateAsync(payload);
                console.log('📊 Poll creation response:', poll);
            }

            safeHapticFeedback('success', isInTelegram);
            onSuccess && onSuccess(poll.id);
        } catch (err: unknown) {
            console.error('📊 Poll creation error:', err);
            const errorMessage = extractErrorMessage(err, t('errorCreating'));
            setError(errorMessage);
            safeHapticFeedback('error', isInTelegram);
        } finally {
            setIsCreating(false);
            if (isInTelegram && isMountedRef.current) {
                try {
                    mainButton.setParams({ isLoaderVisible: false });
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    console.warn('MainButton already unmounted:', message);
                }
            }
        }
    }, [title, description, options, timeValue, timeUnit, selectedWallet, isInTelegram, t, onSuccess, isEditMode, pollId, updatePoll]);

    // Telegram MainButton integration
    useEffect(() => {
        if (isInTelegram && isMountedRef.current) {
            let cleanup: (() => void) | undefined;

            const initializeMainButton = () => {
                if (!isMountedRef.current) return;

                try {
                    // Try to mount the mainButton first
                    mainButton.mount();
                } catch (error: unknown) {
                    // MainButton might already be mounted, that's okay
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    console.warn('MainButton mount warning (expected if already mounted):', message);
                }

                try {
                    // Set the mainButton parameters
                    mainButton.setParams({
                        text: isEditMode ? (t('updatePoll') || 'Update Poll') : t('createPoll'),
                        isVisible: true,
                        isEnabled: true
                    });

                    // Set up click handler
                    cleanup = mainButton.onClick(handleCreate);

                    // Setup back button if cancel is available
                    if (onCancel) {
                        try {
                            backButton.show();
                            const backCleanup = backButton.onClick(onCancel);

                            return () => {
                                if (isMountedRef.current) {
                                    try {
                                        mainButton.setParams({ isVisible: false });
                                    } catch (error: unknown) {
                                        const message = error instanceof Error ? error.message : 'Unknown error';
                                        console.warn('MainButton cleanup warning:', message);
                                    }
                                }
                                if (cleanup) cleanup();
                                backButton.hide();
                                backCleanup();
                            };
                        } catch (error: unknown) {
                            const message = error instanceof Error ? error.message : 'Unknown error';
                            console.error('Failed to setup back button:', message);
                        }
                    }

                    return () => {
                        if (isMountedRef.current) {
                            try {
                                mainButton.setParams({ isVisible: false });
                            } catch (error: unknown) {
                                const message = error instanceof Error ? error.message : 'Unknown error';
                                console.warn('MainButton cleanup warning:', message);
                            }
                        }
                        if (cleanup) cleanup();
                    };

                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    console.error('Failed to initialize mainButton:', message);
                    // If mainButton fails, we'll just return a no-op cleanup
                    return () => { };
                }
            };

            // Try to initialize immediately, but if it fails, retry after a short delay
            let cleanupFn = initializeMainButton();

            if (!cleanupFn) {
                // If initialization failed, try again after a short delay
                const timeoutId = setTimeout(() => {
                    if (isMountedRef.current) {
                        cleanupFn = initializeMainButton();
                    }
                }, 200);

                return () => {
                    clearTimeout(timeoutId);
                    if (cleanupFn) cleanupFn();
                };
            }

            return cleanupFn;
        }
        return undefined;
    }, [isInTelegram, handleCreate, onCancel, t]);

    return (
        <div className="space-y-6">
            {!isEditMode && requiresPayment && (
                <div className={`p-3 rounded-lg border ${hasInsufficientPayment
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                    : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                    }`}>
                    {hasInsufficientPayment ? (
                        <p className="text-red-700 dark:text-red-300 text-sm">
                            {t('insufficientPayment', { cost: pollCost })}
                        </p>
                    ) : pollCost > 0 ? (
                        <p className="text-blue-700 dark:text-blue-300 text-sm">
                            {willUseQuota
                                ? t('willPayWithQuota', { remaining: quotaRemaining, cost: pollCost })
                                : t('willPayWithWallet', { balance: walletBalance, cost: pollCost })}
                        </p>
                    ) : (
                        <p className="text-blue-700 dark:text-blue-300 text-sm">
                            {t('pollIsFree')}
                        </p>
                    )}
                </div>
            )}

            {/* Poll Title Section */}
            <BrandFormControl label={t('pollTitleLabel')} required>
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('pollTitlePlaceholder')}
                    disabled={isCreating}
                    className="h-11 rounded-xl w-full"
                />
            </BrandFormControl>

            {/* Description Section */}
            <BrandFormControl label={t('descriptionLabel')}>
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('descriptionPlaceholder')}
                    disabled={isCreating}
                    rows={3}
                    className="resize-none"
                />
            </BrandFormControl>

            {/* Poll Options Section */}
            <div>
                <h2 className="text-sm font-semibold text-brand-text-primary dark:text-base-content mb-2">{t('options')}</h2>
                <div className="space-y-2">
                    {options.map((option, index) => (
                        <div key={`option-${option.id}`} className="flex items-center gap-2">
                            <span className="text-sm font-medium text-brand-text-primary dark:text-base-content w-6">{index + 1}.</span>
                            <div className="flex-1">
                                <Input
                                    value={option.text}
                                    onChange={(e) => updateOption(option.id, e.target.value)}
                                    placeholder={t('optionPlaceholder', { number: index + 1 })}
                                    disabled={isCreating}
                                    className="h-11 rounded-xl w-full"
                                />
                            </div>
                            {options.length > 2 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeOption(option.id)}
                                    disabled={isCreating}
                                    className="rounded-xl active:scale-[0.98] text-red-500 border-red-200 hover:bg-red-50"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            )}
                        </div>
                    ))}

                    {options.length < 10 && (
                        <Button
                            variant="outline"
                            onClick={addOption}
                            disabled={isCreating}
                            className="rounded-xl active:scale-[0.98] mt-2 w-full"
                        >
                            <Plus size={16} />
                            {t('addOption')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Community Selection Section */}
            {!communityId && (
                <BrandFormControl label={t('selectCommunity')} required>
                    <Select
                        value={selectedWallet}
                        onValueChange={setSelectedWallet}
                        disabled={isCreating}
                    >
                        <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
                            <SelectValue placeholder={t('selectCommunityPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            {wallets.map((wallet) => (
                                <SelectItem key={wallet.meta?.currencyOfCommunityTgChatId} value={wallet.meta?.currencyOfCommunityTgChatId}>
                                    {wallet.name || wallet.meta?.currencyNames?.many || t('communityFallback')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </BrandFormControl>
            )}

            {/* Duration Section */}
            <BrandFormControl label={t('durationLabel')} required>
                <div className="flex gap-2">
                    <div className="w-24">
                        <Input
                            value={timeValue}
                            onChange={(e) => setTimeValue(e.target.value)}
                            type="number"
                            disabled={isCreating}
                            className="h-11 rounded-xl w-full"
                        />
                    </div>
                    <div className="flex-1">
                        <Select
                            value={timeUnit}
                            onValueChange={(val) => setTimeUnit(val as any)}
                            disabled={isCreating}
                        >
                            <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="minutes">{t('minutes')}</SelectItem>
                                <SelectItem value="hours">{t('hours')}</SelectItem>
                                <SelectItem value="days">{t('days')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </BrandFormControl>

            {/* Error Alert */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Action Buttons - Hidden in Telegram (uses MainButton) */}
            {!isInTelegram && (
                <div className="flex justify-end gap-3 mt-4">
                    {onCancel && (
                        <Button
                            variant="outline"
                            onClick={onCancel}
                            disabled={isCreating}
                            className="rounded-xl active:scale-[0.98]"
                        >
                            {t('cancel')}
                        </Button>
                    )}
                    <Button
                        variant="default"
                        onClick={handleCreate}
                        disabled={isCreating || hasInsufficientPayment}
                        className="rounded-xl active:scale-[0.98]"
                    >
                        {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isEditMode ? (t('updatePoll') || 'Update Poll') : t('createPoll')}
                    </Button>
                </div>
            )}
        </div>
    );
};

'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from 'next-intl';
import { initDataRaw, useSignal, mainButton, backButton } from '@telegram-apps/sdk-react';
import { pollsApiV1 } from '@/lib/api/v1';
import { useUpdatePoll } from '@/hooks/api/usePolls';
import type { Poll } from '@/types/api-v1';
import { safeHapticFeedback } from '@/shared/lib/utils/haptic-utils';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';

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
    const isEditMode = !!pollId && !!initialData;

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

            const payload = {
                question: title.trim(),
                description: description.trim() || undefined,
                options: filledOptions,
                expiresAt: expiresAt.toISOString(),
                communityId: selectedWallet,
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
                poll = await pollsApiV1.createPoll(payload);
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
        <div className="p-4 space-y-6">
            <div className="flex items-center gap-4">
                {onCancel && (
                    <BrandButton
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        className="p-0"
                    >
                        <ArrowLeft size={24} />
                    </BrandButton>
                )}
                <h1 className="text-xl font-bold text-brand-text-primary dark:text-base-content">
                    {isEditMode ? (t('editTitle') || 'Edit Poll') : t('createTitle')}
                </h1>
            </div>

            {/* Poll Title Section */}
            <BrandFormControl label={t('pollTitleLabel')} required>
                <BrandInput
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('pollTitlePlaceholder')}
                    disabled={isCreating}
                    fullWidth
                />
            </BrandFormControl>

            {/* Description Section */}
            <BrandFormControl label={t('descriptionLabel')}>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('descriptionPlaceholder')}
                    disabled={isCreating}
                    rows={3}
                    className="w-full px-4 py-3 bg-brand-surface dark:bg-base-100 border border-brand-border dark:border-base-300/50 rounded-xl text-brand-text-primary dark:text-base-content placeholder:text-brand-text-secondary/50 dark:placeholder:text-base-content/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
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
                                <BrandInput
                                    value={option.text}
                                    onChange={(e) => updateOption(option.id, e.target.value)}
                                    placeholder={t('optionPlaceholder', { number: index + 1 })}
                                    disabled={isCreating}
                                    fullWidth
                                />
                            </div>
                            {options.length > 2 && (
                                <BrandButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeOption(option.id)}
                                    disabled={isCreating}
                                    className="text-red-500 border-red-200 hover:bg-red-50"
                                >
                                    <Trash2 size={16} />
                                </BrandButton>
                            )}
                        </div>
                    ))}

                    {options.length < 10 && (
                        <BrandButton
                            variant="outline"
                            onClick={addOption}
                            disabled={isCreating}
                            className="mt-2 w-full"
                            leftIcon={<Plus size={16} />}
                        >
                            {t('addOption')}
                        </BrandButton>
                    )}
                </div>
            </div>

            {/* Community Selection Section */}
            {!communityId && (
                <BrandFormControl label={t('selectCommunity')} required>
                    <BrandSelect
                        value={selectedWallet}
                        onChange={setSelectedWallet}
                        options={wallets.map((wallet) => ({
                            label: wallet.name || wallet.meta?.currencyNames?.many || t('communityFallback'),
                            value: wallet.meta?.currencyOfCommunityTgChatId
                        }))}
                        placeholder={t('selectCommunityPlaceholder')}
                        disabled={isCreating}
                        fullWidth
                    />
                </BrandFormControl>
            )}

            {/* Duration Section */}
            <BrandFormControl label={t('durationLabel')} required>
                <div className="flex gap-2">
                    <div className="w-24">
                        <BrandInput
                            value={timeValue}
                            onChange={(e) => setTimeValue(e.target.value)}
                            type="number"
                            disabled={isCreating}
                            fullWidth
                        />
                    </div>
                    <div className="flex-1">
                        <BrandSelect
                            value={timeUnit}
                            onChange={(val) => setTimeUnit(val as any)}
                            options={[
                                { label: t('minutes'), value: 'minutes' },
                                { label: t('hours'), value: 'hours' },
                                { label: t('days'), value: 'days' },
                            ]}
                            disabled={isCreating}
                            fullWidth
                        />
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
                        <BrandButton
                            variant="outline"
                            onClick={onCancel}
                            disabled={isCreating}
                        >
                            {t('cancel')}
                        </BrandButton>
                    )}
                    <BrandButton
                        variant="primary"
                        onClick={handleCreate}
                        disabled={isCreating}
                        isLoading={isCreating}
                    >
                        {isEditMode ? (t('updatePoll') || 'Update Poll') : t('createPoll')}
                    </BrandButton>
                </div>
            )}
        </div>
    );
};

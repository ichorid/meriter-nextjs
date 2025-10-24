'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { apiPOST } from "@shared/lib/fetch";
import { A } from "@shared/components/simple/simple-elements";
import { useTranslations } from 'next-intl';
import { initDataRaw, useSignal, hapticFeedback, mainButton, backButton } from '@telegram-apps/sdk-react';

interface IPollOption {
    id: string;
    text: string;
}

interface IFormPollCreateProps {
    wallets?: any[];
    communityId?: string;
    onSuccess?: (pollId: string) => void;
    onCancel?: () => void;
}

export const FormPollCreate = ({
    wallets = [],
    communityId,
    onSuccess,
    onCancel,
}: IFormPollCreateProps) => {
    const t = useTranslations('polls');
    const rawData = useSignal(initDataRaw);
    const isInTelegram = !!rawData;
    const isMountedRef = useRef(true);
    
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [options, setOptions] = useState<IPollOption[]>([
        { id: "1", text: "" },
        { id: "2", text: "" },
    ]);
    const [timeValue, setTimeValue] = useState(24);
    const [timeUnit, setTimeUnit] = useState<"minutes" | "hours" | "days">("hours");
    const [selectedWallet, setSelectedWallet] = useState(communityId || "");
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

        if (timeValue <= 0) {
            setError(t('errorInvalidTime'));
            return false;
        }

        return true;
    };

    const handleCreate = useCallback(async () => {
        if (!validate()) {
            hapticFeedback.notificationOccurred('error');
            return;
        }

        setIsCreating(true);
        setError("");
        
        if (isInTelegram && isMountedRef.current) {
            try {
                mainButton.setParams({ isLoaderVisible: true });
            } catch (error: any) {
                console.warn('MainButton already unmounted:', error.message);
            }
        }

        try {
            // Calculate expiration time in milliseconds
            let durationMs = timeValue;
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
                    votes: 0,
                    voterCount: 0,
                }));

            const payload = {
                title: title.trim(),
                description: description.trim() || undefined,
                options: filledOptions,
                expiresAt: expiresAt.toISOString(),
                communityId: selectedWallet,
            };

            console.log('📊 Creating poll with payload:', payload);

            const response = await apiPOST("/api/rest/poll/create", payload);

            console.log('📊 Poll creation response:', response);

            if (response.error) {
                setError(response.error);
                hapticFeedback.notificationOccurred('error');
            } else if (response._id) {
                hapticFeedback.notificationOccurred('success');
                onSuccess && onSuccess(response._id);
            }
        } catch (err: any) {
            console.error('📊 Poll creation error:', err);
            const errorMessage = err.response?.data?.message || err.message || t('errorCreating');
            setError(errorMessage);
            hapticFeedback.notificationOccurred('error');
        } finally {
            setIsCreating(false);
            if (isInTelegram && isMountedRef.current) {
                try {
                    mainButton.setParams({ isLoaderVisible: false });
                } catch (error: any) {
                    console.warn('MainButton already unmounted:', error.message);
                }
            }
        }
    }, [title, description, options, timeValue, timeUnit, selectedWallet, isInTelegram, t, onSuccess]);

    // Telegram MainButton integration
    useEffect(() => {
        if (isInTelegram && isMountedRef.current) {
            let cleanup: (() => void) | undefined;
            
            const initializeMainButton = () => {
                if (!isMountedRef.current) return;
                
                try {
                    // Try to mount the mainButton first
                    mainButton.mount();
                } catch (error: any) {
                    // MainButton might already be mounted, that's okay
                    console.warn('MainButton mount warning (expected if already mounted):', error.message);
                }
                
                try {
                    // Set the mainButton parameters
                    mainButton.setParams({ 
                        text: t('createPoll'),
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
                                    } catch (error: any) {
                                        console.warn('MainButton cleanup warning:', error.message);
                                    }
                                }
                                if (cleanup) cleanup();
                                backButton.hide();
                                backCleanup();
                            };
                        } catch (error: any) {
                            console.error('Failed to setup back button:', error.message);
                        }
                    }
                    
                    return () => {
                        if (isMountedRef.current) {
                            try {
                                mainButton.setParams({ isVisible: false });
                            } catch (error: any) {
                                console.warn('MainButton cleanup warning:', error.message);
                            }
                        }
                        if (cleanup) cleanup();
                    };
                    
                } catch (error: any) {
                    console.error('Failed to initialize mainButton:', error.message);
                    // If mainButton fails, we'll just return a no-op cleanup
                    return () => {};
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
        <div className="card bg-base-100 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="card-body">
                <h2 className="card-title text-2xl mb-4">{t('createTitle')}</h2>

                {/* Poll Title Section */}
                <div className="card bg-base-100 shadow-md mb-4">
                    <div className="card-body">
                        <h3 className="card-title text-lg">{t('pollTitle')}</h3>
                        <div className="form-control">
                            <label className="label" htmlFor="poll-title">
                                <span className="label-text">{t('pollTitleLabel')}</span>
                            </label>
                            <input
                                id="poll-title"
                                type="text"
                                className="input input-bordered w-full"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={t('pollTitlePlaceholder')}
                                disabled={isCreating}
                            />
                        </div>
                    </div>
                </div>

                {/* Description Section */}
                <div className="card bg-base-100 shadow-md mb-4">
                    <div className="card-body">
                        <h3 className="card-title text-lg">{t('description')}</h3>
                        <div className="form-control">
                            <label className="label" htmlFor="poll-description">
                                <span className="label-text">{t('descriptionLabel')}</span>
                            </label>
                            <textarea
                                id="poll-description"
                                className="textarea textarea-bordered w-full"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('descriptionPlaceholder')}
                                disabled={isCreating}
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                {/* Poll Options Section */}
                <div className="card bg-base-100 shadow-md mb-4">
                    <div className="card-body">
                        <h3 className="card-title text-lg">{t('options')}</h3>
                        <div className="space-y-3">
                            {options.map((option, index) => (
                                <div key={`option-${option.id}`} className="border border-base-300 rounded-lg p-3 bg-base-100">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium w-6">{index + 1}.</span>
                                        <input
                                            type="text"
                                            className="input input-bordered flex-1"
                                            value={option.text}
                                            onChange={(e) => updateOption(option.id, e.target.value)}
                                            placeholder={t('optionPlaceholder', { number: index + 1 })}
                                            disabled={isCreating}
                                        />
                                        {options.length > 2 && (
                                            <button
                                                type="button"
                                                className="btn btn-error btn-sm"
                                                onClick={() => removeOption(option.id)}
                                                disabled={isCreating}
                                            >
                                                {t('removeOption')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            {options.length < 10 && (
                                <button
                                    type="button"
                                    className="btn btn-outline btn-primary"
                                    onClick={addOption}
                                    disabled={isCreating}
                                >
                                    {t('addOption')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Community Selection Section */}
                {!communityId && (
                    <div className="card bg-base-100 shadow-md mb-4">
                        <div className="card-body">
                            <h3 className="card-title text-lg">{t('community')}</h3>
                            <div className="form-control">
                                <label className="label" htmlFor="poll-community">
                                    <span className="label-text">{t('selectCommunity')}</span>
                                </label>
                                <select
                                    id="poll-community"
                                    className="select select-bordered w-full"
                                    value={selectedWallet}
                                    onChange={(e) => setSelectedWallet(e.target.value)}
                                    disabled={isCreating}
                                >
                                    <option value="">{t('selectCommunityPlaceholder')}</option>
                                    {wallets.map((wallet) => (
                                        <option
                                            key={wallet._id}
                                            value={wallet.meta?.currencyOfCommunityTgChatId}
                                        >
                                            {wallet.name || wallet.meta?.currencyNames?.many || t('communityFallback')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Duration Section */}
                <div className="card bg-base-100 shadow-md mb-4">
                    <div className="card-body">
                        <h3 className="card-title text-lg">{t('duration')}</h3>
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">{t('durationLabel')}</span>
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    className="input input-bordered w-24"
                                    value={timeValue}
                                    onChange={(e) => setTimeValue(parseInt(e.target.value) || 1)}
                                    disabled={isCreating}
                                />
                                <select
                                    className="select select-bordered flex-1"
                                    value={timeUnit}
                                    onChange={(e) =>
                                        setTimeUnit(e.target.value as "minutes" | "hours" | "days")
                                    }
                                    disabled={isCreating}
                                >
                                    <option value="minutes">{t('minutes')}</option>
                                    <option value="hours">{t('hours')}</option>
                                    <option value="days">{t('days')}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="alert alert-error mb-4">
                        {error}
                    </div>
                )}

                {/* Action Buttons - Hidden in Telegram (uses MainButton) */}
                {!isInTelegram && (
                    <div className="card bg-base-100 shadow-md">
                        <div className="card-body">
                            <div className="flex gap-4">
                                {onCancel && (
                                    <button 
                                        className="btn btn-ghost" 
                                        onClick={onCancel} 
                                        disabled={isCreating}
                                    >
                                        {t('cancel')}
                                    </button>
                                )}
                                <button
                                    className="btn btn-primary flex-1"
                                    onClick={handleCreate}
                                    disabled={isCreating}
                                >
                                    {isCreating ? (
                                        <>
                                            <span className="loading loading-spinner loading-sm"></span>
                                            {t('creating')}
                                        </>
                                    ) : (
                                        t('createPoll')
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


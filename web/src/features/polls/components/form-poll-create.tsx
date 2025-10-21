'use client';

import { useState } from "react";
import { apiPOST } from "@shared/lib/fetch";
import { A } from "@shared/components/simple/simple-elements";
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation('polls');
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

    const handleCreate = async () => {
        if (!validate()) return;

        setIsCreating(true);
        setError("");

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
            } else if (response._id) {
                onSuccess && onSuccess(response._id);
            }
        } catch (err) {
            console.error('📊 Poll creation error:', err);
            const errorMessage = err.response?.data?.message || err.message || t('errorCreating');
            setError(errorMessage);
        } finally {
            setIsCreating(false);
        }
    };

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

                {/* Action Buttons */}
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
            </div>
        </div>
    );
};


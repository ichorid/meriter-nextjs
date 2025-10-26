'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useEffect, useState } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity, useUpdateCommunity } from '@/hooks/api';
import { communitiesApiV1 } from '@/lib/api/v1';
import type { Community } from '@/types/api-v1';
import { etv } from '@shared/lib/input-utils';
import { nanoid } from "nanoid";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { initDataRaw, useSignal, backButton } from '@telegram-apps/sdk-react';

import { DivFade } from '@shared/components/transitions';
import Page from '@shared/components/page';
import { Spinner } from '@shared/components/misc';
import { IconPicker } from '@shared/components/iconpicker';
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import { CardWithAvatar } from '@shared/components/card-with-avatar';
import { CommunityAvatar } from '@shared/components/community-avatar';
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';

const CommunitySettingsPage = () => {
    const router = useRouter();
    const params = useParams();
    const chatId = params.id as string;
    const t = useTranslations('pages');
    
    // Telegram SDK integration
    const rawData = useSignal(initDataRaw);
    const isInTelegram = !!rawData;

    // Form state
    const [formData, setFormData] = useState({
        currencyNames: { 1: '', 2: '', 5: '' },
        icon: '',
        spaces: [] as any[]
    });
    const [isDirty, setIsDirty] = useState(false);
    const [touched, setTouched] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');

    // Load user data using v1 API
    const { user } = useAuth();
    const [communityData, setCommunityData] = useState<Community | null>(null);
    const [communityLoading, setCommunityLoading] = useState(true);
    const [communityError, setCommunityError] = useState('');

    // Redirect if not authenticated
    useEffect(() => {
        if (user === null) {
            router.push(`/meriter/login?returnTo=/meriter/communities/${chatId}/settings`);
        }
    }, [user, router, chatId]);

    // Telegram BackButton integration
    useEffect(() => {
        if (isInTelegram) {
            const handleBack = () => {
                router.push(`/meriter/communities/${chatId}`);
            };
            
            backButton.show();
            const cleanup = backButton.onClick(handleBack);
            
            return () => {
                backButton.hide();
                cleanup();
            };
        }
        return undefined;
    }, [isInTelegram, router, chatId]);

    // Load community data using v1 API
    const { data: communityResponse, isLoading: communityIsLoading, error: communityErr } = useCommunity(chatId);
    
    useEffect(() => {
        if (communityResponse) {
            setCommunityData(communityResponse);
            
            // Map API format to form format
            // API has: settings.currencyNames { singular, plural, genitive }
            // Form uses: { 1: 'singular', 2: 'dual/genitive', 5: 'plural' }
            const currencyNames = communityResponse.settings?.currencyNames || {};
            const formCurrencyNames = {
                1: currencyNames.singular || '',
                2: currencyNames.genitive || currencyNames.plural || '',
                5: currencyNames.plural || '',
            };
            
            // Map hashtags to spaces format
            const spaces = (communityResponse.hashtags || []).map((tag: string) => ({
                slug: nanoid(8),
                tagRus: tag,
                description: ''
            }));
            
            setFormData({
                currencyNames: formCurrencyNames,
                icon: communityResponse.settings?.iconUrl || communityResponse.avatarUrl || '',
                spaces: spaces
            });
            setCommunityError('');
        }
        if (communityErr) {
            setCommunityError(t('communitySettings.failedToLoad'));
        }
        setCommunityLoading(false);
    }, [communityResponse, communityErr, t]);

    // Validation logic
    const validateForm = (): Record<string, string> => {
        const errors: Record<string, string> = {};
        if (!formData.currencyNames[1]?.trim()) {
            errors.currencyName = t('communitySettings.validation.currencyNameRequired');
        }
        if (!formData.icon) {
            errors.icon = t('communitySettings.validation.iconRequired');
        }
        const validHashtags = formData.spaces.filter((s: any) => s.tagRus?.trim() && !s.deleted);
        if (validHashtags.length === 0) {
            errors.hashtags = t('communitySettings.validation.hashtagsRequired');
        }
        return errors;
    };

    const isValid = Object.keys(validateForm()).length === 0;

    // Form handlers
    const setCurrencyName = (form: number) => (value: string) => {
        setFormData(prev => ({
            ...prev,
            currencyNames: { ...prev.currencyNames, [form]: value }
        }));
        setIsDirty(true);
    };

    const setIcon = (iconUrl: string) => {
        setFormData(prev => ({ ...prev, icon: iconUrl }));
        setIsDirty(true);
    };

    const setVal = (idx: number, key: string) => (val: any) => {
        let spacesNew = [...formData.spaces] as any[];
        spacesNew[idx] = { ...spacesNew[idx], [key]: val };
        setFormData(prev => ({ ...prev, spaces: spacesNew }));
        setIsDirty(true);
    };

    const addHashtag = () => {
        const newSpace = { slug: nanoid(8), tagRus: '', description: '' };
        setFormData(prev => ({ ...prev, spaces: [...prev.spaces, newSpace] }));
        setIsDirty(true);
    };

    const deleteHashtag = (idx: number) => {
        let spacesNew = [...formData.spaces];
        spacesNew[idx].deleted = true;
        setFormData(prev => ({ ...prev, spaces: spacesNew }));
        setIsDirty(true);
    };

    // Save handler using v1 API
    const updateCommunityMutation = useUpdateCommunity();
    
    const handleSave = async () => {
        setTouched(true);
        if (!isValid) return;

        // Map currency names from form format to API format
        // Form uses: { 1: 'singular', 2: 'dual', 5: 'plural' }
        // API expects: { singular: 'text', plural: 'text', genitive: 'text' }
        const currencyNames = {
            singular: formData.currencyNames[1] || '',
            plural: formData.currencyNames[5] || '',
            genitive: formData.currencyNames[2] || formData.currencyNames[5] || '', // Use plural as fallback for genitive
        };

        const saveData = {
            name: communityResponse?.name,
            description: communityResponse?.description,
            settings: {
                iconUrl: formData.icon,
                currencyNames: currencyNames,
            },
            hashtags: formData.spaces.filter((d: any) => d.tagRus && !d.deleted).map((d: any) => d.tagRus),
        };

        setSaving(true);
        setSaveError('');

        try {
            await updateCommunityMutation.mutateAsync({ id: chatId, data: saveData });

            setIsDirty(false);
            setSaveSuccess(t('communitySettings.settingsSaved'));
            setTimeout(() => {
                setSaveSuccess('');
                router.push(`/meriter/communities/${chatId}?saved=1`);
            }, 1500);
        } catch (error: unknown) {
            // Log error details properly
            if (error instanceof Error) {
                console.error('Save failed:', error.message, error);
            } else if (error && typeof error === 'object') {
                const errorDetails = {
                    message: (error as any).message || 'Unknown error',
                    code: (error as any).code,
                    details: (error as any).details
                };
                console.error('Save failed:', JSON.stringify(errorDetails, null, 2));
                const message = (error as any).message || 'Failed to save settings';
                setSaveError(message);
            } else {
                console.error('Save failed:', String(error));
                setSaveError('Failed to save settings');
            }
        } finally {
            setSaving(false);
        }
    };

    // Unsaved changes protection
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Note: Route change protection is not available in Next.js App Router
    // The beforeunload event will still protect against browser close/refresh

    // Loading state
    if (communityLoading) {
        return (
            <Page>
                <div className="flex justify-center items-center min-h-[400px]">
                    <Spinner />
                </div>
            </Page>
        );
    }

    // Error state
    if (communityError) {
        return (
            <Page>
                <div className="text-center py-8">
                    <h2 className="text-xl font-semibold mb-4">{t('communitySettings.error')}</h2>
                    <p className="text-base-content/70 mb-4">{communityError}</p>
                    <Link href="/meriter/home" className="btn btn-primary">
                        {t('communitySettings.backToCommunities')}
                    </Link>
                </div>
            </Page>
        );
    }

    // Not authenticated
    if (!user?.telegramId) {
        return null;
    }

    const currentErrors = validateForm();

    return (
        <Page>
            <HeaderAvatarBalance
                balance1={undefined}
                balance2={undefined}
                avatarUrl={telegramGetAvatarLink(user?.telegramId || '')}
                onAvatarUrlNotFound={() =>
                    telegramGetAvatarLinkUpd(user?.telegramId || '')
                }
                onClick={() => {
                    router.push("/meriter/home");
                }}
                userName={user?.displayName || 'User'}
            >
                <MenuBreadcrumbs>
                    <div>
                        <div className="breadcrumbs text-sm">
                            <ul>
                                <li><Link href="/meriter/home">Home</Link></li>
                                <li><Link href={`/meriter/communities/${chatId}/settings`}>{communityData?.name || 'Community'}</Link></li>
                                <li>{t('communitySettings.breadcrumb')}</li>
                            </ul>
                        </div>
                    </div>
                </MenuBreadcrumbs>
                <div>
                    {t('communitySettings.subtitle', { communityName: communityData?.name || 'this community' })}
                </div>
            </HeaderAvatarBalance>

            {/* Community Profile Section */}
            {communityData && (
                <div className="card bg-base-100 shadow-xl mb-6">
                    <div className="card-body">
                        <h2 className="card-title">{t('communitySettings.communityProfile')}</h2>
                        <div className="flex items-center gap-4">
                            <CommunityAvatar
                                avatarUrl={communityData?.avatarUrl}
                                communityName={communityData?.name || 'Community'}
                                size={80}
                            />
                            <div>
                                <div className="text-xl font-semibold">{communityData?.name}</div>
                                <div className="text-sm opacity-60">
                                    {communityData?.description || t('communitySettings.noDescription')}
                                </div>
                                <div className="text-xs opacity-50 mt-1">
                                    {t('communitySettings.avatarUpdateNote')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Currency Names Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">{t('communitySettings.currencyNames')}</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="label">
                                <span className="label-text">{t('communitySettings.singularForm')}</span>
                            </label>
                            <input
                                className={`input input-bordered w-full ${touched && currentErrors.currencyName ? 'input-error' : ''}`}
                                placeholder={t('communitySettings.singularPlaceholder')}
                                value={formData.currencyNames[1]}
                                onChange={(e) => setCurrencyName(1)(e.target.value)}
                                onBlur={() => setTouched(true)}
                            />
                            {touched && currentErrors.currencyName && (
                                <div className="text-error text-sm mt-1">{currentErrors.currencyName}</div>
                            )}
                        </div>
                        
                        <div>
                            <label className="label">
                                <span className="label-text">{t('communitySettings.dualForm')}</span>
                            </label>
                            <input
                                className="input input-bordered w-full"
                                placeholder={t('communitySettings.dualPlaceholder')}
                                value={formData.currencyNames[2]}
                                onChange={(e) => setCurrencyName(2)(e.target.value)}
                                onBlur={() => setTouched(true)}
                            />
                        </div>
                        
                        <div>
                            <label className="label">
                                <span className="label-text">{t('communitySettings.pluralForm')}</span>
                            </label>
                            <input
                                className="input input-bordered w-full"
                                placeholder={t('communitySettings.pluralPlaceholder')}
                                value={formData.currencyNames[5]}
                                onChange={(e) => setCurrencyName(5)(e.target.value)}
                                onBlur={() => setTouched(true)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Currency Icon Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">{t('communitySettings.currencyIcon')}</h2>
                    <div className={`${touched && currentErrors.icon ? 'border border-error rounded-lg p-4' : ''}`}>
                        <IconPicker
                            icon={formData.icon}
                            cta={t('communitySettings.selectIcon')}
                            setIcon={setIcon}
                        />
                        {touched && currentErrors.icon && (
                            <div className="text-error text-sm mt-2">{currentErrors.icon}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Community Values Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">{t('communitySettings.communityValues')}</h2>
                    <div className="space-y-4">
                        {formData.spaces.map((space, i) => {
                            if (space.deleted) return null;
                            
                            return (
                                <div key={i} className="border border-base-300 rounded-lg p-4 bg-base-100 space-y-3">
                                    <div className="text-sm font-medium text-base-content/70 uppercase">
                                        {t('communitySettings.hashtagForTracking')}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1">
                                            <span className="text-lg font-bold text-primary">#</span>
                                            <input
                                                className="input input-bordered flex-1"
                                                placeholder={t('communitySettings.hashtagPlaceholder')}
                                                value={space.tagRus || ''}
                                                onChange={(e) => setVal(i, 'tagRus')(e.target.value)}
                                                onBlur={() => setTouched(true)}
                                            />
                                        </div>
                                        <div className="text-xs text-base-content/50 pl-2">
                                            {t('communitySettings.hashtagDescription')}
                                        </div>
                                    </div>
                                    <div>
                                        <textarea
                                            className="textarea textarea-bordered w-full"
                                            placeholder={t('communitySettings.descriptionPlaceholder')}
                                            rows={3}
                                            value={space.description || ''}
                                            onChange={(e) => setVal(i, 'description')(e.target.value)}
                                            onBlur={() => setTouched(true)}
                                        />
                                    </div>
                                    <button
                                        className="btn btn-error btn-sm"
                                        onClick={() => deleteHashtag(i)}
                                    >
                                        {t('communitySettings.delete')}
                                    </button>
                                </div>
                            );
                        })}
                        
                        <button
                            className="btn btn-outline btn-primary"
                            onClick={addHashtag}
                        >
                            {t('communitySettings.addValue')}
                        </button>
                        
                        {touched && currentErrors.hashtags && (
                            <div className="text-error text-sm">{currentErrors.hashtags}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Save Section */}
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    {touched && !isValid && (
                        <div className="alert alert-warning mb-4">
                            <ul>
                        {Object.values(currentErrors).map((err, i) => (
                            <li key={i}>{err as string}</li>
                        ))}
                            </ul>
                        </div>
                    )}
                    
                    {saveError && (
                        <div className="alert alert-error mb-4">
                            {saveError}
                        </div>
                    )}
                    
                    {saveSuccess && (
                        <div className="alert alert-success mb-4">
                            {saveSuccess}
                        </div>
                    )}
                    
                    <div className="flex gap-4">
                        {!isInTelegram && (
                            <Link href={`/meriter/communities/${chatId}`} className="btn btn-ghost">
                                {t('communitySettings.cancel')}
                            </Link>
                        )}
                        <button
                            className="btn btn-primary flex-1"
                            disabled={!isValid || saving}
                            onClick={handleSave}
                            aria-label={!isValid ? 'Fill in all required fields to save' : 'Save settings'}
                        >
                            {saving ? (
                                <>
                                    <span className="loading loading-spinner loading-sm"></span>
                                    {t('communitySettings.saving')}
                                </>
                            ) : (
                                t('communitySettings.saveSettings')
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Page>
    );
};

export default CommunitySettingsPage;

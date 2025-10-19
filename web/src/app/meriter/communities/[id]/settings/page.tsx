'use client';

import { swr } from '@lib/swr';
import { useEffect, useState } from "react";
import Axios from "axios";
import { etv } from '@shared/lib/input-utils';
import { nanoid } from "nanoid";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { DivFade } from '@shared/components/transitions';
import Page from '@shared/components/page';
import { Spinner } from '@shared/components/misc';
import { IconPicker } from '@shared/components/iconpicker';
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import { CardWithAvatar } from '@shared/components/card-with-avatar';
import { CommunityAvatarWithBadge } from '@shared/components/community-avatar-with-badge';
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';
import { ThemeToggle } from "@shared/components/theme-toggle";

const CommunitySettingsPage = () => {
    const router = useRouter();
    const params = useParams();
    const chatId = params.id as string;

    // Form state
    const [formData, setFormData] = useState({
        currencyNames: { 1: '', 2: '', 5: '' },
        icon: '',
        spaces: []
    });
    const [isDirty, setIsDirty] = useState(false);
    const [touched, setTouched] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');

    // Load user and community data
    const [user] = swr("/api/rest/getme", { init: true });
    const [communityData, setCommunityData] = useState(null);
    const [communityLoading, setCommunityLoading] = useState(true);
    const [communityError, setCommunityError] = useState('');

    // Redirect if not authenticated
    useEffect(() => {
        if (!user.tgUserId && !user.init) {
            router.push("/meriter/login?returnTo=/meriter/manage");
        }
    }, [user, router]);

    // Load community data
    useEffect(() => {
        if (!chatId || !user.tgUserId) return;

        setCommunityLoading(true);
        Axios.get(`/api/rest/communityinfo?chatId=${chatId}`)
            .then((response) => {
                const data = response.data;
                setCommunityData(data);
                
                // Populate form with existing data
                setFormData({
                    currencyNames: data.currencyNames || { 1: '', 2: '', 5: '' },
                    icon: data.icon || '',
                    spaces: data.spaces || []
                });
                
                setCommunityError('');
            })
            .catch((error) => {
                console.error('Failed to load community data:', error);
                setCommunityError(error.response?.status === 404 ? 'Community not found' : 'Failed to load community data');
            })
            .finally(() => {
                setCommunityLoading(false);
            });
    }, [chatId, user.tgUserId]);

    // Validation logic
    const validateForm = (): Record<string, string> => {
        const errors: Record<string, string> = {};
        if (!formData.currencyNames[1]?.trim()) {
            errors.currencyName = 'Currency name (singular) is required';
        }
        if (!formData.icon) {
            errors.icon = 'Currency icon is required';
        }
        const validHashtags = formData.spaces.filter(s => s.tagRus?.trim() && !s.deleted);
        if (validHashtags.length === 0) {
            errors.hashtags = 'At least one hashtag is required';
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
        let spacesNew = [...formData.spaces];
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

    // Save handler
    const handleSave = async () => {
        setTouched(true);
        if (!isValid) return;

        const saveData = {
            spaces: formData.spaces.filter((d) => d.tagRus && !d.deleted),
            icon: formData.icon,
            currencyNames: formData.currencyNames,
        };

        setSaving(true);
        setSaveError('');

        try {
            await Axios.post(`/api/rest/communityinfo?chatId=${chatId}`, saveData);

            setIsDirty(false);
            setSaveSuccess('Settings saved successfully!');
            setTimeout(() => {
                setSaveSuccess('');
                router.push('/meriter/manage?success=saved');
            }, 1500);
        } catch (error) {
            console.error('Save failed:', error);
            setSaveError(error.response?.data?.message || 'Failed to save settings');
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
                    <h2 className="text-xl font-semibold mb-4">Error</h2>
                    <p className="text-base-content/70 mb-4">{communityError}</p>
                    <Link href="/meriter/manage" className="btn btn-primary">
                        Back to Communities
                    </Link>
                </div>
            </Page>
        );
    }

    // Not authenticated
    if (!user.tgUserId) {
        return null;
    }

    const currentErrors = validateForm();

    return (
        <Page>
            <div className="flex justify-end mb-2">
                <ThemeToggle />
            </div>
            <HeaderAvatarBalance
                balance1={undefined}
                balance2={undefined}
                avatarUrl={telegramGetAvatarLink(user?.tgUserId)}
                onAvatarUrlNotFound={() =>
                    telegramGetAvatarLinkUpd(user?.tgUserId)
                }
                onClick={() => {
                    router.push("/meriter/home");
                }}
                userName={user?.name || 'User'}
            >
                <MenuBreadcrumbs>
                    <div>
                        <div className="breadcrumbs text-sm">
                            <ul>
                                <li><Link href="/meriter/manage">Communities</Link></li>
                                <li><Link href={`/meriter/${chatId}/settings`}>{communityData?.chat?.title || 'Community'}</Link></li>
                                <li>Settings</li>
                            </ul>
                        </div>
                    </div>
                </MenuBreadcrumbs>
                <div>
                    Manage settings for {communityData?.chat?.title || 'this community'}
                </div>
            </HeaderAvatarBalance>

            {/* Community Profile Section */}
            {communityData?.chat && (
                <div className="card bg-base-100 shadow-xl mb-6">
                    <div className="card-body">
                        <h2 className="card-title">Community Profile</h2>
                        <div className="flex items-center gap-4">
                            <CommunityAvatarWithBadge
                                avatarUrl={communityData.chat.photo}
                                communityName={communityData.chat.title || 'Community'}
                                iconUrl={communityData.icon}
                                size={80}
                            />
                            <div>
                                <div className="text-xl font-semibold">{communityData.chat.title}</div>
                                <div className="text-sm opacity-60">
                                    {communityData.chat.description || 'No description'}
                                </div>
                                <div className="text-xs opacity-50 mt-1">
                                    Avatar updates automatically when you save settings
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Currency Names Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">Currency Names</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="label">
                                <span className="label-text">Singular form (required)</span>
                            </label>
                            <input
                                className={`input input-bordered w-full ${touched && currentErrors.currencyName ? 'input-error' : ''}`}
                                placeholder="e.g., merit"
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
                                <span className="label-text">Dual form (optional)</span>
                            </label>
                            <input
                                className="input input-bordered w-full"
                                placeholder="e.g., merits"
                                value={formData.currencyNames[2]}
                                onChange={(e) => setCurrencyName(2)(e.target.value)}
                                onBlur={() => setTouched(true)}
                            />
                        </div>
                        
                        <div>
                            <label className="label">
                                <span className="label-text">Plural form (optional)</span>
                            </label>
                            <input
                                className="input input-bordered w-full"
                                placeholder="e.g., merits"
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
                    <h2 className="card-title">Currency Icon</h2>
                    <div className={`${touched && currentErrors.icon ? 'border border-error rounded-lg p-4' : ''}`}>
                        <IconPicker
                            icon={formData.icon}
                            cta="Select a currency icon"
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
                    <h2 className="card-title">Community Values (Hashtags)</h2>
                    <div className="space-y-4">
                        {formData.spaces.map((space, i) => {
                            if (space.deleted) return null;
                            
                            return (
                                <div key={i} className="border border-base-300 rounded-lg p-4 bg-base-100 space-y-3">
                                    <div className="text-sm font-medium text-base-content/70 uppercase">
                                        Hashtag for tracking in chat
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1">
                                            <span className="text-lg font-bold text-primary">#</span>
                                            <input
                                                className="input input-bordered flex-1"
                                                placeholder="Enter hashtag name"
                                                value={space.tagRus || ''}
                                                onChange={(e) => setVal(i, 'tagRus')(e.target.value)}
                                                onBlur={() => setTouched(true)}
                                            />
                                        </div>
                                        <div className="text-xs text-base-content/50 pl-2">
                                            Any message with this hashtag in the community chat will automatically appear on the site
                                        </div>
                                    </div>
                                    <div>
                                        <textarea
                                            className="textarea textarea-bordered w-full"
                                            placeholder="Description of this value"
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
                                        Delete
                                    </button>
                                </div>
                            );
                        })}
                        
                        <button
                            className="btn btn-outline btn-primary"
                            onClick={addHashtag}
                        >
                            + Add Value
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
                        <Link href="/meriter/manage" className="btn btn-ghost">
                            Cancel
                        </Link>
                        <button
                            className="btn btn-primary flex-1"
                            disabled={!isValid || saving}
                            onClick={handleSave}
                            aria-label={!isValid ? 'Fill in all required fields to save' : 'Save settings'}
                        >
                            {saving ? (
                                <>
                                    <span className="loading loading-spinner loading-sm"></span>
                                    Saving...
                                </>
                            ) : (
                                'Save Settings'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Page>
    );
};

export default CommunitySettingsPage;

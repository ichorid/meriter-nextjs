'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CommunityAvatar } from "@shared/components/community-avatar";
import { useCommunity } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';

interface WalletCommunityProps {
    amount: number;
    currencyNames: string[];
    currencyOfCommunityTgChatId: string;
    tgUserId: string;
    isAdmin?: boolean;
    needsSetup?: boolean;
}

export const WalletCommunity: React.FC<WalletCommunityProps> = ({
    amount,
    currencyNames,
    currencyOfCommunityTgChatId,
    tgUserId,
    isAdmin,
    needsSetup: needsSetupProp,
}) => {
    const router = useRouter();
    const [showTooltip, setShowTooltip] = useState(false);
    
    // Use v1 API hooks
    const { data: info } = useCommunity(currencyOfCommunityTgChatId);
    const { user } = useAuth();

    const title = info?.name;
    const chatPhoto = info?.avatarUrl; // Community's Telegram avatar
    const icon = info?.settings?.iconUrl; // Currency icon from settings
    const tags = info?.hashtags;
    
    // Derive needsSetup from community data (API-provided needsSetup field)
    const needsSetup = needsSetupProp !== undefined ? needsSetupProp : (info?.needsSetup === true);
    
    // Use API-provided isAdmin field, or fall back to passed prop
    const userIsAdmin = info?.isAdmin !== undefined ? info.isAdmin : (isAdmin ?? false);
    
    const handleClick = (e: React.MouseEvent) => {
        if (needsSetup) {
            if (userIsAdmin) {
                // Admin: redirect to settings
                router.push(`/meriter/communities/${info?.telegramChatId || currencyOfCommunityTgChatId}/settings`);
            } else {
                // Non-admin: show tooltip, don't navigate
                e.stopPropagation();
                setShowTooltip(true);
                setTimeout(() => setShowTooltip(false), 3000);
            }
        } else {
            // Normal navigation to community page
            router.push(`/meriter/communities/${info?.telegramChatId || currencyOfCommunityTgChatId}`);
        }
    };
    
    if (!title) return null;
    
    return (
        <div className="relative">
            {showTooltip && (
                <div className="absolute top-0 left-0 right-0 bg-warning text-warning-content p-3 rounded-t-lg z-10">
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span>Community is unconfigured</span>
                    </div>
                </div>
            )}
            <div 
                className="card bg-base-100 shadow-md rounded-2xl mb-5 p-5 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={handleClick}
            >
            {/* Setup banners */}
            {needsSetup && userIsAdmin && (
                <div className="alert alert-warning mb-3">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>This community is unconfigured. Click to configure</span>
                </div>
            )}
            {needsSetup && !userIsAdmin && (
                <div className="alert alert-info mb-3">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>This community is unconfigured. Community admin will configure it soon</span>
                </div>
            )}
            
            <div className="flex items-start gap-4">
                <CommunityAvatar
                    avatarUrl={chatPhoto}
                    communityName={title}
                    size={48}
                />
                <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="title font-medium">{title}</div>
                        <div className="flex items-center gap-2">
                            {icon && <img className="w-5 h-5" src={icon} alt="Currency" />}
                            <span className="text-lg font-semibold">{amount}</span>
                        </div>
                    </div>
                    <div className="description text-sm opacity-60 mt-2">
                        {tags && tags.map((t: string) => "#" + t).join(" ")}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

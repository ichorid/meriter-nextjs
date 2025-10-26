'use client';

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
    needsSetup,
}) => {
    // Use v1 API hooks
    const { data: info } = useCommunity(currencyOfCommunityTgChatId);
    const { user } = useAuth();

    const title = info?.name;
    const chatPhoto = info?.avatarUrl; // Community's Telegram avatar
    const icon = info?.avatarUrl; // Currency icon
    const tags = info?.hashtags;
    const administratorsIds: string[] = []; // TODO: Add admin support to Community type
    
    // Use passed isAdmin prop if available, otherwise fall back to checking administratorsIds
    const userIsAdmin = isAdmin !== undefined ? isAdmin : (user?.id && administratorsIds.includes(user.id));
    
    if (!title) return null;
    
    return (
        <div 
            className="card bg-base-100 shadow-md rounded-2xl mb-5 p-5 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => (document.location.href = "/meriter/communities/" + info?.id || currencyOfCommunityTgChatId)}
        >
            {/* Setup banners */}
            {needsSetup && userIsAdmin && (
                <div className="alert alert-warning mb-3">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Requires setup</span>
                </div>
            )}
            {needsSetup && !userIsAdmin && (
                <div className="alert alert-info mb-3">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>Pending setup by admin</span>
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
                        <div className="flex items-center gap-2">
                            <div className="title font-medium">{title}</div>
                            {userIsAdmin && (
                                <div 
                                    className="tooltip tooltip-bottom" 
                                    data-tip="You are an administrator"
                                >
                                    <svg 
                                        className="w-4 h-4 text-primary" 
                                        fill="currentColor" 
                                        viewBox="0 0 20 20"
                                    >
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {icon && <img className="w-5 h-5" src={icon} alt="Currency" />}
                            <span className="text-lg font-semibold">{amount}</span>
                            {userIsAdmin && (
                                <button 
                                    className="btn btn-ghost btn-sm btn-circle"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        document.location.href = "/meriter/communities/" + (info?.id || currencyOfCommunityTgChatId) + "/settings";
                                    }}
                                    title="Settings"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="description text-sm opacity-60 mt-2">
                        {tags && tags.map((t: string) => "#" + t).join(" ")}
                    </div>
                </div>
            </div>
        </div>
    );
};

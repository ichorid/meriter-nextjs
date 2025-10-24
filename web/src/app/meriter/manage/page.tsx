'use client';

import { useEffect, useState } from "react";

import Page from '@shared/components/page';
import { Spinner } from '@shared/components/misc';
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import { useRouter, useSearchParams } from "next/navigation";
import { CommunityAvatar } from '@shared/components/community-avatar';
import Link from "next/link";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';
import { useAuth } from '@/contexts/AuthContext';

const CommunityCard = ({ chatId, title, description, tags, avatarUrl, icon }: any) => {
    return (
        <Link href={`/meriter/communities/${chatId}/settings`} className="block">
            <div className="card bg-base-100 shadow-md rounded-2xl mb-5 p-5 cursor-pointer hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                    <CommunityAvatar
                        avatarUrl={avatarUrl}
                        communityName={title || 'Community'}
                        size={56}
                    />
                    <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="text-lg font-semibold mb-1">{title}</div>
                            {icon && (
                                <div className="flex items-center gap-2">
                                    <img className="w-5 h-5" src={icon} alt="Currency" />
                                </div>
                            )}
                        </div>
                        <div className="text-sm text-base-content/70 mb-2">{description}</div>
                        {tags && tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {tags.map((tag: string, i: number) => (
                                    <span key={i} className="badge badge-primary badge-sm">#{tag}</span>
                                ))}
                            </div>
                        )}
                        <div className="text-xs text-base-content/50 mt-2">
                            Click to view settings
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
};

const ManagePage = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [successMessage, setSuccessMessage] = useState('');
    
    // Use centralized auth context
    const { user, isLoading, isAuthenticated } = useAuth();
    
    // State for chats data
    const [chats, setChats] = useState<any[]>([]);
    const [chatsLoading, setChatsLoading] = useState(true);
    
    // Extract query parameters using Next.js hook
    const refreshChatId = searchParams.get('refreshChatId') || undefined;
    const showSuccess = searchParams.get('success') === 'saved';
    
    useEffect(() => {
        if (showSuccess) {
            setSuccessMessage('Settings saved successfully!');
            setTimeout(() => setSuccessMessage(''), 5000);
        }
    }, [showSuccess]);
    
    // Fetch chats data
    useEffect(() => {
        if (isAuthenticated && user) {
            const fetchChats = async () => {
                try {
                    setChatsLoading(true);
                    const url = refreshChatId
                        ? `/api/rest/getmanagedchats?refreshChatId=${refreshChatId}`
                        : '/api/rest/getmanagedchats';
                    
                    const response = await fetch(url, {
                        credentials: 'include',
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        setChats(data || []);
                    } else {
                        console.error('Failed to fetch chats');
                        setChats([]);
                    }
                } catch (error) {
                    console.error('Error fetching chats:', error);
                    setChats([]);
                } finally {
                    setChatsLoading(false);
                }
            };
            
            fetchChats();
        }
    }, [isAuthenticated, user, refreshChatId]);
    
    // Redirect if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push("/meriter/login?returnTo=/meriter/manage");
        }
    }, [isAuthenticated, isLoading, router]);

    // Show loading state while checking authentication or fetching chats
    if (isLoading || chatsLoading) {
        return (
            <Page className="manage">
                <div className="flex justify-center items-center min-h-[400px]">
                    <div className="loading loading-spinner loading-lg"></div>
                </div>
            </Page>
        );
    }

    // Don't render if not authenticated (will redirect)
    if (!isAuthenticated || !user) {
        return null;
    }
    
    return (
        <Page>
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
                    <div>Communities</div>
                </MenuBreadcrumbs>
                <div>
                    View and manage settings for communities where you are an administrator and the bot is connected
                </div>
            </HeaderAvatarBalance>
            
            {successMessage && (
                <div className="alert alert-success mb-4">
                    {successMessage}
                </div>
            )}
            
            <div className="mar-40"></div>
            
            {chats?.length === 0 ? (
                <div className="text-center py-8">
                    <h2 className="text-xl font-semibold mb-4">No Communities Found</h2>
                    <p className="text-base-content/70 mb-4">
                        You don't have any communities where you are an administrator with the bot connected.
                    </p>
                    <p className="text-sm text-base-content/50">
                        Make sure you are an admin in a Telegram group and have added the bot to that group.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {chats?.map((chat: any, i: number) => (
                        <CommunityCard
                            key={i}
                            chatId={chat.chatId}
                            title={chat.title}
                            description={chat.description}
                            tags={chat.tags}
                            avatarUrl={chat.photo}
                            icon={chat.icon}
                        />
                    ))}
                </div>
            )}
        </Page>
    );
};

export default ManagePage;

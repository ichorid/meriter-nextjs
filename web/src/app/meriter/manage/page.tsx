'use client';

import { swr } from '@lib/swr';
import { useEffect, useState } from "react";

import Page from '@shared/components/page';
import { Spinner } from '@shared/components/misc';
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import { useRouter } from "next/navigation";
import { CardWithAvatar } from '@shared/components/card-with-avatar';
import Link from "next/link";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';
import { ThemeToggle } from "@shared/components/theme-toggle";

const CommunityCard = ({ chatId, title, description, tags }: any) => {
    return (
        <Link href={`/meriter/communities/${chatId}/settings`} className="block">
            <CardWithAvatar>
                <div className="text-lg font-semibold mb-1">{title}</div>
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
            </CardWithAvatar>
        </Link>
    );
};

const ManagePage = () => {
    const router = useRouter();
    const [refreshChatId, setRefreshChatId] = useState(undefined);
    const [successMessage, setSuccessMessage] = useState('');
    
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setRefreshChatId(params.get('refreshChatId') || undefined);
        
        // Check for success message
        if (params.get('success') === 'saved') {
            setSuccessMessage('Settings saved successfully!');
            setTimeout(() => setSuccessMessage(''), 5000);
        }
    }, []);
    
    const [chats] = swr(
        () =>
            refreshChatId
                ? "/api/rest/getmanagedchats?refreshChatId=" + refreshChatId
                : "/api/rest/getmanagedchats",
        [],
        { key: "chats" }
    );
    const [user] = swr("/api/rest/getme", { init: true });

    useEffect(() => {
        if (!user.tgUserId && !user.init) {
            router.push("/meriter/login?returnTo=/meriter/manage");
        }
    }, [user]);

    if (!user.tgUserId) return null;
    
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
                    {chats?.map((chat, i) => (
                        <CommunityCard
                            key={i}
                            chatId={chat.chatId}
                            title={chat.title}
                            description={chat.description}
                            tags={chat.tags}
                        />
                    ))}
                </div>
            )}
        </Page>
    );
};

export default ManagePage;

'use client';

import { use, useEffect } from "react";
import { swr } from '@lib/swr';
import Page from '@shared/components/page';
import { useRouter } from "next/navigation";
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';
import { Publication } from "@features/feed";
import { useTranslation } from 'react-i18next';
import { ellipsize } from "@shared/lib/text";

const PostPage = ({ params }: { params: Promise<{ id: string; slug: string }> }) => {
    const router = useRouter();
    const { t } = useTranslation('pages');
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;
    const slug = resolvedParams.slug;

    const [user] = swr("/api/rest/getme", { init: true });

    const [publication] = swr(
        () => user?.token ? `/api/rest/publications/${slug}` : null,
        {}
    );

    const [chat] = swr(
        () => user?.token ? `/api/rest/getchat?chatId=${chatId}` : null,
        {},
        { key: "chat" }
    );

    const [balance, updBalance] = swr(
        () => user?.token ? `/api/rest/wallet?tgChatId=${chatId}` : null,
        0,
        { key: "balance" }
    );

    const [userdata] = swr(
        () => user?.tgUserId ? `/api/rest/users/telegram/${user.tgUserId}/profile` : null,
        0,
        { key: "userdata" }
    );

    const chatNameVerb = String(chat?.title ?? "");

    useEffect(() => {
        if (!user?.tgUserId && !user.init) {
            router.push("/meriter/login?returnTo=" + encodeURIComponent(window.location.pathname));
        }
    }, [user, user?.init, router]);

    if (!user.token) return null;

    const tgAuthorId = user?.tgUserId;
    
    // Clean post text for breadcrumb: remove hashtags and /ben: commands
    const getCleanPostText = (text: string) => {
        if (!text) return '';
        return text
            .replace(/#\w+/g, '') // Remove hashtags
            .replace(/\/ben:@?\w+/g, '') // Remove /ben: commands
            .trim();
    };

    return (
        <Page className="feed">
            <HeaderAvatarBalance
                balance1={{ icon: chat?.icon, amount: balance }}
                balance2={undefined}
                avatarUrl={telegramGetAvatarLink(tgAuthorId)}
                onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
                onClick={() => {
                    router.push("/meriter/home");
                }}
                userName={user?.name || 'User'}
            >
                <MenuBreadcrumbs
                    chatId={chatId}
                    chatNameVerb={chatNameVerb}
                    postText={publication?.messageText ? ellipsize(getCleanPostText(publication.messageText), 40) : ''}
                />
            </HeaderAvatarBalance>

            <div className="space-y-4">
                {publication && publication.messageText && (
                    <Publication
                        key={publication._id}
                        {...publication}
                        balance={balance}
                        updBalance={updBalance}
                        activeCommentHook={[null, () => {}]}
                        dimensionConfig={undefined}
                        myId={user?.tgUserId}
                        onlyPublication={true}
                        highlightTransactionId={undefined}
                        isDetailPage={true}
                        showCommunityAvatar={false}
                    />
                )}
            </div>
        </Page>
    );
};

export default PostPage;


'use client';

import { use } from "react";
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
import { ThemeToggle } from "@shared/components/theme-toggle";
import { ellipsize } from "@shared/lib/text";

const PostPage = ({ params }: { params: Promise<{ id: string; slug: string }> }) => {
    const router = useRouter();
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
    const defaultHelpUrl = process.env.NEXT_PUBLIC_HELP_URL || "https://info.meriter.ru";
    const chatHelpUrl = chat?.helpUrl ?? defaultHelpUrl;

    if (!user.token) return null;

    const tgAuthorId = user?.tgUserId;

    return (
        <Page className="feed">
            <div className="flex justify-end items-center gap-2 opacity-50">
                <ThemeToggle />
                <span
                    className="cursor-pointer inline-flex items-center gap-1 hover:opacity-70"
                    onClick={() => (document.location.href = chatHelpUrl)}
                >
                    <img
                        className="h-5 w-5"
                        src={"/meriter/help.svg"}
                        alt="Help"
                    />
                    Помощь
                </span>
            </div>
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
                    postText={publication?.messageText ? ellipsize(publication.messageText, 40) : ''}
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
                    />
                )}
            </div>
        </Page>
    );
};

export default PostPage;


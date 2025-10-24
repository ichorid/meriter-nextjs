'use client';

import Link from "next/link";
import { useTranslations } from 'next-intl';

export const MenuBreadcrumbs = ({
    pathname,
    chatId,
    tagRus,
    chatNameVerb,
    chatIcon,
    postText,
    children,
}: any) => {
    const t = useTranslations('common');
    return (
        <div className="breadcrumbs text-sm mb-4">
            <ul className="flex flex-wrap items-center gap-1">
                <li className="flex items-center gap-1">
                    <Link href="/meriter/home" className="link link-hover flex items-center gap-1">
                        <img
                            className="w-5 h-5"
                            src={"/meriter/home.svg"}
                            alt="Home"
                        />
                        <span>{t('home')}</span>
                    </Link>
                </li>
                {chatId && !tagRus && !postText && (
                    <li>
                        <Link href={"/meriter/communities/" + chatId} className="link link-hover flex items-center gap-1">
                            {chatIcon && <img className="w-4 h-4" src={chatIcon} alt="Currency" />}
                            {chatNameVerb}
                        </Link>
                    </li>
                )}
                {chatId && (tagRus || postText) && (
                    <li>
                        <Link href={"/meriter/communities/" + chatId} className="link link-hover flex items-center gap-1">
                            {chatIcon && <img className="w-4 h-4" src={chatIcon} alt="Currency" />}
                            {chatNameVerb}
                        </Link>
                    </li>
                )}
                {tagRus && (
                    <li>
                        <span>#{tagRus}</span>
                    </li>
                )}
                {postText && (
                    <li className="max-w-xs">
                        <span className="block break-words line-clamp-2 text-ellipsis overflow-hidden">
                            {postText}
                        </span>
                    </li>
                )}
            </ul>
            {children}
        </div>
    );
};

'use client';

import Link from "next/link";

export const MenuBreadcrumbs = ({
    pathname,
    chatId,
    tagRus,
    chatNameVerb,
    postText,
    children,
}: any) => {
    return (
        <div className="breadcrumbs text-sm mb-4">
            <ul>
                <li className="flex items-center gap-1">
                    <Link href="/meriter/home" className="link link-hover flex items-center gap-1">
                        <img
                            className="w-5 h-5"
                            src={"/meriter/home.svg"}
                            alt="Home"
                        />
                        <span>Главная</span>
                    </Link>
                </li>
                {chatId && !tagRus && !postText && (
                    <li>
                        <Link href={"/meriter/communities/" + chatId} className="link link-hover">
                            {chatNameVerb}
                        </Link>
                    </li>
                )}
                {chatId && (tagRus || postText) && (
                    <li>
                        <Link href={"/meriter/communities/" + chatId} className="link link-hover">
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
                    <li>
                        <span>{postText}</span>
                    </li>
                )}
            </ul>
            {children}
        </div>
    );
};

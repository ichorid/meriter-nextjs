'use client';

import Link from "next/link";

export const MenuBreadcrumbs = ({
    pathname,
    chatId,
    tagRus,
    chatNameVerb,
    children,
}: any) => {
    const path = pathname && pathname.split("/");
    let spaceSlug = path && path[1] !== "c" && path[1];
    let publication = path && path[1] !== "c" && path[2];
    return (
        <div className="breadcrumbs text-sm mb-4">
            <ul>
                <li className="hidden">
                    <a href="/">@главная</a>
                </li>
                {chatId && (
                    <li className="flex items-center gap-1">
                        <img
                            className="w-5 h-5"
                            src={"/meriter/home.svg"}
                            alt="Home"
                        />
                        <Link href={"/mt/c/" + chatId} className="link link-hover">
                            {chatNameVerb}
                        </Link>
                    </li>
                )}
                {spaceSlug && (
                    <li>
                        <Link href={"/mt/" + spaceSlug} className="link link-hover">
                            {"#" + tagRus}
                        </Link>
                    </li>
                )}
                {publication && <li>публикация</li>}
            </ul>
            {children}
        </div>
    );
};

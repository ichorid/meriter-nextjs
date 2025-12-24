// Breadcrumbs molecule component with complex navigation logic
'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface BreadcrumbsProps {
  pathname: string;
  chatId?: string;
  tag?: string;
  chatNameVerb?: string;
  chatIcon?: string;
  postText?: string;
  children?: React.ReactNode;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  _pathname,
  chatId,
  tag,
  chatNameVerb,
  chatIcon,
  postText,
  children,
  className = ''
}) => {
  const t = useTranslations('common');
  
  return (
    <div className={`breadcrumbs text-sm mb-4 ${className}`}>
      <ul className="flex flex-wrap items-center gap-1 bg-base-100 rounded-lg p-2 sm:p-3">
        <li className="flex items-center gap-1">
          <Link href="/meriter/profile" className="link link-hover flex items-center gap-1">
            <img
              className="w-5 h-5"
              src={"/meriter/home.svg"}
              alt="Profile"
            />
            <span>{t('home')}</span>
          </Link>
        </li>
        {chatId && !tag && !postText && (
          <li>
            <Link href={"/meriter/communities/" + chatId} className="link link-hover flex items-center gap-1">
              {chatIcon && <img className="w-4 h-4" src={chatIcon} alt="Currency" />}
              {chatNameVerb}
            </Link>
          </li>
        )}
        {chatId && (tag || postText) && (
          <li>
            <Link href={"/meriter/communities/" + chatId} className="link link-hover flex items-center gap-1">
              {chatIcon && <img className="w-4 h-4" src={chatIcon} alt="Currency" />}
              {chatNameVerb}
            </Link>
          </li>
        )}
        {tag && (
          <li>
            <span>#{tag}</span>
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
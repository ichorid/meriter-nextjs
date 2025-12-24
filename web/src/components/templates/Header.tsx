'use client';

import React from 'react';
import { _usePathname } from 'next/navigation';
import { Bell, Menu, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/shared/lib/theme-provider';

export interface HeaderProps {
    pageTitle?: string;
    noOfNotifications?: number;
    onNotificationClick?: () => void;
    onProfileClick?: () => void;
    className?: string;
}

export function Header({
    pageTitle = 'Home',
    noOfNotifications = 0,
    onNotificationClick,
    onProfileClick,
    className = '',
}: HeaderProps) {
    const { theme, resolvedTheme, setTheme } = useTheme();

    const handleThemeToggle = () => {
        // Cycle through: light -> dark -> auto -> light
        if (theme === 'light') {
            setTheme('dark');
        } else if (theme === 'dark') {
            setTheme('auto');
        } else {
            // theme === 'auto'
            setTheme('light');
        }
    };

    const openNotification = () => {
        if (onNotificationClick) {
            onNotificationClick();
        }
    };

    return (
        <div className={`navbar sticky top-0 bg-base-100 z-10 shadow-md ${className}`}>
            {/* Menu toggle for mobile view or small screen */}
            <div className="flex-1">
                <label htmlFor="left-sidebar-drawer" className="btn btn-primary drawer-button lg:hidden">
                    <Menu className="h-5 w-5" />
                </label>
                <h1 className="text-2xl font-semibold ml-2">{pageTitle}</h1>
            </div>

            <div className="flex-none">
                {/* Light, dark, and auto theme selection toggle */}
                <label className="swap">
                    <input 
                        type="checkbox" 
                        checked={resolvedTheme === 'dark'} 
                        onChange={handleThemeToggle}
                        title={`Theme: ${theme === 'auto' ? `Auto (${resolvedTheme})` : theme === 'dark' ? 'Dark' : 'Light'}`}
                    />
                    <Sun
                        className={`w-6 h-6 ${resolvedTheme === 'dark' ? 'swap-on' : 'swap-off'}`}
                    />
                    <Moon
                        className={`w-6 h-6 ${resolvedTheme === 'light' ? 'swap-on' : 'swap-off'}`}
                    />
                </label>

                {/* Notification icon */}
                <button className="btn btn-ghost ml-4 btn-circle" onClick={openNotification}>
                    <div className="indicator">
                        <Bell className="h-6 w-6" />
                        {noOfNotifications > 0 && (
                            <span className="indicator-item badge badge-secondary badge-sm">
                                {noOfNotifications}
                            </span>
                        )}
                    </div>
                </button>

                {/* Profile icon, opening menu on click */}
                <div className="dropdown dropdown-end ml-4">
                    <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                        <div className="w-10 rounded-full">
                            <img src="https://placeimg.com/80/80/people" alt="profile" />
                        </div>
                    </label>
                    <ul tabIndex={0} className="menu menu-compact dropdown-content mt-3 p-2 shadow bg-base-100 rounded-box w-52">
                        <li className="justify-between">
                            <Link href="/meriter/settings">
                                Profile Settings
                                <span className="badge">New</span>
                            </Link>
                        </li>
                        <li>
                            <a>Bill History</a>
                        </li>
                        <div className="divider mt-0 mb-0"></div>
                        <li>
                            <a onClick={onProfileClick}>Logout</a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

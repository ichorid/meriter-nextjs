'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

export interface SidebarRoute {
    path: string;
    icon?: React.ReactNode;
    name: string;
    submenu?: SidebarRoute[];
}

export interface LeftSidebarProps {
    routes?: SidebarRoute[];
    logoPath?: string;
    logoAlt?: string;
    className?: string;
}

export function LeftSidebar({
    routes = [],
    logoPath = '/logo192.png',
    logoAlt = 'Logo',
    className = '',
}: LeftSidebarProps) {
    const pathname = usePathname();

    const close = () => {
        const drawer = document.getElementById('left-sidebar-drawer') as HTMLInputElement;
        if (drawer) {
            drawer.click();
        }
    };

    const isActive = (routePath: string) => {
        return pathname === routePath;
    };

    return (
        <div className={`drawer-side z-30 ${className}`}>
            <label htmlFor="left-sidebar-drawer" className="drawer-overlay"></label>
            <ul className="menu pt-2 w-80 bg-base-100 min-h-full text-base-content">
                <button
                    className="btn btn-ghost bg-base-300 btn-circle z-50 top-0 right-0 mt-4 mr-2 absolute lg:hidden"
                    onClick={close}
                >
                    <X className="h-5 w-5" />
                </button>

                <li className="mb-2 font-semibold text-xl">
                    <Link href="/">
                        <img className="mask mask-squircle w-10" src={logoPath} alt={logoAlt} />
                        DashWind
                    </Link>
                </li>
                {routes.map((route, k) => (
                    <li className="" key={k}>
                        {route.submenu ? (
                            <SidebarSubmenu route={route} pathname={pathname} />
                        ) : (
                            <Link
                                href={route.path}
                                className={isActive(route.path) ? 'font-semibold bg-base-200' : 'font-normal'}
                            >
                                {route.icon} {route.name}
                                {isActive(route.path) && (
                                    <span
                                        className="absolute inset-y-0 left-0 w-1 rounded-tr-md rounded-br-md bg-primary"
                                        aria-hidden="true"
                                    ></span>
                                )}
                            </Link>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

interface SidebarSubmenuProps {
    route: SidebarRoute;
    pathname: string | null;
}

function SidebarSubmenu({ route, pathname }: SidebarSubmenuProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    React.useEffect(() => {
        if (route.submenu) {
            const hasActiveChild = route.submenu.some((sub) => pathname === sub.path);
            setIsOpen(hasActiveChild);
        }
    }, [pathname, route.submenu]);

    if (!route.submenu) return null;

    return (
        <details open={isOpen}>
            <summary className="font-normal">
                {route.icon} {route.name}
            </summary>
            <ul>
                {route.submenu.map((subroute, subk) => (
                    <li key={subk}>
                        <Link
                            href={subroute.path}
                            className={
                                pathname === subroute.path ? 'font-semibold bg-base-200' : 'font-normal'
                            }
                        >
                            {subroute.icon} {subroute.name}
                            {pathname === subroute.path && (
                                <span
                                    className="absolute inset-y-0 left-0 w-1 rounded-tr-md rounded-br-md bg-primary"
                                    aria-hidden="true"
                                ></span>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </details>
    );
}


'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, Icon, Avatar } from '@/components/atoms';
import { routes } from '@/lib/constants/routes';
import { useAuth } from '@/contexts/AuthContext';
import { useUIStore } from '@/stores/ui.store';
import { useRouter } from 'next/navigation';

export interface NavigationBarProps {
  className?: string;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ className = '' }) => {
  const auth = useAuth();
  const { user, isAuthenticated } = auth;
  const { activeModal, setActiveSidebar } = useUIStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  
  const navLinks = [
    { href: routes.home, label: 'Home', icon: 'home' },
    { href: routes.communities, label: 'Communities', icon: 'group' },
    { href: routes.polls, label: 'Polls', icon: 'poll' },
    { href: routes.wallet, label: 'Wallet', icon: 'account_balance_wallet' },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowDropdown(false);
    await auth.logout();
  };

  // Hide navbar on login page
  if (pathname?.includes('/login')) {
    return null;
  }
  
  return (
    <nav className={`sticky top-0 z-50 navbar bg-base-100 shadow-md ${className}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between w-full">
          {/* Logo/Brand */}
          <Link href={routes.home} className="btn btn-ghost normal-case text-xl">
            Meriter
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={pathname === link.href ? 'btn-active' : ''}
                >
                  <Icon name={link.icon} size={20} />
                  <span className="hidden lg:inline">{link.label}</span>
                </Button>
              </Link>
            ))}
          </div>
          
          {/* User Menu */}
          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2"
                >
                  <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
                  <span className="hidden lg:inline">{user.displayName}</span>
                  <Icon name="arrow_drop_down" size={16} />
                </Button>
                
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50">
                    <div className="p-2">
                      <div className="px-4 py-2 text-sm border-b border-base-300">
                        <div className="font-medium truncate">{user.displayName}</div>
                      </div>
                      <Link href={routes.settings}>
                        <button 
                          className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 rounded flex items-center gap-2"
                          onClick={() => setShowDropdown(false)}
                        >
                          <Icon name="settings" size={18} />
                          Settings
                        </button>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 rounded flex items-center gap-2 text-error"
                      >
                        <Icon name="logout" size={18} />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link href={routes.login}>
                <Button variant="primary" size="sm">
                  Login
                </Button>
              </Link>
            )}
            
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveSidebar('menu')}
              className="md:hidden"
            >
              <Icon name="menu" size={24} />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

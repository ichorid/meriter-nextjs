import React from 'react';
import Link from 'next/link';
import { Button, Icon, Avatar } from '@/components/atoms';
import { routes } from '@/lib/constants/routes';
import { useAuth } from '@/contexts/AuthContext';
import { useUIStore } from '@/stores/ui.store';

export interface NavigationBarProps {
  className?: string;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ className = '' }) => {
  const { user, isAuthenticated } = useAuth();
  const { activeModal, setActiveSidebar } = useUIStore();
  
  const navLinks = [
    { href: routes.home, label: 'Home', icon: 'home' },
    { href: routes.communities, label: 'Communities', icon: 'group' },
    { href: routes.polls, label: 'Polls', icon: 'poll' },
    { href: routes.wallet, label: 'Wallet', icon: 'account_balance_wallet' },
  ];
  
  return (
    <nav className={`navbar bg-base-100 shadow-md ${className}`}>
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
                <Button variant="ghost" size="sm">
                  <Icon name={link.icon} size={20} />
                  <span className="hidden lg:inline">{link.label}</span>
                </Button>
              </Link>
            ))}
          </div>
          
          {/* User Menu */}
          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                <Link href={routes.settings}>
                  <Button variant="ghost" size="sm">
                    <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
                    <span className="hidden lg:inline ml-2">{user.displayName}</span>
                  </Button>
                </Link>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveSidebar('menu')}
                  className="md:hidden"
                >
                  <Icon name="menu" size={24} />
                </Button>
              </>
            ) : (
              <Link href={routes.login}>
                <Button variant="primary" size="sm">
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

import React from 'react';
import * as LucideIcons from 'lucide-react';

export type IconSize = number | string;

// Mapping from material-symbols names to lucide-react icon names
const iconNameMap: Record<string, keyof typeof LucideIcons> = {
  'home': 'Home',
  'group': 'Users',
  'poll': 'BarChart3',
  'account_balance_wallet': 'Wallet',
  'arrow_drop_down': 'ChevronDown',
  'settings': 'Settings',
  'logout': 'LogOut',
  'menu': 'Menu',
  'reply': 'Reply',
  'thumb_up': 'ThumbsUp',
  'thumb_down': 'ThumbsDown',
  'remove': 'Minus',
  'add': 'Plus',
  'search': 'Search',
};

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'size'> {
  name: string;
  size?: IconSize;
  filled?: boolean; // Kept for backward compatibility but not used
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  (
    {
      name,
      size = 24,
      filled = false,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    // Map icon name to lucide icon name
    const lucideIconName = iconNameMap[name] || name;
    
    // Get the icon component from lucide-react
    const IconComponent = LucideIcons[lucideIconName as keyof typeof LucideIcons] as React.ComponentType<any>;
    
    if (!IconComponent) {
      console.warn(`Icon "${name}" not found in lucide-react. Using placeholder.`);
      return (
        <div
          ref={ref as any}
          className={className}
          style={{ width: size, height: size, ...style }}
        >
          ?
        </div>
      );
    }

    return (
      <IconComponent
        ref={ref}
        size={typeof size === 'number' ? size : parseInt(size as string) || 24}
        className={className}
        style={style}
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';

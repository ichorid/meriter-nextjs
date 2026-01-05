"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import { getColorFromString, getContrastTextColor } from "@/lib/utils/avatar"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

interface AvatarFallbackProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  userId?: string;
  communityId?: string;
}

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, userId, communityId, style, ...props }, ref) => {
  // Generate color from userId or communityId if provided (prefer userId for backwards compatibility)
  const idForColor = userId || communityId;
  const backgroundColor = idForColor ? getColorFromString(idForColor) : undefined;
  const textColor = backgroundColor ? getContrastTextColor(backgroundColor) : undefined;
  
  // Build style object
  const fallbackStyle: React.CSSProperties = {
    ...style,
    ...(backgroundColor && {
      backgroundColor,
      color: textColor === 'white' ? '#FFFFFF' : '#000000',
    }),
  };
  
  // Remove bg-muted and text-muted-foreground classes if we have a custom color
  const fallbackClassName = idForColor 
    ? className?.replace(/\b(bg-muted|text-muted-foreground|bg-secondary|text-secondary-foreground)\b/g, '').replace(/\s+/g, ' ').trim()
    : className;
  
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full",
        !idForColor && "bg-muted text-muted-foreground",
        fallbackClassName
      )}
      style={fallbackStyle}
      {...props}
    />
  );
})
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }

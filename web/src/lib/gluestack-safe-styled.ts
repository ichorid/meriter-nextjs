'use client';

import React from 'react';
import { styled } from '@gluestack-style/react';

/**
 * Safe wrapper for @gluestack-style/react styled() function
 * 
 * This function creates styled components directly, as StyledProvider
 * should be available in the component tree.
 */
export function createSafeStyledComponent(
  Component: any,
  styles: any,
  options?: any
) {
  // Create styled component directly - StyledProvider should be available
  try {
    return styled(Component, styles, options);
  } catch (error) {
    console.error('[Gluestack] Failed to create styled component:', error);
    // Fallback to plain component if styled fails
    return React.forwardRef((props: any, ref: any) => {
      return React.createElement(Component, { ...props, ref });
    });
  }
}

/**
 * Safe styled function that returns a component wrapper
 */
export function getStyled() {
  return (Component: any, styles: any, options?: any) => {
    return createSafeStyledComponent(Component, styles, options);
  };
}


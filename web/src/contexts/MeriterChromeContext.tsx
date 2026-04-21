'use client';

import React, { createContext, useContext } from 'react';

const MeriterChromeContext = createContext(false);

export function MeriterChromeProvider({
  stitch,
  children,
}: {
  stitch: boolean;
  children: React.ReactNode;
}) {
  return <MeriterChromeContext.Provider value={stitch}>{children}</MeriterChromeContext.Provider>;
}

export function useMeriterStitchChrome(): boolean {
  return useContext(MeriterChromeContext);
}

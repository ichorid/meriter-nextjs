'use client';

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

const TabsContext = createContext<{
  value: string;
  onChange: (value: string) => void;
  idBase: string;
} | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab components must be used inside Tabs');
  return context;
}

export function Tabs({
  value,
  onChange,
  children,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  'aria-label'?: string;
}) {
  const idBase = useId();
  const tabs: ReactNode[] = [];
  const panels: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Tab) tabs.push(child);
    else if (child.type === TabPanel) panels.push(child);
  });

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
    if (!buttons.length) return;
    const current = buttons.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    const id = buttons[next]?.dataset.value;
    if (!id) return;
    onChange(id);
    buttons[next]?.focus();
  }

  return (
    <TabsContext.Provider value={{ value, onChange, idBase }}>
      <div className="space-y-8">
        <div
          role="tablist"
          aria-label={ariaLabel}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-stitch-border bg-stitch-surface p-1"
        >
          {tabs}
        </div>
        {panels}
      </div>
    </TabsContext.Provider>
  );
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  const { value: selected, onChange, idBase } = useTabs();
  const active = selected === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${idBase}-tab-${value}`}
      data-value={value}
      aria-selected={active}
      aria-controls={`${idBase}-panel-${value}`}
      tabIndex={active ? 0 : -1}
      className={cn(
        'min-h-11 min-w-11 whitespace-nowrap rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-accent',
        active ? 'bg-stitch-accent text-white' : 'text-stitch-muted',
      )}
      onClick={() => onChange(value)}
    >
      {children}
    </button>
  );
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const { value: selected, idBase } = useTabs();
  const active = selected === value;
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      hidden={!active}
      tabIndex={0}
    >
      {active ? children : null}
    </div>
  );
}

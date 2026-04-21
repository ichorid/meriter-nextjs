'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, BarChart2, Info, FolderKanban } from 'lucide-react';
import { useCanCreatePost } from '@/hooks/useCanCreatePost';
import { useToastStore } from '@/shared/stores/toast.store';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useUIStore } from '@/stores/ui.store';
import { Button } from '@/components/ui/shadcn/button';
import { Plus } from 'lucide-react';
import { ENABLE_PROJECT_POSTS } from '@/lib/constants/features';
import { trackMeriterUiEvent } from '@/lib/telemetry/meriter-ui-telemetry';

const MENU_WIDTH_PX = 224; // w-56
const FLOAT_GAP_PX = 8;
const BODY_MENU_Z = 10000;

interface CreateMenuProps {
    communityId: string;
    trigger?: React.ReactNode;
}

export const CreateMenu: React.FC<CreateMenuProps> = ({ communityId, trigger }) => {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const tCommon = useTranslations('common');
    const { canCreate, isLoading: permissionLoading, reason } = useCanCreatePost(communityId);
    const { data: community } = useCommunity(communityId);
    const addToast = useToastStore((state) => state.addToast);
    const { activeVotingTarget, activeWithdrawTarget, activeModal } = useUIStore();
    const [isOpen, setIsOpen] = useState(false);
    const [floatingPos, setFloatingPos] = useState({ top: 0, left: 0 });
    const triggerWrapRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const hasActivePopup = activeVotingTarget !== null || activeWithdrawTarget !== null || activeModal !== null;

    const isFutureVision = community?.typeTag === 'future-vision';

    const isGoodDeedsMarathon = community?.typeTag === 'marathon-of-good';
    const isTeamCommunity = community?.typeTag === 'team';
    const canCreateProjects = ENABLE_PROJECT_POSTS && (isGoodDeedsMarathon || isTeamCommunity);

    const hasAvailableActions = canCreate === true;

    const updateFloatingPosition = useCallback(() => {
        const triggerEl = triggerWrapRef.current;
        const panelEl = panelRef.current;
        if (!triggerEl) return;

        const rect = triggerEl.getBoundingClientRect();
        const isLg = window.matchMedia('(min-width: 1024px)').matches;
        const panelH = panelEl?.offsetHeight || 160;

        let left = rect.right - MENU_WIDTH_PX;
        left = Math.min(
            Math.max(FLOAT_GAP_PX, left),
            window.innerWidth - MENU_WIDTH_PX - FLOAT_GAP_PX,
        );

        let top: number;
        if (isLg) {
            top = rect.bottom + FLOAT_GAP_PX;
            if (top + panelH > window.innerHeight - FLOAT_GAP_PX) {
                top = rect.top - FLOAT_GAP_PX - panelH;
            }
        } else {
            top = rect.top - FLOAT_GAP_PX - panelH;
            if (top < FLOAT_GAP_PX) {
                top = rect.bottom + FLOAT_GAP_PX;
            }
        }

        top = Math.max(
            FLOAT_GAP_PX,
            Math.min(top, window.innerHeight - panelH - FLOAT_GAP_PX),
        );

        setFloatingPos({ top, left });
    }, []);

    useLayoutEffect(() => {
        if (!isOpen) return;

        updateFloatingPosition();
        const raf = requestAnimationFrame(() => updateFloatingPosition());

        const onWin = () => updateFloatingPosition();
        window.addEventListener('resize', onWin);
        window.addEventListener('scroll', onWin, true);
        const mainWrap = document.querySelector('.mainWrap');
        mainWrap?.addEventListener('scroll', onWin, { passive: true });

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', onWin);
            window.removeEventListener('scroll', onWin, true);
            mainWrap?.removeEventListener('scroll', onWin);
        };
    }, [isOpen, updateFloatingPosition, canCreate, isFutureVision, canCreateProjects, reason]);

    const handleCreatePost = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canCreate) {
            addToast(reason || t('noPermission'), 'info');
            setIsOpen(false);
            return;
        }
        router.push(`/meriter/communities/${communityId}/create`);
        setIsOpen(false);
    };

    const handleCreatePoll = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canCreate) {
            addToast(reason || t('noPermission'), 'info');
            setIsOpen(false);
            return;
        }
        router.push(`/meriter/communities/${communityId}/create-poll`);
        setIsOpen(false);
    };

    const handleCreateProject = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canCreate) {
            addToast(reason || t('noPermission'), 'info');
            setIsOpen(false);
            return;
        }
        router.push(`/meriter/communities/${communityId}/create?postType=project`);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerWrapRef.current?.contains(target) || panelRef.current?.contains(target)) {
                return;
            }
            setIsOpen(false);
        };

        if (isOpen) {
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 200);

            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }

        return undefined;
    }, [isOpen]);

    const shouldHide = (hasActivePopup && !isOpen) || (!permissionLoading && !hasAvailableActions);

    const defaultTrigger = (
        <Button
            variant="ghost"
            size="sm"
            onClick={() =>
                setIsOpen((prev) => {
                    if (!prev) trackMeriterUiEvent({ name: 'nav_create_click', payload: { surface: 'fab' } });
                    return !prev;
                })
            }
            className="rounded-full active:scale-[0.98] p-0 w-[45px] h-[45px] flex items-center justify-center bg-base-200 dark:bg-base-100 shadow-lg hover:bg-base-300 dark:hover:bg-base-100/90"
            aria-label={isOpen ? tCommon('close') : tCommon('open')}
        >
            <Plus size={27} className="text-base-content/70 dark:text-base-content/90" />
        </Button>
    );

    const triggerWithHandler =
        trigger && React.isValidElement(trigger)
            ? React.cloneElement(trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
                  onClick: (e: React.MouseEvent) => {
                      e.stopPropagation();
                      const orig = (trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>).props
                          .onClick;
                      orig?.(e);
                      setIsOpen((prev) => {
                          if (!prev) trackMeriterUiEvent({ name: 'nav_create_click', payload: { surface: 'fab' } });
                          return !prev;
                      });
                  },
              })
            : trigger;

    const menuPanel = (
        <div
            ref={panelRef}
            className="w-56 bg-base-100 rounded-xl shadow-2xl shadow-none overflow-hidden border border-base-300"
            style={{
                position: 'fixed',
                top: floatingPos.top,
                left: floatingPos.left,
                zIndex: BODY_MENU_Z,
            }}
        >
            <div className="py-2">
                {canCreate ? (
                    <>
                        <button
                            type="button"
                            onClick={handleCreatePost}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-content/5 transition-colors text-left"
                        >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <FileText size={16} className="text-primary" />
                            </div>
                            <span className="text-sm font-medium text-base-content">{t('createPost')}</span>
                        </button>
                        {!isFutureVision && (
                            <button
                                type="button"
                                onClick={handleCreatePoll}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-content/5 transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <BarChart2 size={16} className="text-primary" />
                                </div>
                                <span className="text-sm font-medium text-base-content">{t('createPoll')}</span>
                            </button>
                        )}
                        {canCreateProjects && (
                            <button
                                type="button"
                                onClick={handleCreateProject}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-content/5 transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <FolderKanban size={16} className="text-primary" />
                                </div>
                                <span className="text-sm font-medium text-base-content">{t('createProject')}</span>
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            disabled
                            className="w-full px-4 py-3 flex items-center gap-3 text-left opacity-40 cursor-not-allowed"
                        >
                            <div className="w-8 h-8 rounded-full bg-base-content/5 flex items-center justify-center">
                                <FileText size={16} className="text-base-content/50" />
                            </div>
                            <span className="text-sm font-medium text-base-content/50">{t('createPost')}</span>
                        </button>
                        {!isFutureVision && (
                            <button
                                type="button"
                                disabled
                                className="w-full px-4 py-3 flex items-center gap-3 text-left opacity-40 cursor-not-allowed"
                            >
                                <div className="w-8 h-8 rounded-full bg-base-content/5 flex items-center justify-center">
                                    <BarChart2 size={16} className="text-base-content/50" />
                                </div>
                                <span className="text-sm font-medium text-base-content/50">{t('createPoll')}</span>
                            </button>
                        )}
                        {canCreateProjects && (
                            <button
                                type="button"
                                disabled
                                className="w-full px-4 py-3 flex items-center gap-3 text-left opacity-40 cursor-not-allowed"
                            >
                                <div className="w-8 h-8 rounded-full bg-base-content/5 flex items-center justify-center">
                                    <FolderKanban size={16} className="text-base-content/50" />
                                </div>
                                <span className="text-sm font-medium text-base-content/50">{t('createProject')}</span>
                            </button>
                        )}
                        {reason && (
                            <div className="mx-3 mt-2 p-3 rounded-xl bg-base-200/50">
                                <div className="flex items-start gap-2">
                                    <Info size={14} className="text-base-content/50 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-base-content/60 leading-relaxed">{reason}</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div ref={triggerWrapRef} className={`relative ${shouldHide ? 'hidden' : ''}`}>
            {triggerWithHandler || defaultTrigger}
            {isOpen && !permissionLoading && typeof document !== 'undefined'
                ? createPortal(menuPanel, document.body)
                : null}
        </div>
    );
};

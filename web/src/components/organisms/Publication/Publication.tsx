// Enhanced Publication component with all domain logic
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader } from '@/components/atoms';
import { usePublicationVoting } from '@/hooks/usePublicationVoting';
import { usePublicationNavigation } from '@/hooks/usePublicationNavigation';
import { usePublicationState } from '@/hooks/usePublicationState';
import { useComments } from '@shared/hooks/use-comments';
import { useCommunity, usePoll } from '@/hooks/api';
import { telegramGetAvatarLink, telegramGetAvatarLinkUpd } from '@shared/lib/telegram';
import { WithTelegramEntities } from '@shared/components/withTelegramEntities';
import { FormDimensionsEditor } from '@shared/components/form-dimensions-editor';
import { useUIStore } from '@/stores/ui.store';
import { Comment } from '@features/comments/components/comment';
import { PollVoting } from '@features/polls/components/poll-voting';
import { BarVoteUnified } from '@shared/components/bar-vote-unified';
import { BarWithdraw } from '@shared/components/bar-withdraw';
import { FormWithdraw } from '@shared/components/form-withdraw';
import { Spinner } from '@shared/components/misc';
import { CardPublication } from '@features/feed/components/card-publication';
import { classList } from '@lib/classList';
import { dateVerbose } from '@shared/lib/date';
import type { IPollData } from '@features/polls/types';

export interface IPublication {
  tgChatName: string;
  tgMessageId: string;
  minus: number;
  plus: number;
  sum: number;
  slug: string;
  spaceSlug: string;
  balance: any;
  updBalance?: any;
  messageText: string;
  authorPhotoUrl: string;
  tgAuthorName: string;
  tgAuthorId?: string;
  beneficiaryName?: string;
  beneficiaryPhotoUrl?: string;
  beneficiaryId?: string;
  beneficiaryUsername?: string;
  keyword: string;
  ts: string;
  type?: string;
  content?: any;
  _id?: string;
}

export interface PublicationProps {
  // Core publication data
  tgChatName: string;
  tgChatId?: string;
  tgMessageId: string;
  minus: number;
  plus: number;
  sum: number;
  slug: string;
  spaceSlug: string;
  balance: any;
  updBalance?: () => Promise<void>;
  messageText: string;
  authorPhotoUrl: string;
  tgAuthorName: string;
  tgAuthorId?: string;
  beneficiaryName?: string;
  beneficiaryPhotoUrl?: string;
  beneficiaryId?: string;
  beneficiaryUsername?: string;
  keyword: string;
  ts: string;
  type?: string;
  content?: any;
  _id?: string;
  
  // State management
  activeCommentHook: [string | null, React.Dispatch<React.SetStateAction<string | null>>];
  activeSlider?: string | null;
  setActiveSlider?: (slider: string | null) => void;
  myId?: string;
  onlyPublication?: boolean;
  entities?: any;
  highlightTransactionId?: string;
  isDetailPage?: boolean;
  showCommunityAvatar?: boolean;
  
  // Withdrawal functionality
  wallets?: any[];
  updateWalletBalance?: (currency: string, change: number) => void;
  activeWithdrawPost?: string | null;
  setActiveWithdrawPost?: (post: string | null) => void;
  updateAll?: () => Promise<void>;
  currency?: string;
  inMerits?: boolean;
  currencyOfCommunityTgChatId?: string;
  fromTgChatId?: string;
  
  // Dimensions
  dimensions?: any;
  dimensionConfig?: any;
}

export const Publication: React.FC<PublicationProps> = ({
  tgChatName,
  tgChatId,
  tgMessageId,
  minus,
  plus,
  sum,
  slug,
  spaceSlug,
  balance,
  updBalance = async () => {},
  messageText,
  authorPhotoUrl,
  tgAuthorName,
  tgAuthorId,
  beneficiaryName,
  beneficiaryPhotoUrl,
  beneficiaryId,
  beneficiaryUsername,
  keyword,
  ts,
  type,
  content,
  _id,
  activeCommentHook,
  activeSlider,
  setActiveSlider,
  myId,
  onlyPublication,
  entities,
  highlightTransactionId,
  isDetailPage,
  showCommunityAvatar,
  wallets,
  updateWalletBalance,
  activeWithdrawPost,
  setActiveWithdrawPost,
  updateAll,
  currency,
  inMerits,
  currencyOfCommunityTgChatId,
  fromTgChatId,
  dimensions,
  dimensionConfig,
}) => {
  const t = useTranslations('feed');
  const router = useRouter();
  
  if (!tgChatName && type !== 'poll') return null;
  
  // Use custom hooks for business logic
  const votingLogic = usePublicationVoting({
    slug,
    _id,
    sum,
    isAuthor: myId === tgAuthorId,
    tgAuthorId,
    myId,
    wallets,
    currencyOfCommunityTgChatId,
    fromTgChatId,
    tgChatId,
    updateWalletBalance,
    updateAll,
    activeWithdrawPost,
    setActiveWithdrawPost,
    activeSlider,
    setActiveSlider,
  });
  
  const navigationLogic = usePublicationNavigation({
    slug,
    tgChatId,
    isDetailPage,
    myId,
    tgAuthorId,
    activeSlider,
    setActiveSlider,
  });
  
  const stateLogic = usePublicationState({
    tgAuthorId,
    authorPhotoUrl,
    tgAuthorName,
    beneficiaryId,
    beneficiaryName,
    myId,
    tgChatId,
    showCommunityAvatar,
    wallets,
    balance,
    updBalance,
    type,
    content,
    _id,
    onlyPublication,
    isDetailPage,
    activeCommentHook,
    dimensions,
    keyword,
    entities,
  });
  
  // Use comments hook
  const {
    comments,
    showPlus,
    currentPlus,
    currentMinus,
    showMinus,
    showComments,
    setShowComments,
    formCommentProps,
  } = useComments(
    false,
    slug,
    "",
    "",
    "",
    balance,
    updBalance,
    plus,
    minus,
    activeCommentHook,
    onlyPublication,
    spaceSlug
  );
  
  // Auto-show plus and comments for detail pages
  useEffect(() => {
    if (onlyPublication || isDetailPage) {
      showPlus();
      setShowComments(true);
    }
  }, [onlyPublication, isDetailPage]);
  
  // State for polls
  const [pollUserVote, setPollUserVote] = useState(null);
  const [pollUserVoteSummary, setPollUserVoteSummary] = useState(null);
  const [pollData, setPollData] = useState<IPollData | null>(type === 'poll' ? content : null);
  
  // Fetch poll data using v1 API
  const { data: pollData_v1 } = usePoll(_id || '');
  
  useEffect(() => {
    if (pollData_v1) {
      setPollData(pollData_v1 as any);
    }
  }, [pollData_v1]);
  
  // Render poll publication
  if (type === 'poll' && pollData) {
    const avatarUrl = authorPhotoUrl || (tgAuthorId ? telegramGetAvatarLink(tgAuthorId) : undefined);
    
    const withdrawSliderContent = stateLogic.isAuthor && votingLogic.directionAdd !== undefined && (
      votingLogic.loading ? (
        <Spinner />
      ) : (
        <FormWithdraw
          comment={votingLogic.comment}
          setComment={votingLogic.setComment}
          amount={votingLogic.amount}
          setAmount={votingLogic.setAmount}
          maxWithdrawAmount={votingLogic.maxWithdrawAmount}
          maxTopUpAmount={votingLogic.maxTopUpAmount}
          isWithdrawal={!votingLogic.directionAdd}
          onSubmit={() => !votingLogic.disabled && votingLogic.submitWithdrawal()}
        >
          <div>
            {votingLogic.directionAdd ? t('addCommunityPoints', { amount: votingLogic.amount }) : t('removeCommunityPoints', { amount: votingLogic.amount })}
          </div>
        </FormWithdraw>
      )
    );
    
    return (
      <div className="mb-5" key={slug}>
        <CardPublication
          title={stateLogic.displayTitle}
          subtitle={dateVerbose(ts)}
          avatarUrl={avatarUrl}
          onAvatarUrlNotFound={stateLogic.handleAvatarError}
          description={stateLogic.isAuthor ? t('pollMy') : t('poll')}
          onClick={undefined}
          onDescriptionClick={undefined}
          bottom={undefined}
          showCommunityAvatar={showCommunityAvatar}
          communityAvatarUrl={stateLogic.communityInfo?.avatarUrl}
          communityName={stateLogic.communityInfo?.name || tgChatName}
          communityIconUrl={stateLogic.communityInfo?.settings?.iconUrl}
          onCommunityClick={() => {
            const communityId = stateLogic.communityInfo?.id || '';
            if (!communityId) return;
            
            if (stateLogic.communityInfo?.needsSetup) {
              if (stateLogic.communityInfo?.isAdmin) {
                // Admin: redirect to settings
                router.push(`/meriter/communities/${communityId}/settings`);
              } else {
                // Non-admin: show toast
                const { useToastStore } = require('@/shared/stores/toast.store');
                useToastStore.getState().addToast(
                  t('communitySetupPending'),
                  'info'
                );
              }
            } else {
              // Normal navigation
              navigationLogic.navigateToCommunity(communityId);
            }
          }}
          communityNeedsSetup={stateLogic.communityInfo?.needsSetup}
          communityIsAdmin={stateLogic.communityInfo?.isAdmin}
          withdrawSliderContent={withdrawSliderContent}
        >
          <PollVoting
            pollData={pollData}
            pollId={_id || slug}
            userVote={pollUserVote || undefined}
            userVoteSummary={pollUserVoteSummary || undefined}
            balance={stateLogic.effectiveBalance || 0}
            onVoteSuccess={stateLogic.handlePollVoteSuccess}
            updateWalletBalance={updateWalletBalance}
            communityId={pollData?.communityId}
            initiallyExpanded={isDetailPage}
          />
        </CardPublication>
      </div>
    );
  }
  
  // Regular publication rendering
  const publicationUnderReply = activeCommentHook[0] == slug;
  const nobodyUnderReply = activeCommentHook[0] === null;
  const commentUnderReply = activeCommentHook[0] && activeCommentHook[0] !== slug && activeCommentHook[0] !== null;
  
  // Check if current user is the beneficiary (but not the author)
  // Simplified: directly check if beneficiaryId exists and matches current user
  const hasBeneficiary = !!(beneficiaryId && beneficiaryId !== tgAuthorId);
  const isBeneficiary = !!(hasBeneficiary && myId === beneficiaryId);
  const isAuthor = myId === tgAuthorId;
  const currentScore = currentPlus - currentMinus;
  
  // Debug logging
  console.log('[Publication] Mutual Exclusivity Debug:', {
    slug,
    myId,
    tgAuthorId,
    beneficiaryId,
    stateLogicHasBeneficiary: stateLogic.hasBeneficiary,
    hasBeneficiary,
    isAuthor,
    isBeneficiary,
    calculation: {
      'beneficiaryId exists': !!beneficiaryId,
      'beneficiaryId !== tgAuthorId': beneficiaryId !== tgAuthorId,
      'myId === beneficiaryId': myId === beneficiaryId,
      'myId !== tgAuthorId': myId !== tgAuthorId,
    },
    currentScore,
    currentPlus,
    currentMinus,
  });
  
  // Mutual exclusivity logic:
  // Show withdraw if: (isAuthor && !hasBeneficiary) || isBeneficiary
  // Show vote if: !isAuthor && !isBeneficiary (or if isAuthor && hasBeneficiary - author can vote for beneficiary)
  // IMPORTANT: If user is beneficiary, NEVER show vote button (even if balance is 0)
  const showWithdraw = (isAuthor && !hasBeneficiary) || isBeneficiary;
  const showVote = !isAuthor && !isBeneficiary; // Explicitly exclude beneficiaries
  const showVoteForAuthor = isAuthor && hasBeneficiary; // Author can vote when there's a beneficiary
  
  console.log('[Publication] Button Visibility Logic:', {
    showWithdraw,
    showVote,
    showVoteForAuthor,
    willShowWithdraw: showWithdraw,
    willShowVote: showVote || showVoteForAuthor,
    finalChoice: showWithdraw ? 'WITHDRAW' : (showVote || showVoteForAuthor ? 'VOTE' : 'NONE'),
  });
  
  const withdrawSliderContent = ((stateLogic.isAuthor && !stateLogic.hasBeneficiary) || isBeneficiary) && votingLogic.directionAdd !== undefined && (
    votingLogic.loading ? (
      <Spinner />
    ) : (
      <FormWithdraw
        comment={votingLogic.comment}
        setComment={votingLogic.setComment}
        amount={votingLogic.amount}
        setAmount={votingLogic.setAmount}
        maxWithdrawAmount={votingLogic.maxWithdrawAmount}
        maxTopUpAmount={votingLogic.maxTopUpAmount}
        isWithdrawal={!votingLogic.directionAdd}
        onSubmit={() => !votingLogic.disabled && votingLogic.submitWithdrawal()}
      >
        <div>
          {votingLogic.directionAdd ? t('addCommunityPoints', { amount: votingLogic.amount }) : t('removeCommunityPoints', { amount: votingLogic.amount })}
        </div>
      </FormWithdraw>
    )
  );
  
  return (
    <div
      className={classList(
        "mb-5 transition-all duration-300",
        publicationUnderReply ? "scale-100 opacity-100" : 
        activeSlider && activeSlider !== slug ? "scale-95 opacity-60" : "scale-100 opacity-100"
      )}
      onClick={navigationLogic.handleContainerClick}
      key={slug}
    >
      <CardPublication
        title={stateLogic.displayTitle}
        subtitle={dateVerbose(ts)}
        avatarUrl={stateLogic.avatarUrl}
        onAvatarUrlNotFound={stateLogic.handleAvatarError}
        description={stateLogic.tagsStr}
        onClick={!isDetailPage ? navigationLogic.navigateToDetail : undefined}
        onDescriptionClick={stateLogic.handleDimensionsClick}
        bottom={
          (() => {
            console.log('[Publication] Rendering bottom component:', {
              showWithdraw,
              showVote,
              showVoteForAuthor,
              isBeneficiary,
              isAuthor,
              hasBeneficiary,
            });
            
            if (showWithdraw) {
              console.log('[Publication] Rendering BarWithdraw');
              return (
                <BarWithdraw
                  balance={votingLogic.maxWithdrawAmount}
                  onWithdraw={() => votingLogic.handleSetDirectionAdd(false)}
                  onTopup={() => votingLogic.handleSetDirectionAdd(true)}
                  showDisabled={isBeneficiary || (isAuthor && !hasBeneficiary)} // Show disabled state for beneficiaries and authors without beneficiary
                  commentCount={!isDetailPage ? comments?.length || 0 : 0}
                  onCommentClick={navigationLogic.handleCommentClick}
                >
                  {null}
                </BarWithdraw>
              );
            } else if (showVote || showVoteForAuthor) {
              console.log('[Publication] Rendering BarVoteUnified', {
                showVote,
                showVoteForAuthor,
                isBeneficiary,
                isAuthor,
                hasBeneficiary,
              });
              return (
                <BarVoteUnified
                  score={currentScore}
                  onVoteClick={() => {
                    useUIStore.getState().openVotingPopup(slug, 'publication');
                  }}
                  isAuthor={isAuthor}
                  isBeneficiary={isBeneficiary}
                  hasBeneficiary={hasBeneficiary}
                  commentCount={!isDetailPage ? comments?.length || 0 : 0}
                  onCommentClick={navigationLogic.handleCommentClick}
                />
              );
            } else {
              console.log('[Publication] Rendering null (no buttons)');
              return null;
            }
          })()
        }
        showCommunityAvatar={showCommunityAvatar}
        communityAvatarUrl={stateLogic.communityInfo?.avatarUrl}
        communityName={stateLogic.communityInfo?.name || tgChatName}
        communityIconUrl={stateLogic.communityInfo?.settings?.iconUrl}
        onCommunityClick={() => {
          const communityId = stateLogic.communityInfo?.id || '';
          if (!communityId) return;
          
          if (stateLogic.communityInfo?.needsSetup) {
            if (stateLogic.communityInfo?.isAdmin) {
              // Admin: redirect to settings
              router.push(`/meriter/communities/${communityId}/settings`);
            } else {
              // Non-admin: show toast
              const { useToastStore } = require('@/shared/stores/toast.store');
              useToastStore.getState().addToast(
                t('communitySetupPending'),
                'info'
              );
            }
          } else {
            // Normal navigation
            navigationLogic.navigateToCommunity(communityId);
          }
        }}
        communityNeedsSetup={stateLogic.communityInfo?.needsSetup}
        communityIsAdmin={stateLogic.communityInfo?.isAdmin}
        withdrawSliderContent={withdrawSliderContent}
      >
        <WithTelegramEntities entities={entities}>
          {messageText}
        </WithTelegramEntities>
      </CardPublication>
      
      {stateLogic.showDimensionsEditor && dimensionConfig && tgAuthorId == myId && (
        <FormDimensionsEditor
          level="publication"
          dimensions={dimensions}
          dimensionConfig={dimensionConfig}
          onSave={(dimensions) => {
            console.warn('SetDimensions endpoint not implemented', { slug, dimensions });
          }}
        />
      )}
      
      {showComments && (
        <div className="publication-comments">
          <div className="comments">
            {comments?.map((c: any) => (
              <Comment
                key={c._id}
                {...c}
                balance={balance}
                updBalance={updBalance}
                spaceSlug={spaceSlug}
                inPublicationSlug={slug}
                activeCommentHook={activeCommentHook}
                activeSlider={activeSlider}
                setActiveSlider={setActiveSlider}
                myId={myId}
                highlightTransactionId={highlightTransactionId}
                wallets={wallets}
                updateWalletBalance={updateWalletBalance}
                activeWithdrawPost={activeWithdrawPost}
                setActiveWithdrawPost={setActiveWithdrawPost}
                updateAll={updateAll}
                isDetailPage={isDetailPage}
              />
            ))}
          </div>
        </div>
      )}
      
    </div>
  );
};

'use client';

import { GLOBAL_FEED_TG_CHAT_ID } from "@config/meriter";
import { useEffect, useState } from "react";
import { swr } from "@lib/swr";
import Axios from "axios";
import { Spinner } from "@shared/components/misc";
import { FormWithdraw } from "@features/wallet/components/form-withdraw";
import { CommentMy } from "@features/comments/components/comment-my";
import { PublicationMy } from "./publication-my";

export const ContentMY = (props) => {
    const {
        slug: publicationSlug,
        tgChatName,
        tgChatId,
        tgMessageId,
        plus,
        minus,
        sum: initialSum,
        currency,
        inMerits,
        messageText,
        authorPhotoUrl,
        tgAuthorName,
        ts,
        keyword,
        updateAll,
        updateWalletBalance,
        transactionId,
        wallets,
        currencyOfCommunityTgChatId,
        fromTgChatId,
        activeWithdrawPost,
        setActiveWithdrawPost,
    } = props;
    
    // Local state to track optimistic sum updates
    const [optimisticSum, setOptimisticSum] = useState(initialSum);
    const sum = optimisticSum ?? initialSum;
    
    // Update optimistic sum when initial sum changes (on mount or parent update)
    useEffect(() => {
        setOptimisticSum(initialSum);
    }, [initialSum]);
    const curr = currencyOfCommunityTgChatId || fromTgChatId;
    const currentBalance =
        (wallets &&
            wallets.find((w) => w.currencyOfCommunityTgChatId == curr)
                ?.amount) ||
        0;
    const isMerit = tgChatId === GLOBAL_FEED_TG_CHAT_ID;
    const [showselector, setShowselector] = useState(false);
    useEffect(() => {
        if (document.location.search.match("show")) setShowselector(true);
    }, []);

    const [rate] = swr(
        () => !isMerit && "/api/rest/rate?fromCurrency=" + tgChatId,
        0,
        { key: "rate", revalidateOnFocus: false }
    );

    // Create a unique identifier for this post
    const postId = publicationSlug || transactionId;
    
    // Parse the activeWithdrawPost to get post ID and direction
    const isThisPostActive = activeWithdrawPost && activeWithdrawPost.startsWith(postId + ':');
    const directionAdd = isThisPostActive 
        ? activeWithdrawPost === postId + ':add' 
        : undefined;
    
    const [amount, setAmount] = useState(0);
    const [comment, setComment] = useState("");
    const [amountInMerits, setAmountInMerits] = useState(0);
    const [withdrawMerits, setWithdrawMerits] = useState(isMerit);
    const [loading, setLoading] = useState(false);
    const doWhat = directionAdd ? "Добавить" : "Снять";
    const disabled = withdrawMerits ? !amountInMerits : !amount;
    const submit = async () => {
        setLoading(true);
        
        // Calculate the change in balance (in community points)
        const changeAmount = amount; // The slider always sets 'amount' which is in community points
        
        // Optimistically update the post sum immediately
        const newSum = directionAdd 
            ? optimisticSum + changeAmount  // Adding to post increases post balance
            : optimisticSum - changeAmount; // Withdrawing from post decreases post balance
        
        setOptimisticSum(newSum);
        
        // Optimistically update the wallet balance immediately (inverse of post change)
        const walletChange = directionAdd 
            ? -changeAmount  // Adding to post decreases wallet balance
            : changeAmount;  // Withdrawing from post increases wallet balance
        
        if (updateWalletBalance && curr) {
            updateWalletBalance(curr, walletChange);
        }
        
        try {
            await Axios.post("/api/rest/withdraw", {
                publicationSlug,
                transactionId,
                amount: withdrawMerits ? amountInMerits : amount,
                currency: withdrawMerits ? "merit" : currency,
                directionAdd,
                withdrawMerits,
                comment,
                amountInternal: withdrawMerits
                    ? rate > 0
                        ? amountInMerits / rate
                        : 0
                    : amount,
            });
            
            // Reset form state after successful withdrawal
            setAmount(0);
            setAmountInMerits(0);
            setComment("");
            
            // Close slider (no need to reload data)
            await updateAll();
        } catch (error) {
            console.error("Withdrawal failed:", error);
            // Revert optimistic updates on error
            setOptimisticSum(initialSum);
            if (updateWalletBalance && curr) {
                updateWalletBalance(curr, -walletChange); // Revert wallet change
            }
        } finally {
            setLoading(false);
        }
    };
    const meritsAmount =
        Math.floor(10 * (withdrawMerits ? rate * sum : sum)) / 10;

    const maxWithdrawAmount =
        Math.floor(10 * (withdrawMerits ? rate * sum : sum)) / 10;

    const maxTopUpAmount =
        Math.floor(
            10 * (withdrawMerits ? rate * currentBalance : currentBalance)
        ) / 10;

    // Create a wrapper function that handles the centralized state
    const handleSetDirectionAdd = (direction: boolean | undefined) => {
        if (direction === undefined) {
            // Close the slider
            setActiveWithdrawPost(null);
        } else {
            const newState = postId + ':' + (direction ? 'add' : 'withdraw');
            // Toggle: if clicking the same button again, close it
            if (activeWithdrawPost === newState) {
                setActiveWithdrawPost(null);
            } else {
                setActiveWithdrawPost(newState);
            }
        }
    };

    const params = {
        setDirectionAdd: handleSetDirectionAdd,
        meritsAmount,
        showselector,
        withdrawMerits,
        transactionId,

        setWithdrawMerits,
    };

    // Render the withdraw slider content
    const withdrawSliderContent = directionAdd !== undefined && (
        <>
            {withdrawMerits &&
                (loading ? (
                    <Spinner />
                ) : (
                    <FormWithdraw
                        comment={comment}
                        setComment={setComment}
                        amount={amount}
                        setAmount={setAmount}
                        maxWithdrawAmount={maxWithdrawAmount}
                        maxTopUpAmount={maxTopUpAmount}
                        isWithdrawal={!directionAdd}
                        onSubmit={() => !disabled && submit()}
                    >
                        <div>
                            {doWhat} меритов: {amount}
                        </div>
                    </FormWithdraw>
                ))}

            {!withdrawMerits &&
                (loading ? (
                    <Spinner />
                ) : (
                    <FormWithdraw
                        comment={comment}
                        setComment={setComment}
                        amount={amount}
                        setAmount={setAmount}
                        maxWithdrawAmount={maxWithdrawAmount}
                        maxTopUpAmount={maxTopUpAmount}
                        isWithdrawal={!directionAdd}
                        onSubmit={() => !disabled && submit()}
                    >
                        <div>
                            {doWhat} баллов сообщества: {amount}
                        </div>
                    </FormWithdraw>
                ))}
        </>
    );

    return (
        <>
            {publicationSlug && (
                <PublicationMy 
                    {...props} 
                    {...params} 
                    showCommunityAvatar={props.showCommunityAvatar}
                    withdrawSliderContent={withdrawSliderContent}
                />
            )}
            {!publicationSlug && (
                <CommentMy 
                    {...props} 
                    {...params} 
                    showCommunityAvatar={props.showCommunityAvatar}
                    withdrawSliderContent={withdrawSliderContent}
                />
            )}
        </>
    );
};

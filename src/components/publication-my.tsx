import { CardPublication } from "../frontend/card-publication";
import { dateVerbose } from "../projects/meriter/utils/date";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "../bots/telegram/telegramapi";
import { BarWithdraw } from "../frontend/bar-withdraw";
import { WithTelegramEntities } from "./withTelegramEntities";

export const PublicationMy = ({
    slug: publicationSlug,
    tgChatName,
    tgChatId,
    tgMessageId,
    plus,
    minus,
    sum,
    currency,
    inMerits,
    messageText,
    authorPhotoUrl,
    tgAuthorName,
    ts,
    keyword,
    updateAll,
    setDirectionAdd,
    meritsAmount,
    showselector,
    withdrawMerits,
    setWithdrawMerits,
    tgAuthorId,
    entities,
}: any) => {
    console.log(publicationSlug, setDirectionAdd);
    return (
        <CardPublication
            title={tgAuthorName}
            subtitle={dateVerbose(ts)}
            avatarUrl={authorPhotoUrl ?? telegramGetAvatarLink(tgAuthorId)}
            onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
            description={"#" + keyword}
            onClick={() => setDirectionAdd(false)}
            onDescriptionClick={() => {}}
            bottom={
                <BarWithdraw
                    balance={meritsAmount}
                    onWithdraw={() => setDirectionAdd(false)}
                    onTopup={() => setDirectionAdd(true)}
                >
                    {showselector && (
                        <div className="select-currency">
                            <span
                                className={
                                    !withdrawMerits
                                        ? "clickable bar-withdraw-select"
                                        : "bar-withdraw-select-active"
                                }
                                onClick={() => setWithdrawMerits(true)}
                            >
                                Мериты{" "}
                            </span>
                            <span
                                className={
                                    withdrawMerits
                                        ? "clickable bar-withdraw-select"
                                        : "bar-withdraw-select-active"
                                }
                                onClick={() => setWithdrawMerits(false)}
                            >
                                Баллы
                            </span>
                        </div>
                    )}
                </BarWithdraw>
            }
        >
            <WithTelegramEntities entities={entities}>
                {messageText}
            </WithTelegramEntities>
        </CardPublication>
    );
};

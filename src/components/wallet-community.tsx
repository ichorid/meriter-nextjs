import { swr } from "../utils/swr";
import { CardWithAvatar } from "../frontend/card-with-avatar";

export const WalletCommunity = ({
    amount,
    currencyNames,
    currencyOfCommunityTgChatId,
    tgUserId,
}) => {
    const [info] = swr(
        "/api/rest/communityinfo?chatId=" + currencyOfCommunityTgChatId,
        {},
        { revalidateOnFocus: false }
    );

    const title = info?.chat?.title;
    const icon = info?.icon;
    const tags = info?.chat?.tags;
    if (!title) return null;
    return (
        <CardWithAvatar
            iconUrl={"/meriter/1468522.svg"}
            iconOnClick={() =>
                (document.location.href = "/mt/c/" + info?.chat?.chatId)
            }
        >
            <div className="title">{title}</div>
            <div className="amount">
                <img src={icon} className="currency-icon" />
                {amount}
            </div>
            <div className="description">
                {tags && tags.map((t) => "#" + t).join(" ")}
            </div>
        </CardWithAvatar>
    );
};

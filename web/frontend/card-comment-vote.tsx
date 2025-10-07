import { classList } from "utils/classList";

export const CardCommentVote = ({
    title,
    subtitle,
    avatarUrl,
    rate,
    content,
    bottom,
    onClick,
    onAvatarUrlNotFound
}:any) => (
    <div className="card-comment-vote-outer">
        <div className="card-comment-vote">
            <div className="rate">{rate}</div>
            <div className="inner">
                <div className="header">
                    <div className="author">
                        <div className="avatar">
                            <img src={avatarUrl} onError={onAvatarUrlNotFound}/>
                        </div>
                        <div className="info">
                            <div className="title">{title}</div>
                            <div className="subtitle">{subtitle}</div>
                        </div>
                    </div>
                </div>
                <div className="content">{content}</div>
                <div className="bottom">{bottom}</div>
            </div>
        </div>
        {false && <div className="line-shadow" style={{ width: "100%" }}></div>}
    </div>
);

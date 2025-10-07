import { classList } from 'utils/classList'

export const WidgetAvatarBalance = ({ title, subtitle, description, avatarUrl, children, bottom }) => (
    <div className="card-publication">
        <div className="inner">
            <div className="header">
                <div className="author">
                    <div className="avatar">
                        <img src={avatarUrl} />
                    </div>
                    <div className="info">
                        <div className="title">{title}</div>
                        <div className="subtitle">{subtitle}</div>
                    </div>
                </div>
                <div className="description">{description}</div>
            </div>
            <div className="content">{children}</div>
            <div className="bottom">{bottom}</div>
        </div>
    </div>
)

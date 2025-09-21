export const BarWithdraw = ({ onWithdraw, onTopup, balance, children }) => (
    <div className="bar-withdraw">
        <div className="left-info">{children}</div>
        <div className="withdraw-widget clickable" onClick={onWithdraw}>
            <span className="withdraw clickable">%</span>
            <span className="count">{balance ?? 0}</span>
            {false && (
                <span className="topup clickable" onClick={onTopup}>
                    <img src="/meriter/uparrow.svg"></img>
                </span>
            )}
        </div>
    </div>
);

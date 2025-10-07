import Link from "next/link";

export const MenuBreadcrumbs = ({
    pathname,
    chatId,
    tagRus,
    chatNameVerb,
    children,
}: any) => {
    const path = pathname && pathname.split("/");
    let spaceSlug = path && path[1] !== "c" && path[1];
    let publication = path && path[1] !== "c" && path[2];
    return (
        <div className="menu-breadcrumbs">
            <div style={{ display: "none" }}>
                <a href="/">@главная</a>
            </div>
            {chatId && (
                <div>
                    <img
                        style={{
                            height: "1.1em",
                            marginBottom: "-0.2em",
                            marginRight: "-0.1em",
                        }}
                        src={"/meriter/home.svg"}
                    />
                    <Link href={"/mt/c/" + chatId}>{chatNameVerb}</Link>
                </div>
            )}
            {spaceSlug && (
                <div>
                    <Link href={"/mt/" + spaceSlug}>{"#" + tagRus}</Link>
                </div>
            )}
            {publication && <div>/ публикация</div>}
            {children}
        </div>
    );
};

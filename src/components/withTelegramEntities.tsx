const linebr = (text) => {
    return text
        .split("\n")
        .map((t) => [t, <br />])
        .flat()
        .slice(0, -1);
};

export const WithTelegramEntities = ({
    entities,
    children,
}: {
    entities: {
        type: string;
        offset: number;
        length: number;
        url?: string;
        user_id?: string;
    }[];
    children: string;
}) => {
    const messageText = children;
    function onlyUnique(value, index, self) {
        return self.indexOf(value) === index;
    }

    const activeEntities =
        entities?.filter(
            (e) =>
                e.type == "bold" ||
                e.type == "italic" ||
                e.type == "url" ||
                e.type == "text_url"
        ) ?? [];
    let points = [
        0,
        messageText.length,
        ...activeEntities.map((e) => [e.offset, e.offset + e.length]).flat(),
    ];

    points?.sort((a, b) => (a < b ? -1 : 1));

    let segments = points
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((p, idx, array) => (idx > 0 ? [array[idx - 1], p] : undefined))
        .filter((a) => a !== undefined);

    if (activeEntities.length > 0)
        console.log("AE", activeEntities, segments, messageText);
    const decorated = segments.map(([start, end]) => {
        const type = activeEntities.find((e) => e.offset === start)?.type;
        if (!type) return <>{linebr(messageText.substring(start, end))}</>;
        if (type === "bold") {
            return <b>{linebr(messageText.substring(start, end))}</b>;
        }
        if (type === "italic") {
            return <em>{linebr(messageText.substring(start, end))}</em>;
        }
        if (type === "url") {
            return (
                <a
                    style={{ wordWrap: "break-word" }}
                    href={messageText.substring(start, end)}
                >
                    {linebr(messageText.substring(start, end))}
                </a>
            );
        }
        if (type === "text_url") {
            const ent = activeEntities.find((e) => e.offset === start);
            return (
                <a style={{ wordWrap: "break-word" }} href={ent?.url}>
                    {linebr(messageText.substring(start, end))}
                </a>
            );
        }
    });

    return <div className={"tttt"}>{decorated}</div>;
};

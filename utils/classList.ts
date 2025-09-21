export const classList = (
    ...classes: (string | { [key: string]: boolean })[]
) => {
    return (
        classes &&
        classes
            .filter((cls) => cls !== undefined)
            .map((cls) =>
                typeof cls == "object"
                    ? cls[Object.keys(cls)[0]]
                        ? Object.keys(cls)[0]
                        : "undefined"
                    : cls
            )
            .filter((c) => c != "undefined")
            .map((c) => String(c).toLowerCase())
            .join(" ")
    );
};

export function fillDefined(obj) {
    return Object.entries(obj).reduce((obj, cur) => {
        if (typeof cur[1] !== "undefined" && cur[0] !== "undefined") obj[cur[0]] = cur[1];

        return obj;
    }, {});
}

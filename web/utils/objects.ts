export const booleany = function (str) {
    if (str == 'true') return true
    if (str == 'false') return false
    else return str
}

export const objectDeepModify = function (
    obj,
    mapObject = (path) => (objEntries) => objEntries,
    filterObject = (path) => (objEntries) => objEntries,
    strFn = (str) => str,
    path = ''
) {
    if (obj && typeof obj == 'object') {
        //console.log("got obj", obj);
        if (Array.isArray(obj)) return obj.map((r, i) => objectDeepModify(r, mapObject, filterObject, strFn, `${path}/${i}`))
        else
            return Object.fromEntries(
                Object.entries(obj)
                    .map(mapObject(path))
                    .filter(filterObject(path))
                    .map(([k, v]) => [k, objectDeepModify(v, mapObject, filterObject, strFn, `${path}/${k}`)])
            )
    } else if (obj && typeof obj == 'string') return strFn(obj)
    else return obj
}

export const objectAddress = function (obj, address = []) {
    if (address.length > 0) {
        if (address[0] === '') return objectAddress(obj, address.slice(1))
        //support of "/" at start of the path
        else return objectAddress(obj[address[0]], address.slice(1))
    } else return obj
}

export const objectExceptKeys = function (obj, keys = []) {
    let o = { ...obj }
    for (let key of keys) {
        delete o[key]
    }
    return o
}

export const objectSelectKeys = function (obj, keys = []) {
    let o = {}
    for (let key of keys) {
        o[key] = obj[key]
    }
    return o
}

export function objectDeepFind(obj, fn) {
    let found = false
    Object.entries(obj).forEach(([k, v]) => {
        if (fn(k, v)) found = true
        if (typeof v === 'object' && objectDeepFind(v, fn)) found = true
    })
    return found
}

export function fillDefined(obj) {
    return Object.entries(obj).reduce((obj, cur) => {
        if (typeof cur[1] !== 'undefined' && cur[0] !== 'undefined') obj[cur[0]] = cur[1]

        return obj
    }, {})
}

export function objectDeepSubst(obj: object, params: object) {
    if (Array.isArray(obj)) {
        return obj.map((o) => objectDeepSubst(o, params))
    }

    if (typeof obj === 'object') {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, objectDeepSubst(v, params)]))
    }

    if (typeof obj === 'string') {
        return strSubst(obj, params)
    }

    if (obj === undefined) return {}

    return obj
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}
export function strSubst(str: string, params: object) {
    let newStr = str
    let retObj

    Object.entries(params).forEach(([from, to]) => {
        if (typeof to === 'object' && str.match(escapeRegExp(from))) {
            retObj = to
            return null
        }
        newStr = newStr.replace(from, to)
    })
    if (retObj) return retObj
    return newStr
}

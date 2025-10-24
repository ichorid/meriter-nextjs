export const booleany = function (str: string | boolean): string | boolean {
    if (str === 'true') return true
    if (str === 'false') return false
    return str
}

export const objectDeepModify = function (
    obj: any,
    mapObject: (path: string) => (objEntries: any) => any = (path) => (objEntries) => objEntries,
    filterObject: (path: string) => (objEntries: any) => any = (path) => (objEntries) => objEntries,
    strFn: (str: string) => string = (str) => str,
    path: string = ''
): any {
    if (obj && typeof obj == 'object') {
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

export const objectAddress = function (obj: any, address: string[] = []): any {
    if (address.length > 0) {
        if (address[0] === '') return objectAddress(obj, address.slice(1))
        //support of "/" at start of the path
        else return objectAddress(obj[address[0]!], address.slice(1))
    } else return obj
}

export const objectExceptKeys = function <T extends Record<string, any>>(obj: T, keys: string[] = []): Partial<T> {
    const o = { ...obj }
    for (const key of keys) {
        delete o[key]
    }
    return o
}

export const objectSelectKeys = function <T extends Record<string, any>>(obj: T, keys: string[] = []): Partial<T> {
    const o: any = {}
    for (const key of keys) {
        o[key] = obj[key]
    }
    return o
}

export function objectDeepFind(obj: Record<string, any>, fn: (key: string, value: any) => boolean): boolean {
    let found = false
    Object.entries(obj).forEach(([k, v]) => {
        if (fn(k, v)) found = true
        if (typeof v === 'object' && v !== null && objectDeepFind(v, fn)) found = true
    })
    return found
}

export function fillDefined<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.entries(obj).reduce((acc, cur) => {
        if (typeof cur[1] !== 'undefined' && cur[0] !== 'undefined') acc[cur[0]] = cur[1]

        return acc
    }, {} as any)
}

export function fillDefinedAndNotEmpty<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.entries(obj).reduce((acc, cur) => {
        if (
            typeof cur[1] !== 'undefined' &&
            cur[0] !== 'undefined' &&
            cur[1] !== ''
        )
            acc[cur[0]] = cur[1]

        return acc
    }, {} as any)
}

export function objectDeepSubst(obj: object, params: object): any {
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

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}
export function strSubst(str: string, params: Record<string, any>): any {
    let newStr = str
    let retObj: any = null

    Object.entries(params).forEach(([from, to]) => {
        if (typeof to === 'object' && str.match(escapeRegExp(from))) {
            retObj = to
            return
        }
        newStr = newStr.replace(from, to as string)
    })
    if (retObj) return retObj
    return newStr
}

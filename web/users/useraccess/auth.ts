import cookie from 'cookie'
import { NextApiRequest, NextApiResponse } from 'next'
import { sign, verify } from 'jsonwebtoken'
import { UserAccess } from './useraccess.model'
import { fillDefined } from 'utils/object'
import { mongooseTypes, uuid } from 'utils/mongooseconnect'
import { uid } from 'uid'

import { linkSet } from 'transactions/links/links'
import { IUserAccess } from './useraccess.type'

// JWT_SECRET should be set via environment variable
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'afdasdfubqi4tb2i4bpadfs132'; // fallback for development only
}

export async function userAccessCreate(query) {
    const token = uid(32)
    const newUserAccess = {
        token,
        query,
    }
    await (UserAccess as any).create(newUserAccess)
    return newUserAccess
}

export async function userAccessCreateJWT(query) {
    const access = await (UserAccess as any).findOne(query)
    if (access) return sign(access)

    return sign(await userAccessCreate(query))
}

export async function userAccessCreateLink(query, redirect) {
    const jwt = await userAccessCreateJWT(query)
    return await linkSet(
        {
            action: 'setCookie',
            jwt,
            redirect,
        },
        600
    )
}

export function getFromCookiesOrRequest(req: NextApiRequest, key: string) {
    if (req?.query?.[key]) return req.query[key]
    if (req?.body?.[key]) return req.body[key]

    const cdata = req.headers?.cookie || req.headers?.Cookie
    if (!cdata) return false

    const c = cookie.parse(cdata ?? '')
    if (!c[key]) return false

    return String(c[key])
}

export function getToken(req: NextApiRequest) {
    return getFromCookiesOrRequest(req, 'token')
}

export function getJWT(req: NextApiRequest) {
    return getFromCookiesOrRequest(req, 'jwt')
}

export function signJWT(payload: object, expiresIn = undefined) {
    return sign(payload, process.env.JWT_SECRET, expiresIn && { expiresIn })
}

export function verifyJWT(jwt: string) {
    return verify(jwt, process.env.JWT_SECRET)
}

function nextRedirect(ctx, redirectUrl) {
    ctx.res.writeHead(302, { Location: redirectUrl })
    ctx.res.end()
    return false
}

export function restrictAccessJWT(ctx, access: string, redirectUrl: string): Boolean | Object {
    const jwt = getJWT(ctx.req)

    try {
        const payload = verifyJWT(jwt)
        if (!payload?.priveleges) return nextRedirect(ctx, redirectUrl)
        const { permissions } = payload
    } catch (e) {
        return false
    }
}

export default function checkTags(tags: string[], allowTags: string[], rejectTags: string[]) {
    let pass = true
    if (allowTags) {
        pass = tags.find((t) => allowTags.includes(t)) ? true : false
    }

    if (rejectTags) {
        pass = pass && !tags.find((t) => rejectTags.includes(t)) ? true : false
    }
    return pass
}
/*
export async function createAuth(res: NextApiResponse, useraccess: IUserAccess) {
    const newUserId = new mongooseTypes.ObjectId()

    const newUserAccess = { ...useraccess, _id: newUserId, uuid: uuid() }
    const user = await (UserAccess as any).create(newUserAccess)
    return signJWT(newUserAccess)

    if (!user) throw 'no such user'

    return signJWT(fillDefined({ ...user.toObject(), id: user._id, _id: undefined })) as IUserAccess
}*/

export async function createAuth(res: NextApiResponse, useraccess: IUserAccess) {
    const jwt = signJWT(useraccess)
    setCookie(res, 'jwt', jwt)
    return jwt
}

export async function getAuth(req: NextApiRequest, res: NextApiResponse) {
    let [jwt, token] = [getJWT(req), getToken(req)]

    if (!jwt && !token) return null

    if (jwt) {
        let userData = {}
        try {
            userData = verifyJWT(jwt)
        } catch (e) {
            console.log(e)
        }
        return userData as IUserAccess
    }

    return null
}

export function setCookie(res: NextApiResponse, key: string, val: string) {
    res.setHeader('Set-Cookie', key + '=' + val + ';Path=/;Expires=Wed, 30 Aug 2029 00:00:00 GMT')
}

export const useraccessCreateByEmail = async (res, email) => {
    const access = await (UserAccess as any).findOne({ email })
    if (!access) throw 'validatecode: user acces not found'
    await createAuth(res, access.toObject())
    return access.toObject()
}

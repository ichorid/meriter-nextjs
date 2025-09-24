import { telegramSendMessage, telegramSendMessageFromScope } from 'bots/telegram/telegramapi'
import { NextApiRequest, NextApiResponse } from 'next'
import { linkSet } from 'transactions/links/links'
import uid from 'uid'
import {
    createAuth,
    getAuth,
    signJWT,
    useraccessCreateByEmail,
    userAccessSendConfirmation,
    userAccessValidateCode,
} from 'users/useraccess/auth'
import { Userdata } from 'users/userdata/userdata.model'
import { fillDefined, fillDefinedAndNotEmpty } from 'utils/object'
import { noMongoInjection } from 'utils/security'
import { UserAccess } from './useraccess/useraccess.model'
import { IUserdata } from './userdata/userdata.type'
import { UserTag } from './usertags/usertag.model'
import { usertagsSubscribe } from './usertags/usertags'
import { usertagsSetTag } from './usertags/usertags.handler'

export const userHandler = async (req: NextApiRequest, res: NextApiResponse) => {
    noMongoInjection(req, res)
    const { actions } = req.query
    const [action, param] = actions as string[]

    if (action === 'getme') {
        const user = await getAuth(req, res)
        if (!user) return res.json({})
        const { scope, allowTagsOr } = req.query
        const { email, phone } = user
        const userdata = await Userdata.findOne(fillDefined({ email, phone, scope }))
        
        let priveleges = []
        if (allowTagsOr) {
            const allowTagsOrArray = JSON.parse(allowTagsOr as string).map((a) => String(a))
            const allowTags = await UserTag.find({ token: user.token, tag: { $in: allowTagsOrArray } })
            priveleges = allowTags.map((t) => t.tag)
        }
        return res.json({ ...user, ...(userdata ? userdata.toObject() : {}), priveleges })
    }

    if (action === 'usertagsSetOwnTagWithPayload') {
        const user = await getAuth(req, res)
        const { tag, payload } = req.body
        if (!user) return res.status(403).json({ error: 'no user' })
        if (!tag) return res.status(400).json({ error: 'no tag' })
        if (String(tag).match('\\$')) return res.status(400).json({ error: 'bad tag' })
        const tagset = await usertagsSetTag(user, tag)
        const payloadset = await Userdata.create({ ts: Date.now(), payload, token: user.token, scope: tag } as IUserdata)
        if (tagset?.error) return res.json({ tagset })
        return res.json({ ok: true, tag })
    }

    if (action === 'usertagsGetOwnTagPayload') {
        const user = await getAuth(req, res)
        const { tag } = req.query
        if (!user) return res.status(403).json({ error: 'no user' })
        const payloads = await Userdata.find({ token: user.token, scope: tag } as IUserdata)
            .sort({ ts: -1 })
            .limit(1)
        if (payloads?.length == 1) return res.json({ ...payloads[0].toObject() })
        else return res.json({})
    }

    if (action === 'hasnameonscope') {
        const { email: _email, scope } = req.query
        const email = String(_email).toLowerCase()

        const hasnameonscope = await Userdata.countDocuments(fillDefined({ email, scope, firstName: { $exists: true } }))
        return res.json({ count: hasnameonscope })
    }
    if (action === 'checkmytag') {
        const user = await getAuth(req, res)
        if (!user) res.status(403).json({})
        const { tag } = req.query

        const hastag = await UserTag.countDocuments({ tag, token: user.token })

        return res.json({ hastag })
    }

    if (action === 'hasmesssengeronscope') {
        const { email: _email, scope } = req.query
        const email = String(_email).toLowerCase()
        const hastelegramonscope = await Userdata.countDocuments(fillDefined({ email, scope, telegramUserId: { $exists: true } }))
        if (hastelegramonscope) return res.json({ messenger: 'telegram' })
        else res.json({})
    }

    if (action === 'sendcode') {
        const { email, scope } = req.query
        return res.json(await userAccessSendConfirmation(email, scope))
    }

    if (action === 'validatecode') {
        const { email: _email, checkId, code } = req.query
        const email = String(_email).toLowerCase()
        const valid = await userAccessValidateCode(email, checkId, code)
        if (valid) {
            const user = await useraccessCreateByEmail(res, email)
            return res.json({ ok: true, user })
        } else return res.json({ error: 'wrong code' })
    }

    if (action === 'subscribe') {
        noMongoInjection(req, res)
        //await UserAccess.collection.dropIndex({phone:1});
        const { email: _email, scope, tags, firstName:firstNameInit, lastName:lastNameInit, phone, utm } = req.body
        const firstName=firstNameInit.split(' ')?.[0];
        const lastName=lastNameInit??firstNameInit?.split(' ')?.[1]??undefined;
        const email = String(_email).toLowerCase()
        if (!email) return res.status(400).json({})
        if (!scope) return res.status(400).json({})
        const extuser = await UserAccess.countDocuments({ $or: [{ email }, { phone }] })
        await usertagsSubscribe(email, scope, tags, firstName, lastName, phone, undefined, utm)
        if (!extuser) {
            const user = await useraccessCreateByEmail(res, email)
            return res.json({ ok: true, user })
        }
        return res.json({ ok: true })
    }

    if (action === 'adminFindByPhone') {
        const users = await UserAccess.find({ phone: { $regex: req.query.phone } })
        return res.json({ users })
    }

    if (action === 'adminFindByLastName') {
        const users = await UserAccess.find({ lastName: { $regex: req.query.lastName } })
        const userdata = await Userdata.find({ lastName: { $regex: req.query.lastName } })
        return res.json({ users, userdata })
    }

    if (action === 'adminFindByToken') {
        const users = await UserAccess.find({ token: req.query.token })
        const userdata = await Userdata.find({ token: req.query.token })
        const usertags = await UserTag.find({ token: req.query.token })
        return res.json({ users, userdata, usertags })
    }
    if (action === 'adminFindByEmail') {
        const users = await UserAccess.find({ email: req.query.email })
        const userdata = await Userdata.find({ email: req.query.email })
        const usertags = await UserTag.find({ email: req.query.email })
        return res.json({ users, userdata, usertags })
    }

    if (action === 'adminSetUserTagOnce') {
        const { tag, token } = req.query
        if (!(tag && token)) return res.status(400).json({})
        if ((await UserTag.countDocuments({ token, tag })) > 0) return res.json({ error: 'already set' })
        const access = await UserAccess.findOne({ token })
        const userdata = await Userdata.findOne({ token })
        if (!(access && userdata)) return res.status(404).json({ error: 'not found' })
        await usertagsSetTag({ ...access.toObject(), ...userdata.toObject() }, tag, true)
        return res.json({ ok: true })
    }
    if (action === 'adminTagList') {
        const usersTags = await UserTag.aggregate([
            {
                $match: {},
            },
            {
                $group: {
                    _id: '$token',
                    token: { $first: '$token' },
                    tags: { $push: '$tag' },
                },
            },
        ])
        const tagsUsers = await UserTag.aggregate([
            {
                $match: {},
            },
            {
                $group: {
                    _id: '$tag',
                    tag: { $first: '$tag' },
                    tags: { $push: '$token' },
                },
            },
        ])
        const userTokens = usersTags.map((u) => u.token)
        const users = await UserAccess.find({ token: { $in: userTokens } }, 'email phone telegram_id')

        return res.json({
            users,
            usersTags,
            tagsUsers,
        })
    }
    if (action === 'admin_useraccess') {
        const user = await getAuth(req, res)
        const useraccess = await UserAccess.find({})
        return res.json({ useraccess, user })
    }
    if (action === 'admin_useraccess_delete') {
        const user = await getAuth(req, res)

        await UserAccess.deleteMany({ _id: req.query._id })
        const useraccess = await UserAccess.find({})
        return res.json({ useraccess, user })
    }

    if (action === 'admin_mytags') {
        const user = await getAuth(req, res)
        if (!user) return res.json({})
        const usertags = await UserTag.find({ token: user.token })
        return res.json({ usertags, user })
    }

    if (action === 'admin_userdata') {
        const userdata = await Userdata.find({})
        const count = await Userdata.countDocuments({})
        return res.json({ count, userdata })
    }
    if (action === 'admin_createaccesslink') {
        const { email, redirect } = req.query
        const access = await UserAccess.findOne({ email })
        if (!access) return res.json({ error: 'no such user' })
        const link = await linkSet(
            {
                action: 'setCookie',
                redirect: redirect || 'https://sevaprem.com/course',
                jwt: signJWT(access.toObject()),
            },
            60 * 60 * 24
        )
        return res.json({ link })
    }

    return res.json({ noaction: true, action })
}

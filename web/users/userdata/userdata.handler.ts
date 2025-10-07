import { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from 'users/useraccess/auth'
import { fillDefined } from 'utils/object'
import { noMongoInjection } from 'utils/security'
import { userdataGetByTelegramId } from './userdata'
import { Userdata } from './userdata.model'
import { IUserdata } from './userdata.type'

export const userdataHandler = async (req: NextApiRequest, res: NextApiResponse) => {
    const { action } = req.query

    if (action === 'userdataGetByTelegramId') {
        return res.json({ userdata: await userdataGetByTelegramId(req.query.telegramUserId as string) })
    }
    if (action === 'getme') {
        noMongoInjection(req, res)
        const user = await getAuth(req, res)
        if (!user) return {}
        const { scope } = req.query
        const { email, phone } = user

        const userdata = await (Userdata as any).findOne(fillDefined({ email, phone, scope }))
        return res.json({ ...user, ...userdata })
    }
    if (action === 'userdataAdd') {
        noMongoInjection(req, res)
        const user = await getAuth(req, res)

        const { name: firstName, lastName, phone, scope } = req.body
        if (!user.token) res.status(403).json({})

        const addUserdata = { token: user.token, firstName, lastName, phone } as IUserdata

        await (Userdata as any).create({ token: user.token, firstName, lastName, phone })

        return res.json({ ...user, ...addUserdata })
    }
    return res.json({ noaction: true })
}

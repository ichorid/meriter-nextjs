import uid from 'uid'
import { UserAccess } from 'users/useraccess/useraccess.model'
import { Userdata } from 'users/userdata/userdata.model'
import { fillDefined, fillDefinedAndNotEmpty } from 'utils/object'
import { usertagsSetTag } from './usertags.handler'

export async function usertagsSubscribe(email, scope, tags, firstName, lastName, phone, chat_id = undefined, utm = undefined) {
    let newToken = uid(32)
    let access = await UserAccess.findOneAndUpdate(
        { $or: [{ email }, { phone }] },
        fillDefinedAndNotEmpty({
            email,
            phone,
            telegram_id: chat_id,
            $addToSet: fillDefined({
                emails: email,
                phones: phone,
                telegram_ids: chat_id,
                utms: utm ? { utm, ts: Date.now() } : undefined,
            }),
            $setOnInsert: { token: newToken },
        }),
        { upsert: true, new: true }
    )
    if (!access.token)
        access = await UserAccess.findOneAndUpdate({ $or: [{ email }, { phone }] }, fillDefined({ token: newToken, telegram_id: chat_id }))

    const userdataNew = fillDefinedAndNotEmpty({ email, scope, firstName, lastName, phone, token: access.token, telegramUserId: chat_id })
    const userdata = await Userdata.findOneAndUpdate({ phone, scope, email }, userdataNew, { upsert: true, new: true })
    console.log('found or created access', access)
    if (tags && tags.length)
        await Promise.all(
            tags.map((tag) => {
                console.log('set tag', tag)
                usertagsSetTag({ ...access.toObject(), ...userdata.toObject() }, tag, true)
            })
        )
}

import { getAuth } from 'projects/meriter/utils/auth'
import { tgGetChat } from 'projects/meriter/actions/telegram'
import { TgChat } from 'projects/meriter/schema/index.schema'
import { fillDefined } from 'utils/object'

export default async (req, res) => {
    const { chatId } = req.query
    const chat: any = await (TgChat as any).findOne({ chatId })

    res.json({ chat })
}

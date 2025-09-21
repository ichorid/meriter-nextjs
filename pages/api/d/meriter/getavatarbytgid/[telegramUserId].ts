import { TgChat } from 'projects/meriter/schema/index.schema'
import { Userdata } from 'users/userdata/userdata.model'

export default async (req, res) => {
    const { telegramUserId } = req.query
    const userdata = await Userdata.findOne({ telegramUserId })
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.json({ avatarUrl: userdata?.avatarUrl })
}

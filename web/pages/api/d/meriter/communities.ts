import { TgChat } from 'projects/meriter/schema/index.schema'

export default async (req, res) => {
    const communities = await (TgChat as any).find({})
    res.json({ ok: 'ok', communities })
}

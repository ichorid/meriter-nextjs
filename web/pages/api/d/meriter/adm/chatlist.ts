import { TgChat } from 'projects/meriter/schema/index.schema'

export default async (req, res) => {
    //const user = await getAuth(req, res);
    const chats = await (TgChat as any).find({})
    // console.log(await (Publication as any).find({}));
    res.json({ ok: 'ok', chats })
}

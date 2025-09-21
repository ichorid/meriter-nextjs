import { TgChat } from 'projects/meriter/schema/index.schema'

export default async (req, res) => {
    //const user = await getAuth(req, res);
    const chats = await TgChat.find({})
    // console.log(await Publication.find({}));
    res.json({ ok: 'ok', chats })
}

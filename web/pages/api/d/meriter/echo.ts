import { Publication } from 'projects/meriter/schema/index.schema'

export default async (req, res) => {
    //const user = await getAuth(req, res);
    console.dir(req.body)
    // console.log(await (Publication as any).find({}));
    res.json({ ok: 'ok' })
}

import { NextApiRequest, NextApiResponse } from 'next'
import { mongooseTypes } from '@lib/mongooseconnect'
import { noMongoInjection } from '@lib/security'
import { PublicationElement } from './publication.model'
import { IPublicationElement } from './publication.type'
export const handlerPublications = async (req: NextApiRequest, res: NextApiResponse) => {
    noMongoInjection(req, res)
    const { actions } = req.query
    const [action, param] = actions as string[]
    if (action === 'list') {
        return res.json({ publications: await (PublicationElement as any).find({}).sort({ ts: -1 }) })
    }

    if (action === 'update') {
        if (req.body._id) return res.json(await (PublicationElement as any).updateOne({ _id: req.body._id }, req.body as IPublicationElement))
        else {
            const _id = new mongooseTypes.ObjectId()
            await (PublicationElement as any).create({ ...req.body, _id, ts: Date.now() } as IPublicationElement)
            return res.json({ _id })
        }
    }
    return res.status(404)
}

import { NextApiRequest, NextApiResponse } from 'next'
import { mongooseTypes } from 'utils/mongooseconnect'
import { Model } from 'mongoose'
import { noMongoInjection } from 'utils/security'
import { PublicationElement } from './publication.model'
import { IPublicationElement } from './publication.type'
export const handlerPublications = async (req: NextApiRequest, res: NextApiResponse) => {
    noMongoInjection(req, res)
    const { actions } = req.query
    const [action, param] = actions as string[]
    if (action === 'list') {
        return res.json({
            publications: await (PublicationElement as Model<IPublicationElement>).find({}).sort({ ts: -1 }),
        })
    }

    if (action === 'update') {
        if (req.body._id)
            return res.json(
                await (PublicationElement as Model<IPublicationElement>).updateOne({ _id: req.body._id }, req.body as IPublicationElement)
            )
        else {
            const _id = mongooseTypes.ObjectId()
            await (PublicationElement as Model<IPublicationElement>).create({ ...req.body, _id, ts: Date.now() } as IPublicationElement)
            return res.json({ _id })
        }
    }
    return res.status(404)
}

import { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from 'users/useraccess/auth'
import { noMongoInjection } from 'utils/security'
import { IRelation, IRelationObject, Relation } from './relation.model'

export interface iHandlerRelations_CreateFromMe {
    action: 'createFromMe'
    _to: IRelationObject
    _for: IRelationObject
    _in: IRelationObject
    _under?: IRelationObject
    amount: number
    positive: boolean
    isPublic: boolean
    isConfidential: boolean
    meta: object
    comment: {
        text: string
    }
}

async function createFromMe(req: NextApiRequest, res: NextApiResponse) {
    const user = await getAuth(req, res)
    if (!user) return res.status(403).json({ error: 'bad auth' })
    if (!user._id) return res.status(403).json({ error: 'bad user id' })
    const _from = {
        uuid: user.uuid,
        source: user.source,
    }
    const { _to, _for, _in, _under, amount, positive, comment, meta, isPublic, isConfidential } = req.body as iHandlerRelations_CreateFromMe
    const addPendingStatus = (entity: IRelationObject) => (entity.uuid ? { ...entity, status: 'pending' } : undefined)
    const addApprovedStatus = (entity: IRelationObject) => (entity.uuid ? { ...entity, status: 'approved' } : undefined)
    const newRelation = {
        _from: addApprovedStatus(_from),
        _to: addApprovedStatus(_to),
        _for: addApprovedStatus(_for),
        _in: addPendingStatus(_in),
        _under: addPendingStatus(_under),
        isPublic,
        isConfidential,
        meta,
        comment,
        amount,
        positive,
    } as IRelation
    await (Relation as any).create(newRelation)

    return res.json({ ok: 'ok' })

    //await notifyStakeholders(newRelation)
}

export const handlerRelations = async (req: NextApiRequest, res: NextApiResponse) => {
    noMongoInjection(req, res)
    const { action } = req.query
    if (action === 'createFromMe') {
        return await createFromMe(req, res)
    }
    if (action === 'getWalletsInGame') {
    }
    res.json('no action')
}

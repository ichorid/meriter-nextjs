import { mongooseConnect, mongooseSchema } from '../../utils/mongooseconnect'

const connection = mongooseConnect('meriterra/mcs/neptune/meriterra')

//console.log(connection);

const mRelation = {
    url: String,
    type: String,
    uuid: String,
    source: String,
    status: String,
}

export const Relation =
    connection.models.Relation ||
    connection.model(
        'Relation',
        new mongooseSchema({
            _from: mRelation,
            _to: mRelation,
            _for: mRelation,
            _in: mRelation,
            _under: mRelation,
            ts: {
                type: Date,
                default: Date.now,
            },
            comment: {
                text: String,
                public: Boolean, //available outside stakeholders
            },
            isPublic: Boolean, //available outside stakeholders
            isConfidential: Boolean, //available for internal use of creator
            amount: Number,
            meta: Object,
        })
    )

export interface IRelationObject {
    url?: string
    type?: string
    uuid?: string
    source?: string
    status?: string
}
export interface IRelation {
    _from?: IRelationObject
    _to?: IRelationObject
    _for?: IRelationObject
    _in?: IRelationObject
    under?: IRelationObject
    amount?: number
    comment?: {
        text: string
    }
    isPublic?: boolean
    isConfidential?: boolean
    meta?: object
    ts?: number
}

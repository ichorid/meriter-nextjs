import { mongooseConnect, mongooseSchema } from '../../utils/mongooseconnect'

export const USERACCESS_SOURCE = 'meriterra/mcs/neptune/meriterra'
const connection = mongooseConnect(USERACCESS_SOURCE)

//console.log(connection);
export const PublicationElement =
    connection?.models?.PublicationElement ||
    connection?.model(
        'PublicationElement',
        new mongooseSchema({
            type: String,
            content: Object,
            tags: [String],
            meta: Object,
            ts: Date,

            uri: String,
            proto: String,
        })
    )

import { mongooseConnect, mongooseSchema } from '@shared/lib/mongooseconnect'

const connection = mongooseConnect('meriter')

export const PublicationElement =
    connection.models.PublicationElement ||
    connection.model(
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

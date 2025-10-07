import { mongooseConnect, mongooseSchema } from '../../utils/mongooseconnect'

const connection = mongooseConnect('meriterra/mcs/neptune/meriterra')

//console.log(connection);
export const Link =
    connection.models.Link ||
    connection.model(
        'Link',
        new mongooseSchema({
            short_id: String,
            long_id: String,
            payload: Object,
            expires: Date,
            stats: Object,
        })
    )

export interface ILink {
    short_id: string
    long_id: string
    payload?: object
    stats?: object
    expires: number
}

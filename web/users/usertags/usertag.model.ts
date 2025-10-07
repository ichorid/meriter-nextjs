import { mongooseConnect, mongooseSchema } from '../../utils/mongooseconnect'

const connection = mongooseConnect('meritterra/mcs/neptune/meriterra')

//console.log(connection);

export const UserTag =
    connection.models.UserTag ||
    connection.model(
        'UserTag',
        new mongooseSchema({
            token: { type: String, index: true },
            expires: Date,
            tag: String,
            value: Boolean,
            meta: Object,
            timeSet: Date,
        })
    )

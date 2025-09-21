import { mongooseConnect, mongooseSchema } from '../../utils/mongooseconnect'

const connection = mongooseConnect('meriterra/mcs/neptune/meriterra')

//console.log(connection);
export const Userdata =
    connection.models.Userdata ||
    connection.model(
        'Userdata',
        new mongooseSchema({
            //identies
            telegramUserId: String,
            telegramUsername: String,
            token: String,
            phone: String,
            email: String,

            source: String,
            scope: String,
            //data_fields
            avatarUrl: String,
            photoUrl: String,
            firstName: String,
            lastName: String,

            payload: Object,
        })
    )

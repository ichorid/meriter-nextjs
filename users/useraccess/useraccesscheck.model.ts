import { mongooseConnect, mongooseSchema } from '../../utils/mongooseconnect'

export const USERACCESS_SOURCE = 'meriterra/mcs/neptune/meriterra'
const connection = mongooseConnect(USERACCESS_SOURCE)

//console.log(connection);
export const UserAccessCheck =
    connection?.models?.UserAccessCheck ||
    connection?.model(
        'UserAccessCheck',
        new mongooseSchema({
            checkId: String,
            type: String,
            email: String,
            phone: String,
            code: String,
            telegramUserId: String,
            ts: Date,
        })
    )

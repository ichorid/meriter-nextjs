import { mongooseConnect, mongooseSchema } from '../../utils/mongooseconnect'

export const USERACCESS_SOURCE = 'meriterra/mcs/neptune/meriterra'
const connection = mongooseConnect(USERACCESS_SOURCE)

//console.log(connection);
export const UserAccess =
    connection?.models?.UserAccess ||
    connection?.model(
        'UserAccess',
        new mongooseSchema({
            uuid: String,
            token: String,
            priveleges: [String],
            email: String,
            phone: String,
            emails: [String],
            phones: [String],
            telegram_id: String,
            telegram_ids: [String],
            vk_id: String,
            utms: [
                {
                    utm: String,
                    ts: Date,
                },
            ],
        })
    )

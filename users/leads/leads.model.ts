import { mongooseConnect, mongooseSchema } from "../../utils/mongooseconnect";

const connection = mongooseConnect("meriterra/mcs/neptune/meriterra");

//console.log(connection);
export const Lead =
    connection?.models?.Lead ||
    connection?.model(
        "Lead",
        new mongooseSchema({
            //identies
            project: String,
            scope: String,
            email: String,
            phone: String,
            payloadArray: [Object],
        })
    );

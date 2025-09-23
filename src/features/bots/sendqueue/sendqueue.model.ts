import { mongooseConnect, mongooseSchema } from "../../utils/mongooseconnect";

const connection = mongooseConnect("meriterra/mcs/neptune/meriterra");

//console.log(connection);
export const Sendqueue =
    connection?.models?.Sendqueue ||
    connection?.model(
        "Sendqueue",
        new mongooseSchema({
            uid: String,
        })
    );

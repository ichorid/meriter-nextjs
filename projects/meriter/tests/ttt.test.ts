import mongoose from "mongoose";

beforeAll(async () => {
    //const url = `mongodb://127.0.0.1/${databaseName}`;
    const MONGO_URL = "mongodb://REPLACE_ME";

    await mongoose.connect(MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    let Entity =
        mongoose.models.Entity ||
        mongoose.model(
            "Entity",
            new mongoose.Schema({
                tgChatIds: [String],
                currencyName1: String,
                currencyName2: String,
                currencyName5: String,
                dailyEmission: Number,
            })
        );
});

describe.skip("Add new community (leader)", () => {
    test("/start community", () => {});
});

import mongoose from "mongoose";
import { TestDatabaseHelper } from "./test-db.helper";

const testDb = new TestDatabaseHelper();

beforeAll(async () => {
    // Start in-memory MongoDB - no external database needed!
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.NODE_ENV = "test";
    
    // Connect mongoose to in-memory database  
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri);
    }
    
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

afterAll(async () => {
    // Clean up: close connection and stop in-memory MongoDB
    await testDb.stop();
});

describe("Add new community (leader)", () => {
    test("/start community", () => {});
});

import mongoose from "mongoose";
export { v4 as uuid } from "uuid";
export { Schema as mongooseSchema, Types as mongooseTypes } from "mongoose";

export const mongooseConnect = (path: string) => {
    const dbpath = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/meriter";
    if (!dbpath) {
        throw new Error("Database connection string not configured");
    }
    try {
        const conn = mongoose.createConnection(dbpath);
        return conn;
    } catch (e) {
        console.error("Failed to create mongoose connection:", e);
        throw e;
    }
};

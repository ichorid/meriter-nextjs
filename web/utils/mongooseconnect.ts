import mongoose from "mongoose";
export { v4 as uuid } from "uuid";
export { Schema as mongooseSchema, Types as mongooseTypes } from "mongoose";

const paths = {};
export const mongooseConnect = (path) => {
    let dbpath = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/meriter";
    if (!dbpath) throw "no such database";
    try {
        const conn = mongoose.createConnection(dbpath);
        return conn;
    } catch (e) {}
};

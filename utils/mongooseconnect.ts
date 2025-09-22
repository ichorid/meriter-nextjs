import mongoose from "mongoose";
export { v4 as uuid } from "uuid";
export { Schema as mongooseSchema, Types as mongooseTypes } from "mongoose";
import getConfig from "next/config";
const { publicRuntimeConfig } = getConfig();

const paths = {};
export const mongooseConnect = (path) => {
    let dbpath = process.env.DATABASE_URL;
    if (!dbpath) throw "no such database";
    try {
        const conn = mongoose.createConnection(dbpath, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        return conn;
    } catch (e) {}
};

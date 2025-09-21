import mongoose from "mongoose";
export { v4 as uuid } from "uuid";
export { Schema as mongooseSchema, Types as mongooseTypes } from "mongoose";
import getConfig from "next/config";
const { publicRuntimeConfig } = getConfig();

const paths = {};
export const mongooseConnect = (path) => {
    let dbpath = "mongodb://user:7Uyvs}36G4AG34o5@84.23.54.76/meritterra";
    if (!dbpath) throw "no such database";
    try {
        const conn = mongoose.createConnection(dbpath, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
        });
        return conn;
    } catch (e) {}
};

module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    moduleNameMapper: {
        "^actions/(.*)": "<rootDir>/actions/$1",
        "^schema/(.*)": "<rootDir>/schema/index.schema",
        "^utils/(.*)": "<rootDir>/utils/$1",

        config: "<rootDir>/config",
    },
};

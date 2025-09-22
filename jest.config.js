module.exports = {
    testTimeout: 5000,
    preset: 'ts-jest',
    testEnvironment: 'node',
    testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
    setupFilesAfterEnv: ["<rootDir>/projects/meriter/tests/setup.ts"],
    transform: {
      "^.+\\.(js|jsx|ts|tsx)$": "<rootDir>/node_modules/babel-jest"
    },
    transformIgnorePatterns: [
        "/node_modules/(?!uuid)"
    ],
    moduleDirectories: [
        "node_modules",
        "<rootDir>"
      ]
  };
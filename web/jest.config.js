module.exports = {
    testEnvironment: 'node',
    testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
    transform: {
      "^.+\\.(js|jsx|ts|tsx)$": "<rootDir>/node_modules/babel-jest"
    },
    transformIgnorePatterns: [
      "node_modules/(?!(nanoid)/)"
    ],
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    moduleDirectories: [
        "node_modules",
        "<rootDir>"
      ],
    testTimeout: 20000
  };
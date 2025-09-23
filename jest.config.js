module.exports = {
    testTimeout: 5000,
    preset: 'ts-jest',
    testEnvironment: 'node',
    testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
    globalSetup: "<rootDir>/projects/meriter/tests/globalSetup.ts",
    globalTeardown: "<rootDir>/projects/meriter/tests/globalTeardown.ts",
    transform: {
      "^.+\\.(js|jsx)$": "<rootDir>/node_modules/babel-jest",
      "^.+\\.(ts|tsx)$": "ts-jest"
    },
    transformIgnorePatterns: [
        "/node_modules/(?!uuid)"
    ],
    moduleDirectories: [
        "node_modules",
        "<rootDir>"
    ],
    moduleNameMapper: {
        "\\.(scss|sass|css)$": "identity-obj-proxy"
    },
    rootDir: ".",
    modulePaths: [
        "<rootDir>"
    ]
  };
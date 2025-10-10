module.exports = {
    testEnvironment: 'jsdom',
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
    moduleNameMapper: {
      "^@app/(.*)$": "<rootDir>/src/app/$1",
      "^@features/(.*)$": "<rootDir>/src/features/$1",
      "^@shared/(.*)$": "<rootDir>/src/shared/$1",
      "^@lib/(.*)$": "<rootDir>/src/shared/lib/$1",
      "^@config/(.*)$": "<rootDir>/config/$1",
      "^@styles/(.*)$": "<rootDir>/styles/$1",
      "\\.(css|scss)$": "identity-obj-proxy"
    },
    testTimeout: 20000
  };
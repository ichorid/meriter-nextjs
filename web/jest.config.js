module.exports = {
    testEnvironment: 'jsdom',
    testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
    preset: 'ts-jest',
    transform: {
      "^.+\\.(ts|tsx)$": ["ts-jest", {
        tsconfig: {
          jsx: "react-jsx"
        }
      }],
      "^.+\\.(js|jsx)$": "babel-jest"
    },
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
      "^@config$": "<rootDir>/src/config/index.ts",
      "^@styles/(.*)$": "<rootDir>/styles/$1",
      "^@/components/(.*)$": "<rootDir>/src/components/$1",
      "^@/contexts/(.*)$": "<rootDir>/src/contexts/$1",
      "^@/hooks/(.*)$": "<rootDir>/src/hooks/$1",
      "^@/types/(.*)$": "<rootDir>/src/types/$1",
      "^@/lib/(.*)$": "<rootDir>/src/lib/$1",
      "^@/shared/(.*)$": "<rootDir>/src/shared/$1",
      "^@/config/(.*)$": "<rootDir>/src/config/$1",
      "^@/config$": "<rootDir>/src/config/index.ts",
      "\\.(css|scss)$": "identity-obj-proxy"
    },
    testTimeout: 20000,
    collectCoverageFrom: [
      "src/**/*.{js,jsx,ts,tsx}",
      "!src/**/*.d.ts",
      "!src/**/*.stories.{js,jsx,ts,tsx}",
      "!src/**/*.test.{js,jsx,ts,tsx}",
      "!src/**/*.spec.{js,jsx,ts,tsx}",
    ],
    coverageThreshold: {
      global: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  };
/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
    collectCoverageFrom: [
        "src/index.ts",
        "src/workflow_types.ts",
        "!**/*.d.ts",
        "!**/node_modules/**",
    ],
    coverageDirectory: "coverage",
    coverageReporters: ["text", "lcov", "html"],
    // If you store tests in a specific folder, you can specify it here:
    roots: ["<rootDir>/src"],
    testPathIgnorePatterns: ["/node_modules/", "/dist/"],
    // testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
    verbose: true,
};

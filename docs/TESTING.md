# Testing Documentation

## Overview

This project uses Jest as the testing framework with full TypeScript and ESM support.

## Running Tests

### Run all tests
```bash
npm run test:node
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests with Bun (alternative)
```bash
npm run test:bun
```

## Test Structure

The test suite in `index.test.ts` covers all 8 phases of the workflow creation process:

### Phase 1: Login State
- Tests GitHub authentication status checking
- Verifies proper error handling when not logged in

### Phase 2: Loading Config
- Tests YAML config file loading and parsing
- Verifies error handling for missing files
- Tests custom config paths

### Phase 3: Repo Selection
- Tests repository list generation and sorting
- Verifies handling of empty configurations

### Phase 4: Branch Selection
- Tests branch filtering for selected repositories
- Verifies handling of non-existent repositories

### Phase 5: Workflow Selection
- Tests workflow listing from GitHub API
- Verifies filtering of active workflows only
- Tests empty workflow scenarios

### Phase 6: Workflow Input Retrieval
- Tests parsing of `workflow_dispatch` input schemas
- Verifies handling of different input types (string, boolean, choice, number, environment)
- Tests complex input configurations

### Phase 7: User Input Collection
- Tests building of Clack prompt objects for different input types
- Verifies proper prompt configuration for each input type

### Phase 8: Running Workflow
- Tests workflow run argument construction
- Verifies display information formatting
- Tests scenarios with and without workflow inputs

## Test Coverage

Current coverage focuses on the core logic functions extracted from `index.ts`:
- `checkLogin()`
- `loadConfig()`
- `getRepoList()`
- `getBranchesForRepo()`
- `listWorkflows()`
- `filterActiveWorkflows()`
- `getWorkflowInputs()`
- `buildInputPrompts()`
- `buildWorkflowRunArgs()`
- `buildDisplayInfo()`

## Mocking Strategy

The tests use Jest's `unstable_mockModule` to mock:
- **execa**: For mocking GitHub CLI commands
- **node:fs/promises**: For mocking file system operations
- **@clack/prompts**: For mocking user interface interactions

### ESM Import Considerations

Due to ESM module requirements, imports in test files use the `.js` extension even though source files are `.ts`:

```typescript
const { functionUnderTest } = await import('./index.js');
```

This is required by Node.js ESM specification where imports must include the file extension. TypeScript's module mapper in jest.config.cjs handles the translation from `.js` to `.ts` during test execution. While this creates a dependency on the compiled output structure, it's a standard pattern for TypeScript ESM testing.

**Alternative approaches:**
- Use a test runner with better TypeScript support (like Vitest)
- Configure custom TypeScript path mappings
- Use a bundler for tests that handles extensions automatically

## Configuration

### jest.config.cjs
- Uses `ts-jest` preset for ESM
- Configured for Node.js environment
- Includes coverage reporting (text, lcov, html)
- Excludes test files from coverage

### tsconfig.json
- Excludes test files from TypeScript compilation
- Maintains strict type checking for production code

## Writing New Tests

When adding new tests:

1. Use `jest.unstable_mockModule()` before importing the module under test
2. Import test utilities from `@jest/globals`
3. Clear mocks in `beforeEach()` hooks
4. Follow the existing pattern of organizing tests by workflow phases

Example:
```typescript
import { jest, beforeEach, describe, it, expect } from '@jest/globals';

const mockFn = jest.fn();
jest.unstable_mockModule('module-name', () => ({
  functionName: mockFn,
}));

const { functionUnderTest } = await import('./index.js');

describe('Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should test something', () => {
    // Test implementation
  });
});
```

## Continuous Integration

Tests should be run as part of CI/CD pipeline to ensure:
- All tests pass before merging
- Coverage thresholds are maintained
- No regressions are introduced

## Future Improvements

Potential areas for test expansion:
- Integration tests with real GitHub CLI (in isolated environment)
- E2E tests for complete workflow execution
- Performance tests for large configuration files
- Error scenario coverage expansion

import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import type { ResultPromise } from 'execa';

// Create mock functions
const mockExecaFn = jest.fn();
const mockReadFileFn = jest.fn();

// Mock modules with unstable_mockModule
jest.unstable_mockModule('execa', () => ({
  execa: mockExecaFn,
}));

jest.unstable_mockModule('node:fs/promises', () => ({
  readFile: mockReadFileFn,
}));

jest.unstable_mockModule('@clack/prompts', () => ({
  intro: jest.fn(),
  outro: jest.fn(),
  log: {
    success: jest.fn(),
    error: jest.fn(),
    step: jest.fn(),
  },
  select: jest.fn(),
  spinner: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
  group: jest.fn(),
  text: jest.fn(),
  cancel: jest.fn(),
  confirm: jest.fn(),
}));

// Import the module under test
// Note: Using .js extension is required for ESM imports even though source is .ts
const {
  checkLogin,
  loadConfig,
  getRepoList,
  getBranchesForRepo,
  listWorkflows,
  filterActiveWorkflows,
  getWorkflowInputs,
  buildInputPrompts,
  buildWorkflowRunArgs,
  buildDisplayInfo,
} = await import('./index.js');

describe('Phase 1: Login State', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when gh auth status succeeds', async () => {
    mockExecaFn.mockResolvedValueOnce({
      stdout: 'Logged in to github.com',
      stderr: '',
      exitCode: 0,
    });

    const result = await checkLogin();
    expect(result).toBe(true);
    expect(mockExecaFn).toHaveBeenCalled();
  });

  it('should return false when gh auth status fails', async () => {
    mockExecaFn.mockRejectedValueOnce(new Error('Not logged in'));

    const result = await checkLogin();
    expect(result).toBe(false);
  });
});

describe('Phase 2: Loading Config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully load and parse valid config.yml', async () => {
    const validConfig = `
repos:
  - name: owner/repo1
    branches:
      - main
      - dev
  - name: owner/repo2
    branches:
      - master
`;
    mockReadFileFn.mockResolvedValueOnce(validConfig);

    const result = await loadConfig('./config.yml');
    
    expect(result).toEqual({
      repos: [
        { name: 'owner/repo1', branches: ['main', 'dev'] },
        { name: 'owner/repo2', branches: ['master'] },
      ],
    });
    expect(mockReadFileFn).toHaveBeenCalledWith('./config.yml', 'utf8');
  });

  it('should throw error when config file is not found', async () => {
    mockReadFileFn.mockRejectedValueOnce(new Error('ENOENT: no such file'));

    await expect(loadConfig('./missing.yml')).rejects.toThrow('ENOENT: no such file');
  });

  it('should handle custom config path', async () => {
    const validConfig = `
repos:
  - name: owner/repo1
    branches:
      - main
`;
    mockReadFileFn.mockResolvedValueOnce(validConfig);

    await loadConfig('/custom/path/config.yml');
    expect(mockReadFileFn).toHaveBeenCalledWith('/custom/path/config.yml', 'utf8');
  });
});

describe('Phase 3: Repo Selection', () => {
  const mockConfig = {
    repos: [
      { name: 'owner/repo-b', branches: ['main'] },
      { name: 'owner/repo-a', branches: ['dev'] },
      { name: 'owner/repo-c', branches: ['master'] },
    ],
  };

  it('should generate sorted list of repository names', () => {
    const result = getRepoList(mockConfig);
    
    expect(result).toEqual(['owner/repo-a', 'owner/repo-b', 'owner/repo-c']);
  });

  it('should return empty array for config with no repos', () => {
    const emptyConfig = { repos: [] };
    const result = getRepoList(emptyConfig);
    
    expect(result).toEqual([]);
  });
});

describe('Phase 4: Branch Selection', () => {
  const mockConfig = {
    repos: [
      { name: 'owner/repo1', branches: ['main', 'dev', 'staging'] },
      { name: 'owner/repo2', branches: ['master'] },
    ],
  };

  it('should return branches for selected repo', () => {
    const result = getBranchesForRepo(mockConfig, 'owner/repo1');
    
    expect(result).toEqual(['main', 'dev', 'staging']);
  });

  it('should return empty array when repo is not found', () => {
    const result = getBranchesForRepo(mockConfig, 'owner/nonexistent');
    
    expect(result).toEqual([]);
  });

  it('should return branches for second repo', () => {
    const result = getBranchesForRepo(mockConfig, 'owner/repo2');
    
    expect(result).toEqual(['master']);
  });
});

describe('Phase 5: Workflow Selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list workflows from GitHub API', async () => {
    const mockWorkflows = [
      { name: 'CI', path: '.github/workflows/ci.yml', id: 1, state: 'active' },
      { name: 'Deploy', path: '.github/workflows/deploy.yml', id: 2, state: 'active' },
    ];

    mockExecaFn.mockResolvedValueOnce({
      stdout: JSON.stringify(mockWorkflows),
      stderr: '',
      exitCode: 0,
    });

    const result = await listWorkflows('owner/repo');
    
    expect(result).toEqual(mockWorkflows);
    expect(mockExecaFn).toHaveBeenCalled();
  });

  it('should filter only active workflows', () => {
    const workflows = [
      { name: 'CI', path: '.github/workflows/ci.yml', id: 1, state: 'active' },
      { name: 'Old', path: '.github/workflows/old.yml', id: 2, state: 'disabled' },
      { name: 'Deploy', path: '.github/workflows/deploy.yml', id: 3, state: 'active' },
      { name: 'Archived', path: '.github/workflows/archived.yml', id: 4, state: 'deleted' },
    ];

    const result = filterActiveWorkflows(workflows);
    
    expect(result).toEqual([
      { name: 'CI', path: '.github/workflows/ci.yml', id: 1, state: 'active' },
      { name: 'Deploy', path: '.github/workflows/deploy.yml', id: 3, state: 'active' },
    ]);
  });

  it('should return empty array when no active workflows', () => {
    const workflows = [
      { name: 'Old', path: '.github/workflows/old.yml', id: 1, state: 'disabled' },
    ];

    const result = filterActiveWorkflows(workflows);
    
    expect(result).toEqual([]);
  });
});

describe('Phase 6: Workflow Input Retrieval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should parse workflow_dispatch inputs correctly', async () => {
    const workflowYaml = `
name: Deploy
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        type: choice
        options:
          - dev
          - staging
          - prod
        default: dev
      version:
        description: 'Version to deploy'
        required: false
        type: string
        default: '1.0.0'
`;

    mockExecaFn.mockResolvedValueOnce({
      stdout: workflowYaml,
      stderr: '',
      exitCode: 0,
    });

    const result = await getWorkflowInputs('Deploy', 'owner/repo', 'main');
    
    expect(result).toEqual([
      {
        name: 'environment',
        type: 'choice',
        default: 'dev',
        options: ['dev', 'staging', 'prod'],
        required: true,
      },
      {
        name: 'version',
        type: 'string',
        default: '1.0.0',
        options: undefined,
        required: false,
      },
    ]);
  });

  it('should handle workflow with no inputs', async () => {
    const workflowYaml = `
name: Simple
on:
  workflow_dispatch:
    inputs: {}
`;

    mockExecaFn.mockResolvedValueOnce({
      stdout: workflowYaml,
      stderr: '',
      exitCode: 0,
    });

    const result = await getWorkflowInputs('Simple', 'owner/repo', 'main');
    
    expect(result).toEqual([]);
  });

  it('should handle boolean inputs', async () => {
    const workflowYaml = `
name: Test
on:
  workflow_dispatch:
    inputs:
      debug:
        description: 'Enable debug mode'
        required: false
        type: boolean
        default: false
`;

    mockExecaFn.mockResolvedValueOnce({
      stdout: workflowYaml,
      stderr: '',
      exitCode: 0,
    });

    const result = await getWorkflowInputs('Test', 'owner/repo', 'main');
    
    expect(result[0]?.type).toBe('boolean');
    expect(result[0]?.default).toBe('false');
  });
});

describe('Phase 7: User Input Collection', () => {
  it('should build input prompts for string inputs', () => {
    const inputs = [
      { name: 'version', type: 'string', default: '1.0.0', required: true, options: undefined },
      { name: 'tag', type: 'string', default: '', required: false, options: undefined },
    ];

    const result = buildInputPrompts(inputs);
    
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('tag');
    expect(typeof result['version']).toBe('function');
    expect(typeof result['tag']).toBe('function');
  });

  it('should build input prompts for choice inputs', () => {
    const inputs = [
      {
        name: 'environment',
        type: 'choice',
        default: 'dev',
        options: ['dev', 'staging', 'prod'],
        required: true,
      },
    ];

    const result = buildInputPrompts(inputs);
    
    expect(result).toHaveProperty('environment');
    expect(typeof result['environment']).toBe('function');
  });

  it('should build input prompts for boolean inputs', () => {
    const inputs = [
      { name: 'debug', type: 'boolean', default: 'false', required: false, options: undefined },
    ];

    const result = buildInputPrompts(inputs);
    
    expect(result).toHaveProperty('debug');
    expect(typeof result['debug']).toBe('function');
  });

  it('should build input prompts for number and environment inputs', () => {
    const inputs = [
      { name: 'timeout', type: 'number', default: '30', required: true, options: undefined },
      { name: 'env', type: 'environment', default: 'production', required: true, options: undefined },
    ];

    const result = buildInputPrompts(inputs);
    
    expect(result).toHaveProperty('timeout');
    expect(result).toHaveProperty('env');
    expect(typeof result['timeout']).toBe('function');
    expect(typeof result['env']).toBe('function');
  });

  it('should handle empty inputs array', () => {
    const inputs: Array<{name: string; type: string; default: string; options: string[] | undefined; required: boolean}> = [];

    const result = buildInputPrompts(inputs);
    
    expect(result).toEqual({});
  });
});

describe('Phase 8: Running Workflow', () => {
  it('should build workflow run arguments correctly', () => {
    const inputGroup = {
      environment: 'staging',
      version: '2.0.0',
      debug: 'true',
    };

    const result = buildWorkflowRunArgs('Deploy', 'owner/repo', 'main', inputGroup);
    
    expect(result).toEqual([
      'workflow',
      'run',
      'Deploy',
      '-R',
      'owner/repo',
      '--ref',
      'main',
      '-f',
      'environment=staging',
      '-f',
      'version=2.0.0',
      '-f',
      'debug=true',
    ]);
  });

  it('should build workflow run arguments with no inputs', () => {
    const inputGroup = {};

    const result = buildWorkflowRunArgs('Simple', 'owner/repo', 'dev', inputGroup);
    
    expect(result).toEqual([
      'workflow',
      'run',
      'Simple',
      '-R',
      'owner/repo',
      '--ref',
      'dev',
    ]);
  });

  it('should build display info correctly', () => {
    const inputGroup = {
      environment: 'prod',
      version: '3.0.0',
    };

    const result = buildDisplayInfo('Deploy', 'owner/repo', 'main', inputGroup);
    
    expect(result).toContain('Running Workflow : Deploy');
    expect(result).toContain('Repo             : owner/repo');
    expect(result).toContain('Branch           : main');
    expect(result).toContain('environment     : prod');
    expect(result).toContain('version         : 3.0.0');
  });

  it('should build display info with no inputs', () => {
    const inputGroup = {};

    const result = buildDisplayInfo('Simple', 'owner/test', 'dev', inputGroup);
    
    expect(result).toContain('Running Workflow : Simple');
    expect(result).toContain('Repo             : owner/test');
    expect(result).toContain('Branch           : dev');
    expect(result).toContain('Inputs :');
  });
});

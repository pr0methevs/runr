import { jest, beforeEach, describe, it, expect } from "@jest/globals";
// import { getRepos, loadConfig } from "./index.js";

// Create mock functions
const mockExecaFn = jest.fn<any>();
const mockReadFileFn = jest.fn<any>();

// Mock modules with unstable_mockModule
jest.unstable_mockModule("execa", () => ({
  execa: mockExecaFn,
}));

jest.unstable_mockModule("node:fs/promises", () => ({
  readFile: mockReadFileFn,
}));

jest.unstable_mockModule("@clack/prompts", () => ({
  intro: jest.fn(),
  outro: jest.fn(),
  log: {
    success: jest.fn(),
    error: jest.fn(),
    step: jest.fn(),
    warn: jest.fn(),
    message: jest.fn(),
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

const {
  checkLogin,
  loadConfig,
  getRepos,
  getWorkflowsForRepo,
  getBranchesFromRepo,
  filterForActiveWorkflows,
  getWorkflowInputs,
  buildInputPrompts,
  buildWorkflowRunArgs,
  buildDisplayInfo } = await import("./index.js");

describe("Phase 1: Login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true when login to GitHub is successful", async () => {
    mockExecaFn.mockResolvedValueOnce({
      stdout: "Logged in to github.com",
      stderr: "",
      exitCode: 0,
    });

    const result = await checkLogin();

    await expect(result).toBe(true);

    expect(mockExecaFn).toHaveBeenCalled();
  });

  it("should return false when login to GitHub is unsuccessful", async () => {
    mockExecaFn.mockRejectedValueOnce(new Error("Failed to login"));
    const result = await checkLogin();

    expect(result).toBe(false);
    expect(mockExecaFn).toHaveBeenCalled();
  });
});

describe("Phase 2: Configuration Loading", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully load & parse config.yml", async () => {
    const cfg = `
      repos:
        - name: owner1/repo1
          branches:
            - main
            - dev
        - name: owner2/repo2
          branches:
            - master
            - release
      `;

    mockReadFileFn.mockResolvedValueOnce(cfg);

    const result = await loadConfig("./config.yml");

    expect(result).toEqual({
      repos: [
        { name: "owner1/repo1", branches: ["main", "dev"] },
        { name: "owner2/repo2", branches: ["master", "release"] },
      ],
    });

    expect(mockReadFileFn).toHaveBeenCalledWith("./config.yml", "utf8");
  });

  it("should throw error when config.yml is not found", async () => {
    mockReadFileFn.mockRejectedValueOnce(new Error("ENOENT: File not found"));
    await expect(loadConfig("./missing.yml")).rejects.toThrow("ENOENT: File not found");
  });

  it('should handle custom config path', async () => {
    const validConfig = `
    repos:
      - name: owner/repo1
        branches:
          - main
    `;
    mockReadFileFn.mockResolvedValueOnce(validConfig);

    await loadConfig('./custom/path/config.yml');
    expect(mockReadFileFn).toHaveBeenCalledWith('./custom/path/config.yml', 'utf8');
  });

});


describe("Phase 3: Select a Repository", () => {
  const mockConfig = {
    repos: [
      { name: "owner1/repo1", branches: ["main", "dev"] },
      { name: "owner2/repo2", branches: ["master", "release"] },
      { name: "owner3/repo3", branches: ["main", "dev"] },
    ]
  }

  it("should get a list of repositories that is sorted", () => {
    const result = getRepos(mockConfig);
    expect(result).toEqual(["owner1/repo1", "owner2/repo2", "owner3/repo3"].sort());
  });

  it("should return nothing when no repositorties present in config.yml", () => {
    const emptyConfig = { repos: [] };
    const result = getRepos(emptyConfig);

    expect(result).toEqual([]);
  });

});

describe("Phase 4: Select a Branch", () => {
  const mockConfig = {
    repos: [
      { name: 'owner/repo1', branches: ['main', 'dev', 'staging'] },
      { name: 'owner/repo2', branches: ['master'] },
    ],
  };

  it("should return branches for selected repository", () => {
    const result = getBranchesFromRepo(mockConfig, 'owner/repo1');
    expect(result).toEqual(['main', 'dev', 'staging']);
  });

  it("should return empty array when repository is not found", () => {
    const result = getBranchesFromRepo(mockConfig, 'owner/repo3');
    expect(result).toEqual([]);
  });

  it("should return branches for 2nd repository", () => {
    const result = getBranchesFromRepo(mockConfig, 'owner/repo2');
    expect(result).toEqual(['master']);
  });
});

describe("Phase 5: Select a Workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockWorkflows = [
    { name: 'CI', path: '.github/workflows/ci.yml', id: 1, state: 'active' },
    { name: 'Deploy', path: '.github/workflows/deploy.yml', id: 2, state: 'active' },
    { name: 'CodeQL', path: '.github/workflows/codeql.yml', id: 3, state: 'inactive' },
  ];

  it("should list workflows from the GitHub API (repository)", async () => {
    const mockWorkflows = [
      { name: 'CI', path: '.github/workflows/ci.yml', id: 1, state: 'active' },
      { name: 'Deploy', path: '.github/workflows/deploy.yml', id: 2, state: 'active' },
    ];

    mockExecaFn.mockResolvedValueOnce({
      stdout: JSON.stringify(mockWorkflows),
      stderr: '',
      exitCode: 0,
    });

    const result = await getWorkflowsForRepo('owner/repo');

    expect(result).toEqual(mockWorkflows);
    expect(mockExecaFn).toHaveBeenCalled();
  });

  it("should filter for only active workflows", () => {
    const workflows = [
      { name: 'CI', path: '.github/workflows/ci.yml', id: 1, state: 'active' },
      { name: 'Old', path: '.github/workflows/old.yml', id: 2, state: 'disabled' },
      { name: 'Deploy', path: '.github/workflows/deploy.yml', id: 3, state: 'active' },
    ];

    const result = filterForActiveWorkflows(workflows);

    expect(result).toEqual([
      { name: 'CI', path: '.github/workflows/ci.yml', id: 1, state: 'active' },
      { name: 'Deploy', path: '.github/workflows/deploy.yml', id: 3, state: 'active' },
    ]);
  });

  it("should return an empty array when no active workflows", async () => {
    const workflows = [
      { name: 'CI', path: '.github/workflows/old.yml', id: 1, state: 'disabled' },
    ];

    const result = filterForActiveWorkflows(workflows);

    expect(result).toEqual([]);
  });
});

describe("Phase 6: Retrieve Workflows Inputs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse workflow_dispatch inputs", async () => {
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

  it("should handle workflows with no inputs, not prompting user for input", async () => {
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

  it("should handle boolean inputs", async () => {
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

describe("Phase 7: User Inputs For Workflow Inputs", () => {

  it("should build input prompts for string inputs", async () => {
    const workflowYaml = `
      name: Test
      on:
        workflow_dispatch:
          inputs:
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

    const result = await getWorkflowInputs('Test', 'owner/repo', 'main');

    expect(result[0]?.type).toBe('string');
    expect(result[0]?.default).toBe('1.0.0');
  });

  it("should build input prompts for choice inputs", async () => {
    const workflowYaml = `
      name: Test
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
      `;

    mockExecaFn.mockResolvedValueOnce({
      stdout: workflowYaml,
      stderr: '',
      exitCode: 0,
    });

    const result = await getWorkflowInputs('Test', 'owner/repo', 'main');

    expect(result[0]?.type).toBe('choice');
    expect(result[0]?.default).toBe('dev');
    expect(result[0]?.options).toEqual(['dev', 'staging', 'prod']);
  });

  it("should build input prompts for boolean inputs", async () => {
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

  it("should build input prompts for environment inputs", async () => {
    const workflowYaml = `
      name: Test
      on:
        workflow_dispatch:
          inputs:
            environment:
              description: 'Environment to deploy to'
              required: true
              type: environment
              default: dev
      `;

    mockExecaFn.mockResolvedValueOnce({
      stdout: workflowYaml,
      stderr: '',
      exitCode: 0,
    });

    const result = await getWorkflowInputs('Test', 'owner/repo', 'main');

    expect(result[0]?.type).toBe('environment');
    expect(result[0]?.default).toBe('dev');
  });

  it("should handle empty inputs array", async () => {
    const workflowYaml = `
      name: Test
      on:
        workflow_dispatch:
          inputs: {}
      `;

    mockExecaFn.mockResolvedValueOnce({
      stdout: workflowYaml,
      stderr: '',
      exitCode: 0,
    });

    const result = await getWorkflowInputs('Test', 'owner/repo', 'main');

    expect(result).toEqual([]);
  });
});

describe("Phase 8: Run Workflow", () => {

  it("should build workflow run arguments correctly", () => {
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

  it("should build workflow run arguments with no inputs", () => {
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

  it("should build pretty print workflow inputs", () => {
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

  it("should build pretty print workflow with no inputs", () => {
    const inputGroup = {};

    const result = buildDisplayInfo('Simple', 'owner/test', 'dev', inputGroup);

    expect(result).toContain('Running Workflow : Simple');
    expect(result).toContain('Repo             : owner/test');
    expect(result).toContain('Branch           : dev');
    expect(result).toContain('Inputs :');
  });
});
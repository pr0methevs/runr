#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { execa } from "execa";
import { intro, outro, log, select, spinner, group, text, cancel, confirm } from "@clack/prompts";
import type {
  WorkflowDispatchInput,
  WorkflowDispatchParsed,
} from "./workflow_types.js";
import { isChoiceInput } from "./workflow_types.js";

// EXECA DOCS : https://github.com/sindresorhus/execa/blob/main/docs/execution.md

// Define the expected structure of your config
export interface RepoConfig {
  repos: Array<{
    name: string;
    branches: string[];
  }>;
}

interface Workflow {
  name: string;
  path: string;
  id: number;
  state: string;
}

export interface WorkflowInput {
  name: string;
  type: string;
  default: string;
  options: string[] | undefined;
  required: boolean;
}

// Exported functions for testing
export async function checkLogin(): Promise<boolean> {
  try {
    await execa`gh auth status`;
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadConfig(configPath: string = "./config.yml"): Promise<RepoConfig> {
  const configText = await readFile(configPath, "utf8");
  return parseYaml(configText) as RepoConfig;
}

export function getRepoList(config: RepoConfig): string[] {
  return config.repos.map((repo) => repo.name).sort();
}

export function getBranchesForRepo(config: RepoConfig, repoName: string): string[] {
  const repo = config.repos.find((r) => r.name === repoName);
  return repo?.branches || [];
}

export async function listWorkflows(repo: string): Promise<Workflow[]> {
  const workflowResult = await execa`gh workflow list -R ${repo} --json name,path,id,state`;
  return JSON.parse(workflowResult.stdout);
}

export function filterActiveWorkflows(workflows: Workflow[]): Workflow[] {
  return workflows.filter((w) => w.state === "active").sort();
}

export async function getWorkflowInputs(
  workflowName: string,
  repo: string,
  branch: string
): Promise<WorkflowInput[]> {
  const workflowViewCommandOutput =
    await execa`gh workflow view ${workflowName} -R ${repo} --ref ${branch} --yaml`;

  const workflow = parseYaml(workflowViewCommandOutput.stdout) as WorkflowDispatchParsed;
  const inputs: Record<string, WorkflowDispatchInput> | undefined = workflow.on.workflow_dispatch.inputs;

  return Object.entries(inputs ?? {}).map(([name, input]) => ({
    name,
    type: input.type,
    default: String(input.default ?? ""),
    options: isChoiceInput(input) ? input.options : undefined,
    required: input.required,
  }));
}

export function buildInputPrompts(
  inputs: WorkflowInput[]
): Record<string, () => ReturnType<typeof text> | ReturnType<typeof select>> {
  const createdGroup: Record<string, () => ReturnType<typeof text> | ReturnType<typeof select>> = {};

  inputs.forEach((input) => {
    switch (input.type) {
      case "string":
      case "number":
      case "environment":
        createdGroup[input.name] = () => text({
          message: "Input " + input.name,
          placeholder: "Required? " + input.required,
          initialValue: input.default
        });
        break;
      case "boolean":
        createdGroup[input.name] = () => select({
          message: "Input " + input.name,
          options: [{ value: "true", label: "True" }, { value: "false", label: "False" }],
          initialValue: input.default
        });
        break;
      case "choice":
        createdGroup[input.name] = () => select({
          message: "Input " + input.name,
          options: (input.options ?? []).map((opt) => ({ value: opt, label: opt })),
          initialValue: input.default
        });
        break;
      default:
        log.error("Invalid Input Type !")
    }
  });

  return createdGroup;
}

export function buildWorkflowRunArgs(
  workflowName: string,
  repo: string,
  branch: string,
  inputGroup: Record<string, unknown>
): string[] {
  const workflowRunArgs: string[] = [
    "workflow", "run", workflowName,
    "-R", repo,
    "--ref", branch,
  ];

  for (const [key, value] of Object.entries(inputGroup)) {
    workflowRunArgs.push("-f", `${key}=${value}`);
  }

  return workflowRunArgs;
}

export function buildDisplayInfo(
  workflowName: string,
  repo: string,
  branch: string,
  inputGroup: Record<string, unknown>
): string {
  return [
    `Running Workflow : ${workflowName}`,
    `Repo             : ${repo}`,
    `Branch           : ${branch}`,
    ``,
    `Inputs :`,
    ...Object.entries(inputGroup).map(([k, v]) => `  ${k.padEnd(15)} : ${v}`)
  ].join("\n");
}

// Main function that orchestrates the workflow
export async function runWorkflowCreation(): Promise<void> {
  intro("Starting Workflow Creation");

  const s = spinner();

  s.start("Checking Login");
  // --- LOGIN STATE
  const isLoggedIn = await checkLogin();
  if (isLoggedIn) {
    log.success("Logged in to GitHub");
  } else {
    log.error("You are not logged in! Run `gh auth login` to authenticate with GitHub");
    s.stop();
    process.exit(1);
  }
  s.stop();
  outro("Finished Checking Login");

  intro("Loading Config");

  // Read and parse the YAML config at runtime
  const config = await loadConfig();
  log.step(`Config : ${JSON.stringify(config, null, 4)}`);
  outro("Finished Loading Config");

  intro("Repo Selection");

  // --- Get All Repos
  const repos = getRepoList(config);
  log.step(`Repos : ${repos}`);

  // --- Pick a Repo
  const repo = await select({
    message: "Pick a repository:",
    options: repos.map((repo) => ({ value: repo })).sort(),
  });

  outro("Finished Repo Selection");

  intro("Branch Selection");

  // -- Get branches for selected repo
  const branch = await select({
    message: "Pick a branch",
    options: getBranchesForRepo(config, String(repo)).map((branch) => ({ value: branch })),
  });

  outro("Finished Branch Selection");

  intro("Workflow Selection");

  const workflows = await listWorkflows(String(repo));
  const activeWorkflows = filterActiveWorkflows(workflows);

  // Select a workflow
  const selectedWorkflowId = await select({
    message: "Select Workflow",
    options: activeWorkflows.map((w) => ({
      value: w.id,
      label: w.name,
      hint: w.path,
    })),
  });

  const selectedWorkflow = activeWorkflows.find((w) => w.id === selectedWorkflowId);
  const selectedWorkflowName = selectedWorkflow?.name ?? "";

  log.step(`Selected Workflow: [${selectedWorkflowName}]`);
  outro("Finished Workflow Selection");

  intro("Workflow Input Retrieval");

  const inputsArray = await getWorkflowInputs(selectedWorkflowName, String(repo), String(branch));
  outro("Finished Workflow Input Retrieval");

  intro("User Input Collection");

  const createdGroup = buildInputPrompts(inputsArray);

  const inputGroup = await group(
    createdGroup,
    {
      onCancel: ({ results }) => {
        cancel('Operation cancelled.');
        process.exit(0);
      },
    }
  );

  outro("Finished User Input Collection");

  intro("Running Workflow");

  const workflowRunArgs = buildWorkflowRunArgs(
    selectedWorkflowName,
    String(repo),
    String(branch),
    inputGroup
  );

  const displayInfo = buildDisplayInfo(
    selectedWorkflowName,
    String(repo),
    String(branch),
    inputGroup
  );

  const shouldContinue = await confirm({
    message: `${displayInfo}\n\nDo you want to continue?`,
  });

  s.start("Running Workflow");
  if (shouldContinue) {
    const { stdout } = await execa("gh", workflowRunArgs);
    log.step(`Done ! Result : ${stdout}`);
  }
  s.stop();

  const shouldOpen = await confirm({
    message: "Do you want to open the workflow in the web ui?",
  });

  if (shouldOpen) {
    await execa`gh workflow view ${selectedWorkflowName} -R ${String(repo)} --web`;
  }

  outro(`Done ! \n View your workflow in the web ui : https://github.com/${String(repo)}/actions`);
}

// Only run if this is the main module (not imported for testing)
// In ESM, we check if import.meta.url matches the resolved file path
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  runWorkflowCreation().catch((error) => {
    log.error(String(error));
    process.exit(1);
  });
}

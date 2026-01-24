import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import envPaths from "env-paths";
import { parse as parseYaml } from "yaml";
import { execa } from "execa";
import {
  intro,
  outro,
  log,
  select,
  spinner,
  group,
  text,
  cancel,
  confirm,
} from "@clack/prompts";

import type {
  RepoConfig,
  Workflow,
  WorkflowInput,
  WorkflowDispatchInput,
  WorkflowDispatch,
} from "./workflow_types.js";

import type { Replay } from "./types.js";

import { isChoiceInput } from "./workflow_types.js";


/** Verify user is logged in to GH via GH CLI
 *
 * @returns
 */
export async function checkLogin(): Promise<boolean> {
  try {
    await execa("gh", ["auth", "status"]);
    log.step("Logged in successfully");
    return true;
  } catch (e) {
    log.step("Unexpected login state with GH");
    log.error(
      "You are not logged in! Run `gh auth login` to authenticate with GitHub",
    );
    return false;
  }
}

/**
 * Resolves the configuration file path based on XDG standards and platform defaults.
 * Priority:
 * 1. XDG_CONFIG_HOME/runr/config.yml (if set)
 * 2. ~/.config/runr/config.yml (Linux/Mac standard)
 * 3. Platform specific default (APPDATA on Windows, ~/Library/Preferences on Mac)
 * 4. ./config.yml (Legacy/Local fallback)
 */
export function getConfigPath(): string {
  // 1. Check XDG_CONFIG_HOME
  if (process.env.XDG_CONFIG_HOME) {
    const xdgPath = path.join(process.env.XDG_CONFIG_HOME, "runr", "config.yml");
    if (existsSync(xdgPath)) return xdgPath;
  }

  // 2. Check common ~/.config explicitly (preferred for CLI tools on Mac/Linux)
  if (os.platform() !== "win32") {
    const homeConfig = path.join(os.homedir(), ".config", "runr", "config.yml");
    if (existsSync(homeConfig)) return homeConfig;
  }

  // 3. Platform specific defaults via env-paths
  // Windows: %APPDATA%\runr\config.yml
  // Mac: ~/Library/Preferences/runr/config.yml
  // Linux: ~/.config/runr/config.yml (already covered above typically, but good fallback)
  const paths = envPaths("runr");
  const platformConfig = path.join(paths.config, "config.yml");
  if (existsSync(platformConfig)) return platformConfig;

  // 4. Fallback to local
  return "./config.yml";
}

/** Read in the ./config.yml which contains repos and associated branche
 *
 * @param cfgPath
 * @returns
 */
export async function loadConfig(
  cfgPath?: string,
): Promise<RepoConfig> {

  const resolvedPath = cfgPath || getConfigPath();

  log.step(`Loading config from: ${resolvedPath}`);

  const configTxt = await readFile(resolvedPath, "utf8");
  return parseYaml(configTxt) as RepoConfig;
}

export async function saveConfig(cfg: RepoConfig) {
  const resolvedPath = getConfigPath();
  log.step(`Saving config to: ${resolvedPath}`);
  await writeFile(resolvedPath, JSON.stringify(cfg, null, 2));
}

/**
 *
 * @param cfg
 * @returns
 */
export function getRepos(cfg: RepoConfig): string[] {
  log.step("Got defined repositories from config");
  return cfg.repos.map((r) => r.name).sort();
}

/**
 *
 * @param cfg
 * @param repoName
 * @returns
 */
export function getBranchesFromRepo(
  cfg: RepoConfig,
  repoName: string,
): string[] {
  log.step(`Retrieving Branches for ${repoName}`);
  const repo = cfg.repos.find((r) => r.name === repoName);
  return repo?.branches || [];
}

export async function getWorkflowsForRepo(repo: string): Promise<Workflow[]> {
  // TODO: Verify if it's possible to also use the branch
  // TODO: Handle no workflows available
  const result =
    await execa`gh workflow list -R ${repo} --json name,path,id,state`;
  return JSON.parse(result.stdout);
}

export function filterForActiveWorkflows(workflows: Workflow[]): Workflow[] {
  return workflows.filter((w) => w.state === "active").sort();
}

export async function getWorkflowInputs(
  workflowName: string,
  repo: string,
  branch: string,
): Promise<WorkflowInput[]> {
  const workflowViewCommandOutput =
    await execa`gh workflow view ${workflowName} -R ${repo} --ref ${branch} --yaml`;

  const workflow = parseYaml(
    workflowViewCommandOutput.stdout,
  ) as WorkflowDispatch;

  const inputs: Record<string, WorkflowDispatchInput> | undefined =
    workflow.on?.workflow_dispatch?.inputs;

  // Early return if no inputs are defined
  if (!inputs || Object.keys(inputs).length === 0) {
    log.warn("Workflow has no inputs defined");
    return [];
  }

  return Object.entries(inputs ?? {}).map(([name, input]) => ({
    name,
    type: input.type,
    default: String(input.default ?? ""),
    options: isChoiceInput(input) ? input.options : undefined,
    required: input.required ?? false,
  }));
}

export function buildInputPrompts(
  inputs: WorkflowInput[],
): Record<string, () => ReturnType<typeof text> | ReturnType<typeof select>> {
  const createdGroup: Record<
    string,
    () => ReturnType<typeof text> | ReturnType<typeof select>
  > = {};

  inputs.forEach((input) => {
    switch (input.type) {
      case "string":
      case "number":
      case "environment":
        createdGroup[input.name] = () =>
          text({
            message: "Input: " + input.name,
            placeholder: "Required? " + input.required,
            initialValue: input.default,
          });
        break;
      case "boolean":
        createdGroup[input.name] = () =>
          select({
            message: "Input: " + input.name,
            options: [
              { value: "true", label: "true" },
              { value: "false", label: "false" },
            ],
            initialValue: input.default,
          });
        break;
      case "choice":
        createdGroup[input.name] = () =>
          select({
            message: "Input: " + input.name,
            options: (input.options ?? []).map((opt) => ({
              value: opt,
              label: opt,
            })),
            initialValue: input.default,
          });
        break;
      default:
        log.error("Invalid Input Type !");
    }
  });

  return createdGroup;
}

export function buildWorkflowRunArgs(
  workflowName: string,
  repo: string,
  branch: string,
  inputGroup: Record<string, unknown>,
): string[] {
  const workflowRunArgs: string[] = [
    "workflow",
    "run",
    workflowName,
    "-R",
    repo,
    "--ref",
    branch,
  ];

  for (const [key, value] of Object.entries(inputGroup)) {
    workflowRunArgs.push("-f", `${key}=${value}`);
  }

  return workflowRunArgs;
}
/**
 *
 * @param workflowName
 * @param repo
 * @param branch
 * @param inputGroup
 * @returns
 */
export function buildDisplayInfo(
  workflowName: string,
  repo: string,
  branch: string,
  inputGroup: Record<string, unknown>,
): string {
  return [
    `Running Workflow : ${workflowName}`,
    `Repo             : ${repo}`,
    `Branch           : ${branch}`,
    ``,
    `Inputs :`,
    ...Object.entries(inputGroup).map(([k, v]) => `  ${k.padEnd(15)} : ${v}`),
  ].join("\n");
}

/**
 *
 * @param cfg
 * @param selectedRepo
 * @param selectedBranch
 * @param selectedWorkflow
 * @param inputGroup
 */
async function saveReplay(
  cfg: RepoConfig,
  selectedRepo: string,
  selectedBranch: string,
  selectedWorkflow: string,
  inputGroup: Record<string, unknown>,
) {
  // -- FEAT : Adding a replay to the config
  // 1. Ask if to save (y/n)
  // 2. Ask for nickname (input)
  // 3. Add to config
  const shouldSave = await confirm({
    message: "Do you want to save this workflow for future use?",
  })

  if (shouldSave) {
    const nickname = await text({
      message: "Enter a nickname for this workflow",
    })
    const replay: Replay = {
      nickname: String(nickname),
      repo: String(selectedRepo),
      branch: String(selectedBranch),
      workflow: String(selectedWorkflow),
      inputs: inputGroup,
    }

    log.info(JSON.stringify(replay, null, 4));

    // TODO: Add replay to config
    const currRepo = cfg.repos.find(r => r.name === selectedRepo);

    if (currRepo?.replays === null || currRepo?.replays === undefined) {
      currRepo!.replays = [];
    }

    currRepo!.replays.push(replay);

    await saveConfig(cfg);
  }
}
// --- LOGIN STATE
// try {
//   const { stdout } = await execa`gh auth status`;
//   log.success(stdout);
// } catch (e) {
//   log.error(
//     "You are not logged in! Run `gh auth login` to authenticate with GitHub",
//   );
// }

export async function main(): Promise<void> {
  const s = spinner();
  s.start();
  s.message("Constructing workflow command");

  intro("Initialization started");
  const isLoggedIn = await checkLogin();
  // TODO: Handle not loged in -- if !isLoggedIn return error and exit

  let cfg: RepoConfig;
  try {
    cfg = await loadConfig();
  } catch (error) {
    log.error(`Failed to load configuration file. Make sure 'config.yml' exists at one of the standard locations (e.g. ~/.config/runr/config.yml) or in the current directory.`);
    process.exit(1);
  }

  outro("Initialization finished");

  intro("Workflow setup started");
  const repos = getRepos(cfg);
  log.step(`Repos: ${repos}`);

  const selectedRepo = await select({
    message: "Pick a repository:",
    options: repos.map((r) => ({ value: r })).sort(),
  });

  const selectedBranch = await select({
    message: "Pick a branch:",
    options: getBranchesFromRepo(cfg, String(selectedRepo)).map((b) => ({
      value: b,
    })),
  });

  const possibleWorkflows = await getWorkflowsForRepo(String(selectedRepo));
  const activeWorkflows = filterForActiveWorkflows(possibleWorkflows);

  const selectedWorkflowById = await select({
    message: "",
    options: activeWorkflows.map((w) => ({
      value: w.id,
      label: w.name,
      hint: w.path,
    })),
  });

  const selectedWorkflowByName = activeWorkflows.find(
    (w) => w.id === selectedWorkflowById,
  );
  const selectedWorkflow = selectedWorkflowByName?.name ?? "";
  outro("Workflow setup finished");

  intro("Worfklow inputs started");
  // Construct Workflow Inputs
  const inputsArray: WorkflowInput[] = await getWorkflowInputs(
    selectedWorkflow,
    String(selectedRepo),
    String(selectedBranch),
  );

  log.message(`Workflow inputs: ${JSON.stringify(inputsArray, null, 4)}`);

  // Create prompt for inputs
  const createdGroup = buildInputPrompts(inputsArray);

  const inputGroup = await group(createdGroup, {
    onCancel: ({ results }) => {
      cancel("Operation cancelled.");
      process.exit(0);
    },
  });

  const workflowRunArgs = buildWorkflowRunArgs(
    selectedWorkflow,
    String(selectedRepo),
    String(selectedBranch),
    inputGroup,
  );

  const displayInfo = buildDisplayInfo(
    selectedWorkflow,
    String(selectedRepo),
    String(selectedBranch),
    inputGroup,
  );
  outro("Workflow inputs finished");

  intro("Workflow execution started");
  const shouldContinue = await confirm({
    message: `${displayInfo}\n\nDo you want to continue?`,
  });

  if (shouldContinue) {
    const { stdout } = await execa("gh", workflowRunArgs);
  }

  await saveReplay(cfg, String(selectedRepo), String(selectedBranch), String(selectedWorkflow), inputGroup);


  s.stop();

  const shouldOpen = await confirm({
    message: "Do you want to open the workflow in the web ui?",
  });

  if (shouldOpen) {
    await execa`gh workflow view ${selectedWorkflow} -R ${String(selectedRepo)} --web`;
  }

  s.stop();
  outro(
    `Done ! \n View your workflow in the web ui : https://github.com/${String(selectedRepo)}/actions`,
  );
}

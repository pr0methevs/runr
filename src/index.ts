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
  isCancel,
} from "@clack/prompts";

import type {
  Workflow,
  WorkflowInput,
  WorkflowDispatchInput,
  WorkflowDispatch,
} from "./workflow_types.js";

import type { RepoConfig, Replay } from "./types.js";

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
    const xdgPath = path.join(
      process.env.XDG_CONFIG_HOME,
      "runr",
      "config.yml",
    );
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
export async function loadConfig(cfgPath?: string): Promise<RepoConfig> {
  const resolvedPath = cfgPath || getConfigPath();

  log.step(`Loading config from: ${resolvedPath}`);

  const configTxt = await readFile(resolvedPath, "utf8");
  let cfg = parseYaml(configTxt) as RepoConfig;

  cfg.repos = cfg.repos || [];
  cfg.replays = cfg.replays || [];

  return cfg;
}

export async function selectWorkflowOrReplay(cfg: RepoConfig): Promise<{ selectedWorkflow: string; selectedRepo: string; selectedBranch: string; inputGroup: Record<string, unknown> }> {
  let selectedWorkflow: string;
  let selectedRepo: string;
  let selectedBranch: string;
  let inputGroup: Record<string, unknown>;

  // Replay or Workflow
  const decision = await select({
    message:
      "Do you want to assemble and dispatch a new Workflow command or use a saved Replay?",
    options: [
      { value: "workflow", label: "New Workflow" },
      { value: "replay", label: "Replay" },
    ],
  });

  switch (decision) {
    case "replay":
      // Get replays
      const storedReplays = cfg.replays;

      if (storedReplays.length === 0) {
        log.error("No replays found in config");
        process.exit(0);
      }

      const replay = await select({
        message: "Pick a replay:",
        options: storedReplays
          .map((r) => ({ value: r, label: r.nickname }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      });

      if (isCancel(replay)) {
        cancel("Operation cancelled.");
        process.exit(0);
      }

      selectedRepo = (replay as Replay).repo;
      selectedBranch = (replay as Replay).branch;
      selectedWorkflow = (replay as Replay).workflow;
      inputGroup = (replay as Replay).inputs;
      break;

    // If not a replay, always start a new workflow
    default:
      const repos = getRepos(cfg);
      log.step(`Repos: ${repos}`);

      selectedRepo = await select({
        message: "Pick a repository:",
        options: repos.map((r) => ({ value: r })).sort(),
      }) as string;

      selectedBranch = await select({
        message: "Pick a branch:",
        options: getBranchesFromRepo(cfg, String(selectedRepo)).map((b) => ({
          value: b,
        })),
      }) as string;

      const possibleWorkflows = await getWorkflowsForRepo(String(selectedRepo));
      const activeWorkflows = filterForActiveWorkflows(possibleWorkflows);

      const selectedWorkflowById = await select({
        message: "",
        options: activeWorkflows.map((w) => ({
          value: w.id,
          label: w.name,
          hint: w.path,
        })),
      })

      const selectedWorkflowByName = activeWorkflows.find(
        (w) => w.id === selectedWorkflowById
      );
      selectedWorkflow = selectedWorkflowByName?.name ?? "";
      outro("Workflow setup finished");

      intro("Worfklow inputs started");
      // Construct Workflow Inputs
      const inputsArray: WorkflowInput[] = await getWorkflowInputs(
        selectedWorkflow,
        String(selectedRepo),
        String(selectedBranch)
      );

      log.message(`Workflow inputs: ${JSON.stringify(inputsArray, null, 4)}`);

      // Create prompt for inputs
      const createdGroup = buildInputPrompts(inputsArray);

      inputGroup = await group(createdGroup, {
        onCancel: ({ results }) => {
          cancel("Operation cancelled.");
          process.exit(0);
        },
      });
      break;
  }
  return { selectedWorkflow, selectedRepo, selectedBranch, inputGroup };
}

/** Save the config to disk
 *
 * @param cfg
 */
export async function writeConfig(cfg: RepoConfig) {
  try {
    const resolvedPath = getConfigPath();
    log.step(`Saving config to: ${resolvedPath}`);
    await writeFile(resolvedPath, JSON.stringify(cfg, null, 2));
  } catch (e) {
    log.error("Failed to save config");
    throw e;
  }
}

/** Retrieve all defined repos from config
 *
 * @param cfg
 * @returns
 */
export function getRepos(cfg: RepoConfig): string[] {
  log.step("Got defined repositories from config");
  return cfg.repos.map((r) => r.name).sort();
}

/** Retrieve all defined branches from config for a specific repo
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

/** Retrieve all workflows for a specific repo
 *
 * @param repo
 * @returns
 */
export async function getWorkflowsForRepo(repo: string): Promise<Workflow[]> {
  // TODO: Verify if it's possible to also use the branch
  // TODO: Handle no workflows available
  const result =
    await execa`gh workflow list -R ${repo} --json name,path,id,state`;
  return JSON.parse(result.stdout);
}

/** Filter workflows for active workflows
 *
 * @param workflows
 * @returns
 */
export function filterForActiveWorkflows(workflows: Workflow[]): Workflow[] {
  return workflows.filter((w) => w.state === "active").sort();
}

/** Retrieve workflow inputs for a specific workflow
 *
 * @param workflowName
 * @param repo
 * @param branch
 * @returns
 */
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

/** Build input prompts for a specific workflow
 *
 * @param inputs
 * @returns
 */
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
        log.error("Invalid input type");
    }
  });

  return createdGroup;
}

/**
 * Build a workflow run command
 *
 * @param workflowName
 * @param repo
 * @param branch
 * @param inputGroup
 * @returns
 */
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
 * Build a display info string for the workflow run
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
 * Save a replay to the config
 *
 * @param cfg
 * @param selectedRepo
 * @param selectedBranch
 * @param selectedWorkflow
 * @param inputGroup
 */
export async function saveReplay(
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
  let nickname = await text({
    message: "Enter a name for the replay",
  });

  const replays = cfg.replays;

  if (replays.length === 0) {
    cfg.replays = [];
  }

  let exists = replays.some((r) => r.nickname === nickname);

  let newNickname = nickname;

  while (exists) {
    log.error("Replay with this nickname already exists");

    newNickname = await text({
      message: "Enter a different name for this replay",
    });

    exists = replays.some((r) => r.nickname === newNickname);
  }

  const replay: Replay = {
    nickname: String(newNickname),
    repo: String(selectedRepo),
    branch: String(selectedBranch),
    workflow: String(selectedWorkflow),
    inputs: inputGroup,
  };

  log.info(JSON.stringify(replay, null, 4));

  log.warning(`${replays.length} replays found`);

  cfg.replays.push(replay);

  await writeConfig(cfg);
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
    log.error(
      `Failed to load configuration file. Make sure 'config.yml' exists at one of the standard locations (e.g. ~/.config/runr/config.yml) or in the current directory.`,
    );
    process.exit(1);
  }

  outro("Initialization finished");

  intro("Workflow setup started");

  let { selectedWorkflow, selectedRepo, selectedBranch, inputGroup } = await selectWorkflowOrReplay(cfg!);

  const workflowRunArgs = buildWorkflowRunArgs(
    selectedWorkflow!,
    String(selectedRepo),
    String(selectedBranch),
    inputGroup!,
  );

  const displayInfo = buildDisplayInfo(
    selectedWorkflow!,
    String(selectedRepo),
    String(selectedBranch),
    inputGroup!,
  );
  outro("Workflow inputs finished");

  intro("Workflow execution started");
  const shouldContinue = await confirm({
    message: `${displayInfo}\n\nDo you want to continue?`,
  });

  if (shouldContinue) {
    try {
      // stdio: 'inherit' allows the gh command to print directly to the terminal
      await execa("gh", workflowRunArgs, { stdio: "inherit" });
      log.success("Workflow successfully triggered!");

      s.stop();

      s.message("Confirmations");

      const shouldSaveReplay = await confirm({
        message:
          "Do you want to save this workflow run command for future use?",
      });

      if (shouldSaveReplay) {
        await saveReplay(
          cfg,
          String(selectedRepo),
          String(selectedBranch),
          String(selectedWorkflow),
          inputGroup!,
        );
      }

      const shouldOpen = await confirm({
        message: "Do you want to open the workflow in the web ui?",
      });

      if (shouldOpen) {
        await execa`gh workflow view ${selectedWorkflow!} -R ${String(selectedRepo)} --web`;
      }

      outro(
        `Done ! \n View your workflow in the web ui : https://github.com/${String(selectedRepo)}/actions`,
      );
    } catch (error) {
      log.error(`Failed to trigger workflow: ${error}`);
      process.exit(1);
    }
  } else {
    cancel("Operation cancelled.");
    process.exit(0);
  }
}

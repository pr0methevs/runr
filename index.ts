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
interface RepoConfig {
  repos: Array<{
    name: string;
    branches: string[];
  }>;
}
intro("Starting Workflow Creation");

const s = spinner();

s.start("Checking Login");
// --- LOGIN STATE
try {
  const { stdout } = await execa`gh auth status`;
  log.success(stdout);
} catch (e) {
  log.error(
    "You are not logged in! Run `gh auth login` to authenticate with GitHub",
  );
}
s.stop();
outro("Finished Checking Login");

intro("Loading Config");

// Read and parse the YAML config at runtime
const configText = await readFile("./config.yml", "utf8");
const config = parseYaml(configText) as RepoConfig;

log.step(`Config : ${JSON.stringify(config, null, 4)}`);
outro("Finished Loading Config");

intro("Repo Selection");

// --- Get All Repos
const repos: string[] = config.repos.map((repo) => repo.name).sort();
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
  options:
    config.repos
      .find((r) => r.name === repo)
      ?.branches.map((branch) => ({ value: branch })) || [],
});

outro("Finished Branch Selection");

intro("Workflow Selection");

interface Workflow {
  name: string;
  path: string;
  id: number;
  state: string;
}

const workflowResult =
  await execa`gh workflow list -R ${repo.toString()} --json name,path,id,state`;

const workflows: Workflow[] = JSON.parse(workflowResult.stdout);

// Filter for only active workflows
const activeWorkflows = workflows.filter((w) => w.state === "active").sort();

// Select a workflow
const selectedWorkflowId = await select({
  message: "Select Workflow",
  options: activeWorkflows.map((w) => ({
    value: w.id,
    label: w.name,
    hint: w.path,
  })),
});

const selectedWorkflow = activeWorkflows.find(
  (w) => w.id === selectedWorkflowId,
);
const selectedWorkflowName = selectedWorkflow?.name ?? "";

log.step(`Selected Workflow: [${selectedWorkflowName}]`);
outro("Finished Workflow Selection");

intro("Workflow Input Retrieval");

// Get the worfklow inputs, their types, defaults and types
const workflowViewCommandOutput =
  await execa`gh workflow view ${selectedWorkflowName} -R ${repo.toString()} --ref ${String(branch)} --yaml`;


// Parse the output of workflowFile and get .on.workflow.dispatch_inputs
const workflow = parseYaml(
  workflowViewCommandOutput.stdout,
) as WorkflowDispatchParsed;

// Extract the inputs for the workflow, their types, defaults, and whether they are required
const inputs: Record<string, WorkflowDispatchInput> | undefined = workflow.on.workflow_dispatch.inputs;

// Convert inputs object to array with name, type, default, and required
const inputsArray = Object.entries(inputs ?? {}).map(([name, input]) => ({
  name,
  type: input.type,
  default: String(input.default ?? ""),
  options: isChoiceInput(input) ? input.options : undefined,
  required: input.required,
}));

outro("Finished Workflow Input Retrieval");

intro("User Input Collection");

const createdGroup: Record<string, () => ReturnType<typeof text> | ReturnType<typeof select>> = {};

// Get the inputs from user
inputsArray.forEach((input) => {
  switch (input.type) {
    case "string":
    case "number":
    case "environment":
      createdGroup[input.name] = () => text({ message: "Input " + input.name, placeholder: "Required? " + input.required, initialValue: input.default });
      break;
    case "boolean":
      createdGroup[input.name] = () => select({ message: "Input " + input.name, options: [{ value: "true", label: "True" }, { value: "false", label: "False" }], initialValue: input.default });
      break
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

})


const inputGroup = await group(
  createdGroup,
  {
    // On Cancel callback that wraps the group
    // So if the user cancels one of the prompts in the group this function will be called
    onCancel: ({ results }) => {
      cancel('Operation cancelled.');
      process.exit(0);
    },
  }
);

outro("Finished User Input Collection");

intro("Running Workflow");
// Build arguments array for execa
const workflowRunArgs: string[] = [
  "workflow", "run", selectedWorkflowName,
  "-R", repo.toString(),
  "--ref", String(branch),
];

// Add input fields
for (const [key, value] of Object.entries(inputGroup)) {
  workflowRunArgs.push("-f", `${key}=${value}`);
}

// Build display command for user confirmation
// Build display for user confirmation
const displayInfo = [
  `Running Workflow : ${selectedWorkflowName}`,
  `Repo             : ${String(repo)}`,
  `Branch           : ${String(branch)}`,
  ``,
  `Inputs :`,
  ...Object.entries(inputGroup).map(([k, v]) => `  ${k.padEnd(15)} : ${v}`)
].join("\n");

const shouldContinue = await confirm({
  message: `${displayInfo}\n\nDo you want to continue?`,
});

if (shouldContinue) {
  const { stdout } = await execa("gh", workflowRunArgs);
  log.step(`Done ! Result : ${stdout}`);
}

const shouldOpen = await confirm({
  message: "Do you want to open the workflow in the web ui?",
});

if (shouldOpen) {
  await execa`gh workflow view ${selectedWorkflowName} -R ${repo.toString()} --web`;
}

outro(`Done ! \n View your workflow in the web ui : https://github.com/${repo.toString()}/actions`);

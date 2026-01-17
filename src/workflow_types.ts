/**
 * GitHub Actions Workflow Dispatch Input Types
 * Represents the structure of a workflow_dispatch trigger with its inputs
 */

// ============================================================
// Input Type Definitions
// ============================================================

type WorkflowDispatchInputType =
  | "string"
  | "number"
  | "boolean"
  | "choice"
  | "environment";

interface BaseInput {
  description: string;
  required: boolean;
  default?: string | number | boolean;
}

interface StringInput extends BaseInput {
  type: "string";
  default?: string;
}

interface NumberInput extends BaseInput {
  type: "number";
  default?: number;
}

interface BooleanInput extends BaseInput {
  type: "boolean";
  default?: boolean;
}

interface ChoiceInput extends BaseInput {
  type: "choice";
  options: string[];
  default?: string;
}

interface EnvironmentInput extends BaseInput {
  type: "environment";
  default?: string;
}

type WorkflowDispatchInput =
  | StringInput
  | NumberInput
  | BooleanInput
  | ChoiceInput
  | EnvironmentInput;

// ============================================================
// Workflow Dispatch Trigger
// ============================================================

interface WorkflowDispatchTrigger {
  inputs?: Record<string, WorkflowDispatchInput>;
}

// ============================================================
// Workflow Triggers (on)
// ============================================================

interface WorkflowTriggers {
  workflow_dispatch?: WorkflowDispatchTrigger;
  push?: {
    branches?: string[];
    tags?: string[];
    paths?: string[];
  };
  pull_request?: {
    branches?: string[];
    types?: string[];
  };
  schedule?: Array<{ cron: string }>;
  // Add other triggers as needed
  [key: string]: unknown;
}

// ============================================================
// Job & Step Definitions
// ============================================================

interface WorkflowStep {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string | number | boolean>;
  env?: Record<string, string>;
  if?: string;
  "continue-on-error"?: boolean;
  "timeout-minutes"?: number;
  working_directory?: string;
}

interface WorkflowJob {
  name?: string;
  "runs-on": string | string[];
  needs?: string | string[];
  if?: string;
  environment?: string | { name: string; url?: string };
  outputs?: Record<string, string>;
  env?: Record<string, string>;
  defaults?: {
    run?: {
      shell?: string;
      "working-directory"?: string;
    };
  };
  steps: WorkflowStep[];
  "timeout-minutes"?: number;
  strategy?: {
    matrix?: Record<string, unknown>;
    "fail-fast"?: boolean;
    "max-parallel"?: number;
  };
  container?: string | Record<string, unknown>;
  services?: Record<string, unknown>;
}

// ============================================================
// Complete Workflow Definition
// ============================================================

interface GitHubWorkflow {
  name: string;
  on: WorkflowTriggers;
  env?: Record<string, string>;
  defaults?: {
    run?: {
      shell?: string;
      "working-directory"?: string;
    };
  };
  concurrency?: string | { group: string; "cancel-in-progress"?: boolean };
  jobs: Record<string, WorkflowJob>;
}

// ============================================================
// Alternative Types for YAML Parsing Quirk
// ============================================================

/**
 * When parsing YAML workflows, the `on` key is often converted to boolean `true`
 * because 'on' is a reserved YAML boolean value. This type handles that case.
 *
 * Use this when your YAML parser outputs `{ "true": { workflow_dispatch: ... } }`
 * instead of `{ "on": { workflow_dispatch: ... } }`
 */
interface GitHubWorkflowParsed {
  name: string;
  true: WorkflowTriggers;
  env?: Record<string, string>;
  defaults?: {
    run?: {
      shell?: string;
      "working-directory"?: string;
    };
  };
  concurrency?: string | { group: string; "cancel-in-progress"?: boolean };
  jobs?: Record<string, WorkflowJob>;
}

/**
 * Simplified version for workflow_dispatch-only workflows with the parsing quirk
 */
interface WorkflowDispatchParsed {
  name: string;
  on: {
    workflow_dispatch: WorkflowDispatchTrigger;
  };
  jobs?: Record<string, WorkflowJob>;
}

// ============================================================
// Simplified Type for Workflow Dispatch Inputs Only
// ============================================================

/**
 * Use this type when you only need to work with workflow_dispatch inputs
 */
interface WorkflowWithDispatchInputs {
  name: string;
  on: {
    workflow_dispatch: WorkflowDispatchTrigger;
  };
  jobs: Record<string, WorkflowJob>;
}

// ============================================================
// Type Guards for Input Types
// ============================================================

function isStringInput(input: WorkflowDispatchInput): input is StringInput {
  return input.type === "string";
}

function isNumberInput(input: WorkflowDispatchInput): input is NumberInput {
  return input.type === "number";
}

function isBooleanInput(input: WorkflowDispatchInput): input is BooleanInput {
  return input.type === "boolean";
}
function isChoiceInput(input: WorkflowDispatchInput): input is ChoiceInput {
  return input.type === "choice";
}

function isEnvironmentInput(
  input: WorkflowDispatchInput,
): input is EnvironmentInput {
  return input.type === "environment";
}

// ============================================================
// Exports
// ============================================================

export type {
  WorkflowDispatchInputType,
  WorkflowDispatchInput,
  StringInput,
  NumberInput,
  BooleanInput,
  ChoiceInput,
  EnvironmentInput,
  WorkflowDispatchTrigger,
  WorkflowTriggers,
  WorkflowStep,
  WorkflowJob,
  GitHubWorkflow,
  WorkflowDispatchParsed,
  WorkflowWithDispatchInputs,
};

export {
  isStringInput,
  isNumberInput,
  isBooleanInput,
  isChoiceInput,
  isEnvironmentInput,
};

export interface Replay {
    nickname: string;
    repo: string;
    branch: string;
    workflow: string;
    inputs: Record<string, unknown>;
}
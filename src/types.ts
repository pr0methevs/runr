interface RepoConfig {
    repos: Array<{
        name: string;
        branches: string[];
    }>;
    replays: Replay[];
}

interface Replay {
    nickname: string;
    repo: string;
    branch: string;
    workflow: string;
    inputs: Record<string, unknown>;
}

export type { RepoConfig, Replay };
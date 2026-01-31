# Branching Strategy

This project follows a simplified workflow inspired by **GitHub Flow** and **Trunk-Based Development** to ensure agility while maintaining code stability.

## Core Branches

### `main`
- **Role**: The source of truth.
- **Stability**: Must always be deployable.
- **Protection**: Direct commits are restricted. Changes must be merged via Pull Requests (PRs).
- **History**: We aim for a linear history where possible.

## Feature & Support Branches

When working on a specific task, create a short-lived branch from `main`.

### Naming Conventions

Use the following prefixes to categorize your branches. This helps in identifying the purpose of the branch at a glance.

| Prefix      | Description | Example |
| ----------- | ----------- | ------- |
| `feat/`     | New features or enhancements | `feat/interactive-menu` |
| `fix/`      | Bug fixes | `fix/input-validation` |
| `docs/`     | Documentation changes only | `docs/update-readme` |
| `refactor/` | Code refactoring (no behavior change) | `refactor/api-client` |
| `test/`     | Adding or modifying tests | `test/cli-coverage` |
| `chore/`    | Maintenance, dependencies, build config | `chore/bump-deps` |

**Format**: `<type>/<short-description>`
**Example**: `feat/add-workflow-filter`

### Branch Lifecycle

1.  **Create**: Start a new branch from `main`.
    ```bash
    git checkout main
    git pull origin main
    git checkout -b feat/my-new-feature
    ```

2.  **Develop**: Commit your changes frequently. Use [Conventional Commits](https://www.conventionalcommits.org/) for your commit messages.

3.  **Sync**: Keep your branch updated with `main` to minimize merge conflicts.
    ```bash
    git fetch origin
    git rebase origin/main
    ```

4.  **Push**: Push your branch to the remote repository.
    ```bash
    git push -u origin feat/my-new-feature
    ```

5.  **Pull Request**: Open a PR against `main`. Automated checks (CI) will run.

6.  **Cleanup**: Once merged, delete the local and remote branch.

## Release Process

Releases are effectively snapshots of the `main` branch at a point in time.
- Versions are managed via tags (e.g., `v1.0.0`).
- Semantic Versioning (`Major.Minor.Patch`) is strictly followed.

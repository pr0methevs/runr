## Project Overview
> Tech stack

This is a CLI tool that streamlines the GitHub Actions workflow dispatch process, built with:
- Runtime: Node.js, Bun
- Language: TypeScript
- CLI Interface: @clack/prompts
- Process Execution: execa
- Configuration: env-paths, yaml
- Testing: Jest, Bun Test
- Build Tool: tsup

## Workflow
> Essential Commands

- **Install dependencies**: `npm install`
- **Run development (Node)**: `npm run dev:node`
- **Run development (Bun)**: `npm run dev:bun`
- **Run tests (Node)**: `npm run test:node`
- **Run tests (Bun)**: `npm run test:bun`
- **Build**: `npm run build`
- **Coverage**: `npm run coverage`

## Code Standards
> Style Guidelines

- Use strict TypeScript typing (avoid `any`)
- Use proper error handling with async/await
- Follow existing file naming conventions (`*.ts`)
- Use `@clack/prompts` for user interactions
- Write descriptive commit messages
    - **Format**: `<type>[optional scope]: <description>`
    - **Types**:
        - `feat`: New feature
        - `fix`: Bug fix
        - `docs`: Documentation only
        - `style`: Formatting changes
        - `refactor`: Code restructuring
        - `perf`: Performance improvements
        - `test`: Adding/fixing tests
        - `chore`: Maintenance/build tasks
    - **Rules**:
        - Use imperative mood ("add" not "added")
        - No period at the end
        - Add `!` for breaking changes (e.g., `feat!:`)
        - Base the commit message analysis ONLY on staged files

## Testing Standards

- Write unit tests for new functionality
- Use Jest (or Bun Test) for testing
- Mock external calls (e.g., `execa`)
- Ensure tests pass before committing (`npm run test:node`)

## Git Workflow

- Create feature branches from `main`
- Use descriptive branch names: `feature/description` or `fix/issue-number`
- Keep commits atomic and focused
- Open pull requests with detailed descriptions

## Boundaries

- Never modify CI/CD configuration files without approval
- Never delete existing tests without replacement
- Never commit secrets or credentials
- Ensure cross-platform compatibility (Node.js and Bun)

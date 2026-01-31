# Contributing to Runr

Thank you for your interest in contributing to Runr! We welcome contributions from the community to help make this tool better. This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all, regardless of gender, sexual orientation, disability, ethnicity, religion, or similar personal characteristics. Please treat all community members with respect.

## Getting Started

### Prerequisites

- **Node.js**: v18 or higher is recommended.
- **Bun**: Optional, but supported for local development and testing.

### Installation

1.  **Fork the repository** on GitHub.
2.  **Clone your fork**:
    ```bash
    git clone https://github.com/your-username/runr.git
    cd runr
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    # or if using Bun
    bun install
    ```

### local Development

You can run the CLI tool locally using the provided scripts:

- **Using Node**:
  ```bash
  npm run dev:node
  ```
- **Using Bun**:
  ```bash
  npm run dev:bun
  ```

To build the production version:
```bash
npm run build
```

### Testing

We use [Jest](https://jestjs.io/) for testing. Please ensure all tests pass before submitting a Pull Request.

- **Run Tests**:
  ```bash
  npm run test:node
  ```
- **Check Coverage**:
  ```bash
  npm run coverage
  ```

## Development Workflow

### Branching Strategy
We follow specific guidelines for branching to keep our repository organized. Please review our [Branching Strategy](./docs/BRANCHING_STRATEGY.md) before starting your work.

### Code Style
- **TypeScript**: We use TypeScript for type safety. Ensure all new code is typed correctly and avoids `any` where possible.
- **Formatting**: Please maintain consistent formatting with the existing codebase.

### Commit Messages
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This helps us generate changelogs and version releases automatically.

**Format**: `<type>(<scope>): <description>`

**Examples**:
- `feat(cli): add interaction selection mode`
- `fix(parser): handle missing workflow inputs`
- `docs: update CONTRIBUTING.md`
- `chore: update dependencies`

## Pull Request Process

1.  Ensure your code follows the project's style and patterns.
2.  Update documentation (README, etc.) if your changes affect usage.
3.  Add unit tests for new features or bug fixes.
4.  Ensure all local tests pass.
5.  Create a Pull Request against the `main` branch.
6.  Fill out the PR template (if available) or provide a clear description of your changes.

All submissions require review. Please familiarize yourself with our [Code Review Guidelines](./docs/CODE_REVIEW_GUIDELINES.md).

## Reporting Issues

If you find a bug or have a feature request, please search existing issues first. If none exist, open a new issue with as much detail as possible (logs, reproduction steps, environment info).

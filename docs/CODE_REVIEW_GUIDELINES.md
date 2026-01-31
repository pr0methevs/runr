# Code Review Guidelines

Code reviews are a critical part of our development lifecycle. They ensure high code quality, facilitate knowledge sharing, and preserve the long-term maintainability of the project.

## For Authors (Before Opening a PR)

To ensure a smooth review process, please check the following before requesting a review:

- [ ] **Self-Review**: Read through your changes. clear out temporary code, commented-out blocks, or `console.log` statements used for debugging.
- [ ] **Tests**: Ensure you've added or updated unit tests covering your changes.
- [ ] **Build Check**: Verify that `npm run build` succeeds locally.
- [ ] **Test Check**: Verify that `npm run test:node` passes locally.
- [ ] **Description**: Provide a clear PR title and description. Explain *what* changed, *why* it changed, and how to *test* it. Link to related issues (e.g., `Fixes #123`).
- [ ] **Scope**: meaningful changes often touch multiple files, but try to keep PRs focused on a single logical change. Large PRs are harder to review.

## For Reviewers

### Review Checklist

When reviewing a Pull Request, verify the following:

#### 1. Functionality & Correctness
- Does the code achieve the stated goal?
- Are edge cases and verify error conditions handled?
- Is there any logic that looks buggy or overly complex?

#### 2. Tests
- Are there sufficient tests for the new functionality?
- Do the tests cover success and failure scenarios?
- Are the tests readable and maintainable?

#### 3. Code Style & Quality
- Are variable and function names descriptive and consistent?
- Is the code readable? (Comments should explain *why*, not *what*).
- Does it follow TypeScript best practices (e.g., avoiding `any`, using appropriate types)?
- specific to `runr`: Are CLI prompts clear user-friendly?

#### 4. Security & Performance
- Are inputs validated properly?
- slightly inefficient code is fine, but are there blatant performance issues (e.g., unnecessary loops, memory leaks)?

### Etiquette & Best Practices

- **Be Constructive**: Focus on the code, not the person. Frame feedback as questions or suggestions.
  - *Good*: "Have we considered handling the case where the input is empty?"
  - *Avoid*: "You forgot to check for empty input."
- **Explain Reasoning**: Don't just ask for changes; explain *why* a change is beneficial (e.g., robust, cleaner, standard practice).
- **Acknowledge Good Work**: Don't hesitate to praise comments for clever solutions or clean implementations!
- **Distinguish Requirements**: Be clear about what is a *blocking* issue versus a *nitpick* or optional suggestion. (You can prefix comments with `[Nit]` for minor style preferences).

### Review Actions

- **Request Changes**: Use this if there are bugs, missing tests, or significant design flaws that must be addressed before merging.
- **Comment**: Use this for questions or non-blocking suggestions.
- **Approve**: Use this when the changes look good and you are confident in them merging into `main`.

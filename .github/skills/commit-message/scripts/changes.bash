#!/bin/bash

# ==============================================================================
# CONVENTIONAL COMMITS GUIDE
# ==============================================================================
# Format: <type>[optional scope]: <description>
# Types: 
#   feat: New feature | fix: Bug fix | perf: Performance
#   refactor: Logic change (no feat/fix) | test: Tests | docs: Documentation
#   build: Build system | ci: CI config | chore: Maintenance | style: Formatting
#
# Rules:
#   - Use imperative mood ("add", not "added")
#   - No period at the end of the header
#   - Breaking change: Add '!' after type/scope (e.g., feat!: ...)
#   - Body/Footer: Use for complex changes or BREAKING CHANGE details.
# ==============================================================================

# 1. Basic Info
current_branch=$(git rev-parse --abbrev-ref HEAD)
echo "### Branch: $current_branch"

# 2. Status and Staged Changes (for the next commit)
echo "### Current Status"
git status -s

echo "### Staged Changes (Diff for next commit)"
git diff --cached

# 3. Branch History (Every commit since branching from main/master)
echo "### Branch History (Commits and Diffs)"
# Automatically find the fork point from main or master
fork_point=$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null)

if [ -n "$fork_point" ] && [ "$fork_point" != "$(git rev-parse HEAD)" ]; then
    # Show each commit's message and its specific diff
    git log $fork_point..HEAD -p --reverse --pretty=format:"----------------------------------------%nCommit: %h%nAuthor: %an%nDate:   %ad%nSubject: %s%n%n%b"
else
    echo "No unique commits on this branch yet or already on main/master."
fi
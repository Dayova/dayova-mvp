# Issue tracker: GitHub

Issues and PRDs for this repo currently live as GitHub issues in `Dayova/dayova-mvp`.

Repo: https://github.com/Dayova/dayova-mvp

Use the `gh` CLI for issue operations.

## Future migration

The team plans to migrate issue tracking to Linear in the future. That migration is tracked in GitHub issue #20:

https://github.com/Dayova/dayova-mvp/issues/20

Until this file is updated, skills should continue treating GitHub Issues as the source of truth for issues and PRDs.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

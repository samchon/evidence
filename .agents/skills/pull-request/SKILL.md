---
name: pull-request
description: Defines Evidence branch, commit, PR submission, check monitoring, and merge boundaries. Use when the user authorizes the corresponding delivery action; ordinary local edits do not imply publication or merge.
---

# Pull Request Submission

## Authorization And Branch

Carry out the user's authorized delivery without asking again for steps already included. A request to submit a PR includes creating a topic branch, committing, pushing that branch, and opening the PR. It does not imply merging.

Use `master` as the default target. Fetch and inspect the target, preserve unrelated work, and branch for the outcome, for example `chore/workspace-foundation` or `feat/markdown-adapter`. Do not commit directly to the target. Use the existing checkout when it can keep the work isolated without disturbing user changes.

## Finish The Change

Read the development and review skills. Implement the concrete scope, update its documentation, run relevant validation, format, and review the complete diff before submitting. Keep coherent changes together and use Conventional Commit subjects such as `chore(workspace): bootstrap package and test workspaces`.

Stage the authorized paths explicitly when the checkout contains mixed work. Confirm generated package README/LICENSE copies, build outputs, temporary consumers, and credentials are absent from the staged diff.

## Submit

Write the PR in English. Lead with the problem and resulting behavior, then describe the relevant scope and verification. Link the issue it resolves; use a closing keyword only when its acceptance criteria are actually met. Include user-requested additions even when they extend the issue's original text.

Use a file-backed body with `gh pr create --body-file`. Push only the topic branch with upstream tracking. Keep the title and body aligned with the final implementation if scope changes; do not leave abandoned approaches as the operative description.

## Checks And Completion

After a push, monitor every relevant check on that exact head until it settles. Inspect failed job logs, fix verified defects in the same branch, rerun affected local checks, and push the correction. Do not treat a previous head's green result as acceptance for the current head.

Report the PR URL, what changed, and the local/CI result. If a runner, permission, or external service blocks validation, state the actual limitation. Merge only when explicitly requested or already included in a standing mandate, after its required checks and review gates pass. Never bypass branch protection to complete a request.

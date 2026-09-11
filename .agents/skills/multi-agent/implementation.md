# Parallel Implementation

Derive assignments from the dependency graph and disjoint file ownership. Give an agent a coherent feature or adapter it can implement immediately, not a waiting or coordinator-only role.

State the shared model/API assumptions before concurrent edits. Keep package manifests, lockfile changes, global formatting, and shared generated assets under one owner. Agents surface integration changes to the lead instead of independently rewriting shared contracts.

Each implementation owner validates its behavior and reports changed files, commands, limitations, and any necessary follow-up. The lead integrates the results, runs cross-feature and packed-package checks where relevant, and reviews the whole final diff. Independent green tests do not prove shared identity, configuration, or packaging semantics agree.

Only the authorized delivery owner commits, pushes, or opens/updates the PR unless the user explicitly assigns those actions differently. Stop using assignment-owned processes and temporary resources when work is complete.

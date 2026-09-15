import { TestValidator } from "@nestia/e2e";

import { EvidenceFileGlob } from "evidence";

/**
 * Prunes impossible or fully excluded subtrees while preserving later
 * reinclusion.
 *
 * Traversal may skip directories only when no later pattern can select a
 * descendant; ordinary directory names, including dependency directories, have
 * no implicit ignore policy.
 *
 * 1. Ask scoped and broad globs about selected ancestors, unselected siblings,
 *    dependency folders, and a bare directory pattern.
 * 2. Exclude an entire private subtree and require both it and its descendants to
 *    be prunable.
 * 3. Reinclude one private specification and require traversal of only the
 *    prefixes that could reach that file, while a partial file exclusion keeps
 *    the private directory traversable.
 * 4. Append a final private exclusion and require it to override both traversal
 *    and file matching after an earlier reinclusion.
 */
export function test_glob_pruning(): void {
  // Directory names have no implicit ignore policy.
  const scoped = new EvidenceFileGlob(["lib/contracts/**"]);
  const broad = new EvidenceFileGlob(["**/*.md"]);

  TestValidator.predicate(
    "selected ancestor",
    scoped.couldMatchDescendant("lib"),
  );
  TestValidator.predicate(
    "selected directory",
    scoped.couldMatchDescendant("lib/contracts"),
  );
  TestValidator.predicate(
    "unselected neighbor",
    !scoped.couldMatchDescendant("lib/other"),
  );
  TestValidator.predicate(
    "explicit dependency folder",
    broad.couldMatchDescendant("node_modules/package"),
  );
  TestValidator.predicate(
    "bare directory has no descendants",
    !new EvidenceFileGlob(["src"]).couldMatchDescendant("src"),
  );

  // A subtree-wide exclusion can prune; a later positive restores only viable prefixes.
  const excluded = new EvidenceFileGlob(["**/*.md", "!private/**"]);
  const restored = new EvidenceFileGlob([
    "**/*.md",
    "!private/**",
    "private/public/spec.md",
  ]);
  const partial = new EvidenceFileGlob(["**/*", "!private/*.md"]);

  TestValidator.predicate(
    "excluded directory",
    !excluded.couldMatchDescendant("private"),
  );
  TestValidator.predicate(
    "excluded descendant",
    !excluded.couldMatchDescendant("private/nested"),
  );
  TestValidator.predicate(
    "reincluded parent",
    restored.couldMatchDescendant("private"),
  );
  TestValidator.predicate(
    "reincluded descendant",
    restored.couldMatchDescendant("private/public"),
  );
  TestValidator.predicate(
    "reinclusion stays narrow",
    !restored.couldMatchDescendant("private/secret"),
  );
  TestValidator.predicate(
    "partial exclusion keeps traversal",
    partial.couldMatchDescendant("private"),
  );

  // A later exclusion still overrides a previously restored selection.
  const removedAgain = new EvidenceFileGlob([
    "**/*",
    "!private/**",
    "private/public/**",
    "!private/**",
  ]);

  TestValidator.predicate(
    "last pattern wins for traversal",
    !removedAgain.couldMatchDescendant("private"),
  );
  TestValidator.predicate(
    "last pattern wins for files",
    !removedAgain.matches("private/public/spec.md"),
  );
}

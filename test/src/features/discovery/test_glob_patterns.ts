import { TestValidator } from "@nestia/e2e";

import { EvidenceFileGlob } from "@wrtnlabs/evidence";

/**
 * Preserves upstream wildcard boundaries, Unicode characters, and ordered
 * exclusions.
 *
 * File selection must preserve the configured pattern sequence after
 * normalizing separators, without adding character-class or case-insensitive
 * glob semantics.
 *
 * 1. Match shallow and recursive Markdown patterns, proving that `*` remains in
 *    one segment while `**` accepts both zero and nested segments.
 * 2. Apply normalized include, exclusion, and later reinclusion patterns; require
 *    the public private file to return while its excluded neighbor and a case
 *    variant remain unmatched.
 * 3. Check that `?` consumes Unicode code points and that directory-only and
 *    bracket spellings retain their literal, non-extension behavior.
 * 4. Reject empty, exclusion-only, absolute, drive-qualified, parent-traversing,
 *    and malformed pattern lists before discovery begins.
 */
export async function test_glob_patterns(): Promise<void> {
  // A single star stays in one segment; globstar also accepts no intermediate directory.
  const shallow = new EvidenceFileGlob(["docs/*.md"]);
  const recursive = new EvidenceFileGlob(["docs/**/*.md"]);

  TestValidator.predicate("shallow file", shallow.matches("docs/spec.md"));
  TestValidator.predicate(
    "shallow boundary",
    !shallow.matches("docs/nested/spec.md"),
  );
  TestValidator.predicate(
    "globstar zero segments",
    recursive.matches("docs/spec.md"),
  );
  TestValidator.predicate(
    "globstar nested",
    recursive.matches("docs/nested/spec.md"),
  );

  // Separators normalize, but case and the order of exclusions remain significant.
  const ordered = new EvidenceFileGlob([
    "docs\\**\\*.md",
    "!docs/private/**",
    "docs/private/public.md",
  ]);

  TestValidator.predicate(
    "normalized path",
    ordered.matches("docs\\nested\\spec.md"),
  );
  TestValidator.predicate(
    "reincluded file",
    ordered.matches("docs/private/public.md"),
  );
  TestValidator.predicate(
    "excluded neighbor",
    !ordered.matches("docs/private/secret.md"),
  );
  TestValidator.predicate(
    "case-sensitive spelling",
    !ordered.matches("Docs/spec.md"),
  );

  // A question mark consumes one code point, including one outside the BMP.
  const character = new EvidenceFileGlob(["scripts/check-?.ts"]);

  TestValidator.predicate(
    "Unicode character",
    character.matches("scripts/check-😀.ts"),
  );
  TestValidator.predicate(
    "two characters",
    !character.matches("scripts/check-ab.ts"),
  );
  TestValidator.predicate(
    "bare directory",
    !new EvidenceFileGlob(["docs/"]).matches("docs/spec.md"),
  );
  TestValidator.predicate(
    "literal bracket",
    new EvidenceFileGlob(["docs/[a].md"]).matches("docs/[a].md"),
  );
  TestValidator.predicate(
    "no character class extension",
    !new EvidenceFileGlob(["docs/[a].md"]).matches("docs/a.md"),
  );

  // Invalid glob syntax must reject before filesystem discovery.
  for (const patterns of [
    [],
    ["!docs/**"],
    [""],
    ["!"],
    ["/docs/**"],
    ["C:docs/**"],
    ["C:/docs/**"],
    ["../docs/**"],
    ["docs//*.md"],
  ])
    await TestValidator.error("invalid glob selection", async () => {
      new EvidenceFileGlob(patterns);
    });
}

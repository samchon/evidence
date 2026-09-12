import { TestValidator } from "@nestia/e2e";

import { FileGlob } from "../../../../packages/evidence/src/internal/FileGlob";

/** Preserves upstream wildcard boundaries, Unicode characters, and ordered exclusions. */
export async function test_glob_patterns(): Promise<void> {
  // A single star stays in one segment; globstar also accepts no intermediate directory.
  const shallow = new FileGlob(["docs/*.md"]);
  const recursive = new FileGlob(["docs/**/*.md"]);

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
  const ordered = new FileGlob([
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
  const character = new FileGlob(["scripts/check-?.ts"]);

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
    !new FileGlob(["docs/"]).matches("docs/spec.md"),
  );
  TestValidator.predicate(
    "literal bracket",
    new FileGlob(["docs/[a].md"]).matches("docs/[a].md"),
  );
  TestValidator.predicate(
    "no character class extension",
    !new FileGlob(["docs/[a].md"]).matches("docs/a.md"),
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
      new FileGlob(patterns);
    });
}

import { EvidenceSourceLoader } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { SourcePath } from "../../../../packages/evidence/src/internal/SourcePath";
import { TestFileSystem } from "../../internal/TestFileSystem";

/**
 * Keeps path identity case-sensitive and rejects ambiguous root spellings.
 *
 * Discovery uses portable, case-sensitive source identities even on a filesystem
 * that can otherwise accept alternate spellings.
 *
 * 1. Load a case-misspelled root and exact file beside the correctly cased file;
 *    require case-mismatch diagnostics for the former and completion for the latter.
 * 2. Reject empty, padded, globbed, and drive-relative roots plus a drive-relative
 *    exact file before scanning can depend on the process working directory.
 * 3. Check containment for exact descendants and roots, trailing separators,
 *    sibling prefixes, case variants, and Windows and POSIX parent escapes.
 */
export async function test_source_paths(): Promise<void> {
  const location = join(__dirname, "paths-" + randomUUID());

  await TestFileSystem.experiment(
    location,
    { "Docs/Spec.md": "# Contract" },
    async (directory) => {
      const config = join(directory, "evidence.config.ts");

      // Root and exact-file misspellings are diagnosed consistently on both filesystem kinds.
      const wrongRoot = await EvidenceSourceLoader.glob(config, {
        root: "docs",
        files: ["*.md"],
      });
      const wrongFile = await EvidenceSourceLoader.file(config, "Docs/spec.md");
      const correct = await EvidenceSourceLoader.file(config, "Docs/Spec.md");

      TestValidator.equals(
        "root case mismatch",
        wrongRoot.diagnostics[0]?.code,
        "case-mismatch",
      );
      TestValidator.equals(
        "file case mismatch",
        wrongFile.diagnostics[0]?.code,
        "case-mismatch",
      );
      TestValidator.predicate("exact case accepted", correct.complete);

      // Invalid root values fail before any scan and do not depend on drive cwd state.
      for (const root of ["", " Docs", "Docs ", "Docs/*", "C:contracts"])
        await TestValidator.error("invalid root", () =>
          EvidenceSourceLoader.glob(config, { root, files: ["**"] }),
        );
      await TestValidator.error("drive-relative exact path", () =>
        EvidenceSourceLoader.file(config, "C:spec.md"),
      );

      // A containment test must respect separators and case, including Windows spellings.
      TestValidator.predicate(
        "descendant",
        SourcePath.contains("C:/project", "C:/project/src/a.ts"),
      );
      TestValidator.predicate(
        "root itself",
        SourcePath.contains("C:/project", "C:/project"),
      );
      TestValidator.predicate(
        "trailing separator",
        SourcePath.contains("C:/project/", "C:/project"),
      );
      TestValidator.predicate(
        "sibling prefix",
        !SourcePath.contains("C:/project", "C:/project-other/a.ts"),
      );
      TestValidator.predicate(
        "case boundary",
        !SourcePath.contains("C:/Project", "C:/project/a.ts"),
      );
      TestValidator.predicate(
        "POSIX boundary",
        !SourcePath.contains("/project", "/project2/a.ts"),
      );
      TestValidator.predicate(
        "Windows parent escape",
        !SourcePath.contains("C:/project", "C:/project/../outside/a.ts"),
      );
      TestValidator.predicate(
        "POSIX parent escape",
        !SourcePath.contains("/project", "/project/../outside/a.ts"),
      );
    },
  );
}

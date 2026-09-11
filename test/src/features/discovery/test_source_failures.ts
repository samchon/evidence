import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { EvidenceSourceLoader } from "../../../../packages/evidence/src/EvidenceSourceLoader";
import { SourcePath } from "../../../../packages/evidence/src/internal/SourcePath";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Distinguishes healthy empty selections from missing roots, files, and invalid UTF-8. */
export async function test_source_failures(): Promise<void> {
  const location = join(__dirname, "failures-" + randomUUID());

  await TestFileSystem.experiment(
    location,
    { "docs/valid.md": "# Valid", "root-file": "Not a directory" },
    async (directory) => {
      const config = join(directory, "evidence.config.ts");

      // A complete empty glob is different from a root that could not be loaded.
      const empty = await EvidenceSourceLoader.glob(config, {
        files: ["absent/**/*.md"],
      });
      const missingRoot = await EvidenceSourceLoader.glob(config, {
        root: "missing",
        files: ["docs/*.md"],
      });
      const occupiedRoot = await EvidenceSourceLoader.glob(config, {
        root: "root-file",
        files: ["**/*.md"],
      });

      TestValidator.predicate("healthy empty selection", empty.complete);
      TestValidator.equals("empty inventory", empty.files, []);
      TestValidator.predicate("missing root fails", !missingRoot.complete);
      TestValidator.equals(
        "missing root cause",
        missingRoot.diagnostics[0]?.code,
        "root-unreadable",
      );
      TestValidator.equals(
        "non-directory root cause",
        occupiedRoot.diagnostics[0]?.code,
        "root-unreadable",
      );
      TestValidator.predicate(
        "missing root remains watched",
        missingRoot.dependencies.some(
          (dependency) =>
            dependency.path === SourcePath.slash(join(directory, "missing")) &&
            dependency.recursive,
        ),
      );

      // Exact files diagnose absence and directories rather than returning an empty success.
      const missingFile = await EvidenceSourceLoader.file(
        config,
        "docs/missing.md",
      );
      const directoryFile = await EvidenceSourceLoader.file(config, "docs");

      TestValidator.predicate(
        "missing exact file fails",
        !missingFile.complete,
      );
      TestValidator.equals(
        "directory is not a file",
        directoryFile.diagnostics[0]?.code,
        "not-file",
      );

      // Valid neighbors remain inspectable, but malformed bytes make the snapshot incomplete.
      await writeFile(
        join(directory, "docs/invalid.md"),
        Buffer.from([0xc3, 0x28]),
      );

      const malformed = await EvidenceSourceLoader.glob(config, {
        files: ["docs/*.md"],
      });

      TestValidator.predicate("invalid UTF-8 fails", !malformed.complete);
      TestValidator.equals(
        "encoding diagnostic",
        malformed.diagnostics.map((diagnostic) => diagnostic.code),
        ["invalid-encoding"],
      );
      TestValidator.equals(
        "valid neighbor retained",
        malformed.files.flatMap((file) =>
          file.addresses.map((address) => address.relative),
        ),
        ["docs/valid.md"],
      );

      // Excluded files are not opened, so excluded malformed bytes do not poison discovery.
      const excluded = await EvidenceSourceLoader.glob(config, {
        files: ["docs/*.md", "!docs/invalid.md"],
      });

      TestValidator.predicate(
        "deliberately excluded malformed file",
        excluded.complete,
      );
    },
  );
}

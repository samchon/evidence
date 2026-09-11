import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceSourceLoader } from "../../../../packages/evidence/src/EvidenceSourceLoader";
import { SourcePath } from "../../../../packages/evidence/src/internal/SourcePath";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Anchors roots to the config, preserves raw source, and returns deterministic snapshots. */
export async function test_source_snapshots(): Promise<void> {
  const location = join(__dirname, "sources " + randomUUID());
  const content =
    "\uFEFF" +
    dedent`
    # Contract

    Preserve this source.
  `.replaceAll("\n", "\r\n");

  await TestFileSystem.experiment(
    location,
    {
      "project/evidence.config.ts": "export default {};",
      "shared/문서.md": content,
      "shared/a.md": "# A",
      "shared/private/hidden.md": "# Hidden",
      "shared/private/public.md": "# Public",
      "shared/custom.unknown": "Adapter must account for this file.",
    },
    async (directory) => {
      // Relative and absolute population roots select the same files from a nested config.
      const config = join(directory, "project/evidence.config.ts");
      const files = ["**/*.md", "!private/**", "private/public.md"];

      const relative = await EvidenceSourceLoader.glob(config, {
        root: "../shared",
        files,
      });
      const absolute = await EvidenceSourceLoader.glob(config, {
        root: join(directory, "shared"),
        files,
      });

      TestValidator.predicate("complete relative discovery", relative.complete);
      TestValidator.equals(
        "absolute-root inventory",
        relative.files,
        absolute.files,
      );
      TestValidator.equals(
        "deterministic address order",
        relative.files.flatMap((file) =>
          file.addresses.map((address) => address.relative),
        ),
        ["a.md", "private/public.md", "문서.md"],
      );
      TestValidator.equals(
        "raw source with BOM and CRLF",
        relative.files.find((file) =>
          file.addresses.some((address) => address.relative === "문서.md"),
        )?.content,
        content,
      );
      TestValidator.equals("root display", relative.root.display, "../shared");
      TestValidator.predicate(
        "root tracks new matches",
        relative.dependencies.some(
          (dependency) =>
            dependency.path === SourcePath.slash(join(directory, "shared")) &&
            dependency.recursive,
        ),
      );

      // An unchanged file has a stable digest; edits invalidate it.
      const previous = relative.files.find((file) =>
        file.addresses.some((address) => address.relative === "a.md"),
      );
      await TestFileSystem.save(directory, { "shared/a.md": "# Changed" });

      const changed = await EvidenceSourceLoader.file(config, "../shared/a.md");

      TestValidator.predicate("exact local file", changed.complete);
      TestValidator.notEquals(
        "changed source digest",
        changed.files[0]?.digest,
        previous?.digest,
      );
      TestValidator.equals(
        "exact path display",
        changed.files[0]?.addresses[0]?.display,
        "../shared/a.md",
      );

      // Discovery retains unknown extensions for explicit adapter acceptance or rejection.
      const unclassified = await EvidenceSourceLoader.glob(config, {
        root: "../shared",
        files: ["*.unknown"],
      });

      TestValidator.predicate(
        "unclassified file retained",
        unclassified.complete,
      );
      TestValidator.equals(
        "unclassified inventory",
        unclassified.files[0]?.addresses[0]?.relative,
        "custom.unknown",
      );
    },
  );
}

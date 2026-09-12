import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { link, symlink } from "node:fs/promises";
import { join } from "node:path";

import { EvidenceSourceLoader } from "../../../../packages/evidence/src/EvidenceSourceLoader";
import { SourcePath } from "../../../../packages/evidence/src/internal/SourcePath";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Deduplicates linked files without losing addresses and diagnoses traversed directory cycles. */
export async function test_source_links(): Promise<void> {
  const location = join(__dirname, "links-" + randomUUID());

  await TestFileSystem.experiment(
    location,
    {
      "project/evidence.config.ts": "export default {};",
      "schema/model.prisma": dedent`
        model Sale {
          id Int @id
        }
      `,
    },
    async (directory) => {
      // Directory aliases and hard links identify the same physical schema.
      await symlink(
        join(directory, "schema"),
        join(directory, "project/alias"),
        "junction",
      );
      await symlink(
        join(directory, "project/alias"),
        join(directory, "project/chain"),
        "junction",
      );
      await link(
        join(directory, "schema/model.prisma"),
        join(directory, "project/hard.prisma"),
      );
      const config = join(directory, "project/evidence.config.ts");

      const snapshot = await EvidenceSourceLoader.glob(config, {
        files: ["**/*.prisma"],
      });

      TestValidator.predicate("linked inventory complete", snapshot.complete);
      TestValidator.equals("one physical schema", snapshot.files.length, 1);
      TestValidator.equals(
        "all selected aliases",
        snapshot.files.flatMap((file) =>
          file.addresses.map((address) => address.relative),
        ),
        ["alias/model.prisma", "chain/model.prisma", "hard.prisma"],
      );
      for (const dependency of ["schema", "project/alias", "project/chain"])
        TestValidator.predicate(
          "link topology dependency",
          snapshot.dependencies.some(
            (entry) =>
              entry.path === SourcePath.slash(join(directory, dependency)),
          ),
        );

      // A linked root retains its own logical path space.
      const linkedRoot = await EvidenceSourceLoader.glob(config, {
        root: "alias",
        files: ["*.prisma"],
      });

      TestValidator.predicate("linked root complete", linkedRoot.complete);
      TestValidator.equals(
        "linked root address",
        linkedRoot.files.flatMap((file) =>
          file.addresses.map((address) => address.relative),
        ),
        ["model.prisma"],
      );
      TestValidator.equals(
        "shared physical identity",
        linkedRoot.files[0]?.id,
        snapshot.files[0]?.id,
      );

      // A followed cycle is a failure; an explicitly excluded cycle is never traversed.
      await symlink(
        join(directory, "project"),
        join(directory, "project/loop"),
        "junction",
      );

      const cyclic = await EvidenceSourceLoader.glob(config, {
        files: ["**/*.prisma"],
      });
      const excluded = await EvidenceSourceLoader.glob(config, {
        files: ["**/*.prisma", "!loop/**"],
      });

      TestValidator.predicate("cyclic population incomplete", !cyclic.complete);
      TestValidator.equals(
        "cycle cause",
        cyclic.diagnostics.map((diagnostic) => diagnostic.code),
        ["symlink-cycle"],
      );
      TestValidator.predicate(
        "excluded cycle does not fail",
        excluded.complete,
      );
      TestValidator.equals(
        "excluded cycle preserves files",
        excluded.files.length,
        1,
      );
    },
  );
}

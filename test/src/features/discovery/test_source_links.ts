import { EvidSourceLoader } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { link, symlink } from "node:fs/promises";
import { join } from "node:path";

import { EvidSourcePath } from "../../../../packages/evidence/src/internal/EvidSourcePath";
import { TestFileSystem } from "../../internal/TestFileSystem";

/**
 * Deduplicates linked files without losing addresses and diagnoses traversed directory cycles.
 *
 * A snapshot identifies one physical file while preserving every selected logical
 * address, and follows links only while their topology remains acyclic.
 *
 * 1. Create directory junction aliases and a hard link to one Prisma schema,
 *    then require one physical file with all three selected addresses and link
 *    topology dependencies. Require the first logical address to own its stable
 *    fingerprint path while the physical project root maps to `.`.
 * 2. Select through a linked root and require its local relative address while
 *    preserving the same physical identity as the original snapshot. Require
 *    the root's configured alias to remain in portable fingerprint metadata.
 * 3. Add a junction cycle and require an incomplete snapshot with the
 *    symlink-cycle diagnostic.
 * 4. Exclude the cyclic path and require complete discovery with the original
 *    single physical schema still present.
 */
export async function test_source_links(): Promise<void> {
  const location: string = join(__dirname, "links-" + randomUUID());

  await TestFileSystem.experiment(
    location,
    {
      "project/evid.config.ts": "export default {};",
      "schema/model.prisma": dedent`
        model Sale {
          id Int @id
        }
      `,
    },
    async (directory: string): Promise<void> => {
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
      const config: string = join(directory, "project/evid.config.ts");

      const snapshot = await EvidSourceLoader.glob(config, {
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
      TestValidator.equals(
        "logical fingerprint path",
        snapshot.files[0]?.fingerprintPath,
        "alias/model.prisma",
      );
      TestValidator.equals(
        "project fingerprint root",
        snapshot.files[0]?.fingerprintRoot,
        {
          physicalPath: EvidSourcePath.slash(join(directory, "project")),
          fingerprintPath: ".",
        },
      );
      const linkDependencies: string[] = [
        "schema",
        "project/alias",
        "project/chain",
      ];
      for (const dependency of linkDependencies)
        TestValidator.predicate(
          "link topology dependency",
          snapshot.dependencies.some(
            (entry) =>
              entry.path === EvidSourcePath.slash(join(directory, dependency)),
          ),
        );

      // A linked root retains its own logical path space.
      const linkedRoot = await EvidSourceLoader.glob(config, {
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
      TestValidator.equals(
        "linked root fingerprint path",
        linkedRoot.files[0]?.fingerprintPath,
        "alias/model.prisma",
      );
      TestValidator.equals(
        "linked root fingerprint mapping",
        linkedRoot.files[0]?.fingerprintRoot,
        {
          physicalPath: EvidSourcePath.slash(join(directory, "schema")),
          fingerprintPath: "alias",
        },
      );

      // A followed cycle is a failure; an explicitly excluded cycle is never traversed.
      await symlink(
        join(directory, "project"),
        join(directory, "project/loop"),
        "junction",
      );

      const cyclic = await EvidSourceLoader.glob(config, {
        files: ["**/*.prisma"],
      });
      const excluded = await EvidSourceLoader.glob(config, {
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

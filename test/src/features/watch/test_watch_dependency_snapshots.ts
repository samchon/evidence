import { EvidenceWatchDependencySnapshot, type IEvidenceSourceDependency } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { rm, symlink } from "node:fs/promises";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Detects content, directory-topology, deletion, and junction-target changes.
 *
 * Watch dependencies need versioning for exact files, recursive directories,
 * and followed junctions so each state change can trigger a fresh analysis.
 *
 * 1. Capture a recursive root and an exact source, edit the source bytes, and
 *    require the snapshot to change without a path change.
 * 2. Create a new file under the recursive root and require directory topology to
 *    produce a different snapshot.
 * 3. Delete the exact source and require the missing dependency's version to
 *    differ, allowing a later repair to be observed.
 * 4. When Windows junction creation is available, retarget a recursive junction
 *    from one populated directory to another and require the snapshot to
 *    change.
 */
export async function test_watch_dependency_snapshots(): Promise<void> {
  const location = join(__dirname, `snapshots ${randomUUID()}`);
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "root/source.ts": "export const value = 1;\n",
      "target-a/value.ts": 'export const value = "a";\n',
      "target-b/value.ts": 'export const value = "b";\n',
    },
    async (directory) => {
      const root = join(directory, "root");
      const source = join(root, "source.ts");
      const dependencies: IEvidenceSourceDependency[] = [
        { path: root, recursive: true },
        { path: source, recursive: false },
      ];
      const initial = await EvidenceWatchDependencySnapshot.capture(dependencies);

      // File bytes change even when the source remains at the same exact path.
      await EvidenceTestFileSystem.save(directory, {
        "root/source.ts": "export const value = 2;\n",
      });
      const edited = await EvidenceWatchDependencySnapshot.capture(dependencies);
      TestValidator.predicate("content edit detected", !initial.equals(edited));

      // A recursive dependency records immediate names so new glob candidates appear.
      await EvidenceTestFileSystem.save(directory, {
        "root/created.ts": "export const created = true;\n",
      });
      const created = await EvidenceWatchDependencySnapshot.capture(dependencies);
      TestValidator.predicate(
        "directory creation detected",
        !edited.equals(created),
      );

      // Missing exact paths retain a version that changes when they are repaired.
      await EvidenceTestFileSystem.erase(source);
      const deleted = await EvidenceWatchDependencySnapshot.capture(dependencies);
      TestValidator.predicate(
        "file deletion detected",
        !created.equals(deleted),
      );

      // Junction metadata and its followed target make retargeting observable on Windows.
      const link = join(directory, "linked-root");
      try {
        await symlink(join(directory, "target-a"), link, "junction");
      } catch {
        return;
      }
      const linked: IEvidenceSourceDependency[] = [{ path: link, recursive: true }];
      const firstTarget = await EvidenceWatchDependencySnapshot.capture(linked);
      await rm(link, { recursive: true, force: true });
      await symlink(join(directory, "target-b"), link, "junction");
      const secondTarget = await EvidenceWatchDependencySnapshot.capture(linked);

      TestValidator.predicate(
        "junction retarget detected",
        !firstTarget.equals(secondTarget),
      );
    },
  );
}

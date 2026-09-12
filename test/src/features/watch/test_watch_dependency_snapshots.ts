import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { rm, symlink } from "node:fs/promises";
import { join } from "node:path";

import { WatchDependencySnapshot } from "../../../../packages/evidence/src/internal/WatchDependencySnapshot";
import type { IEvidenceSourceDependency } from "../../../../packages/evidence/src/structures/IEvidenceSourceDependency";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Detects content, directory-topology, deletion, and junction-target changes. */
export async function test_watch_dependency_snapshots(): Promise<void> {
  const location = join(__dirname, `snapshots 한글 ${randomUUID()}`);
  await TestFileSystem.experiment(
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
      const initial = await WatchDependencySnapshot.capture(dependencies);

      // File bytes change even when the source remains at the same exact path.
      await TestFileSystem.save(directory, {
        "root/source.ts": "export const value = 2;\n",
      });
      const edited = await WatchDependencySnapshot.capture(dependencies);
      TestValidator.predicate("content edit detected", !initial.equals(edited));

      // A recursive dependency records immediate names so new glob candidates appear.
      await TestFileSystem.save(directory, {
        "root/created.ts": "export const created = true;\n",
      });
      const created = await WatchDependencySnapshot.capture(dependencies);
      TestValidator.predicate(
        "directory creation detected",
        !edited.equals(created),
      );

      // Missing exact paths retain a version that changes when they are repaired.
      await TestFileSystem.erase(source);
      const deleted = await WatchDependencySnapshot.capture(dependencies);
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
      const linked: IEvidenceSourceDependency[] = [
        { path: link, recursive: true },
      ];
      const firstTarget = await WatchDependencySnapshot.capture(linked);
      await rm(link, { recursive: true, force: true });
      await symlink(join(directory, "target-b"), link, "junction");
      const secondTarget = await WatchDependencySnapshot.capture(linked);

      TestValidator.predicate(
        "junction retarget detected",
        !firstTarget.equals(secondTarget),
      );
    },
  );
}

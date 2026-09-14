import { TestValidator } from "@nestia/e2e";
import { EvidenceWatcher } from "@wrtnlabs/evidence";
import type { IEvidenceConfig } from "@wrtnlabs/evidence";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Replaces valid JSON results with parse/deletion failures and recovers when the file is repaired. */
export async function test_watch_json_config(): Promise<void> {
  const config: IEvidenceConfig = {
    claims: [
      {
        type: "markdown",
        files: ["source.md"],
        reference: { type: "markdown", files: ["target.md"] },
      },
    ],
  };
  const content = JSON.stringify(config);
  await TestFileSystem.experiment(
    "json-watch",
    {
      "evidence.json": content,
      "source.md":
        "# Source\n<!-- @evidence target.md#target Implements the target. -->\n",
      "target.md": "# Target\n",
    },
    async (directory) => {
      const file = join(directory, "evidence.json");
      const watcher = new EvidenceWatcher(file, {
        pollIntervalMilliseconds: 10,
        debounceMilliseconds: 10,
      });
      try {
        await watcher.watch(async (cycle) => {
          if (cycle.cycle === 1) {
            TestValidator.equals(
              "initial JSON analysis",
              cycle.status,
              "complete",
            );
            await TestFileSystem.save(directory, { "evidence.json": "{" });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "malformed JSON fails",
              cycle.status,
              "failed",
            );
            await unlink(file);
          } else if (cycle.cycle === 3) {
            TestValidator.equals("deleted JSON fails", cycle.status, "failed");
            await TestFileSystem.save(directory, { "evidence.json": content });
          } else {
            TestValidator.equals(
              "recreated JSON recovers",
              cycle.status,
              "complete",
            );
            await watcher.close();
          }
        });
      } finally {
        await watcher.close();
      }
    },
  );
}

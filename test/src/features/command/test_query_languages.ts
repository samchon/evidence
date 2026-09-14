import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import typia from "typia";

import { EvidenceCommand } from "../../../../packages/evidence/src/commands/EvidenceCommand";
import type { IEvidenceCommandFailure } from "../../../../packages/evidence/src/structures/IEvidenceCommandFailure";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Reports certified registry entries without loading a project configuration. */
export async function test_query_languages(): Promise<void> {
  const location = join(__dirname, `query languages ${randomUUID()}`);
  await TestFileSystem.experiment(location, {}, async (directory) => {
    // An empty directory is sufficient because language support is package metadata.
    const result = await EvidenceCommand.run(
      ["languages", "--format", "json"],
      directory,
    );
    TestValidator.equals("languages exit", result.exitCode, 0);
    TestValidator.equals("languages stderr", result.stderr, "");
    // Other operational commands retain their own command in JSON failures.
    const failed = await EvidenceCommand.run(
      ["list", "--config", "missing.config.ts", "--format", "json"],
      directory,
    );
    TestValidator.equals("query failure exit", failed.exitCode, 2);
    TestValidator.equals(
      "query failure command",
      typia.json.assertParse<IEvidenceCommandFailure>(failed.stdout).command,
      "list",
    );
  });
}

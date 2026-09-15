import { EvidCommand } from "evid";
import type { IEvidCommandFailure } from "evid";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import typia from "typia";

import { TestFileSystem } from "../../internal/TestFileSystem";

/**
 * Reports certified language support without requiring a project configuration.
 *
 * Language metadata is package-level registry data, so an empty directory must
 * still produce a successful JSON response. A separate failed query must retain
 * its own command name in the structured operational failure.
 *
 * 1. Run languages with JSON output in an empty directory and require exit 0 with
 *    no stderr.
 * 2. Run list against a missing config in the same directory and require exit 2.
 * 3. Parse the failure report and require its command field to remain list rather
 *    than being attributed to the configuration-free languages operation.
 */
export async function test_query_languages(): Promise<void> {
  const location = join(__dirname, `query languages ${randomUUID()}`);
  await TestFileSystem.experiment(location, {}, async (directory) => {
    // An empty directory is sufficient because language support is package metadata.
    const result = await EvidCommand.run(
      ["languages", "--format", "json"],
      directory,
    );
    TestValidator.equals("languages exit", result.exitCode, 0);
    TestValidator.equals("languages stderr", result.stderr, "");
    // Other operational commands retain their own command in JSON failures.
    const failed = await EvidCommand.run(
      ["list", "--config", "missing.config.ts", "--format", "json"],
      directory,
    );
    TestValidator.equals("query failure exit", failed.exitCode, 2);
    TestValidator.equals(
      "query failure command",
      typia.json.assertParse<IEvidCommandFailure>(failed.stdout).command,
      "list",
    );
  });
}

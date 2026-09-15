import { EvidenceCommand, EvidenceConfigLoader } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Initializes one explicitly named TypeScript configuration and protects it
 * from overwrite.
 *
 * Initialization resolves custom paths from the supplied working directory. A
 * successful command must create a loadable starter only at that destination; a
 * later invocation must preserve the user's existing bytes.
 *
 * 1. Run init with a relative custom config path and require a successful, silent
 *    result.
 * 2. Load the emitted config and require the test directory to contain only that
 *    file.
 * 3. Invoke init for the same path again and require:
 *
 *    - Exit code 2 and an overwrite-refusal diagnostic.
 *    - Exact preservation of the original file content.
 */
export async function test_command_init(): Promise<void> {
  const location = join(__dirname, `init ${randomUUID()}`);
  await EvidenceTestFileSystem.experiment(location, {}, async (directory) => {
    // Custom paths resolve from --cwd and create only the requested config.
    const created = await EvidenceCommand.run(
      ["init", "--config", "custom.config.ts"],
      directory,
    );
    TestValidator.equals("init exit", created.exitCode, 0);
    TestValidator.equals("init stderr", created.stderr, "");

    const file = join(directory, "custom.config.ts");
    const source = await readFile(file, "utf8");
    await EvidenceConfigLoader.load(file);
    TestValidator.equals(
      "only requested config created",
      await readdir(directory),
      ["custom.config.ts"],
    );

    // A second initialization preserves the exact authored file.
    const refused = await EvidenceCommand.run(
      ["init", "--config", "custom.config.ts"],
      directory,
    );
    TestValidator.equals("overwrite exit", refused.exitCode, 2);
    TestValidator.predicate(
      "overwrite diagnostic",
      refused.stderr.includes("Refusing to overwrite"),
    );
    TestValidator.equals(
      "existing config preserved",
      await readFile(file, "utf8"),
      source,
    );
  });
}

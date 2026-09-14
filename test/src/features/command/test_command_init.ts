import { EvidenceCommand, EvidenceConfigLoader } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Creates one typed starter config and refuses every overwrite attempt. */
export async function test_command_init(): Promise<void> {
  const location = join(__dirname, `init ${randomUUID()}`);
  await TestFileSystem.experiment(location, {}, async (directory) => {
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

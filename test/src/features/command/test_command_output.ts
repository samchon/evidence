import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceCommand } from "../../../../packages/evidence/src/commands/EvidenceCommand";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Keeps help/version independent and makes operational JSON/output failures explicit. */
export async function test_command_output(): Promise<void> {
  const location = join(__dirname, `output ${randomUUID()}`);
  await TestFileSystem.experiment(
    location,
    { "nested/.keep": "" },
    async (directory) => {
      // Help and version never need a configuration in the selected working directory.
      const help = await EvidenceCommand.run(["--help"], directory);
      const version = await EvidenceCommand.run(["--version"], directory);
      TestValidator.equals("help exit", help.exitCode, 0);
      TestValidator.predicate(
        "help usage",
        help.stdout.includes("Usage: evidence"),
      );
      TestValidator.equals("version exit", version.exitCode, 0);
      TestValidator.predicate(
        "version output",
        /^\d+\.\d+\.\d+\n$/u.test(version.stdout),
      );

      // A missing config becomes a clean versioned JSON failure on stdout.
      const missing = await EvidenceCommand.run(
        [
          "--cwd",
          "nested",
          "--format",
          "json",
          "--config",
          "missing.config.ts",
        ],
        directory,
      );
      const explicit = await EvidenceCommand.run(
        [
          "check",
          "--cwd",
          "nested",
          "--format",
          "json",
          "--config",
          "missing.config.ts",
        ],
        directory,
      );
      TestValidator.equals("missing config exit", missing.exitCode, 2);
      TestValidator.equals("bare and explicit check", explicit, missing);
      TestValidator.equals("JSON stderr", missing.stderr, "");
      TestValidator.predicate(
        "JSON failure schema",
        missing.stdout.includes('"status": "failed"'),
      );
      TestValidator.predicate(
        "resolved config path",
        missing.stdout.includes(
          JSON.stringify(join(directory, "nested", "missing.config.ts")).slice(
            1,
            -1,
          ),
        ),
      );
      TestValidator.predicate(
        "operational exit in JSON",
        missing.stdout.includes('"exitCode": 2'),
      );

      // Buffered embedding directs infinite watch use to the public streaming API.
      const watch = await EvidenceCommand.run(["--watch"], directory);
      TestValidator.equals("buffered watch exit", watch.exitCode, 2);
      TestValidator.predicate(
        "buffered watch guidance",
        watch.stderr.includes("Use EvidenceWatcher for embedding"),
      );

      // A destination that is itself a directory reports its failed write on stderr.
      const unwritable = await EvidenceCommand.run(
        ["--config", "missing.config.ts", "--output", ".", "--format", "json"],
        directory,
      );
      TestValidator.equals("output failure exit", unwritable.exitCode, 2);
      TestValidator.equals("output failure stdout", unwritable.stdout, "");
      TestValidator.predicate(
        "output failure diagnostic",
        unwritable.stderr.includes("Could not write Evidence report"),
      );
    },
  );
}

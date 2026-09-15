import { EvidCommand } from "evid";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";

/**
 * Separates configuration-free command output from structured operational
 * failures.
 *
 * The command facade must make help and version usable in an empty directory,
 * preserve the equivalence of implicit and explicit check, and keep machine
 * output parseable even when configuration or report-file writing fails.
 *
 * 1. Run help and version without a config and require successful usage text and a
 *    semantic-version line.
 * 2. Run implicit and explicit JSON checks against a missing config under --cwd;
 *    require identical exit-2 results with an empty stderr, failed schema,
 *    resolved config location, and operational exit code in stdout.
 * 3. Request buffered watch mode and require guidance to use the streaming watcher
 *    API.
 * 4. Use a directory as the JSON output destination and require an exit-2 write
 *    diagnostic on stderr with no partially emitted stdout report.
 */
export async function test_command_output(): Promise<void> {
  const location = join(__dirname, `output ${randomUUID()}`);
  await EvidTestFileSystem.experiment(
    location,
    { "nested/.keep": "" },
    async (directory) => {
      // Help and version never need a configuration in the selected working directory.
      const help = await EvidCommand.run(["--help"], directory);
      const version = await EvidCommand.run(["--version"], directory);
      TestValidator.equals("help exit", help.exitCode, 0);
      TestValidator.predicate(
        "help usage",
        help.stdout.includes("Usage: evid"),
      );
      TestValidator.equals("version exit", version.exitCode, 0);
      TestValidator.predicate(
        "version output",
        /^\d+\.\d+\.\d+\n$/u.test(version.stdout),
      );

      // A missing config becomes a clean versioned JSON failure on stdout.
      const missing = await EvidCommand.run(
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
      const explicit = await EvidCommand.run(
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
      const watch = await EvidCommand.run(["--watch"], directory);
      TestValidator.equals("buffered watch exit", watch.exitCode, 2);
      TestValidator.predicate(
        "buffered watch guidance",
        watch.stderr.includes("Use EvidWatcher for embedding"),
      );

      // A destination that is itself a directory reports its failed write on stderr.
      const unwritable = await EvidCommand.run(
        ["--config", "missing.config.ts", "--output", ".", "--format", "json"],
        directory,
      );
      TestValidator.equals("output failure exit", unwritable.exitCode, 2);
      TestValidator.equals("output failure stdout", unwritable.stdout, "");
      TestValidator.predicate(
        "output failure diagnostic",
        unwritable.stderr.includes("Could not write Evidence Graph report"),
      );
    },
  );
}

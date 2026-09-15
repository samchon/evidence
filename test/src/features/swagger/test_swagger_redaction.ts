import { EvidCommand, EvidSwaggerAdapter, EvidWatcher } from "evid";
import type {
  EvidWatchCycle,
  IEvidCommandResult,
  IEvidDiagnostic,
  IEvidInventory,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";

/**
 * Credential sentinel that must never survive a public Swagger diagnostic.
 *
 * Every failure path is searched for this exact value after adapter analysis.
 */
const PASSWORD: string = "fixture-password";

/**
 * Query and fragment sentinel used to detect incomplete URL redaction.
 *
 * Reusing one marker across malformed URL forms exposes any branch that retains
 * raw query or fragment contents.
 */
const TOKEN: string = "fixture-token";

/**
 * Redacts remote Swagger secrets across adapter and public reporting failures.
 *
 * Transport and URL-parser errors can repeat the configured input in their
 * messages. Sanitizing only the diagnostic location still exposes credentials
 * through JSON, text, query, or watch serialization.
 *
 * 1. Load credential-bearing HTTP, fragmented, unsupported-protocol, padded,
 *    malformed, repeated-userinfo, and percent-encoded URLs through the
 *    adapter.
 * 2. Require every failure to remain incomplete and actionable while retaining a
 *    safe origin/path label and excluding userinfo and query values from the
 *    entire serialized inventory.
 * 3. Load an ordinary local filename containing query punctuation and require its
 *    diagnostic spelling to remain intact rather than being treated as URL
 *    credentials.
 * 4. Run the deterministic credential-construction failure through check JSON,
 *    check text, and list JSON command paths; require exit code two and no
 *    secret in either output channel.
 * 5. Publish the first watch cycle for the same config and require the serialized
 *    cycle and active dependencies to contain no credential or query value.
 */
export async function test_swagger_redaction(): Promise<void> {
  const adapter: EvidSwaggerAdapter = new EvidSwaggerAdapter();
  const config: string = join(__dirname, "evidence.config.ts");
  const secretSources: string[] = [
    `https://user:${PASSWORD}@example.invalid/schema?token=${TOKEN}`,
    `https://user:${PASSWORD}@example.invalid/schema?token=${TOKEN}#fragment`,
    `ftp://user:${PASSWORD}@example.invalid/schema?token=${TOKEN}`,
    ` https://user:${PASSWORD}@example.invalid/schema?token=${TOKEN} `,
    `https://user:${PASSWORD}@[invalid]?token=${TOKEN}`,
    `https://first@second:${PASSWORD}@example.invalid:bad/schema?token=${TOKEN}`,
    `https://user:${PASSWORD} @example.invalid:bad/schema?token=${TOKEN}`,
    `https://user%40fixture:${PASSWORD}%2Dencoded@example.invalid/schema?token=${TOKEN}%2Dencoded`,
  ];
  for (let index: number = 0; index < secretSources.length; ++index) {
    const source: string | undefined = secretSources[index];
    if (source === undefined) continue;
    const failure: IEvidInventory = await adapter.load(config, source);
    const serialized: string = JSON.stringify(failure);
    TestValidator.equals(
      `remote failure ${index} incomplete`,
      failure.complete,
      false,
    );
    TestValidator.predicate(
      `remote failure ${index} retains safe source context`,
      failure.diagnostics.some((diagnostic: IEvidDiagnostic): boolean => {
        const file: string | undefined = diagnostic.location?.file;
        return file !== undefined && file.includes("://");
      }),
    );
    assertRedacted(`remote failure ${index}`, serialized);
  }

  const local: string = `local?token=${TOKEN}.yaml`;
  const localFailure: IEvidInventory = await adapter.load(config, local);
  TestValidator.predicate(
    "local punctuation remains literal",
    JSON.stringify(localFailure).includes(local),
  );

  const location: string = join(__dirname, `swagger redaction ${randomUUID()}`);
  const publicSource: string = secretSources[0] ?? "";
  await EvidTestFileSystem.experiment(
    location,
    {
      "evid.json": JSON.stringify({
        claims: [
          {
            type: "markdown",
            files: ["rules.md"],
            reference: { type: "swagger", file: publicSource },
          },
        ],
      }),
      "rules.md": `# Rule {#rule}\n\nDo the work.\n`,
    },
    async (directory: string): Promise<void> => {
      const json: IEvidCommandResult = await EvidCommand.run(
        ["check", "--config", "evid.json", "--format", "json"],
        directory,
      );
      const text: IEvidCommandResult = await EvidCommand.run(
        ["check", "--config", "evid.json", "--format", "text"],
        directory,
      );
      const query: IEvidCommandResult = await EvidCommand.run(
        ["list", "--config", "evid.json", "--format", "json"],
        directory,
      );
      const results: IEvidCommandResult[] = [json, text, query];
      for (const result of results) {
        TestValidator.equals("remote failure command exit", result.exitCode, 2);
        assertRedacted("public command", result.stdout + result.stderr);
      }

      const watcher: EvidWatcher = new EvidWatcher(
        join(directory, "evid.json"),
        { pollIntervalMilliseconds: 20, debounceMilliseconds: 20 },
      );
      await watcher.watch(async (cycle: EvidWatchCycle): Promise<void> => {
        assertRedacted(
          "watch cycle",
          JSON.stringify({ cycle, dependencies: watcher.dependencies() }),
        );
        await watcher.close();
      });
    },
  );
}

/**
 * Requires every credential token to be absent from one serialized output.
 *
 * The shared assertion covers raw, percent-encoded, and query-secret spellings
 * across adapter, command, and watch result shapes.
 */
function assertRedacted(label: string, output: string): void {
  TestValidator.predicate(
    `${label} password redacted`,
    !output.includes(PASSWORD),
  );
  TestValidator.predicate(`${label} token redacted`, !output.includes(TOKEN));
  TestValidator.predicate(
    `${label} percent-encoded userinfo redacted`,
    !output.includes("user%40fixture"),
  );
}

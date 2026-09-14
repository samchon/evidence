import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import typia from "typia";

import { EvidenceCommand } from "../../../../packages/evidence/src/commands/EvidenceCommand";
import { EvidenceLanguageRegistry } from "../../../../packages/evidence/src/parsers/EvidenceLanguageRegistry";
import type { IEvidenceCommandFailure } from "../../../../packages/evidence/src/structures/IEvidenceCommandFailure";
import type { IEvidenceLanguagesReport } from "../../../../packages/evidence/src/structures/IEvidenceLanguagesReport";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Reports certified registry entries without loading a project configuration. */
export async function test_query_languages(): Promise<void> {
  const location = join(__dirname, `query languages 한글 ${randomUUID()}`);
  await TestFileSystem.experiment(location, {}, async (directory) => {
    // An empty directory is sufficient because language support is package metadata.
    const result = await EvidenceCommand.run(
      ["languages", "--format", "json"],
      directory,
    );
    TestValidator.equals("languages exit", result.exitCode, 0);
    TestValidator.equals("languages stderr", result.stderr, "");
    const report = typia.json.assertParse<IEvidenceLanguagesReport>(
      result.stdout,
    );
    const certified = EvidenceLanguageRegistry.list()
      .filter((language) => language.adapter !== undefined)
      .map((language) => language.type)
      .sort(compare);
    TestValidator.equals(
      "registry-generated languages",
      report.languages.map((language) => language.type),
      certified,
    );
    TestValidator.predicate(
      "grammar-only candidates omitted",
      !report.languages.some((language) => language.type === "kotlin"),
    );
    TestValidator.predicate(
      "capability metadata",
      report.languages.every(
        (language) =>
          language.grammars.length !== 0 &&
          language.adapter.symbols.length !== 0 &&
          language.adapter.publicSurface.length !== 0 &&
          language.adapter.addressing.length !== 0 &&
          language.adapter.unsupported.length !== 0,
      ),
    );

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

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

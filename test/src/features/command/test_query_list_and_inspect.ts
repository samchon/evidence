import { EvidenceCommand, EvidenceQuery } from "@wrtnlabs/evidence";
import type {
  IEvidenceInspectReport,
  IEvidenceListReport,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import typia from "typia";

import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestQueryAnalysis } from "../../internal/TestQueryAnalysis";

/**
 * Lists canonical aliases and round-trips each reference target through scoped inspection.
 *
 * Query consumers need selected and structural rows without mutating evaluation,
 * plus a stable target spelling that resolves the same semantic identity through
 * both the API and command facade.
 *
 * 1. List the fixture and require the selected dotted property plus its ancestor
 *    contract type.
 * 2. Find the re-exported property and require literal accessor escaping, its
 *    physical shared-source alias, and the Renamed barrel alias.
 * 3. Inspect every listed reference target and require exactly its listed unit ID.
 * 4. Apply language and kind filters; require all emitted rows to match while the
 *    original check denominator and exit status remain unchanged.
 * 5. Run JSON list and inspect commands, parse their public reports, and require
 *    the command-provided canonical target to round-trip to the same unit ID.
 */
export async function test_query_list_and_inspect(): Promise<void> {
  const location = join(__dirname, `query list ${randomUUID()}`);
  await TestFileSystem.experiment(
    location,
    TestQueryAnalysis.records(),
    async (directory) => {
      const analysis = await TestQueryAnalysis.analyze(directory);
      const baseline = structuredClone(analysis.report);

      // Property selection exposes each selected property and its aggregate type.
      const listing = EvidenceQuery.list(analysis, directory);
      const references = listing.items.filter(
        (item) => item.scope.role === "reference",
      );
      TestValidator.predicate(
        "selected properties",
        references.some(
          (item) =>
            item.name === "member.with.dots" && item.selection === "selected",
        ),
      );
      TestValidator.predicate(
        "aggregate type",
        references.some(
          (item) => item.name === "Contract" && item.selection === "ancestor",
        ),
      );

      // One semantic identity retains its physical and re-exported spellings.
      const aliased = references.find(
        (item) =>
          item.name === "member.with.dots" &&
          item.aliases.some((alias) => alias.includes("Renamed")),
      );
      if (aliased === undefined)
        throw new Error("Missing re-exported query identity.");
      TestValidator.predicate(
        "literal segment preserved",
        aliased.aliases.every((alias) =>
          alias.endsWith('["member.with.dots"]'),
        ),
      );
      TestValidator.predicate(
        "shared source address",
        aliased.aliases.some((alias) => alias.includes("shared.ts")),
      );
      TestValidator.predicate(
        "re-export alias preserved",
        aliased.aliases.includes(
          'contracts/index.ts#Renamed["member.with.dots"]',
        ),
      );

      // Every listed reference target resolves back to its exact semantic identity.
      for (const item of references) {
        const inspected = await EvidenceQuery.inspect(
          analysis,
          directory,
          item.target,
        );
        TestValidator.equals(
          `round-trip ${item.target}`,
          inspected.inspections.flatMap((entry) =>
            entry.units.map((unit) => unit.item.unitId),
          ),
          [item.unitId],
        );
      }

      // Listing filters change only emitted rows; the complete graph stays untouched.
      const filtered = EvidenceQuery.list(
        analysis,
        directory,
        "typescript",
        "property",
      );
      TestValidator.predicate(
        "filter applied",
        filtered.items.every(
          (item) =>
            item.scope.type === "typescript" && item.symbol === "property",
        ),
      );
      TestValidator.equals(
        "check denominator preserved",
        analysis.report,
        baseline,
      );
      TestValidator.equals(
        "filter status preserved",
        filtered.exitCode,
        analysis.report.exitCode,
      );

      // The public command dispatch emits the same canonical target and resolves it.
      const commandList = await EvidenceCommand.run(
        ["list", "--format", "json"],
        directory,
      );
      const commandListing = typia.json.assertParse<IEvidenceListReport>(
        commandList.stdout,
      );
      const commandItem = commandListing.items.find(
        (item) => item.unitId === aliased.unitId,
      );
      if (commandItem === undefined)
        throw new Error("Missing command-listed query identity.");
      const commandInspect = await EvidenceCommand.run(
        ["inspect", commandItem.target, "--format", "json"],
        directory,
      );
      const commandInspection = typia.json.assertParse<IEvidenceInspectReport>(
        commandInspect.stdout,
      );
      TestValidator.equals(
        "command round-trip",
        commandInspection.inspections.flatMap((entry) =>
          entry.units.map((entryUnit) => entryUnit.item.unitId),
        ),
        [commandItem.unitId],
      );
    },
  );
}

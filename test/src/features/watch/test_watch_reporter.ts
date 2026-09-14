import { TestValidator } from "@nestia/e2e";
import typia from "typia";

import { EvidenceWatchReporter } from "../../../../packages/evidence/src/reporters/EvidenceWatchReporter";
import type { IEvidenceWatchFailureCycle } from "../../../../packages/evidence/src/structures/IEvidenceWatchFailureCycle";
import type { EvidenceWatchCycle } from "../../../../packages/evidence/src/typings/EvidenceWatchCycle";

/** Keeps operational failures persistent and machine output framed as one NDJSON record. */
export function test_watch_reporter(): void {
  const failure: IEvidenceWatchFailureCycle = {
    schemaVersion: 1,
    command: "check",
    watch: true,
    cycle: 7,
    status: "failed",
    success: false,
    exitCode: 2,
    configFile: "/project/evidence.config.ts",
    message: "Imported settings are invalid.",
    repair: "Correct the imported settings.",
  };

  // JSON uses a single compact line that independently validates as a cycle.
  const json = EvidenceWatchReporter.json(failure);
  TestValidator.equals("one JSON line", json.trim().split("\n").length, 1);
  TestValidator.equals(
    "typed JSON cycle",
    typia.json.assertParse<EvidenceWatchCycle>(json).cycle,
    7,
  );

  // Text identifies the cycle and retains the current failure and repair.
  const text = EvidenceWatchReporter.text(failure);
  TestValidator.predicate(
    "text cycle status",
    text.includes("Evidence watch cycle 7 (failed)."),
  );
  TestValidator.predicate(
    "text failure",
    text.includes("Imported settings are invalid."),
  );
  TestValidator.predicate(
    "text repair",
    text.includes("Repair: Correct the imported settings."),
  );
}

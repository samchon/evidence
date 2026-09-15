import { EvidWatchReporter } from "evid";
import type { EvidWatchCycle, IEvidWatchFailureCycle } from "evid";
import { TestValidator } from "@nestia/e2e";
import typia from "typia";

/**
 * Keeps operational failures persistent and machine output framed as one NDJSON
 * record.
 *
 * A watch reporter must serialize each cycle independently for machine
 * consumers while retaining the current operational message and repair guidance
 * in text.
 *
 * 1. Construct a failed check cycle with a fixed schema version, cycle number,
 *    configuration path, failure message, and repair instruction.
 * 2. Render JSON and require one compact line that type-validates as a watch cycle
 *    with the same identifier.
 * 3. Render text and require its cycle status, failure message, and repair
 *    instruction to remain visible.
 */
export function test_watch_reporter(): void {
  const failure: IEvidWatchFailureCycle = {
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
  const json = EvidWatchReporter.json(failure);
  TestValidator.equals("one JSON line", json.trim().split("\n").length, 1);
  TestValidator.equals(
    "typed JSON cycle",
    typia.json.assertParse<EvidWatchCycle>(json).cycle,
    7,
  );

  // Text identifies the cycle and retains the current failure and repair.
  const text = EvidWatchReporter.text(failure);
  TestValidator.predicate(
    "text cycle status",
    text.includes("Evidence Graph watch cycle 7 (failed)."),
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

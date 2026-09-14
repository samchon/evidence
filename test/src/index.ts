import { DynamicExecutor } from "@nestia/e2e";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { TestParserAssets } from "./internal/TestParserAssets";

/** Executes all logic tests, or file-name filters explicitly supplied by a contributor. */
async function main(): Promise<void> {
  await TestParserAssets.run(run);
}

/** Discovers tests within an isolated parser acquisition scope. */
async function run(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { include: { type: "string", multiple: true } },
    allowPositionals: true,
  });
  const filters = [...(values.include ?? []), ...positionals];
  const report = await DynamicExecutor.validate({
    prefix: "test_",
    location: join(__dirname, "features"),
    extension: "ts",
    filter: (file) =>
      filters.length === 0 || filters.some((filter) => file.includes(filter)),
    parameters: () => [],
    onComplete: (execution) => {
      console.log(
        `${execution.error === null ? "PASS" : "FAIL"} ${execution.name}`,
      );
    },
  });
  if (report.executions.length === 0)
    throw new Error("No logic unit tests were discovered.");

  const failures = report.executions.filter(
    (execution) => execution.error !== null,
  );
  console.log(
    `${report.executions.length - failures.length}/${report.executions.length} unit tests passed.`,
  );
  if (failures.length !== 0) {
    for (const failure of failures) console.error(failure.error);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

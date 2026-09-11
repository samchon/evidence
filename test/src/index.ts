import { DynamicExecutor } from "@nestia/e2e";
import { join } from "node:path";

const main = async (): Promise<void> => {
  const report = await DynamicExecutor.validate({
    prefix: "test_",
    location: join(__dirname, "features"),
    extension: "ts",
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
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

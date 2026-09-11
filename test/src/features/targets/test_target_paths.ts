import { TestValidator } from "@nestia/e2e";

import { EvidenceFileTarget } from "../../../../packages/evidence/src/EvidenceFileTarget";

/** Preserves encoded path characters and literal accessor segments across platforms. */
export async function test_target_paths(): Promise<void> {
  const posix = EvidenceFileTarget.parse(
    '../src/a%20%23%20b.ts#Service["prototype.run"]["a/b"]',
    "/project/docs/review.md",
  );

  TestValidator.equals("decoded POSIX target", posix, {
    file: "/project/src/a # b.ts",
    segments: ["Service", "prototype.run", "a/b"],
  });
  TestValidator.equals(
    "canonical target",
    EvidenceFileTarget.format(posix),
    '/project/src/a%20%23%20b.ts#Service["prototype.run"]["a/b"]',
  );

  // Windows paths use the citing drive even when the authored path uses backslashes.
  const windows = EvidenceFileTarget.parse(
    "..\\src\\calculator.ts#add",
    "D:/project/docs/review.md",
  );

  TestValidator.equals("portable Windows target", windows, {
    file: "D:/project/src/calculator.ts",
    segments: ["add"],
  });
  TestValidator.equals(
    "canonical Windows target",
    EvidenceFileTarget.format(windows),
    "D:/project/src/calculator.ts#add",
  );

  // Malformed percent escapes and drive-relative paths cannot depend on process state.
  await TestValidator.error("invalid percent escape", async () =>
    EvidenceFileTarget.parse("../bad%2.ts#value", "/project/docs/review.md"),
  );
  await TestValidator.error("drive-relative target", async () =>
    EvidenceFileTarget.parse("C:relative.ts#value", "D:/project/review.ts"),
  );
}

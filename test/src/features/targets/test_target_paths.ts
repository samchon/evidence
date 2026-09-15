import { EvidFileTarget } from "evid";
import { TestValidator } from "@nestia/e2e";

/**
 * Resolves encoded paths and literal accessor segments across platforms.
 *
 * Path encoding and accessor punctuation must survive platform path conversion
 * without changing identity.
 *
 * 1. Parse and format a POSIX target containing encoded file characters and quoted
 *    literal accessor segments.
 * 2. Parse and format a backslash-authored Windows target using the citing drive,
 *    then parse a file-only target with no accessor.
 * 3. Reject malformed percent encoding and a drive-relative authored path.
 */
export async function test_target_paths(): Promise<void> {
  const posix = EvidFileTarget.parse(
    '../src/a%20%23%20b.ts#Service["prototype.run"]["a/b"]',
    "/project/docs/review.md",
  );

  TestValidator.equals("decoded POSIX target", posix, {
    file: "/project/src/a # b.ts",
    segments: ["Service", "prototype.run", "a/b"],
  });
  TestValidator.equals(
    "canonical target",
    EvidFileTarget.format(posix),
    '/project/src/a%20%23%20b.ts#Service["prototype.run"]["a/b"]',
  );

  // Windows paths use the citing drive even when the authored path uses backslashes.
  const windows = EvidFileTarget.parse(
    "..\\src\\calculator.ts#add",
    "D:/project/docs/review.md",
  );

  TestValidator.equals("portable Windows target", windows, {
    file: "D:/project/src/calculator.ts",
    segments: ["add"],
  });
  TestValidator.equals(
    "canonical Windows target",
    EvidFileTarget.format(windows),
    "D:/project/src/calculator.ts#add",
  );

  // Omitting the accessor addresses an artifact's file unit directly.
  const file = EvidFileTarget.parse(
    "../docs/requirements.md",
    "/project/src/calculator.ts",
  );

  TestValidator.equals("file unit target", file, {
    file: "/project/docs/requirements.md",
    segments: [],
  });
  TestValidator.equals(
    "canonical file unit target",
    EvidFileTarget.format(file),
    "/project/docs/requirements.md",
  );

  // Malformed percent escapes and drive-relative paths cannot depend on process state.
  await TestValidator.error("invalid percent escape", async () =>
    EvidFileTarget.parse("../bad%2.ts#value", "/project/docs/review.md"),
  );
  await TestValidator.error("drive-relative target", async () =>
    EvidFileTarget.parse("C:relative.ts#value", "D:/project/review.ts"),
  );
}

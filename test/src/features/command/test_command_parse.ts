import { TestValidator } from "@nestia/e2e";

import { EvidenceCommand } from "../../../../packages/evidence/src/EvidenceCommand";

/**
 * Verifies command selection without processes, files, or terminal output.
 *
 * Help and version require a single recognized flag. Empty, unknown, and
 * extra-argument invocations must remain unavailable while checking is absent.
 */
export const test_command_parse = (): void => {
  for (const flag of ["--help", "-h"])
    TestValidator.equals("help flag", EvidenceCommand.parse([flag]), "help");
  for (const flag of ["--version", "-v"])
    TestValidator.equals(
      "version flag",
      EvidenceCommand.parse([flag]),
      "version",
    );
  for (const args of [
    [],
    ["check"],
    ["init"],
    ["--unknown"],
    ["--help", "file.ts"],
    ["--version", "--help"],
    ["check", "--help"],
  ])
    TestValidator.equals(
      `unavailable arguments: ${args.join(" ")}`,
      EvidenceCommand.parse(args),
      "unavailable",
    );
};

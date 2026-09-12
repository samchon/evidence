import { TestValidator } from "@nestia/e2e";
import assert from "node:assert/strict";

import { EvidenceCommand } from "../../../../packages/evidence/src/EvidenceCommand";
import { EvidenceCommandError } from "../../../../packages/evidence/src/EvidenceCommandError";
import type { IEvidenceCheckCommand } from "../../../../packages/evidence/src/structures/IEvidenceCheckCommand";

/** Parses aliases, common options, and every reserved or invalid combination. */
export function test_command_parse(): void {
  // Bare invocation and the explicit command have the same complete defaults.
  const defaults: IEvidenceCheckCommand = {
    operation: "check",
    cwd: ".",
    config: "evidence.config.ts",
    format: "text",
  };
  TestValidator.equals("bare check", EvidenceCommand.parse([]), defaults);
  TestValidator.equals(
    "explicit check",
    EvidenceCommand.parse(["check"]),
    defaults,
  );

  // Both spellings preserve authored paths until execution resolves --cwd.
  TestValidator.equals(
    "check options",
    EvidenceCommand.parse([
      "check",
      "--cwd",
      "nested",
      "-c",
      "config/evidence.config.ts",
      "--format",
      "json",
      "-o",
      "reports/evidence.json",
    ]),
    {
      operation: "check",
      cwd: "nested",
      config: "config/evidence.config.ts",
      format: "json",
      output: "reports/evidence.json",
    },
  );
  TestValidator.equals(
    "init options",
    EvidenceCommand.parse([
      "init",
      "--cwd",
      "nested",
      "--config",
      "config/custom.ts",
    ]),
    {
      operation: "init",
      cwd: "nested",
      config: "config/custom.ts",
    },
  );
  TestValidator.equals(
    "list filters",
    EvidenceCommand.parse([
      "list",
      "--language",
      "typescript",
      "--kind",
      "property",
      "--format",
      "json",
    ]),
    {
      operation: "list",
      cwd: ".",
      config: "evidence.config.ts",
      format: "json",
      language: "typescript",
      kind: "property",
    },
  );
  TestValidator.equals(
    "inspect target",
    EvidenceCommand.parse([
      "inspect",
      "src/contract.ts#Contract.member",
      "--cwd",
      "project",
    ]),
    {
      operation: "inspect",
      target: "src/contract.ts#Contract.member",
      cwd: "project",
      config: "evidence.config.ts",
      format: "text",
    },
  );
  TestValidator.equals(
    "graph format",
    EvidenceCommand.parse(["graph", "--format", "dot"]),
    {
      operation: "graph",
      cwd: ".",
      config: "evidence.config.ts",
      format: "dot",
    },
  );
  TestValidator.equals(
    "languages without config",
    EvidenceCommand.parse(["languages", "--format", "json"]),
    {
      operation: "languages",
      cwd: ".",
      format: "json",
    },
  );

  // Help and version are selected without any project option processing.
  for (const args of [
    ["--help"],
    ["-h"],
    ["check", "--help"],
    ["inspect", "--help"],
  ])
    TestValidator.equals(
      `help arguments: ${args.join(" ")}`,
      EvidenceCommand.parse(args),
      { operation: "help" },
    );
  for (const flag of ["--version", "-v"])
    TestValidator.equals(
      `version flag: ${flag}`,
      EvidenceCommand.parse([flag]),
      { operation: "version" },
    );

  // Typos, duplicates, bad formats, incompatible flags, and watch all fail loudly.
  for (const args of [
    ["unknown"],
    ["--unknown"],
    ["--config"],
    ["--config", "--unknown"],
    ["--config", "one.ts", "-c", "two.ts"],
    ["--format", "yaml"],
    ["init", "--format", "json"],
    ["init", "--output", "report.txt"],
    ["languages", "--config", "evidence.config.ts"],
    ["graph", "--format", "text"],
    ["inspect"],
    ["inspect", "one.ts#A", "two.ts#B"],
    ["inspect", "one.ts#A", "--kind", "type"],
    ["list", "--language", "kotlin"],
    ["list", "--kind", "namespace"],
    ["check", "--language", "typescript"],
    ["--help", "--format", "json"],
    ["check", "--version"],
    ["--watch"],
  ])
    assert.throws(
      () => EvidenceCommand.parse(args),
      EvidenceCommandError,
      `Expected invalid arguments to fail: ${args.join(" ")}`,
    );
}

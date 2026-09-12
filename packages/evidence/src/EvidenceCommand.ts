import { dedent } from "@typia/utils";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import typia from "typia";

import { EvidenceChecker } from "./EvidenceChecker";
import { EvidenceCommandError } from "./EvidenceCommandError";
import { EvidenceReporter } from "./EvidenceReporter";
import type { IPackageManifest } from "./internal/IPackageManifest";
import type { IEvidenceCheckCommand } from "./structures/IEvidenceCheckCommand";
import type { IEvidenceCommand } from "./structures/IEvidenceCommand";
import type { IEvidenceCommandFailure } from "./structures/IEvidenceCommandFailure";
import type { IEvidenceCommandResult } from "./structures/IEvidenceCommandResult";
import type { IEvidenceInitCommand } from "./structures/IEvidenceInitCommand";
import type { EvidenceCommandExitCode } from "./typings/EvidenceCommandExitCode";

/** Parses and runs the standalone Evidence command line. */
export namespace EvidenceCommand {
  /** Parses the complete argument list and rejects unknown or incompatible input. */
  export function parse(args: readonly string[]): IEvidenceCommand {
    if (args.length === 1 && (args[0] === "-v" || args[0] === "--version"))
      return { operation: "version" };

    const tokens = [...args];
    let operation: "check" | "init" = "check";
    const first = tokens[0];
    if (first === "check" || first === "init") {
      operation = first;
      tokens.shift();
    } else if (first !== undefined && !first.startsWith("-"))
      throw new EvidenceCommandError(`Unknown Evidence command '${first}'.`);

    if (tokens.length === 1 && (tokens[0] === "-h" || tokens[0] === "--help"))
      return { operation: "help" };
    if (tokens.includes("-h") || tokens.includes("--help"))
      throw new EvidenceCommandError(
        "The help flag cannot be combined with other options.",
      );
    if (tokens.includes("-v") || tokens.includes("--version"))
      throw new EvidenceCommandError(
        "The version flag cannot be combined with a command or other options.",
      );

    const values = new Map<string, string>();
    let watch = false;
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      if (token === undefined)
        throw new EvidenceCommandError(
          "The argument list changed while parsing.",
        );
      if (token === "-w" || token === "--watch") {
        if (operation !== "check")
          throw new EvidenceCommandError(
            `${token} is available only to evidence check.`,
          );
        watch = true;
        continue;
      }
      const key = optionKey(token);
      if (key === undefined)
        throw new EvidenceCommandError(`Unknown Evidence argument '${token}'.`);
      if (operation === "init" && (key === "format" || key === "output"))
        throw new EvidenceCommandError(
          `${token} is not available to evidence init.`,
        );
      if (values.has(key))
        throw new EvidenceCommandError(`Option '${token}' was provided twice.`);
      const value = tokens[++index];
      if (value === undefined || value.startsWith("-"))
        throw new EvidenceCommandError(`Option '${token}' requires a value.`);
      if (value === "")
        throw new EvidenceCommandError(`Option '${token}' cannot be empty.`);
      values.set(key, value);
    }
    if (watch)
      throw new EvidenceCommandError(
        "Evidence watch mode is reserved but not implemented. Run evidence check without --watch.",
      );

    const cwd = values.get("cwd") ?? ".";
    const config = values.get("config") ?? "evidence.config.ts";
    if (operation === "init") return { operation, cwd, config };

    const format = values.get("format") ?? "text";
    if (format !== "text" && format !== "json")
      throw new EvidenceCommandError(
        `Unknown report format '${format}'. Use text or json.`,
      );
    const output = values.get("output");
    return {
      operation,
      cwd,
      config,
      format,
      ...(output === undefined ? {} : { output }),
    };
  }

  /** Runs a command with buffered output for direct logic tests and embedding. */
  export async function run(
    args: readonly string[],
    baseCwd: string = process.cwd(),
  ): Promise<IEvidenceCommandResult> {
    let command: IEvidenceCommand;
    try {
      command = parse(args);
    } catch (cause) {
      return failureResult(cause, "Run 'evidence --help' for valid syntax.");
    }

    if (command.operation === "help")
      return { exitCode: 0, stdout: HELP + "\n", stderr: "" };
    if (command.operation === "version") {
      try {
        return {
          exitCode: 0,
          stdout: `${await version()}\n`,
          stderr: "",
        };
      } catch (cause) {
        return failureResult(
          cause,
          "Restore the installed @samchon/evidence package manifest.",
        );
      }
    }
    if (command.operation === "init") return runInit(command, baseCwd);
    return runCheck(command, baseCwd);
  }

  /** Writes buffered output and returns the status for the executable entry point. */
  export async function main(
    args: readonly string[],
  ): Promise<EvidenceCommandExitCode> {
    const result = await run(args);
    if (result.stdout !== "") process.stdout.write(result.stdout);
    if (result.stderr !== "") process.stderr.write(result.stderr);
    return result.exitCode;
  }

  /** Creates one typed starter config without overwriting an existing file. */
  export async function initialize(file: string): Promise<void> {
    try {
      await writeFile(file, INITIAL_CONFIG + "\n", {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (cause) {
      if (errorCode(cause) === "EEXIST")
        throw new Error(
          `Refusing to overwrite the existing Evidence configuration: ${file}`,
        );
      throw cause;
    }
  }
}

async function runCheck(
  command: IEvidenceCheckCommand,
  baseCwd: string,
): Promise<IEvidenceCommandResult> {
  const cwd = path.resolve(baseCwd, command.cwd);
  const configFile = path.resolve(cwd, command.config);
  try {
    const report = await EvidenceChecker.check(configFile);
    return writeReport(
      command,
      cwd,
      EvidenceReporter.render(report, command.format),
      report.exitCode,
      false,
    );
  } catch (cause) {
    const message = errorMessage(cause);
    const repair =
      "Correct the command, configuration, dependencies, or source failure and run the complete check again.";
    const output =
      command.format === "json"
        ? JSON.stringify(
            {
              schemaVersion: 1,
              command: "check",
              status: "failed",
              success: false,
              exitCode: 2,
              configFile,
              message,
              repair,
            } satisfies IEvidenceCommandFailure,
            null,
            2,
          ) + "\n"
        : `Evidence check failed: ${message}\nRepair: ${repair}\n`;
    return writeReport(command, cwd, output, 2, command.format === "text");
  }
}

async function writeReport(
  command: IEvidenceCheckCommand,
  cwd: string,
  content: string,
  exitCode: EvidenceCommandExitCode,
  failure: boolean,
): Promise<IEvidenceCommandResult> {
  if (command.output === undefined)
    return {
      exitCode,
      stdout: failure ? "" : content,
      stderr: failure ? content : "",
    };
  const destination = path.resolve(cwd, command.output);
  try {
    await writeFile(destination, content, "utf8");
    return { exitCode, stdout: "", stderr: "" };
  } catch (cause) {
    return failureResult(
      new Error(
        `Could not write Evidence report '${destination}': ${errorMessage(cause)}`,
      ),
      "Correct the output path or its permissions and run the check again.",
    );
  }
}

async function runInit(
  command: IEvidenceInitCommand,
  baseCwd: string,
): Promise<IEvidenceCommandResult> {
  const cwd = path.resolve(baseCwd, command.cwd);
  const configFile = path.resolve(cwd, command.config);
  try {
    await EvidenceCommand.initialize(configFile);
    return {
      exitCode: 0,
      stdout: `Created ${configFile}\n`,
      stderr: "",
    };
  } catch (cause) {
    return failureResult(
      cause,
      "Choose another --config path or preserve and edit the existing file.",
    );
  }
}

function optionKey(token: string | undefined): string | undefined {
  switch (token) {
    case "-c":
    case "--config":
      return "config";
    case "--cwd":
      return "cwd";
    case "--format":
      return "format";
    case "-o":
    case "--output":
      return "output";
    case undefined:
      return undefined;
    default:
      return undefined;
  }
}

async function version(): Promise<string> {
  const manifest = typia.json.assertParse<IPackageManifest>(
    await readFile(path.join(__dirname, "../package.json"), "utf8"),
  );
  return manifest.version;
}

function failureResult(cause: unknown, repair: string): IEvidenceCommandResult {
  return {
    exitCode: 2,
    stdout: "",
    stderr: `Evidence command failed: ${errorMessage(cause)}\nRepair: ${repair}\n`,
  };
}

function errorCode(cause: unknown): string | undefined {
  if (!(cause instanceof Error) || !("code" in cause)) return undefined;
  const code: unknown = cause.code;
  return typeof code === "string" ? code : undefined;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

const HELP = dedent`
  Usage: evidence [check] [options]
         evidence init [options]
         evidence --help
         evidence --version

  Commands:
    check                 Evaluate every enabled claim and reference (default).
    init                  Create a typed evidence.config.ts without overwriting.

  Options:
    -c, --config <path>   Select the configuration file.
        --cwd <path>      Resolve CLI paths from this directory.
        --format <value>  Emit check results as text or json (default: text).
    -o, --output <path>   Write the check report to a file.
    -w, --watch           Reserved for a future watch command.
    -h, --help            Show this help without loading configuration.
    -v, --version         Show the package version without loading configuration.

  Exit codes:
    0  Complete check without error-severity findings.
    1  Complete check with Evidence violations.
    2  Invalid command/configuration or incomplete analysis.
`;

const INITIAL_CONFIG = dedent`
  import type { IEvidenceConfig } from "@samchon/evidence";

  export default {
    claims: [
      {
        name: "application",
        type: "typescript",
        // Replace these globs with the public source and requirements in this project.
        files: ["src/**/*.ts"],
        reference: {
          type: "markdown",
          files: ["docs/requirements.md"],
        },
      },
    ],
  } satisfies IEvidenceConfig;
`;

import { dedent } from "@typia/utils";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import typia from "typia";

import { EvidenceChecker } from "./EvidenceChecker";
import { EvidenceCommandError } from "./EvidenceCommandError";
import { EvidenceGraphReporter } from "./EvidenceGraphReporter";
import { EvidenceQuery } from "./EvidenceQuery";
import { EvidenceQueryReporter } from "./EvidenceQueryReporter";
import { EvidenceReporter } from "./EvidenceReporter";
import { EvidenceWatcher } from "./EvidenceWatcher";
import { EvidenceWatchReporter } from "./EvidenceWatchReporter";
import { EvidenceArtifactTypes } from "./internal/EvidenceArtifactTypes";
import type { IPackageManifest } from "./internal/IPackageManifest";
import type { IEvidenceCheckCommand } from "./structures/IEvidenceCheckCommand";
import type { IEvidenceCommand } from "./structures/IEvidenceCommand";
import type { IEvidenceCommandFailure } from "./structures/IEvidenceCommandFailure";
import type { IEvidenceCommandResult } from "./structures/IEvidenceCommandResult";
import type { IEvidenceGraphCommand } from "./structures/IEvidenceGraphCommand";
import type { IEvidenceInitCommand } from "./structures/IEvidenceInitCommand";
import type { IEvidenceInspectCommand } from "./structures/IEvidenceInspectCommand";
import type { IEvidenceLanguagesCommand } from "./structures/IEvidenceLanguagesCommand";
import type { IEvidenceListCommand } from "./structures/IEvidenceListCommand";
import type { EvidenceCommandExitCode } from "./typings/EvidenceCommandExitCode";
import type { EvidenceGraphFormat } from "./typings/EvidenceGraphFormat";
import type { EvidenceReportFormat } from "./typings/EvidenceReportFormat";
import type { EvidenceSymbol } from "./typings/EvidenceSymbol";

/** Parses and runs the standalone Evidence command line. */
export namespace EvidenceCommand {
  /** Parses the complete argument list and rejects unknown or incompatible input. */
  export function parse(args: readonly string[]): IEvidenceCommand {
    if (args.length === 1 && (args[0] === "-v" || args[0] === "--version"))
      return { operation: "version" };

    const tokens = [...args];
    const operation = command(tokens[0]);
    if (operation !== "check" || tokens[0] === "check") tokens.shift();

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
    let target: string | undefined;
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
        if (watch)
          throw new EvidenceCommandError("The watch flag was provided twice.");
        watch = true;
        continue;
      }
      if (!token.startsWith("-")) {
        if (operation !== "inspect")
          throw new EvidenceCommandError(
            `Unexpected argument '${token}' for evidence ${operation}.`,
          );
        if (target !== undefined)
          throw new EvidenceCommandError(
            "Evidence inspect accepts exactly one target.",
          );
        target = token;
        continue;
      }

      const key = optionKey(token);
      if (key === undefined)
        throw new EvidenceCommandError(`Unknown Evidence argument '${token}'.`);
      if (!optionAllowed(operation, key))
        throw new EvidenceCommandError(
          `${token} is not available to evidence ${operation}.`,
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

    const cwd = values.get("cwd") ?? ".";
    if (operation === "init")
      return {
        operation,
        cwd,
        config: values.get("config") ?? "evidence.config.ts",
      };
    if (operation === "languages")
      return {
        operation,
        cwd,
        format: reportFormat(values.get("format")),
        ...optionalOutput(values),
      };

    const config = values.get("config") ?? "evidence.config.ts";
    if (operation === "graph")
      return {
        operation,
        cwd,
        config,
        format: graphFormat(values.get("format")),
        ...optionalOutput(values),
      };
    if (operation === "inspect") {
      if (target === undefined)
        throw new EvidenceCommandError(
          "Evidence inspect requires exactly one target.",
        );
      return {
        operation,
        target,
        cwd,
        config,
        format: reportFormat(values.get("format")),
        ...optionalOutput(values),
      };
    }
    if (operation === "list") {
      const language = values.get("language");
      if (
        language !== undefined &&
        !EvidenceArtifactTypes.isSupported(language)
      )
        throw new EvidenceCommandError(
          `Unknown Evidence artifact type '${language}'. Use a type backed by a shipped adapter.`,
        );
      const kind = values.get("kind");
      if (kind !== undefined && !typia.is<EvidenceSymbol>(kind))
        throw new EvidenceCommandError(
          `Unknown Evidence symbol kind '${kind}'.`,
        );
      return {
        operation,
        cwd,
        config,
        format: reportFormat(values.get("format")),
        ...optionalOutput(values),
        ...(language === undefined ? {} : { language }),
        ...(kind === undefined ? {} : { kind }),
      };
    }
    return {
      operation,
      cwd,
      config,
      format: reportFormat(values.get("format")),
      ...optionalOutput(values),
      ...(watch ? { watch: true } : {}),
    };
  }

  /** Runs a command with buffered output for direct logic tests and embedding. */
  export async function run(
    args: readonly string[],
    baseCwd: string = process.cwd(),
  ): Promise<IEvidenceCommandResult> {
    let parsed: IEvidenceCommand;
    try {
      parsed = parse(args);
    } catch (cause) {
      return failureResult(cause, "Run 'evidence --help' for valid syntax.");
    }

    if (parsed.operation === "help")
      return { exitCode: 0, stdout: HELP + "\n", stderr: "" };
    if (parsed.operation === "version") {
      try {
        return { exitCode: 0, stdout: `${await version()}\n`, stderr: "" };
      } catch (cause) {
        return failureResult(
          cause,
          "Restore the installed @samchon/evidence package manifest.",
        );
      }
    }
    if (parsed.operation === "init") return runInit(parsed, baseCwd);
    if (parsed.operation === "languages") return runLanguages(parsed, baseCwd);
    if (parsed.operation === "check" && parsed.watch === true)
      return failureResult(
        new Error("Buffered EvidenceCommand.run cannot execute watch mode."),
        "Use EvidenceWatcher for embedding or the evidence executable for streamed watch output.",
      );
    return runAnalysis(parsed, baseCwd);
  }

  /** Writes buffered output and returns the status for the executable entry point. */
  export async function main(
    args: readonly string[],
  ): Promise<EvidenceCommandExitCode> {
    let parsed: IEvidenceCommand | undefined;
    try {
      parsed = parse(args);
    } catch {
      // The buffered path owns the established command-error rendering.
    }
    const result =
      parsed?.operation === "check" && parsed.watch === true
        ? await runWatch(parsed, process.cwd())
        : await run(args);
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

async function runWatch(
  command: IEvidenceCheckCommand,
  baseCwd: string,
): Promise<IEvidenceCommandResult> {
  const cwd = path.resolve(baseCwd, command.cwd);
  const configFile = path.resolve(cwd, command.config);
  const destination =
    command.output === undefined
      ? undefined
      : path.resolve(cwd, command.output);
  try {
    if (destination !== undefined) await writeFile(destination, "", "utf8");
  } catch (cause) {
    return failureResult(
      new Error(
        `Could not initialize Evidence watch output '${String(destination)}': ${errorMessage(cause)}`,
      ),
      "Correct the output path or its permissions and run the command again.",
    );
  }

  const watcher = new EvidenceWatcher(configFile);
  const interrupt = (): void => {
    void watcher.close();
  };
  process.once("SIGINT", interrupt);
  try {
    await watcher.watch(async (cycle) => {
      const content = EvidenceWatchReporter.render(cycle, command.format);
      if (destination === undefined) await writeStandardOutput(content);
      else await appendFile(destination, content, "utf8");
    });
    return { exitCode: 0, stdout: "", stderr: "" };
  } catch (cause) {
    return failureResult(
      cause,
      "Correct the watch output or dependency failure and start the command again.",
    );
  } finally {
    process.removeListener("SIGINT", interrupt);
    await watcher.close();
  }
}

async function writeStandardOutput(content: string): Promise<void> {
  await new Promise<undefined>((resolve, reject) => {
    process.stdout.write(content, (cause) => {
      if (cause === null || cause === undefined) resolve(undefined);
      else reject(cause);
    });
  });
}

async function runAnalysis(
  command:
    | IEvidenceCheckCommand
    | IEvidenceGraphCommand
    | IEvidenceInspectCommand
    | IEvidenceListCommand,
  baseCwd: string,
): Promise<IEvidenceCommandResult> {
  const cwd = path.resolve(baseCwd, command.cwd);
  const configFile = path.resolve(cwd, command.config);
  try {
    const analysis = await EvidenceChecker.analyze(configFile);
    if (command.operation === "check")
      return writeReport(
        command.output,
        cwd,
        EvidenceReporter.render(analysis.report, command.format),
        analysis.report.exitCode,
        false,
      );
    if (command.operation === "list") {
      const report = EvidenceQuery.list(
        analysis,
        cwd,
        command.language,
        command.kind,
      );
      return writeReport(
        command.output,
        cwd,
        EvidenceQueryReporter.render(report, command.format),
        report.exitCode,
        false,
      );
    }
    if (command.operation === "inspect") {
      const report = await EvidenceQuery.inspect(analysis, cwd, command.target);
      return writeReport(
        command.output,
        cwd,
        EvidenceQueryReporter.render(report, command.format),
        report.exitCode,
        false,
      );
    }
    const report = EvidenceQuery.graph(analysis, cwd);
    return writeReport(
      command.output,
      cwd,
      EvidenceGraphReporter.render(report, command.format),
      report.exitCode,
      false,
    );
  } catch (cause) {
    const message = errorMessage(cause);
    const repair =
      "Correct the command, configuration, dependencies, or source failure and run the complete command again.";
    const output =
      command.format === "json"
        ? JSON.stringify(
            {
              schemaVersion: 1,
              command: command.operation,
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
        : `Evidence ${command.operation} failed: ${message}\nRepair: ${repair}\n`;
    return writeReport(
      command.output,
      cwd,
      output,
      2,
      command.format !== "json",
    );
  }
}

async function runLanguages(
  command: IEvidenceLanguagesCommand,
  baseCwd: string,
): Promise<IEvidenceCommandResult> {
  const cwd = path.resolve(baseCwd, command.cwd);
  const report = EvidenceQuery.languages();
  return writeReport(
    command.output,
    cwd,
    EvidenceQueryReporter.render(report, command.format),
    0,
    false,
  );
}

async function writeReport(
  output: string | undefined,
  cwd: string,
  content: string,
  exitCode: EvidenceCommandExitCode,
  failure: boolean,
): Promise<IEvidenceCommandResult> {
  if (output === undefined)
    return {
      exitCode,
      stdout: failure ? "" : content,
      stderr: failure ? content : "",
    };
  const destination = path.resolve(cwd, output);
  try {
    await writeFile(destination, content, "utf8");
    return { exitCode, stdout: "", stderr: "" };
  } catch (cause) {
    return failureResult(
      new Error(
        `Could not write Evidence report '${destination}': ${errorMessage(cause)}`,
      ),
      "Correct the output path or its permissions and run the command again.",
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
    return { exitCode: 0, stdout: `Created ${configFile}\n`, stderr: "" };
  } catch (cause) {
    return failureResult(
      cause,
      "Choose another --config path or preserve and edit the existing file.",
    );
  }
}

function command(
  token: string | undefined,
): Exclude<IEvidenceCommand["operation"], "help" | "version"> {
  if (token === undefined || token.startsWith("-")) return "check";
  switch (token) {
    case "check":
    case "graph":
    case "init":
    case "inspect":
    case "languages":
    case "list":
      return token;
    default:
      throw new EvidenceCommandError(`Unknown Evidence command '${token}'.`);
  }
}

function optionKey(token: string): string | undefined {
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
    case "--language":
      return "language";
    case "--kind":
      return "kind";
    default:
      return undefined;
  }
}

function optionAllowed(operation: string, option: string): boolean {
  if (option === "cwd") return true;
  if (operation === "init") return option === "config";
  if (operation === "languages")
    return option === "format" || option === "output";
  if (option === "config" || option === "format" || option === "output")
    return true;
  return operation === "list" && (option === "language" || option === "kind");
}

function optionalOutput(
  values: Map<string, string>,
): Pick<IEvidenceCheckCommand, "output"> {
  const output = values.get("output");
  return output === undefined ? {} : { output };
}

function reportFormat(value: string | undefined): EvidenceReportFormat {
  const format = value ?? "text";
  if (format !== "text" && format !== "json")
    throw new EvidenceCommandError(
      `Unknown report format '${format}'. Use text or json.`,
    );
  return format;
}

function graphFormat(value: string | undefined): EvidenceGraphFormat {
  const format = value ?? "json";
  if (format !== "json" && format !== "mermaid" && format !== "dot")
    throw new EvidenceCommandError(
      `Unknown graph format '${format}'. Use json, mermaid, or dot.`,
    );
  return format;
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
         evidence list [options]
         evidence inspect <target> [options]
         evidence graph [options]
         evidence languages [options]
         evidence init [options]
         evidence --help
         evidence --version

  Commands:
    check                 Evaluate every enabled claim and reference (default).
    list                  List configured public Evidence targets.
    inspect               Resolve and explain one target in every applicable scope.
    graph                 Export the configured graph as json, mermaid, or dot.
    languages             Report adapters shipped with this package.
    init                  Create a typed evidence.config.ts without overwriting.

  Options:
    -c, --config <path>   Select the configuration file.
        --cwd <path>      Resolve CLI paths from this directory.
        --format <value>  Select the command's output format.
    -o, --output <path>   Write command output to a file.
        --language <type> Filter evidence list by artifact type.
        --kind <symbol>   Filter evidence list by symbol kind.
    -w, --watch           Recheck whenever an active dependency changes.
    -h, --help            Show this help without loading configuration.
    -v, --version         Show the package version without loading configuration.

  Formats:
    check, list, inspect, languages  text (default), json
    graph                           json (default), mermaid, dot
    check --watch                   text blocks (default), NDJSON

  Exit codes:
    0  Complete analysis without error-severity findings.
    1  Complete analysis with Evidence violations or an unresolved inspection.
    2  Invalid command/configuration or incomplete analysis.

  Watch stays active across cycle exit codes. Ctrl+C cleans up and exits 0.
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

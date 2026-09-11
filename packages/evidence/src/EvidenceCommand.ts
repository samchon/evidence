import type { IPackageManifest } from "./internal/IPackageManifest";

/** Runs the bootstrap CLI while graph checking is under development. */
export namespace EvidenceCommand {
  /** Selects a supported operation from a complete argument list. */
  export const parse = (
    args: readonly string[],
  ): "help" | "version" | "unavailable" => {
    if (args.length !== 1) return "unavailable";
    const [argument] = args;
    if (argument === "--version" || argument === "-v") return "version";
    if (argument === "--help" || argument === "-h") return "help";
    return "unavailable";
  };

  /** Prints package information or fails explicitly for unavailable commands. */
  export const main = (args: readonly string[]): void => {
    const operation = parse(args);
    if (operation === "version") {
      const manifest = require("../package.json") as IPackageManifest;
      process.stdout.write(`${manifest.version}\n`);
      return;
    }
    if (operation === "help") {
      process.stdout.write(
        [
          "Usage: evidence [--help | --version]",
          "",
          "The package scaffold is available. Evidence graph checking is not implemented yet.",
          "Implementation roadmap: https://github.com/samchon/evidence/issues/31",
          "",
        ].join("\n"),
      );
      return;
    }
    process.stderr.write(
      "Evidence graph checking is not implemented yet. No project was checked. Run evidence --help for the implementation roadmap.\n",
    );
    process.exitCode = 2;
  };
}

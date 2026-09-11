import { createRequire } from "node:module";

/** Runs the bootstrap CLI while graph checking is under development. */
export namespace EvidenceCommand {
  /** Prints package information or fails explicitly for unavailable commands. */
  export const main = (args: readonly string[]): void => {
    if (args.length === 1 && ["--version", "-v"].includes(args[0]!)) {
      const manifest = createRequire(import.meta.url)("../package.json") as {
        version: string;
      };
      process.stdout.write(`${manifest.version}\n`);
      return;
    }
    if (args.length === 1 && ["--help", "-h"].includes(args[0]!)) {
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

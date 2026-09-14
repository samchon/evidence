import { extname } from "node:path";

/** Selects the evaluator supported by a configuration filename's explicit extension. */
export namespace EvidenceConfigFormat {
  /** Rejects unsupported spellings instead of guessing a parser from file content. */
  export function get(file: string): "json" | "typescript" {
    const extension = extname(file);
    if (extension === ".json") return "json";
    if ([".ts", ".cts", ".mts"].includes(extension)) return "typescript";
    throw new Error(
      `Unsupported evidence configuration extension: ${file}. Use .json, .ts, .cts, or .mts.`,
    );
  }
}

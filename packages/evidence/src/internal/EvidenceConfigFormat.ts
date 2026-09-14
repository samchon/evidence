import { extname } from "node:path";

/** Selects the supported configuration evaluator before reading or creating files. */
export namespace EvidenceConfigFormat {
  /** Rejects unsupported spellings, including YAML, instead of guessing from content. */
  export function get(file: string): "json" | "typescript" {
    const extension = extname(file);
    if (extension === ".json") return "json";
    if ([".ts", ".cts", ".mts"].includes(extension)) return "typescript";
    throw new Error(
      `Unsupported evidence configuration extension: ${file}. Use .json, .ts, .cts, or .mts.`,
    );
  }
}

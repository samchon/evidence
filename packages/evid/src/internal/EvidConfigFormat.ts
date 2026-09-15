import { extname } from "node:path";

/** Selects the evaluator supported by a configuration filename's explicit extension.
 *
 * Config loading calls this boundary before parsing so file content never changes the evaluator selected for a path.
 */
export namespace EvidConfigFormat {
  /** Returns the evaluator selected by an explicit supported filename extension.
   *
   * Unsupported spellings fail here instead of causing configuration loading to guess a parser from file content.
   */
  export function get(file: string): "json" | "typescript" {
    const extension = extname(file);
    if (extension === ".json") return "json";
    if ([".ts", ".cts", ".mts"].includes(extension)) return "typescript";
    throw new Error(
      `Unsupported evidence configuration extension: ${file}. Use .json, .ts, .cts, or .mts.`,
    );
  }
}

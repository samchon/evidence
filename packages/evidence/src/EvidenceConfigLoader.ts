import { realpath, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import typia from "typia";

import { evaluateTypeScriptConfig } from "./internal/evaluateTypeScriptConfig";
import type { IEvidenceConfig } from "./structures/IEvidenceConfig";

/** Loads a TypeScript configuration through the consumer's ttsx. */
export namespace EvidenceConfigLoader {
  /**
   * Loads a TS default export through the consumer's ttsx, then validates its data.
   * Evaluator output goes to stderr.
   *
   * @param file Configuration path, relative to the current working directory.
   */
  export async function load(
    file: string = "evidence.config.ts",
  ): Promise<IEvidenceConfig> {
    const filename = await realpath(resolve(file));
    if (![".ts", ".cts", ".mts"].includes(extname(filename)))
      throw new Error(
        `Unsupported evidence configuration extension: ${filename}`,
      );
    if (!(await stat(filename)).isFile())
      throw new Error(`Evidence configuration must be a file: ${filename}`);
    return typia.assert<IEvidenceConfig>(
      await evaluateTypeScriptConfig(filename),
    );
  }
}

/// <reference types="node" />

import type { ITtscLintPlugin } from "@ttsc/lint";
import path from "node:path";
import type { IEvidenceGraphConfig } from "./structures/index";
import { version } from "../package.json";

export * from "./structures/index";
export * from "./typings/index";

/**
 * The `@ttsc/lint` contributor that checks a project's evidence graph.
 *
 * Import this value into `lint.config.ts` and register it under the
 * `"evidence"` plugin name. You can then enable `"evidence/graph"` and pass an
 * {@link IEvidenceGraphConfig} that describes which documents and TypeScript
 * symbols must remain connected.
 *
 * @example <caption>Configure the plugin in `lint.config.ts`</caption>
 *   import type { ITtscLintConfig } from "@ttsc/lint";
 *   import {
 *     evidence,
 *     type IEvidenceGraphConfig,
 *   } from "@samchon/lint-plugin-evidence";
 *
 *   const graph: IEvidenceGraphConfig = {
 *     claims: [
 *       {
 *         type: "typescript",
 *         files: ["src/**"],
 *         reference: {
 *           type: "markdown",
 *           files: ["docs/*.md"],
 *         },
 *       },
 *     ],
 *   };
 *
 *   export default {
 *     plugins: {
 *       evidence: evidence,
 *     },
 *     rules: {
 *       "evidence/graph": ["error", graph],
 *     },
 *   } satisfies ITtscLintConfig;
 */
export const evidence = {
  meta: {
    name: "@samchon/lint-plugin-evidence",
    namespace: "evidence",
    version,
  } as const,
  rules: ["graph"] as const,
  source: path.resolve(__dirname, "..", "native"),
} satisfies ITtscLintPlugin;
export default evidence;

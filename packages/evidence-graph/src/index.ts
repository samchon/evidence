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
 * `"evidence-graph"` plugin name. You can then enable `"evidence-graph/index"`
 * and pass an {@link IEvidenceGraphConfig} that describes which documents and
 * TypeScript symbols must remain connected.
 *
 * @example <caption>Configure the plugin in `lint.config.ts`</caption>
 *   import type { ITtscLintConfig } from "@ttsc/lint";
 *   import {
 *     evidenceGraph,
 *     type IEvidenceGraphConfig,
 *   } from "@samchon/evidence-graph";
 *
 *   const graph: IEvidenceGraphConfig = {
 *     sources: [
 *       {
 *         type: "markdown",
 *         files: ["docs/*.md"],
 *         citedBy: {
 *           type: "typescript",
 *           files: ["src/**"],
 *         },
 *       },
 *     ],
 *   };
 *
 *   export default {
 *     plugins: {
 *       "evidence-graph": evidenceGraph,
 *     },
 *     rules: {
 *       "evidence-graph/index": ["error", graph],
 *     },
 *   } satisfies ITtscLintConfig;
 */
export const evidenceGraph = {
  meta: {
    name: "@samchon/evidence-graph",
    namespace: "evidence-graph",
    version,
  } as const,
  rules: ["index"] as const,
  source: path.resolve(__dirname, "..", "native"),
} satisfies ITtscLintPlugin;
export default evidenceGraph;

declare module "@ttsc/lint" {
  interface ITtscLintRuleOptionsMap {
    /**
     * Declares this project's evidence graph.
     *
     * The sources define evidence units and the independently complete citer
     * populations that must acknowledge them.
     */
    "evidence-graph/index": IEvidenceGraphConfig;
  }
}

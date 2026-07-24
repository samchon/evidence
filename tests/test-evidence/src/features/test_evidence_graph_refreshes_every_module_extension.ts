import fs from "node:fs";
import path from "node:path";

import {
  assertFailure,
  assertIncludes,
  assertStatus,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/index.ts";

/**
 * Verifies every supported module extension both materializes evidence and
 * refreshes across repeated checks.
 *
 * The loader accepts `.ts`, `.tsx`, `.mts`, and `.cts`, and `.d.ts` arrives as
 * an ordinary `.ts` suffix — but every graph case until now used `.ts` alone,
 * so four of the five accepted extensions were carried by a suffix list nothing
 * exercised. Dropping one from that list, or an inventory keyed in a way that
 * missed a module kind, would have gone unnoticed while every test stayed
 * green. Renaming all five in one edit makes each extension name itself on
 * failure.
 *
 * 1. Cite one exported type from each of `.ts`, `.tsx`, `.mts`, `.cts`, and
 *    `.d.ts`.
 * 2. Rename all five and assert each old target is unresolved and each new one
 *    missing.
 * 3. Update the citations and assert the graph is complete again.
 */
export const test_evidence_graph_refreshes_every_module_extension =
  (): void => {
    const project: IEvidenceProject = createProject({
      name: "module-extensions",
      lintConfig: [
        'import { evidence } from "@samchon/lint-plugin-evidence";',
        "",
        "export default {",
        '  plugins: { "evidence": evidence },',
        "  rules: {",
        '    "evidence/graph": ["error", {',
        "      claims: [{",
        '        type: "markdown",',
        '        files: ["docs/ledger.md"],',
        '        symbol: "file",',
        "        reference: {",
        '          type: "typescript",',
        '          files: ["src/**"],',
        '          symbol: "type",',
        "        },",
        "      }],",
        "    }],",
        "  },",
        "};",
        "",
      ].join("\n"),
      files: {
        ...sourcesFor("Alpha"),
        "docs/ledger.md": ledgerFor("Alpha"),
      },
    });
    try {
      assertStatus(
        runCheck(project.directory),
        0,
        "Every supported module extension must materialize evidence before freshness is tested.",
      );

      for (const [relative, content] of Object.entries(sourcesFor("Beta")))
        write(project, relative, content);
      const stale = runCheck(project.directory);
      assertFailure(
        stale,
        "A rename in any supported module extension must invalidate its old target.",
      );
      for (const suffix of SUFFIXES) {
        assertIncludes(
          stale,
          `Unresolved evidence target 'IAlpha${suffix.symbol}'`,
          `A renamed type in a ${suffix.extension} module must not survive in the next inventory.`,
        );
        assertIncludes(
          stale,
          `Missing acknowledgement for 'IBeta${suffix.symbol}'`,
          `The renamed type in a ${suffix.extension} module must become the current obligation.`,
        );
      }

      write(project, "docs/ledger.md", ledgerFor("Beta"));
      assertStatus(
        runCheck(project.directory),
        0,
        "Updating every citation must restore the refreshed graph.",
      );
    } finally {
      project.cleanup();
    }
  };

/**
 * The accepted module extensions, each paired with the symbol suffix that keeps
 * its target distinguishable in a diagnostic.
 *
 * A declaration file is listed separately from `.ts` even though the loader
 * sees the same suffix, because it reaches the collector as an ambient module
 * and is the one entry whose exports are implicitly public.
 */
const SUFFIXES: readonly { extension: string; symbol: string }[] = [
  { extension: ".ts", symbol: "Module" },
  { extension: ".tsx", symbol: "Component" },
  { extension: ".mts", symbol: "Esm" },
  { extension: ".cts", symbol: "Commonjs" },
  { extension: ".d.ts", symbol: "Ambient" },
];

const sourcesFor = (name: string): Record<string, string> =>
  Object.fromEntries(
    SUFFIXES.map((suffix) => [
      `src/${suffix.symbol.toLowerCase()}${suffix.extension}`,
      `export interface I${name}${suffix.symbol} {}\n`,
    ]),
  );

const ledgerFor = (name: string): string =>
  SUFFIXES.map(
    (suffix) =>
      `<!-- @evidence I${name}${suffix.symbol} Documents the ${suffix.extension} contract. -->`,
  ).join("\n") + "\n";

const write = (
  project: IEvidenceProject,
  relative: string,
  content: string,
): void => {
  fs.writeFileSync(path.join(project.directory, relative), content, "utf8");
};

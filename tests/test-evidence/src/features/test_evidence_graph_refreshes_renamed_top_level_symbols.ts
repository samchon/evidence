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
 * Verifies repeated checks rebuild the inventory for every top-level symbol
 * kind.
 *
 * The existing refresh case renames a Markdown heading, a namespace property,
 * and a class method — all of them nested inside an owner whose own identity
 * never changes. A module-scope declaration is materialized down a different
 * branch of the collector, so a cache keyed on the enclosing scope could
 * refresh the nested cases while serving a stale top-level type, function, or
 * property. Each kind is renamed in one edit so a per-kind failure names itself
 * rather than hiding behind the first one.
 *
 * 1. Check a complete graph citing a top-level type, function, and property.
 * 2. Rename all three and assert the next check reports each old target unresolved
 *    and each new target missing.
 * 3. Update the citations and assert the graph is complete again.
 */
export const test_evidence_graph_refreshes_renamed_top_level_symbols =
  (): void => {
    const project: IEvidenceProject = createProject({
      name: "top-level-refresh",
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
        '          files: ["src/contracts.ts"],',
        '          symbol: ["type", "function", "property"],',
        "        },",
        "      }],",
        "    }],",
        "  },",
        "};",
        "",
      ].join("\n"),
      files: {
        "src/contracts.ts": contractsFor("Alpha"),
        "docs/ledger.md": ledgerFor("Alpha"),
      },
    });
    try {
      assertStatus(
        runCheck(project.directory),
        0,
        "The initial graph must prove the fixture can pass before freshness is tested.",
      );

      write(project, "src/contracts.ts", contractsFor("Beta"));
      const stale = runCheck(project.directory);
      assertFailure(
        stale,
        "Renamed top-level declarations must invalidate their old targets on the next check.",
      );
      assertIncludes(
        stale,
        "Unresolved evidence target 'IAlpha'",
        "A renamed top-level type must not survive in the next inventory.",
      );
      assertIncludes(
        stale,
        "Unresolved evidence target 'alphaOf'",
        "A renamed top-level function must not survive in the next inventory.",
      );
      assertIncludes(
        stale,
        "Unresolved evidence target 'alphaLimit'",
        "A renamed top-level property must not survive in the next inventory.",
      );
      assertIncludes(
        stale,
        "Missing acknowledgement for 'IBeta'",
        "The renamed type must become the current obligation.",
      );
      assertIncludes(
        stale,
        "Missing acknowledgement for 'betaOf'",
        "The renamed function must become the current obligation.",
      );
      assertIncludes(
        stale,
        "Missing acknowledgement for 'betaLimit'",
        "The renamed property must become the current obligation.",
      );

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

const contractsFor = (name: string): string => {
  const lower: string = name.toLowerCase();
  return [
    `export interface I${name} {}`,
    "",
    `export function ${lower}Of(): string {`,
    `  return "${lower}";`,
    "}",
    "",
    `export const ${lower}Limit = 10;`,
    "",
  ].join("\n");
};

const ledgerFor = (name: string): string => {
  const lower: string = name.toLowerCase();
  return [
    `<!-- @evidence I${name} Documents the current top-level contract. -->`,
    `<!-- @evidence ${lower}Of Documents the current top-level callable. -->`,
    `<!-- @evidence ${lower}Limit Documents the current top-level constant. -->`,
    "",
  ].join("\n");
};

const write = (
  project: IEvidenceProject,
  relative: string,
  content: string,
): void => {
  fs.writeFileSync(path.join(project.directory, relative), content, "utf8");
};

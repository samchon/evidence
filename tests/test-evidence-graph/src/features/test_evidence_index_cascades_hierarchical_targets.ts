import {
  assertExcludes,
  assertStatus,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies hierarchical targets through the real binary: Markdown files and
 * TypeScript namespaces acknowledge their selected descendants.
 *
 * Unit tests can prove the graph evaluator, but not that the published
 * descriptor links the changed Go package or that the consumer's typed config
 * reaches it. This fixture crosses both hierarchy directions and exercises the
 * new namespace and variable materializers.
 *
 * 1. Cite an H2/H3 document through its unselected file ancestor.
 * 2. Cite namespace function/property units through their unselected type
 *    ancestor.
 * 3. Assert the consumer build has no unresolved or missing evidence.
 */
export const test_evidence_index_cascades_hierarchical_targets = (): void => {
  const project: IEvidenceProject = createProject({
    name: "hierarchical-targets",
    lintConfig: [
      'import type { ITtscLintConfig } from "@ttsc/lint";',
      'import { evidenceGraph } from "@samchon/evidence-graph";',
      "",
      "export default {",
      '  plugins: { "evidence-graph": evidenceGraph },',
      "  rules: {",
      '    "evidence-graph/index": ["error", {',
      "      claims: [",
      "        {",
      '          type: "typescript",',
      '          files: ["src/implementation.ts"],',
      '          symbol: "type",',
      '          reference: { type: "markdown", files: ["docs/spec.md"], symbol: ["h2", "h3"] },',
      "        },",
      "        {",
      '          type: "markdown",',
      '          files: ["docs/ledger.md"],',
      '          symbol: "file",',
      '          reference: { type: "typescript", files: ["src/implementation.ts"], symbol: ["function", "property"] },',
      "        },",
      "      ],",
      "    }],",
      "  },",
      "} satisfies ITtscLintConfig;",
      "",
    ].join("\n"),
    files: {
      "docs/spec.md": ["## Orders", "", "### Retry", ""].join("\n"),
      "src/implementation.ts": [
        "/** @evidence docs/spec.md The namespace implements the complete order specification. */",
        "export namespace Implementation {",
        '  export const state = "ready";',
        "  export function run(): void {}",
        "}",
        "",
      ].join("\n"),
      "docs/ledger.md": [
        "<!-- @evidence Implementation The ledger documents the complete implementation namespace. -->",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertStatus(
      result,
      0,
      "Ancestor targets must satisfy selected descendant obligations through the packaged contributor.",
    );
    assertExcludes(
      result,
      "Unresolved evidence target",
      "Both unselected ancestors must remain resolvable citation scopes.",
    );
    assertExcludes(
      result,
      "Missing acknowledgement",
      "Both descendant populations must be covered by their ancestors.",
    );
  } finally {
    project.cleanup();
  }
};

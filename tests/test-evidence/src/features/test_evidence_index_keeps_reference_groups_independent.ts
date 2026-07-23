import {
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies that separate reference groups cannot pool partial coverage.
 *
 * Each group below acknowledges a different half of the same source. A global
 * acknowledgement set would report full coverage, but the public contract
 * requires both populations to account for both evidence units independently.
 *
 * 1. Define two Markdown H2 evidence units.
 * 2. Let each TypeScript reference group cite only the other group's missing unit.
 * 3. Assert that both group-specific missing acknowledgements are reported.
 */
export const test_evidence_index_keeps_reference_groups_independent =
  (): void => {
    const project: IEvidenceProject = createProject({
      name: "independent-references",
      lintConfig: [
        'import type { ITtscLintConfig } from "@ttsc/lint";',
        'import { evidenceGraph } from "@samchon/evidence-graph";',
        "",
        "export default {",
        '  plugins: { "evidence-graph": evidenceGraph },',
        "  rules: {",
        '    "evidence-graph/index": ["error", {',
        "      sources: [{",
        '        type: "markdown",',
        '        files: ["docs/spec.md"],',
        '        symbol: "h2",',
        "        reference: [",
        '          { type: "typescript", files: ["src/team-a.ts"], symbol: "function" },',
        '          { type: "typescript", files: ["src/team-b.ts"], symbol: "function" },',
        "        ],",
        "      }],",
        "    }],",
        "  },",
        "} satisfies ITtscLintConfig;",
        "",
      ].join("\n"),
      files: {
        "docs/spec.md": ["## Alpha {#alpha}", "", "## Beta {#beta}", ""].join(
          "\n",
        ),
        "src/team-a.ts": [
          "/** @evidence docs/spec.md#alpha Team A implements Alpha. */",
          "export function alpha(): void {}",
          "",
        ].join("\n"),
        "src/team-b.ts": [
          "/** @evidence docs/spec.md#beta Team B implements Beta. */",
          "export function beta(): void {}",
          "",
        ].join("\n"),
      },
    });
    try {
      const result = runCheck(project.directory);
      assertFailure(
        result,
        "Incomplete independent reference groups must fail the consumer build.",
      );
      assertIncludes(
        result,
        "Missing acknowledgement for 'docs/spec.md#beta'",
        "Reference group 1 must not borrow Beta's acknowledgement from group 2.",
      );
      assertIncludes(
        result,
        "Missing acknowledgement for 'docs/spec.md#alpha'",
        "Reference group 2 must not borrow Alpha's acknowledgement from group 1.",
      );
      assertIncludes(
        result,
        "reference 1",
        "The diagnostic must identify the first incomplete population.",
      );
      assertIncludes(
        result,
        "reference 2",
        "The diagnostic must identify the second incomplete population.",
      );
    } finally {
      project.cleanup();
    }
  };

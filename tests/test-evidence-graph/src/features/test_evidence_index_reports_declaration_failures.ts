import {
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies declaration diagnostics through the packaged rule.
 *
 * Unit tests pin the parser's individual branches; this fixture proves those
 * failures survive config evaluation, contributor linking, project dispatch,
 * and diagnostic rendering in the real consumer process.
 *
 * 1. Write malformed, unresolved, duplicate, and out-of-scope declarations.
 * 2. Run the published plugin through `ttsc check`.
 * 3. Assert that every failure class reaches the consumer.
 */
export const test_evidence_index_reports_declaration_failures = (): void => {
  const project: IEvidenceProject = createProject({
    name: "declaration-failures",
    lintConfig: [
      'import type { ITtscLintConfig } from "@ttsc/lint";',
      'import { evidenceGraph } from "@samchon/evidence-graph";',
      "",
      "export default {",
      '  plugins: { "evidence-graph": evidenceGraph },',
      "  rules: {",
      '    "evidence-graph/index": ["error", {',
      "      claims: [{",
      '        type: "typescript",',
      '        files: ["src/citations.ts"],',
      '        symbol: "function",',
      "        reference: {",
      '          type: "markdown",',
      '          files: ["docs/spec.md"],',
      '          symbol: "h2",',
      "        },",
      "      }],",
      "    }],",
      "  },",
      "} satisfies ITtscLintConfig;",
      "",
    ].join("\n"),
    files: {
      "docs/spec.md": "## Required {#required}\n",
      "src/citations.ts": [
        "/** @evidence docs/spec.md#required */",
        "export function missingReason(): void {}",
        "",
        "/** @evidence docs/spec.md#absent This target does not exist. */",
        "export function unresolved(): void {}",
        "",
        "/** @evidence docs/spec.md#required First acknowledgement. */",
        "export function first(): void {}",
        "",
        "/** @evidenceExclude docs/spec.md#required Second acknowledgement. */",
        "export function second(): void {}",
        "",
        "/** @evidence docs/spec.md#required A property is outside the selected function hosts. */",
        "export interface IOutside {",
        "  value: string;",
        "}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertFailure(
      result,
      "Invalid evidence declarations must fail the consumer build.",
    );
    assertIncludes(
      result,
      "Malformed @evidence declaration",
      "A declaration without a reason must fail.",
    );
    assertIncludes(
      result,
      "Unresolved evidence target 'docs/spec.md#absent'",
      "A declaration target must resolve.",
    );
    assertIncludes(
      result,
      "Duplicate acknowledgement for 'docs/spec.md#required'",
      "One claim may acknowledge an evidence unit only once.",
    );
    assertIncludes(
      result,
      "Out-of-scope @evidence host",
      "A declaration on an unselected symbol kind must fail.",
    );
  } finally {
    project.cleanup();
  }
};

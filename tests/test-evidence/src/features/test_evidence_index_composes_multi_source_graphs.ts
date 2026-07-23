import {
  assertExcludes,
  assertStatus,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies a composed multi-source graph: Markdown owing Markdown across two
 * independent citer groups, Markdown owing components and tests, and TypeScript
 * owing TypeScript, all in one `sources` array.
 *
 * Each single-source case is pinned elsewhere; this fixture proves the shapes
 * compose without leaking state across entries. It also exercises the exclusion
 * path end to end: one requirement is acknowledged with `@evidenceExclude`, so
 * a green run proves an exclusion satisfies exactly its own group.
 *
 * 1. Declare three sources: requirements owed by analysis and architecture docs,
 *    feature rules owed by components and tests, components owed by tests.
 * 2. Acknowledge every unit, one of them through an exclusion.
 * 3. Assert the composed graph passes with no missing acknowledgement.
 */
export const test_evidence_index_composes_multi_source_graphs = (): void => {
  const project: IEvidenceProject = createProject({
    name: "composed-graph",
    lintConfig: [
      'import type { ITtscLintConfig } from "@ttsc/lint";',
      'import { evidenceGraph, type IEvidenceGraphConfig } from "@samchon/evidence-graph";',
      "",
      "const graph: IEvidenceGraphConfig = {",
      "  sources: [",
      "    {",
      '      type: "markdown",',
      '      files: ["docs/requirements.md"],',
      '      symbol: "h2",',
      "      citedBy: [",
      '        { type: "markdown", files: ["docs/analysis.md"], symbol: "h2" },',
      '        { type: "markdown", files: ["docs/architecture.md"], symbol: "h2" },',
      "      ],",
      "    },",
      "    {",
      '      type: "markdown",',
      '      files: ["docs/features.md"],',
      '      symbol: "h2",',
      "      citedBy: [",
      '        { type: "typescript", files: ["src/components/**/*.tsx"], symbol: "function" },',
      '        { type: "typescript", files: ["src/features/**/*.ts"], symbol: "function" },',
      "      ],",
      "    },",
      "    {",
      '      type: "typescript",',
      '      files: ["src/components/**/*.tsx"],',
      '      symbol: "function",',
      "      citedBy: {",
      '        type: "typescript",',
      '        files: ["src/features/**/*.ts"],',
      '        symbol: "function",',
      "      },",
      "    },",
      "  ],",
      "};",
      "",
      "export default {",
      '  plugins: { "evidence-graph": evidenceGraph },',
      '  rules: { "evidence-graph/index": ["error", graph] },',
      "} satisfies ITtscLintConfig;",
      "",
    ].join("\n"),
    files: {
      "docs/requirements.md": "## Checkout {#checkout}\n",
      "docs/analysis.md": [
        "## Checkout Analysis",
        "",
        "<!-- @evidence docs/requirements.md#checkout The analysis refines the checkout requirement. -->",
        "",
      ].join("\n"),
      "docs/architecture.md": [
        "## Checkout Architecture",
        "",
        "<!-- @evidenceExclude docs/requirements.md#checkout Architecture defers checkout to the payment provider. -->",
        "",
      ].join("\n"),
      "docs/features.md": "## Cart Badge {#cart-badge}\n",
      "src/components/CartBadge.tsx": [
        "/**",
        " * @evidence docs/features.md#cart-badge Renders the badge the feature rule defines.",
        " */",
        "export function CartBadge(): string {",
        '  return "badge";',
        "}",
        "",
      ].join("\n"),
      "src/features/cart_badge.ts": [
        "/**",
        " * @evidence docs/features.md#cart-badge Verifies the badge follows the feature rule.",
        " * @evidence CartBadge Claims the exported component contract.",
        " */",
        "export function test_cart_badge(): void {}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertStatus(
      result,
      0,
      "A composed markdown-to-markdown, markdown-to-typescript, and typescript-to-typescript graph must pass when every group acknowledges its units.",
    );
    assertExcludes(
      result,
      "Missing acknowledgement",
      "Every citer group acknowledged its own units, one via @evidenceExclude.",
    );
  } finally {
    project.cleanup();
  }
};

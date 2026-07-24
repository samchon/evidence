import {
  assertStatus,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/index.ts";

/**
 * Verifies the README's opening `lint.config.ts` against the real binary.
 *
 * That block is the first thing a reader copies, and it enables both rules in
 * one unscoped entry — the shape a project rule requires. What makes it safe is
 * program membership: a config file outside the project's `include` is never
 * linted, so `evidence/singular` never meets the anonymous default that `export
 * default {` would otherwise present it with. A README example that fails on
 * itself is worse than no example, and this pins which condition it depends
 * on.
 *
 * 1. Materialize the README's configuration verbatim under `include: ["src"]`.
 * 2. Satisfy the graph obligation with one citing component.
 * 3. Assert `ttsc check` exits clean.
 */
export const test_evidence_readme_configure_example_passes = (): void => {
  const project: IEvidenceProject = createProject({
    name: "readme-configure",
    include: ["src"],
    lintConfig: [
      'import type { ITtscLintConfig } from "@ttsc/lint";',
      'import { evidence, type IEvidenceGraphConfig } from "@samchon/lint-plugin-evidence";',
      "",
      "const graph: IEvidenceGraphConfig = {",
      "  claims: [",
      "    {",
      '      type: "typescript",',
      '      files: ["src/components/**/*.tsx"],',
      '      symbol: "function",',
      "      reference: {",
      '        type: "markdown",',
      '        files: ["docs/**/*.md"],',
      '        symbol: ["h2", "h3"],',
      "      },",
      "    },",
      "  ],",
      "};",
      "",
      "export default {",
      "  plugins: {",
      '    "evidence": evidence,',
      "  },",
      "  rules: {",
      '    "evidence/graph": ["error", graph],',
      '    "evidence/singular": "error",',
      "  },",
      "} satisfies ITtscLintConfig;",
      "",
    ].join("\n"),
    files: {
      "docs/orders.md": "## Create Order {#create-order}\n",
      "src/components/CreateOrder.tsx": [
        "/**",
        " * @evidence docs/orders.md#create-order Renders the documented creation flow.",
        " */",
        "export function CreateOrder(): null {",
        "  return null;",
        "}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertStatus(
      result,
      0,
      "The README's opening configuration must pass on a project that satisfies it.",
    );
  } finally {
    project.cleanup();
  }
};

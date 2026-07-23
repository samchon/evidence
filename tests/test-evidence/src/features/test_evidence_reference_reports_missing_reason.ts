import {
  assertExcludes,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies that a citation without a reason fails, and that a symbol target
 * resolves through a namespace.
 *
 * Two properties that would otherwise rot unnoticed. A bare `@evidence
 * docs/spec.md` parses fine — the grammar only requires a target — so nothing
 * but this rule stands between the graph and a wall of pointers no reviewer can
 * evaluate. And symbol resolution walks namespace bodies to qualify nested
 * names, which is the one path where `IShoppingSale.IUpdate` either works or
 * silently reports every dotted citation as a missing symbol.
 *
 * 1. Cite a document with no reason at all.
 * 2. Cite a namespaced symbol correctly, with a reason.
 * 3. Assert the reasonless tag is reported and the namespaced symbol is not.
 */
export const test_evidence_reference_reports_missing_reason = (): void => {
  const project: IEvidenceProject = createProject({
    name: "missing-reason",
    lint: {
      plugins: { "evidence-graph": "@samchon/evidence-graph" },
      rules: {
        "evidence-graph/index": ["error", { documents: ["docs/**/*.md"] }],
        "evidence-graph/reference": "error",
      },
    },
    files: {
      "docs/spec.md": ["# Spec", "", "## Pricing", "", "Prose.", ""].join("\n"),
      "src/sale.ts": [
        "export interface IShoppingSale {",
        "  price: number;",
        "}",
        "",
        "export namespace IShoppingSale {",
        "  export interface IUpdate {",
        "    price: number;",
        "  }",
        "}",
        "",
        "/**",
        " * @evidence docs/spec.md",
        " */",
        "export const RATE: number = 1;",
        "",
        "/**",
        " * @evidence IShoppingSale.IUpdate Mirrors the update payload exactly.",
        " */",
        "export interface IShoppingSaleDraft {",
        "  price: number;",
        "}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);

    if (result.status === 0)
      throw new Error(
        `Expected a non-zero exit for a reasonless citation, got 0.\n\n${result.output}`,
      );
    assertIncludes(
      result,
      "states no reason",
      "A citation with no reason must be reported: a bare pointer says nothing a reviewer can check.",
    );
    // The negative twin. A namespaced symbol must resolve, or every dotted
    // citation in a samchon-style codebase would be a false positive.
    assertExcludes(
      result,
      "IShoppingSale.IUpdate",
      "A namespaced symbol target must resolve; reporting it would make symbol citations unusable.",
    );
  } finally {
    project.cleanup();
  }
};

import {
  assertExcludes,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies that one document's ambiguous anchor does not switch off integrity
 * checking for the rest of the project.
 *
 * `evidence-graph/index` reports a duplicate-slug heading through `ctx.Report`,
 * which marks the project rule failed even though it still publishes a complete
 * index. The file rules read that index back through `ProjectResult`; a version
 * that accepted it only when the status was `passed` let a single duplicate
 * heading anywhere discard the whole index and silence
 * `evidence-graph/reference` and `evidence-graph/require` across every file — a
 * green build with all integrity checking silently off. The gate must be a
 * usable index, not a passing status.
 *
 * The fixture pins both halves at once: the duplicate heading must still be
 * reported (the ambiguity is real), AND a dangling citation in an unrelated
 * file must still be caught (reference did not go silent), while a citation
 * that resolves is left alone.
 *
 * 1. Index a document with two `## Overview` headings (a duplicate slug) plus a
 *    unique `## Pricing`.
 * 2. From TypeScript, cite a nonexistent anchor and a valid one.
 * 3. Assert the ambiguity is named, the dangling citation is still reported, and
 *    the resolving citation is not.
 */
export const test_evidence_reference_survives_ambiguous_anchor_elsewhere =
  (): void => {
    const project: IEvidenceProject = createProject({
      name: "ambiguous-anchor-does-not-silence",
      lint: {
        plugins: { "evidence-graph": "@samchon/evidence-graph" },
        rules: {
          "evidence-graph/index": ["error", { documents: ["docs/**/*.md"] }],
          "evidence-graph/reference": "error",
        },
      },
      files: {
        "docs/spec.md": [
          "# Shopping Spec",
          "",
          "## Overview",
          "",
          "The catalog domain at a glance.",
          "",
          "## Pricing",
          "",
          "Sale price derives from the campaign rate.",
          "",
          "## Overview",
          "",
          "A second overview, whose heading slugs to the same anchor.",
          "",
        ].join("\n"),
        "src/sale.ts": [
          "/**",
          " * @evidence docs/spec.md#nonexistent This section does not exist.",
          " */",
          "export interface IShoppingSale {",
          "  price: number;",
          "}",
          "",
          "/**",
          " * @evidence docs/spec.md#pricing Sale price follows the campaign rate.",
          " */",
          "export interface IShoppingPrice {",
          "  amount: number;",
          "}",
          "",
        ].join("\n"),
      },
    });
    try {
      const result = runCheck(project.directory);

      if (result.status === 0)
        throw new Error(
          `Expected a non-zero exit for an ambiguous anchor and a dangling citation, got 0.\n\n${result.output}`,
        );
      // The ambiguity itself is still surfaced — the fix keeps the diagnostic,
      // it only stops it from silencing everything else.
      assertIncludes(
        result,
        "Ambiguous evidence anchor 'overview'",
        "The duplicate-slug heading must still be reported by evidence-graph/index.",
      );
      // The fix: reference keeps working despite the index rule failing. On the
      // old code this citation was silently unreported.
      assertIncludes(
        result,
        "docs/spec.md#nonexistent",
        "A dangling citation elsewhere must still be caught even though the index rule failed on an unrelated ambiguity.",
      );
      assertIncludes(
        result,
        "evidence-graph/reference",
        "The dangling citation must be attributed to evidence-graph/reference, proving it was not silenced.",
      );
      // The resolving citation must not be flagged — reference is working
      // normally, not blindly reporting everything.
      assertExcludes(
        result,
        "docs/spec.md#pricing",
        "A citation that resolves must not be reported.",
      );
    } finally {
      project.cleanup();
    }
  };

import {
  assertExcludes,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies evidence integrity: a citation to a section no document declares
 * fails the build, while its well-formed twin does not.
 *
 * This crosses every boundary the product depends on, and each one fails
 * silently rather than loudly. ttsc must resolve `@samchon/evidence-graph` from
 * node_modules, read the descriptor's `source` path, copy `native/` into its
 * own Go module, and fire the synthesized `init()` — a namespace typo there
 * drops the rule with only a stderr warning. Then the project rule must read
 * markdown from disk, which no ttsc Program can see, and publish an index the
 * file rule reads back through `ProjectResult`. If any link breaks, the rule
 * stays quiet and a quiet rule is indistinguishable from a passing one.
 *
 * The positive assertion alone would not catch an over-match, so the fixture
 * pins a valid citation one property away: `#pricing` exists and `#discounts`
 * does not, in the same file, under the same rule.
 *
 * 1. Index a document declaring only `Pricing`.
 * 2. Cite `#pricing` correctly from one declaration and `#discounts` from another.
 * 3. Assert a non-zero exit naming only the dangling target.
 */
export const test_evidence_reference_reports_dangling_document_section =
  (): void => {
    const project: IEvidenceProject = createProject({
      name: "dangling-section",
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
          "## Pricing",
          "",
          "Sale price derives from the campaign rate.",
          "",
        ].join("\n"),
        "src/sale.ts": [
          "/**",
          " * @evidence docs/spec.md#pricing Sale price follows the campaign rate.",
          " */",
          "export interface IShoppingSale {",
          "  price: number;",
          "}",
          "",
          "/**",
          " * @evidence docs/spec.md#discounts Discount policy is defined there.",
          " */",
          "export interface IShoppingDiscount {",
          "  rate: number;",
          "}",
          "",
        ].join("\n"),
      },
    });
    try {
      const result = runCheck(project.directory);

      if (result.status === 0)
        throw new Error(
          `Expected a non-zero exit for a dangling citation, got 0.\n\n${result.output}`,
        );
      assertIncludes(
        result,
        "docs/spec.md#discounts",
        "The dangling citation must be named in the diagnostic.",
      );
      assertIncludes(
        result,
        "evidence-graph/reference",
        "The diagnostic must be attributed to the rule that raised it.",
      );
      // The negative twin. An over-matching rule that flags every citation
      // would satisfy every assertion above while being useless.
      assertExcludes(
        result,
        "docs/spec.md#pricing",
        "A citation that resolves must not be reported; flagging it would make the rule an obstacle rather than a check.",
      );
    } finally {
      project.cleanup();
    }
  };

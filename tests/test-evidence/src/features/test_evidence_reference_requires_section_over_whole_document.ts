import {
  assertExcludes,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies that a whole-document citation is refused and that several
 * `@evidence` tags on one declaration are each validated.
 *
 * Both properties are invisible until something asserts them. A whole-document
 * citation resolves trivially — the path exists — so the rule's natural
 * behavior is to accept it, and "the grounds are somewhere in this file" would
 * quietly become the path of least resistance for every author under deadline.
 * Multiple tags are the shape a real citation takes, because a declaration
 * usually has more than one ground; if the walk stopped at the first tag,
 * everything after it would go unchecked while still looking enforced.
 *
 * 1. Cite a whole document with no anchor.
 * 2. Put three tags on one declaration: two resolvable, one dangling.
 * 3. Assert the whole-document tag and the dangling tag are both reported, and
 *    that neither resolvable tag is.
 */
export const test_evidence_reference_requires_section_over_whole_document =
  (): void => {
    const project: IEvidenceProject = createProject({
      name: "section-only",
      lint: {
        plugins: { evidence: "@samchon/evidence" },
        rules: {
          "evidence/index": ["error", { documents: ["docs/**/*.md"] }],
          "evidence/reference": "error",
        },
      },
      files: {
        "docs/spec.md": [
          "# Spec",
          "",
          "## Pricing",
          "",
          "Prose.",
          "",
          "## Refunds",
          "",
          "Prose.",
          "",
        ].join("\n"),
        "src/sale.ts": [
          "/**",
          " * @evidence docs/spec.md The grounds are in here somewhere.",
          " */",
          "export interface IWholeDocument {",
          "  value: number;",
          "}",
          "",
          "/**",
          " * A declaration usually has more than one ground.",
          " *",
          " * @evidence docs/spec.md#pricing Price comes from the campaign rate.",
          " * @evidence docs/spec.md#refunds Refund window follows the same rule.",
          " * @evidence docs/spec.md#nowhere This one does not exist.",
          " */",
          "export interface IShoppingSale {",
          "  price: number;",
          "}",
          "",
        ].join("\n"),
      },
    });
    try {
      const result = runCheck(project.directory);

      if (result.status === 0)
        throw new Error(`Expected a non-zero exit, got 0.\n\n${result.output}`);
      assertIncludes(
        result,
        "cites a whole document",
        "A citation with no anchor must be refused: a document is not grounds a reviewer can check.",
      );
      // Proves the walk does not stop at the first tag.
      assertIncludes(
        result,
        "docs/spec.md#nowhere",
        "The third tag on a declaration must be validated too; a walk that stops early looks enforced while checking nothing.",
      );
      assertExcludes(
        result,
        "#pricing",
        "A resolvable tag must not be reported.",
      );
      assertExcludes(
        result,
        "#refunds",
        "A resolvable tag must not be reported, including when it sits between other tags.",
      );
    } finally {
      project.cleanup();
    }
  };

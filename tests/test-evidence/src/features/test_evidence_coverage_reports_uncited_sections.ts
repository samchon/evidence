import {
  assertExcludes,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies coverage: a declared section nothing cites is reported, a cited one
 * is not, and an exemption excuses a section only when it states a reason.
 *
 * Coverage is the one rule whose finding has no TypeScript node behind it — it
 * names a markdown section — so this also pins that a project-scoped diagnostic
 * survives the whole pipeline without a file or a line. The prior art nominated
 * an arbitrary anchor file to give a file rule somewhere to report; if project
 * findings did not surface, this rule would go silent and look like a pass.
 *
 * The blank-exemption case is the one that matters. An exemption marker written
 * with no reason must not quietly work: someone who writes it believes they
 * have addressed the finding, so accepting it converts a decision nobody
 * defended into a permanent hole, and rejecting it silently leaves them staring
 * at an error they thought they fixed.
 *
 * 1. Declare four sections: one cited, one uncited, one exempt with a reason, one
 *    exempt with a blank reason.
 * 2. Cite exactly one of them from a declaration.
 * 3. Assert the uncited and blank-exempt sections are reported, and neither the
 *    cited nor the properly exempt one is.
 */
export const test_evidence_coverage_reports_uncited_sections = (): void => {
  const project: IEvidenceProject = createProject({
    name: "coverage",
    lint: {
      plugins: { evidence: "@samchon/evidence" },
      rules: {
        "evidence/index": ["error", { documents: ["docs/**/*.md"] }],
        "evidence/reference": "error",
        "evidence/coverage": ["error", { documents: ["docs/**/*.md"] }],
      },
    },
    files: {
      "docs/spec.md": [
        "# Spec",
        "",
        "<!-- evidence-exempt: a title, not behavior anything implements -->",
        "",
        "## Pricing",
        "",
        "Sale price derives from the campaign rate.",
        "",
        "## Refunds",
        "",
        "Nothing in the code claims to implement this yet.",
        "",
        "## Naming Conventions",
        "",
        "<!-- evidence-exempt: describes a convention, not behavior -->",
        "",
        "Prose.",
        "",
        "## Glossary",
        "",
        "<!-- evidence-exempt: -->",
        "",
        "Prose.",
        "",
      ].join("\n"),
      "src/sale.ts": [
        "/**",
        " * @evidence docs/spec.md#pricing Price follows the campaign rate.",
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
      throw new Error(
        `Expected a non-zero exit for an uncited section, got 0.\n\n${result.output}`,
      );
    assertIncludes(
      result,
      "docs/spec.md#refunds",
      "A declared section nothing cites must be reported.",
    );
    assertIncludes(
      result,
      "evidence/coverage",
      "The diagnostic must be attributed to the rule that raised it.",
    );
    assertIncludes(
      result,
      "carries an exemption with no reason",
      "A blank exemption must be rejected: its author believes they addressed the finding, so accepting it creates a hole nobody defended.",
    );

    assertExcludes(
      result,
      "docs/spec.md#pricing",
      "A cited section must not be reported.",
    );
    assertExcludes(
      result,
      "docs/spec.md#naming-conventions",
      "A section exempted with a stated reason must not be reported.",
    );
    assertExcludes(
      result,
      "docs/spec.md#spec",
      "An exemption before any heading is inert, but a heading it does follow must still be excusable.",
    );
  } finally {
    project.cleanup();
  }
};

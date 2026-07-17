import {
  assertExcludes,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies the folder obligation: declarations under a governed folder must
 * cite a section under the required documents, and everything else is left
 * alone.
 *
 * The negatives carry this case. An obligation rule that simply fired on every
 * exported declaration would satisfy the positive assertion while being
 * useless, so the fixture pins four distinct ways a declaration must escape: it
 * sits outside the governed folder, it is not exported, its kind is not under
 * obligation by default, or it is properly grounded. Each is one property away
 * from a violation.
 *
 * The wrong-target case is the subtle one. `IWrongTarget` cites a section that
 * genuinely resolves — `evidence/reference` is content — but the section is not
 * under the required documents, so the obligation stands. Integrity and
 * obligation are different questions, and a citation can satisfy one while
 * failing the other.
 *
 * 1. Govern `src/providers/**` and require citations under `docs/analysis/**`.
 * 2. Place grounded, ungrounded, wrongly-grounded, unexported, and out-of-scope
 *    declarations across two folders.
 * 3. Assert only the ungrounded and wrongly-grounded exports are reported.
 */
export const test_evidence_require_obliges_folder_to_cite_documents =
  (): void => {
    const project: IEvidenceProject = createProject({
      name: "require-policy",
      lint: {
        plugins: { evidence: "@samchon/evidence" },
        rules: {
          "evidence/index": ["error", { documents: ["docs/**/*.md"] }],
          "evidence/reference": "error",
          "evidence/require": [
            "error",
            {
              policies: [
                {
                  files: ["src/providers/**"],
                  targets: ["docs/analysis/**/*.md"],
                },
              ],
            },
          ],
        },
      },
      files: {
        "docs/analysis/requirements.md": [
          "# Requirements",
          "",
          "## Order Placement",
          "",
          "Prose.",
          "",
        ].join("\n"),
        "docs/design/notes.md": [
          "# Notes",
          "",
          "## Scratch",
          "",
          "Prose.",
          "",
        ].join("\n"),
        "src/providers/order.ts": [
          "/**",
          " * @evidence docs/analysis/requirements.md#order-placement Implements the",
          " * placement flow described there.",
          " */",
          "export interface IGrounded {",
          "  id: string;",
          "}",
          "",
          "export interface IUngrounded {",
          "  id: string;",
          "}",
          "",
          "/**",
          " * Cites a real section — integrity is satisfied — but not one under the",
          " * required documents, so the obligation stands.",
          " *",
          " * @evidence docs/design/notes.md#scratch Sketched here.",
          " */",
          "export interface IWrongTarget {",
          "  id: string;",
          "}",
          "",
          "// Not exported: an implementation detail of something already obliged.",
          "interface IPrivate {",
          "  id: string;",
          "}",
          "",
          "// Not an obliged kind by default.",
          "export const RATE: number = 1;",
          "",
        ].join("\n"),
        "src/utility/plain.ts": [
          "// Outside the governed folder entirely.",
          "export interface IOutOfScope {",
          "  id: string;",
          "}",
          "",
        ].join("\n"),
      },
    });
    try {
      const result = runCheck(project.directory);

      if (result.status === 0)
        throw new Error(
          `Expected a non-zero exit for an ungrounded declaration, got 0.\n\n${result.output}`,
        );
      assertIncludes(
        result,
        "'IUngrounded' is not grounded",
        "A declaration under the policy with no citation at all must be reported.",
      );
      assertIncludes(
        result,
        "'IWrongTarget' cites",
        "A citation that resolves but points outside the required documents must not discharge the obligation.",
      );
      assertIncludes(
        result,
        "evidence/require",
        "The diagnostic must be attributed to the rule that raised it.",
      );

      // The four escapes. Each is one property away from a violation.
      //
      // These assert the DIAGNOSTIC form rather than the bare name: ttsc echoes
      // the offending source line under each finding, so a bare name matches
      // whatever neighbouring code happens to mention it and the assertion
      // silently stops testing what it claims to.
      assertExcludes(
        result,
        "'IGrounded'",
        "A properly grounded declaration must not be reported.",
      );
      assertExcludes(
        result,
        "'IPrivate'",
        "An unexported declaration must not be obliged.",
      );
      assertExcludes(
        result,
        "'RATE'",
        "A variable must not be obliged by default; demanding grounds for every constant trains authors to write filler.",
      );
      assertExcludes(
        result,
        "'IOutOfScope'",
        "A declaration outside the governed folder must not be obliged.",
      );
    } finally {
      project.cleanup();
    }
  };

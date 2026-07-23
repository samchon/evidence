import {
  assertExcludes,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies that a directory entry is shorthand for the entry and everything
 * below it across index, source, and target scopes.
 *
 * A bare or trailing-slash directory is the natural scope people bring from
 * gitignore and editors. Silently matching no descendants disables the
 * obligation while leaving a configuration that looks active, which is the most
 * dangerous failure mode for an enforcement rule.
 *
 * 1. Index `docs`, govern `src/providers/`, and accept targets under
 *    `docs/analysis` without spelling `/**`.
 * 2. Put one grounded and one ungrounded declaration below the governed entry.
 * 3. Assert only the ungrounded declaration is reported.
 */
export const test_evidence_require_accepts_directory_glob_shorthand =
  (): void => {
    const project: IEvidenceProject = createProject({
      name: "require-directory-shorthand",
      lint: {
        plugins: { "evidence-graph": "@samchon/evidence-graph" },
        rules: {
          "evidence-graph/index": ["error", { documents: ["docs"] }],
          "evidence-graph/reference": "error",
          "evidence-graph/require": [
            "error",
            {
              policies: [
                {
                  files: ["src/providers/"],
                  targets: ["docs/analysis"],
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
          "Orders follow the placement flow.",
          "",
        ].join("\n"),
        "src/providers/order.ts": [
          "/**",
          " * @evidence docs/analysis/requirements.md#order-placement Implements the placement flow.",
          " */",
          "export interface IGrounded {",
          "  id: string;",
          "}",
          "",
          "export interface IUngrounded {",
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
        "A declaration below a directory-scoped policy must be obliged.",
      );
      assertExcludes(
        result,
        "'IGrounded'",
        "A citation below a directory-scoped target must discharge the obligation.",
      );
    } finally {
      project.cleanup();
    }
  };

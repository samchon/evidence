import {
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies that coverage rejects a missing or empty document scope instead of
 * guessing the whole markdown corpus.
 *
 * Project rules cannot read one another's options, so coverage cannot inherit
 * the index scope. Falling back to every markdown file can demand citations for
 * unrelated guides while making coverage and reference disagree about which
 * documents exist.
 *
 * 1. Enable coverage once without options and once with an empty document list.
 * 2. Run each configuration against an explicitly scoped evidence index.
 * 3. Assert both fail with a diagnostic that names the required repair.
 */
export const test_evidence_coverage_requires_documents_scope = (): void => {
  const settings: readonly unknown[] = ["error", ["error", { documents: [] }]];
  for (const [index, setting] of settings.entries()) {
    const project: IEvidenceProject = createProject({
      name: `coverage-scope-${index}`,
      lint: {
        plugins: { evidence: "@samchon/evidence" },
        rules: {
          "evidence/index": ["error", { documents: ["specs"] }],
          "evidence/coverage": setting,
        },
      },
      files: {
        "specs/requirements.md": [
          "# Requirements",
          "",
          "## Ordering",
          "",
          "Orders follow the placement flow.",
          "",
        ].join("\n"),
        "src/order.ts": "export interface IOrder { id: string; }\n",
      },
    });
    try {
      const result = runCheck(project.directory);

      if (result.status === 0)
        throw new Error(
          `Expected a non-zero exit for coverage without a document scope, got 0.\n\n${result.output}`,
        );
      assertIncludes(
        result,
        "requires a non-empty 'documents' option",
        "Coverage must say which option is missing instead of silently guessing a corpus.",
      );
      assertIncludes(
        result,
        '"docs/**/*.md"',
        "The diagnostic must show a concrete repair.",
      );
    } finally {
      project.cleanup();
    }
  }
};

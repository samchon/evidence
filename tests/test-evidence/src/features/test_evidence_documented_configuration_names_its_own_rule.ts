import {
  assertExcludes,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/index.ts";

/**
 * Verifies a misconfigured `evidence/documented` names itself through the real
 * binary.
 *
 * The Go cases pin the message text; this pins what a consumer actually reads,
 * which is the only place the misattribution ever mattered. A project with both
 * rules enabled was told its _graph_ configuration was invalid while the
 * graph's configuration was fine, so the reader's next move was to edit the one
 * setting that was not wrong.
 *
 * The project deliberately spans several files. The diagnostic repeats once per
 * file — a file rule decodes its options inside `Check` and has no earlier
 * place to speak from — and the assertions below stay silent about how many
 * times it appears, so that this case does not cement a multiplicity that #57
 * records as unresolved.
 *
 * 1. Enable both rules, misspelling one `evidence/documented` option key.
 * 2. Run `ttsc check`.
 * 3. Assert the failure names `evidence/documented` and never the graph.
 */
export const test_evidence_documented_configuration_names_its_own_rule =
  (): void => {
    const project: IEvidenceProject = createProject({
      name: "documented-config-owner",
      include: ["src"],
      lintConfig: [
        'import { evidence } from "@samchon/lint-plugin-evidence";',
        "",
        "export default {",
        '  plugins: { "evidence": evidence },',
        "  rules: {",
        '    "evidence/documented": ["error", { symbols: "type" }],',
        "  },",
        "};",
        "",
      ].join("\n"),
      files: {
        "src/alpha.ts": ["/** Alpha. */", "export const alpha = 1;", ""].join(
          "\n",
        ),
        "src/beta.ts": ["/** Beta. */", "export const beta = 2;", ""].join(
          "\n",
        ),
      },
    });
    try {
      const result = runCheck(project.directory);
      assertFailure(
        result,
        "A misspelled option key must fail the build rather than fall back to a default selection.",
      );
      assertIncludes(
        result,
        "Invalid evidence/documented configuration",
        "The diagnostic must name the rule whose setting is actually wrong.",
      );
      assertExcludes(
        result,
        "Invalid evidence/graph configuration",
        "A documented misconfiguration must never send the reader to the graph's settings.",
      );
    } finally {
      project.cleanup();
    }
  };

import {
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies the packaged rule fails a build when the one block sits on a later
 * half of a merged identity.
 *
 * The accepting twin documents every identity on its first declaration, so
 * without this case a rule that had stopped checking placement entirely would
 * look identical. It also pins the two folds end to end from the other side: a
 * class that is no unit and an export assignment that declares nothing each own
 * the documentation site when they come first.
 *
 * 1. Document the namespace half of an interface merge and of a class merge, and
 *    the default export rather than its const.
 * 2. Enable `evidence/documented` with the default selection.
 * 3. Assert a non-zero exit naming where each block is and where it belongs.
 */
export const test_evidence_documented_reports_misplaced_block = (): void => {
  const project: IEvidenceProject = createProject({
    name: "documented-misplaced",
    include: ["src"],
    lintConfig: [
      'import { evidence } from "@samchon/lint-plugin-evidence";',
      "",
      "export default {",
      '  plugins: { "evidence": evidence },',
      "  rules: {",
      '    "evidence/documented": "error",',
      "  },",
      "};",
      "",
    ].join("\n"),
    files: {
      "src/ISale.ts": [
        "export interface ISale {",
        "  /** Identifier of the sale. */",
        "  id: string;",
        "}",
        "/** A sale offered to a customer. */",
        "export namespace ISale {",
        "  /** Creation input. */",
        "  export interface ICreate {",
        "    /** Identifier of the sale. */",
        "    id: string;",
        "  }",
        "}",
        "",
      ].join("\n"),
      "src/Something.ts": [
        "export class Something {}",
        "/** The exported service. */",
        "export namespace Something {",
        "  /** Current version. */",
        '  export const version = "1";',
        "}",
        "",
      ].join("\n"),
      "src/evidence.ts": [
        'export const evidence = { name: "evidence" };',
        "/** The exported plugin descriptor. */",
        "export default evidence;",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertFailure(
      result,
      "A block on a later half of a merged identity must fail the build.",
    );
    assertIncludes(
      result,
      "Misplaced JSDoc on exported type 'ISale'",
      "The interface comes first, so it owns the documentation site.",
    );
    assertIncludes(
      result,
      "first declared at line 1",
      "The diagnostic must name the line the block belongs on, not only the one it is on.",
    );
    assertIncludes(
      result,
      "Misplaced JSDoc on exported type 'Something'",
      "A class declaration is no unit, but coming first it still owns the site.",
    );
    assertIncludes(
      result,
      "Misplaced JSDoc on exported property 'evidence'",
      "A const owns the site over the default export that re-exposes it.",
    );
  } finally {
    project.cleanup();
  }
};

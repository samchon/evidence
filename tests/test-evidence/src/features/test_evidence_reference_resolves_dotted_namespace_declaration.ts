import {
  assertExcludes,
  assertIncludes,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies that a symbol inside a dotted namespace resolves.
 *
 * `namespace A.B { ... }` does not parse into one node with a dotted name. It
 * parses into `ModuleDeclaration(A)` whose Body is `ModuleDeclaration(B)` whose
 * Body is the block — so an indexer that reaches for `AsModuleBlock()` on the
 * outer declaration gets nil and drops the entire subtree. The failure is
 * silent and inverted: nothing crashes, and the rule instead reports "no such
 * declaration exists" against code sitting in plain sight, which sends the
 * author looking for a typo that is not there.
 *
 * The single-level namespace case passed and hid this, so the fixture pins both
 * depths side by side.
 *
 * 1. Declare a symbol in a single-level namespace and one in a dotted namespace.
 * 2. Cite both, plus a genuinely absent symbol as the negative anchor.
 * 3. Assert only the absent symbol is reported.
 */
export const test_evidence_reference_resolves_dotted_namespace_declaration =
  (): void => {
    const project: IEvidenceProject = createProject({
      name: "dotted-namespace",
      lint: {
        plugins: { evidence: "@samchon/evidence" },
        rules: {
          "evidence/index": ["error", { documents: ["docs/**/*.md"] }],
          "evidence/reference": "error",
        },
      },
      files: {
        "docs/spec.md": ["# Spec", "", "## Pricing", "", "Prose.", ""].join(
          "\n",
        ),
        "src/model.ts": [
          "export namespace Single {",
          "  export interface IUpdate {",
          "    value: number;",
          "  }",
          "}",
          "",
          "export namespace Outer.Inner {",
          "  export interface ICreate {",
          "    value: number;",
          "  }",
          "}",
          "",
        ].join("\n"),
        "src/sale.ts": [
          "/**",
          " * @evidence Single.IUpdate Mirrors the single-level namespace payload.",
          " */",
          "export interface IFromSingle {",
          "  value: number;",
          "}",
          "",
          "/**",
          " * @evidence Outer.Inner.ICreate Mirrors the dotted-namespace payload.",
          " */",
          "export interface IFromDotted {",
          "  value: number;",
          "}",
          "",
          "/**",
          " * @evidence Outer.Inner.INothing This one really does not exist.",
          " */",
          "export interface IFromAbsent {",
          "  value: number;",
          "}",
          "",
        ].join("\n"),
      },
    });
    try {
      const result = runCheck(project.directory);

      assertIncludes(
        result,
        "Outer.Inner.INothing",
        "A genuinely absent symbol must still be reported, or this test would pass on a rule that resolves everything.",
      );
      assertExcludes(
        result,
        "'Single.IUpdate'",
        "A single-level namespace member must resolve.",
      );
      assertExcludes(
        result,
        "'Outer.Inner.ICreate'",
        "A dotted-namespace member must resolve; dropping the subtree makes the rule deny code that plainly exists.",
      );
    } finally {
      project.cleanup();
    }
  };

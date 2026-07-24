import {
  assertExcludes,
  assertStatus,
  createProject,
  runCheck,
  type IEvidenceProject,
} from "../internal/project.ts";

/**
 * Verifies every public callable form as TypeScript evidence.
 *
 * Function declarations alone would miss ordinary exported arrow functions,
 * class APIs, and namespace APIs even though all of them are selected by the
 * public `"function"` contract. The fixture acknowledges each qualified target
 * from one Markdown claim so a silently omitted unit cannot hide behind an
 * incomplete claim.
 *
 * 1. Declare top-level, class, and namespace callables in one referenced file.
 * 2. Acknowledge every documented target identity from a Markdown file host.
 * 3. Assert that the complete graph passes without unresolved or missing units.
 */
export const test_evidence_graph_materializes_all_callable_forms = (): void => {
  const project: IEvidenceProject = createProject({
    name: "callable-sources",
    lintConfig: [
      'import type { ITtscLintConfig } from "@ttsc/lint";',
      'import { evidence } from "@samchon/lint-plugin-evidence";',
      "",
      "export default {",
      '  plugins: { "evidence": evidence },',
      "  rules: {",
      '    "evidence/graph": ["error", {',
      "      claims: [{",
      '        type: "markdown",',
      '        files: ["docs/functions.md"],',
      '        symbol: "file",',
      "        reference: {",
      '          type: "typescript",',
      '          files: ["src/contracts.ts"],',
      '          symbol: "function",',
      "        },",
      "      }],",
      "    }],",
      "  },",
      "} satisfies ITtscLintConfig;",
      "",
    ].join("\n"),
    files: {
      "src/contracts.ts": [
        "export function declared(): void {}",
        "export const arrow = (): void => {};",
        "export const expression = function (): void {};",
        "",
        "export class Service {",
        "  public run(): void {}",
        "  public execute = (): void => {};",
        "  public callback!: () => void;",
        "  public static create(): Service { return new Service(); }",
        "  public static restore = function (): Service { return new Service(); };",
        "  public static provider?: () => Service;",
        "}",
        "",
        "export namespace Orders {",
        "  export function open(): void {}",
        "  export const close = (): void => {};",
        "}",
        "",
      ].join("\n"),
      "docs/functions.md": [
        "<!-- @evidence declared Covers the exported function declaration. -->",
        "<!-- @evidence arrow Covers the exported arrow function. -->",
        "<!-- @evidence expression Covers the exported function expression. -->",
        "<!-- @evidence Service.prototype.run Covers the public instance method. -->",
        "<!-- @evidence Service.prototype.execute Covers the public function field. -->",
        "<!-- @evidence Service.prototype.callback Covers the direct function-typed field. -->",
        "<!-- @evidence Service.create Covers the public static method. -->",
        "<!-- @evidence Service.restore Covers the public static function field. -->",
        "<!-- @evidence Service.provider Covers the static function-typed field. -->",
        "<!-- @evidence Orders.open Covers the namespace function. -->",
        "<!-- @evidence Orders.close Covers the namespace arrow function. -->",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertStatus(
      result,
      0,
      "Every callable form named by EvidenceGraphTypeScriptSymbol must materialize with its documented identity.",
    );
    assertExcludes(
      result,
      "Unresolved evidence target",
      "All documented callable targets must resolve.",
    );
    assertExcludes(
      result,
      "Missing acknowledgement",
      "The claiming file acknowledges every callable unit.",
    );
  } finally {
    project.cleanup();
  }
};

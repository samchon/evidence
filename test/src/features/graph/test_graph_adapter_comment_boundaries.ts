import {
  EvidGoAdapter,
  EvidGraph,
  EvidMarkdownAdapter,
  EvidRubyAdapter,
  EvidRustAdapter,
} from "evid";
import type { IEvidInventory, IEvidGraphResult } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Rejects evidence tags that a language adapter cannot attach to the selected
 * declaration.
 *
 * Comment-boundary handling is part of graph correctness: a tag must cover the
 * declaration that owns it, rather than a neighbouring declaration whose text
 * happens to be aligned with the annotation.
 *
 * 1. Analyze Ruby and Rust member declarations with correctly attached evidence
 *    tags, then require each selected member to cover the Markdown
 *    requirement.
 * 2. Replace each tag with ordinary text and require both results to fail:
 *
 *    - The requirement remains the missing unit.
 *    - Removing documentation cannot leave accidental coverage behind.
 * 3. Put a Go tag at the end of an earlier variable declaration and require that
 *    it cannot cover the later selected declaration.
 * 4. Move the Go tag to the selected declaration's leading comment and require
 *    coverage to recover.
 */
export async function test_graph_adapter_comment_boundaries(): Promise<void> {
  const reference = await new EvidMarkdownAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "docs/spec.md",
      "## Value {#value}\n\nRequires a value.\n",
    ),
  );
  const tag = "@evidence docs/spec.md#value Implements the value.";
  const cases = [
    {
      adapter: new EvidRubyAdapter(),
      file: "src/value.rb",
      content: dedent`
      class Value
      =begin
      ${tag}
      =end
        attr_reader :value
      end
    `,
    },
    {
      adapter: new EvidRustAdapter(),
      file: "src/value.rs",
      content: dedent`
      pub struct Value(
        /// ${tag}
        // Ordinary comments must not move the field or its documentation.
        pub i32,
      );
    `,
    },
  ];
  for (const scenario of cases) {
    const claim = await scenario.adapter.analyze(
      EvidTestSourceSnapshot.create(scenario.file, scenario.content),
    );
    const removed = await scenario.adapter.analyze(
      EvidTestSourceSnapshot.create(
        scenario.file,
        scenario.content.replace(
          tag,
          "This declaration has no acknowledgement.",
        ),
      ),
    );

    TestValidator.equals(
      "attached member documentation covers the target",
      (await evaluate(claim, reference)).success,
      true,
    );
    const missing = await evaluate(removed, reference);
    TestValidator.equals(
      "removing the annotation fails coverage",
      missing.success,
      false,
    );
    TestValidator.equals(
      "the selected requirement remains missing",
      EvidTestGraph.obligation(missing, 0, 0).missingUnitIds,
      reference.units
        .filter((unit) => unit.symbol === "h2")
        .map((unit) => unit.id),
    );
  }

  // Aligned Go trailing comments previously supplied false coverage from the next declaration.
  const go = new EvidGoAdapter();
  const invalid = await go.analyze(
    EvidTestSourceSnapshot.create(
      "src/value.go",
      `package value\nvar Before = 1 // ${tag}\n               var Value = 2\n`,
    ),
  );
  const fixed = await go.analyze(
    EvidTestSourceSnapshot.create(
      "src/value.go",
      `package value\nvar Before = 1\n               // ${tag}\n               var Value = 2\n`,
    ),
  );
  TestValidator.equals(
    "trailing tags cannot satisfy coverage",
    (await evaluate(invalid, reference)).success,
    false,
  );
  TestValidator.equals(
    "moving the tag to a real host restores coverage",
    (await evaluate(fixed, reference)).success,
    true,
  );
}

/**
 * Evaluates the selected public property against the independent Markdown
 * requirement.
 *
 * The helper excludes the control declaration named `Before` and uses the
 * Markdown heading as the sole required reference, keeping each boundary case
 * focused on whether its comment attaches to the intended property host.
 */
async function evaluate(
  claim: IEvidInventory,
  reference: IEvidInventory,
): Promise<IEvidGraphResult> {
  const selected = reference.units
    .filter((unit) => unit.symbol === "h2")
    .map((unit) => unit.id);
  return EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: claim.units
          .filter(
            (unit) => unit.symbol === "property" && unit.name !== "Before",
          )
          .map((unit) => unit.id),
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: selected,
            singleEvidPerSymbol: true,
            resolutions: await EvidTestGraph.resolveDeclarations(
              claim,
              reference,
              selected,
            ),
          },
        ],
      },
    ],
  });
}

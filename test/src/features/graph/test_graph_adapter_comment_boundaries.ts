import {
  EvidenceGoAdapter,
  EvidenceGraph,
  EvidenceMarkdownAdapter,
  EvidenceRubyAdapter,
  EvidenceRustAdapter,
} from "@wrtnlabs/evidence";
import type {
  IEvidenceInventory,
  IEvidenceGraphResult,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Verifies comment attachment changes against real coverage so lost or misplaced tags cannot pass a check. */
export async function test_graph_adapter_comment_boundaries(): Promise<void> {
  const reference = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "docs/spec.md",
      "## Value {#value}\n\nRequires a value.\n",
    ),
  );
  const tag = "@evidence docs/spec.md#value Implements the value.";
  const cases = [
    {
      adapter: new EvidenceRubyAdapter(),
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
      adapter: new EvidenceRustAdapter(),
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
      TestSourceSnapshot.create(scenario.file, scenario.content),
    );
    const removed = await scenario.adapter.analyze(
      TestSourceSnapshot.create(
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
      TestGraph.obligation(missing, 0, 0).missingUnitIds,
      reference.units
        .filter((unit) => unit.symbol === "h2")
        .map((unit) => unit.id),
    );
  }

  // Aligned Go trailing comments previously supplied false coverage from the next declaration.
  const go = new EvidenceGoAdapter();
  const invalid = await go.analyze(
    TestSourceSnapshot.create(
      "src/value.go",
      `package value\nvar Before = 1 // ${tag}\n               var Value = 2\n`,
    ),
  );
  const fixed = await go.analyze(
    TestSourceSnapshot.create(
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

/** Selects the documented public property and the independent Markdown requirement. */
async function evaluate(
  claim: IEvidenceInventory,
  reference: IEvidenceInventory,
): Promise<IEvidenceGraphResult> {
  const selected = reference.units
    .filter((unit) => unit.symbol === "h2")
    .map((unit) => unit.id);
  return EvidenceGraph.evaluate({
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
            singleEvidencePerSymbol: true,
            resolutions: await TestGraph.resolveDeclarations(
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

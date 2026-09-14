import { EvidenceKotlinAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Prevents local constructor parameters in default expressions from becoming public owner properties. */
export async function test_kotlin_local_constructor(): Promise<void> {
  const inventory = await new EvidenceKotlinAdapter().analyze(
    TestSourceSnapshot.create(
      "src/Container.kt",
      dedent`
    class Container(val value: Int = run {
      class Local(val nested: Int)
      1
    })
  `,
    ),
  );

  TestValidator.equals("default lambda parses", inventory.diagnostics, []);
  TestValidator.equals(
    "only immediate constructor properties",
    inventory.units
      .map((unit) => unit.identity.join("."))
      .sort((a, b) => a.localeCompare(b)),
    ["Container", "Container.value"],
  );
}

import { EvidKotlinAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Prevents local constructor parameters in defaults from becoming owner properties.
 *
 * Only declared public constructor properties belong to the enclosing type.
 *
 * 1. Analyze constructor defaults with local parameters. 2. Compare selected properties. 3. Require local names to stay absent.
 */
export async function test_kotlin_local_constructor(): Promise<void> {
  const inventory = await new EvidKotlinAdapter().analyze(
    EvidTestSourceSnapshot.create(
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

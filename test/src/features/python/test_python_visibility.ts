import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceInventory } from "../../../../packages/evidence/src/EvidenceInventory";
import { EvidencePythonAdapter } from "../../../../packages/evidence/src/EvidencePythonAdapter";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Applies Python public-name convention, local reexports, nested-helper exclusion, and withdrawal. */
export async function test_python_visibility(): Promise<void> {
  const inventory = await new EvidencePythonAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "pkg/dep.py",
        dedent`
          class Source:
              pass
        `,
      ),
      TestSourceSnapshot.create(
        "pkg/api.py",
        dedent`
          from .dep import Source as Alias
          from .dep import Source as _PrivateAlias

          _private_value = 1

          def outer():
              __all__ = ["local_only"]
              def nested_helper():
                  return None
              return nested_helper

          class Hidden:
              """@internal This source declaration is intentionally withdrawn."""

              def child(self):
                  return None
        `,
      ),
    ]),
  );

  TestValidator.equals(
    "Python default public addresses",
    inventory.addresses
      .filter((address) => address.file === "/project/pkg/api.py")
      .map((address) => address.segments.join("."))
      .sort(compare),
    ["Alias", "Hidden", "Hidden.prototype.child", "outer"],
  );
  TestValidator.equals(
    "nested helper omitted",
    inventory.units.some((unit) => unit.name === "nested_helper"),
    false,
  );

  const population = new EvidenceInventory([inventory]).select(
    inventory.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "withdrawn Python scope",
    population.hidden.map((unit) => unit.identity.join(".")).sort(compare),
    ["Hidden", "Hidden.prototype.child"],
  );
  TestValidator.equals("complete Python visibility", inventory.diagnostics, []);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

import { EvidencePythonAdapter } from "@wrtnlabs/evidence";
import type { IEvidenceInventory } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Resolves Python package exports through explicit and transitive public names.
 *
 * The combined package fixture exercises __all__ composition, star imports, renamed imports, namespace imports, and later bindings that shadow an earlier binding.
 *
 * 1. Analyze the package modules and verify barrel, namespace, and shadowed public addresses.
 * 2. Verify a renamed barrel address retains the source declaration identity and produces no diagnostics.
 * 3. Analyze a mutually importing pair and verify its finite exported address set completes without diagnostics.
 */
export async function test_python_exports(): Promise<void> {
  const adapter = new EvidencePythonAdapter();
  const inventory = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "pkg/dep.py",
        dedent`
          __all__ = ["Service", "_forced"]

          class Service:
              def run(self):
                  return None

          _forced = 1
        `,
      ),
      TestSourceSnapshot.create(
        "pkg/extras.py",
        dedent`
          def extra():
              return None
        `,
      ),
      TestSourceSnapshot.create(
        "pkg/__init__.py",
        dedent`
          from .dep import Service as Renamed, _forced as forced
          from .extras import *

          __all__ = ["Renamed"] + ("forced",)
          __all__ += ["extra"]
        `,
      ),
      TestSourceSnapshot.create(
        "pkg/namespace.py",
        dedent`
          import pkg.dep as api
          __all__ = ["api"]
        `,
      ),
      TestSourceSnapshot.create(
        "pkg/import-wins.py",
        dedent`
          class Value:
              stale = True

          from .dep import Service as Value
          __all__ = ["Value"]
        `,
      ),
      TestSourceSnapshot.create(
        "pkg/declaration-wins.py",
        dedent`
          from .dep import Service as Value

          class Value:
              current = True

          __all__ = ["Value"]
        `,
      ),
    ]),
  );

  TestValidator.equals(
    "Python package barrel addresses",
    addresses(inventory, "/project/pkg/__init__.py"),
    ["Renamed", "Renamed.prototype.run", "extra", "forced"],
  );
  TestValidator.equals(
    "Python namespace addresses",
    addresses(inventory, "/project/pkg/namespace.py"),
    ["api.Service", "api.Service.prototype.run", "api._forced"],
  );
  TestValidator.equals(
    "later Python import shadows declaration",
    addresses(inventory, "/project/pkg/import-wins.py"),
    ["Value", "Value.prototype.run"],
  );
  TestValidator.equals(
    "later Python declaration shadows import",
    addresses(inventory, "/project/pkg/declaration-wins.py"),
    ["Value", "Value.current"],
  );

  // Reexported aliases retain the declaration identity from their source module.
  const source = inventory.addresses.find(
    (address) =>
      address.file === "/project/pkg/dep.py" &&
      address.segments.join(".") === "Service",
  );
  const alias = inventory.addresses.find(
    (address) =>
      address.file === "/project/pkg/__init__.py" &&
      address.segments.join(".") === "Renamed",
  );
  if (source === undefined || alias === undefined)
    throw new Error("Missing Python source or alias address.");
  TestValidator.equals("Python alias identity", alias.unitId, source.unitId);
  TestValidator.equals("complete Python exports", inventory.diagnostics, []);

  const cycle = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "cycle/a.py",
        dedent`
          from .b import b
          a = 1
          __all__ = ["a", "b"]
        `,
      ),
      TestSourceSnapshot.create(
        "cycle/b.py",
        dedent`
          from .a import a
          b = 2
          __all__ = ["a", "b"]
        `,
      ),
    ]),
  );
  TestValidator.equals(
    "finite Python import cycle",
    addresses(cycle, "/project/cycle/a.py"),
    ["a", "b"],
  );
  TestValidator.equals("complete Python cycle", cycle.diagnostics, []);
}

function addresses(inventory: IEvidenceInventory, file: string): string[] {
  return inventory.addresses
    .filter((address) => address.file === file)
    .map((address) => address.segments.join("."))
    .sort(compare);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

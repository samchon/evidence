import {
  EvidFingerprint,
  EvidInventory,
  EvidZigAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Preserves Zig aliases, withdrawals, and copied-value independence.
 *
 * Function aliases share their declaration sites, while copied values and withdrawals retain distinct identity effects.
 *
 * 1. Analyze aliases, copied values, and withdrawn declarations.
 * 2. Verify sites, target resolution, and withdrawal behavior.
 */
export async function test_zig_aliases(): Promise<void> {
  const content = dedent`
    /// @evidence docs/spec.md#run Implements the function.
    fn local() i32 { return 1; }
    /// @evidence docs/spec.md#run Exposes the function.
    pub const run = local;
    pub const renamed = run;
    const scalar = 1;
    pub const first = scalar;
    pub const second = first;
  `;
  const adapter = new EvidZigAdapter();
  const inventory = await adapter.analyze(
    EvidTestSourceSnapshot.create("src/Aliases.zig", content),
  );

  TestValidator.equals("complete alias graph", inventory.diagnostics, []);
  TestValidator.equals(
    "copies have independent property identities",
    inventory.units
      .filter((unit) => unit.symbol === "property")
      .map((unit) => unit.name),
    ["first", "second"],
  );
  const callable = inventory.units.find((unit) => unit.symbol === "function");
  if (callable === undefined) throw new Error("Missing exposed function.");
  TestValidator.equals(
    "one callable canonical identity",
    inventory.units.filter((unit) => unit.symbol === "function").length,
    1,
  );
  TestValidator.equals("three declaration sites", callable.sites.length, 3);
  TestValidator.equals(
    "each physical site supplies one host",
    inventory.hosts.filter((host) => host.unitIds.includes(callable.id)).length,
    3,
  );
  TestValidator.equals(
    "alias paths remain addressable",
    inventory.addresses
      .filter((address) => address.unitId === callable.id)
      .map((address) => address.segments.join("."))
      .sort((left, right) => left.localeCompare(right)),
    ["renamed", "run"],
  );
  const annotation = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Aliases.zig",
      content.replace("Exposes the function.", "Explains its public name."),
    ),
  );
  const semantic = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Aliases.zig",
      content.replace("return 1", "return 2"),
    ),
  );
  TestValidator.equals(
    "alias documentation preserves canonical fingerprint",
    EvidFingerprint.inspect(annotation, callable.id).fingerprint,
    EvidFingerprint.inspect(inventory, callable.id).fingerprint,
  );
  TestValidator.notEquals(
    "private implementation edit invalidates exposed fingerprint",
    EvidFingerprint.inspect(semantic, callable.id).fingerprint,
    EvidFingerprint.inspect(inventory, callable.id).fingerprint,
  );

  const withdrawn = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Aliases.zig",
      content
        .replace(
          "/// @evidence docs/spec.md#run Implements the function.\n",
          "",
        )
        .replace(
          "/// @evidence docs/spec.md#run Exposes the function.",
          "/// @internal Withdraws all public aliases.",
        ),
    ),
  );
  const graph = new EvidInventory([withdrawn]);
  for (const name of ["run", "renamed"])
    TestValidator.equals(
      `withdrawal reaches ${name}`,
      graph.resolve(
        { file: "/project/src/Aliases.zig", segments: [name] },
        withdrawn.units.map((unit) => unit.id),
      ).status,
      "hidden",
    );
}

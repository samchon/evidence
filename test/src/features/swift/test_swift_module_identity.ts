import { EvidInventory, EvidSwiftAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Keeps equal Swift names independent across configured module roots.
 *
 * Module-root identity prevents equal declarations from sharing an address.
 *
 * 1. Analyze equal names in separate roots.
 * 2. Verify distinct identities and resolution.
 */
export async function test_swift_module_identity(): Promise<void> {
  const adapter = new EvidSwiftAdapter();
  const first = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "Contract.swift",
      "public struct Contract {}",
      ["Contract.swift"],
      "/project/First",
    ),
  );
  const second = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "Other.swift",
      "public struct Contract {}",
      ["Other.swift"],
      "/project/Second",
    ),
  );
  const inventory = new EvidInventory([first, second]);
  const combined = inventory.snapshot();

  TestValidator.equals(
    "separate modules preserve two nominal identities",
    combined.units.length,
    2,
  );
  TestValidator.notEquals(
    "module roots disambiguate same-name units",
    first.units[0]?.id,
    second.units[0]?.id,
  );
  TestValidator.equals(
    "first module resolves its own type",
    inventory.resolve(
      { file: "/project/First/Contract.swift", segments: ["Contract"] },
      first.units.map((unit) => unit.id),
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "second module cannot resolve inside first population",
    inventory.resolve(
      { file: "/project/Second/Other.swift", segments: ["Contract"] },
      first.units.map((unit) => unit.id),
    ).status,
    "missing",
  );
}

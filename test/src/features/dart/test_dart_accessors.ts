import { EvidenceDartAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Classifies Dart accessor families without reclassifying a function named set.
 *
 * Getter and setter declarations share a property identity even when a setter omits or spells out its return type, but a normal function retains its function identity.
 *
 * 1. Analyze paired getters and setters, an explicit-void setter, a function named set, and an external setter.
 * 2. Require paired accessors to produce one property with two sites and the named function to remain a function.
 * 3. Verify a withdrawn accessor family is hidden and has no eligible host.
 */
export async function test_dart_accessors(): Promise<void> {
  const inventory = await new EvidenceDartAdapter().analyze(
    TestSourceSnapshot.create(
      "src/accessors.dart",
      dedent`
    int get value => 1;
    set value(int next) {}
    int get other => 2;
    void set other(int next) {}
    void set(int next) {}
    external set externalValue(int next);
    /** @internal Retired accessor family. */
    int get retired => 0;
    set retired(int next) {}
  `,
    ),
  );

  TestValidator.equals("complete accessor families", inventory.diagnostics, []);
  TestValidator.equals(
    "exact accessor kinds",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.name}`)
      .sort((left, right) => left.localeCompare(right)),
    [
      "property:value",
      "property:other",
      "function:set",
      "property:externalValue",
      "property:retired",
    ].sort((left, right) => left.localeCompare(right)),
  );
  for (const name of ["value", "other", "retired"])
    TestValidator.equals(
      `${name} has both physical accessors`,
      inventory.units.find((unit) => unit.name === name)?.sites?.length,
      2,
    );
  const retired = inventory.units.find((unit) => unit.name === "retired");
  TestValidator.equals(
    "withdrawal reconciles across accessors",
    retired?.withdrawals?.length,
    1,
  );
  TestValidator.equals(
    "withdrawn setter has no eligible carrier",
    inventory.hosts.some(
      (host) => retired !== undefined && host.unitIds.includes(retired.id),
    ),
    false,
  );
}

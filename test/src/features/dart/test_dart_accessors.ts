import { EvidenceDartAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Treats omitted and explicit setter return types consistently without reclassifying a function named set. */
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

import { EvidenceInventory } from "evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestInventory } from "../../internal/EvidenceTestInventory";

/**
 * Counts aliases once while preserving exact public addresses and distinct
 * identities.
 *
 * A class is exposed through two barrel names, and another declaration supplies
 * a competing identity. Alias reconciliation must preserve citation paths
 * without either inflating the denominator or merging unrelated declarations by
 * spelling.
 *
 * 1. Combine an inventory with its copy and select the class ID twice. Require one
 *    complete selected unit and successful lookup through a renamed export.
 * 2. Check exact file boundaries:
 *
 *    - The same name in an absent file must remain missing.
 *    - Changing the barrel filename's case must not resolve the original path.
 * 3. Publish the second identity under the same address and require ambiguity.
 * 4. Clear the caller's input, a returned population, and a returned snapshot; the
 *    previously constructed index must still select the original class.
 */
export async function test_inventory_aliases(): Promise<void> {
  const input = EvidenceTestInventory.create();
  EvidenceTestInventory.unit(
    input,
    "box",
    ["Box"],
    "type",
    "export class Box { value = 1; }",
  );
  EvidenceTestInventory.unit(
    input,
    "other",
    ["Other"],
    "type",
    "export interface Box { extra: string; }",
  );
  input.addresses.push({
    unitId: "box",
    file: "/project/barrel.ts",
    segments: ["Renamed"],
  });
  input.addresses.push({
    unitId: "box",
    file: "/project/barrel.ts",
    segments: ["Again"],
  });

  const index = new EvidenceInventory([input, structuredClone(input)]);
  const population = index.select(["box", "box"]);

  TestValidator.predicate("complete identity inventory", population.complete);
  TestValidator.equals(
    "aliases owe once",
    population.units.map((unit) => unit.id),
    ["box"],
  );
  TestValidator.equals(
    "renamed export resolves",
    index
      .resolve({ file: "/project/barrel.ts", segments: ["Renamed"] }, ["box"])
      .units.map((unit) => unit.id),
    ["box"],
  );
  TestValidator.equals(
    "no global-name fallback",
    index.resolve({ file: "/project/absent.ts", segments: ["Box"] }, ["box"])
      .status,
    "missing",
  );
  TestValidator.equals(
    "address case stays significant",
    index.resolve({ file: "/project/Barrel.ts", segments: ["Renamed"] }, [
      "box",
    ]).status,
    "missing",
  );

  // Two distinct identities under one public address remain ambiguous.
  input.addresses.push({
    unitId: "other",
    file: "/project/barrel.ts",
    segments: ["Renamed"],
  });
  const ambiguous = new EvidenceInventory([input]).resolve(
    { file: "/project/barrel.ts", segments: ["Renamed"] },
    ["box", "other"],
  );
  TestValidator.equals(
    "distinct declarations are not merged by name",
    ambiguous.status,
    "ambiguous",
  );

  // Snapshot and source-input edits cannot mutate a previously constructed index.
  population.units.splice(0);
  input.units.splice(0);
  index.snapshot().units.splice(0);
  TestValidator.equals(
    "immutable inventory ownership",
    index.select(["box"]).units.length,
    1,
  );
}

import { EvidenceInventory } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestInventory } from "../../internal/EvidenceTestInventory";

/**
 * Normalizes duplicate inventory inputs without losing selection or annotation
 * meaning.
 *
 * Deterministic merging must treat source ranges as a set while retaining real
 * coordinate conflicts. Reviews and tag diagnostics also have different
 * effects: reviews cannot create acknowledgements, and tag problems do not
 * shrink a successfully extracted declaration population.
 *
 * 1. Prepare matching inventories with a review, a tag diagnostic, an added public
 *    alias, and repeated content ranges; mark one source copy dependency-only.
 * 2. Merge in both orders and require identical serialization, with direct source
 *    selection taking precedence over dependency-only loading.
 * 3. Require the merged inventory to retain one review, no acknowledgements, one
 *    selected declaration, and complete extraction despite the tag diagnostic.
 * 4. Alter the line coordinate of a duplicate content range while keeping its
 *    offset and require incomplete analysis rather than deduplicating away the
 *    conflict.
 */
export async function test_inventory_serialization(): Promise<void> {
  const input = EvidenceTestInventory.create();
  EvidenceTestInventory.unit(
    input,
    "box",
    ["Box"],
    "type",
    "export class Box { value = 1; }",
  );
  const host = EvidenceTestInventory.host(
    input,
    "box-doc",
    "box-site",
    ["box"],
    "/** Class documentation. */",
  );
  input.reviews.push({
    id: "review",
    hostId: host.id,
    reviews: "evidence",
    target: "docs/spec.md#rule",
    description: "Checked the contract.",
    location: { file: host.file, range: host.range },
  });
  input.diagnostics.push({
    code: "unattached-tag",
    severity: "error",
    message: "A tag needs an owner.",
    repair: "Attach it to the intended declaration.",
    location: { file: host.file },
  });
  const second = structuredClone(input);
  const dependencySource = second.sources[0];
  if (dependencySource === undefined)
    throw new Error("Missing fixture source.");
  const dependencyAddress = dependencySource.addresses[0];
  if (dependencyAddress === undefined)
    throw new Error("Missing fixture source address.");
  dependencyAddress.selected = false;
  second.addresses.push({
    unitId: "box",
    file: "/project/barrel.ts",
    segments: ["Alias"],
  });
  // Content ranges form a set; ordering or repeated ranges must not create a conflict.
  const originalUnit = input.units[0];
  const repeatedUnit = second.units[0];
  if (originalUnit === undefined || repeatedUnit === undefined)
    throw new Error("Missing fixture declaration.");
  const originalSite = originalUnit.sites[0];
  const repeatedSite = repeatedUnit.sites[0];
  if (originalSite === undefined || repeatedSite === undefined)
    throw new Error("Missing fixture declaration site.");
  const body = EvidenceTestInventory.range(input, "value = 1");
  originalSite.content.push(body);
  repeatedSite.content = [body, ...repeatedSite.content, body];

  const forward = new EvidenceInventory([input, second]);
  const reverse = new EvidenceInventory([second, input]);

  TestValidator.equals(
    "deterministic serialization",
    forward.serialize(),
    reverse.serialize(),
  );
  const mergedSource = forward.snapshot().sources[0];
  if (mergedSource === undefined) throw new Error("Missing merged source.");
  const mergedAddress = mergedSource.addresses[0];
  if (mergedAddress === undefined) throw new Error("Missing merged address.");
  TestValidator.equals(
    "direct selection wins dependency loading",
    mergedAddress.selected,
    undefined,
  );
  TestValidator.equals(
    "reviews cannot add acknowledgements",
    forward.snapshot().declarations,
    [],
  );
  TestValidator.equals(
    "review retained independently",
    forward.snapshot().reviews.length,
    1,
  );
  TestValidator.equals(
    "tag problems preserve complete denominator",
    forward.select(["box"]).units.length,
    1,
  );
  TestValidator.predicate(
    "tag problems are not load failures",
    forward.snapshot().complete,
  );

  // A duplicate range with wrong original coordinates cannot disappear during merging.
  const invalid = structuredClone(second);
  for (const unit of invalid.units)
    for (const site of unit.sites)
      for (const range of site.content)
        if (range.start.offset === body.start.offset) range.start.line += 1;
  TestValidator.predicate(
    "conflicting content coordinates fail",
    !new EvidenceInventory([input, invalid]).snapshot().complete,
  );
}

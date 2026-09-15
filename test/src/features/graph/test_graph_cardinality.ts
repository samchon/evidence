import { EvidGraph } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestInventory } from "../../internal/EvidTestInventory";

/**
 * Applies positive-evidence cardinality to semantic units and hosts.
 *
 * Physical documentation fragments and repeated citations must not inflate
 * cardinality. Aggregate scopes expand to selected descendants, while exclusions
 * can satisfy ordinary coverage without becoming positive evidence.
 *
 * 1. Check three claim subjects under singleEvidPerSymbol:
 *    - An uncited subject reports zero positive units.
 *    - Two comment fragments citing the same unit count once for their shared owner.
 *    - An aggregate citation covering two selected children reports two units.
 * 2. Supply only an exclusion and require ordinary coverage to pass, positive
 *    cardinality to remain zero, and no unique-positive-host finding.
 * 3. Have two semantic hosts cite one reference unit, with a repeated fragment
 *    on one host; compare ordinary and uniqueEvid reference entries.
 * 4. Require exactly one uniqueness finding on the second reference, counting
 *    two semantic hosts rather than three physical citation positions.
 */
export async function test_graph_cardinality(): Promise<void> {
  const reference = EvidTestInventory.create();
  const parent = EvidTestInventory.unit(
    reference,
    "parent",
    ["Parent"],
    "type",
    "export class Box { value = 1; }",
  );
  const first = EvidTestInventory.unit(
    reference,
    "first",
    ["Parent", "first"],
    "property",
    "value = 1",
    parent.id,
  );
  const second = EvidTestInventory.unit(
    reference,
    "second",
    ["Parent", "second"],
    "property",
    "extra: string",
    parent.id,
  );

  const claim = EvidTestInventory.create();
  const empty = EvidTestInventory.unit(
    claim,
    "empty",
    ["Empty"],
    "property",
    "export const unrelated = 3;",
  );
  const duplicate = EvidTestInventory.unit(
    claim,
    "duplicate",
    ["Duplicate"],
    "type",
    "export const first = 1, second = 2;",
  );
  const broad = EvidTestInventory.unit(
    claim,
    "broad",
    ["Broad"],
    "type",
    "export class Box { value = 1; }",
  );
  EvidTestInventory.host(
    claim,
    "empty-host",
    empty.sites[0]?.id ?? "",
    [empty.id],
    "export const unrelated = 3;",
  );
  const duplicateHost = EvidTestInventory.host(
    claim,
    "duplicate-host",
    duplicate.sites[0]?.id ?? "",
    [duplicate.id],
    "/** Shared documentation. */",
  );
  const duplicateFragment = EvidTestInventory.host(
    claim,
    "duplicate-fragment",
    duplicate.sites[0]?.id ?? "",
    [duplicate.id],
    "/** Class documentation. */",
  );
  const broadHost = EvidTestInventory.host(
    claim,
    "broad-host",
    broad.sites[0]?.id ?? "",
    [broad.id],
    "/** Class documentation. */",
  );
  const firstCitation = EvidTestGraph.declaration(
    claim,
    "first-citation",
    duplicateHost,
    "evidence",
    "first",
  );
  const repeatedCitation = EvidTestGraph.declaration(
    claim,
    "repeated-citation",
    duplicateFragment,
    "evidence",
    "first",
  );
  const broadCitation = EvidTestGraph.declaration(
    claim,
    "broad-citation",
    broadHost,
    "evidence",
    "parent",
  );
  const single = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [empty.id, duplicate.id, broad.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [first.id, second.id],
            resolutions: [
              EvidTestGraph.resolved(firstCitation, first),
              EvidTestGraph.resolved(repeatedCitation, first),
              EvidTestGraph.resolved(broadCitation, parent),
            ],
            singleEvidPerSymbol: true,
          },
        ],
      },
    ],
  });

  const singleFindings = single.diagnostics.filter(
    (diagnostic) => diagnostic.code === "graph-single-evidence-per-symbol",
  );
  TestValidator.equals(
    "zero and aggregate host cardinality",
    singleFindings.length,
    2,
  );
  TestValidator.predicate(
    "zero host included",
    singleFindings.some((diagnostic) => diagnostic.message.includes("Empty")),
  );
  TestValidator.predicate(
    "aggregate expands to both descendants",
    singleFindings.some(
      (diagnostic) =>
        diagnostic.message.includes("Broad") &&
        diagnostic.message.includes("cites 2 distinct"),
    ),
  );
  TestValidator.predicate(
    "duplicate positions remain one semantic host",
    singleFindings.every(
      (diagnostic) => !diagnostic.message.includes("Duplicate"),
    ),
  );

  // Exclusions can satisfy ordinary coverage but never contribute a positive cardinality.
  const exclusionClaim = EvidTestInventory.create();
  const exclusionOwner = EvidTestInventory.unit(
    exclusionClaim,
    "exclusion-owner",
    ["ExclusionOwner"],
    "function",
    "export const unrelated = 3;",
  );
  const exclusionHost = EvidTestInventory.host(
    exclusionClaim,
    "exclusion-host",
    exclusionOwner.sites[0]?.id ?? "",
    [exclusionOwner.id],
    "export const unrelated = 3;",
  );
  const exclusion = EvidTestGraph.declaration(
    exclusionClaim,
    "exclusion",
    exclusionHost,
    "evidenceExclude",
    "first",
  );
  const exclusionOnly = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: exclusionClaim,
        unitIds: [exclusionOwner.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [first.id],
            resolutions: [EvidTestGraph.resolved(exclusion, first)],
            uniqueEvid: true,
            singleEvidPerSymbol: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "exclusion supplies ordinary coverage",
    EvidTestGraph.obligation(exclusionOnly, 0, 0).missingUnitIds,
    [],
  );
  TestValidator.predicate(
    "exclusion counts as zero positive units",
    exclusionOnly.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "graph-single-evidence-per-symbol" &&
        diagnostic.message.includes("cites 0 distinct"),
    ),
  );
  TestValidator.equals(
    "exclusion creates no unique host",
    exclusionOnly.diagnostics.filter(
      (diagnostic) => diagnostic.code === "graph-unique-evidence",
    ),
    [],
  );

  // Two different semantic hosts violate only the reference that enables uniqueEvid.
  const uniqueClaim = EvidTestInventory.create();
  const owner = EvidTestInventory.unit(
    uniqueClaim,
    "owner",
    ["Owner"],
    "type",
    "export const first = 1, second = 2;",
  );
  const otherOwner = EvidTestInventory.unit(
    uniqueClaim,
    "other-owner",
    ["OtherOwner"],
    "property",
    "export const unrelated = 3;",
  );
  const ownerHost = EvidTestInventory.host(
    uniqueClaim,
    "owner-host",
    owner.sites[0]?.id ?? "",
    [owner.id],
    "/** Shared documentation. */",
  );
  const ownerFragment = EvidTestInventory.host(
    uniqueClaim,
    "owner-fragment",
    owner.sites[0]?.id ?? "",
    [owner.id],
    "/** Class documentation. */",
  );
  const otherOwnerHost = EvidTestInventory.host(
    uniqueClaim,
    "other-owner-host",
    otherOwner.sites[0]?.id ?? "",
    [otherOwner.id],
    "export const unrelated = 3;",
  );
  const ownerCitation = EvidTestGraph.declaration(
    uniqueClaim,
    "owner-citation",
    ownerHost,
    "evidence",
    "first",
  );
  const ownerRepeated = EvidTestGraph.declaration(
    uniqueClaim,
    "owner-repeated",
    ownerFragment,
    "evidence",
    "first",
  );
  const otherCitation = EvidTestGraph.declaration(
    uniqueClaim,
    "other-citation",
    otherOwnerHost,
    "evidence",
    "first",
  );
  const resolutions = [
    EvidTestGraph.resolved(ownerCitation, first),
    EvidTestGraph.resolved(ownerRepeated, first),
    EvidTestGraph.resolved(otherCitation, first),
  ];
  const unique = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: uniqueClaim,
        unitIds: [owner.id, otherOwner.id],
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: [first.id],
            resolutions,
          },
          {
            severity: "error",
            inventory: reference,
            unitIds: [first.id],
            resolutions,
            uniqueEvid: true,
          },
        ],
      },
    ],
  });

  const uniqueFindings = unique.diagnostics.filter(
    (diagnostic) => diagnostic.code === "graph-unique-evidence",
  );
  TestValidator.equals("one unique host finding", uniqueFindings.length, 1);
  const uniqueFinding = uniqueFindings[0];
  if (uniqueFinding === undefined)
    throw new Error("Missing unique evidence finding.");
  TestValidator.equals(
    "unique policy belongs to second reference",
    uniqueFinding.reference,
    1,
  );
  TestValidator.predicate(
    "unique count uses semantic hosts",
    uniqueFinding.message.includes("2 distinct positive evidence host(s)"),
  );
}

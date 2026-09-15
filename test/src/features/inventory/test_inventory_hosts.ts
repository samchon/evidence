import { EvidInventory } from "evid";
import { TestValidator } from "@nestia/e2e";

import { TestInventory } from "../../internal/TestInventory";

/**
 * Separates shared documentation ownership from each declarator's fingerprint content.
 *
 * A multi-variable statement can expose several semantic units through one
 * physical host. The shared carrier must preserve both owners without making
 * sibling initializer text part of each unit's own content or accepting an invalid
 * adapter attachment as evidence.
 *
 * 1. Give two declarators the same statement site and documentation host but
 *    separate initializer content ranges.
 * 2. Select both units and require complete analysis, one host with both owners,
 *    and distinct first and second initializer slices.
 * 3. Point the host at an unowned site and require incomplete analysis with an
 *    inventory-host diagnostic explaining the ownership failure.
 * 4. Mark the host unsupported, remove its owners, and attach an evidence
 *    declaration; require incomplete analysis because unsupported carriers cannot
 *    supply evidence.
 */
export async function test_inventory_hosts(): Promise<void> {
  const input = TestInventory.create();
  const first = TestInventory.unit(
    input,
    "first",
    ["first"],
    "property",
    "export const first = 1, second = 2;",
  );
  const second = TestInventory.unit(
    input,
    "second",
    ["second"],
    "property",
    "export const first = 1, second = 2;",
  );
  for (const site of first.sites) {
    site.id = "values-site";
    site.content = [TestInventory.range(input, "first = 1")];
  }
  for (const site of second.sites) {
    site.id = "values-site";
    site.content = [TestInventory.range(input, "second = 2")];
  }
  TestInventory.host(
    input,
    "values-doc",
    "values-site",
    ["first", "second"],
    "/** Shared documentation. */",
  );

  const population = new EvidInventory([input]).select(["first", "second"]);

  TestValidator.predicate("shared site is valid", population.complete);
  TestValidator.equals("one physical host", population.hosts.length, 1);
  TestValidator.equals(
    "both semantic owners",
    population.hosts.flatMap((host) => host.unitIds),
    ["first", "second"],
  );
  const source = input.sources[0];
  if (source === undefined) throw new Error("Missing fixture source.");
  TestValidator.equals(
    "sibling text is not shared content",
    population.units.flatMap((unit) =>
      unit.sites.flatMap((site) =>
        site.content.map((range) =>
          source.content.slice(range.start.offset, range.end.offset),
        ),
      ),
    ),
    ["first = 1", "second = 2"],
  );

  const host = input.hosts[0];
  if (host === undefined) throw new Error("Missing fixture host.");
  host.siteId = "unowned-site";
  const broken = new EvidInventory([input]).snapshot();
  TestValidator.predicate("wrong ownership fails analysis", !broken.complete);
  TestValidator.predicate(
    "ownership cause remains visible",
    broken.diagnostics.some(
      (diagnostic) => diagnostic.code === "inventory-host",
    ),
  );

  // Adapter output cannot attach accepted annotations to an unsupported host.
  delete host.siteId;
  host.unitIds = [];
  host.attachment = "unsupported";
  input.declarations.push({
    id: "invalid-host-tag",
    hostId: host.id,
    kind: "evidence",
    target: "docs/spec.md",
    reason: "Claims evidence without a semantic owner.",
    location: { file: host.file, range: host.range },
  });
  TestValidator.predicate(
    "unsupported host cannot supply evidence",
    !new EvidInventory([input]).snapshot().complete,
  );
}

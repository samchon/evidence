import { TestValidator } from "@nestia/e2e";

import { EvidenceInventory } from "../../../../packages/evidence/src/graph/EvidenceInventory";
import { TestInventory } from "../../internal/TestInventory";

/** A multi-variable statement shares a documentation host while keeping each declarator's content. */
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

  const population = new EvidenceInventory([input]).select(["first", "second"]);

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
  const broken = new EvidenceInventory([input]).snapshot();
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
    !new EvidenceInventory([input]).snapshot().complete,
  );
}

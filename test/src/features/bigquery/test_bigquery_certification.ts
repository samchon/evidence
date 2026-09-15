import { TestValidator } from "@nestia/e2e";

import { EvidDatabaseAdapterCertification } from "../../internal/certification/EvidDatabaseAdapterCertification";
import { BigQueryCertificationFixture } from "./BigQueryCertificationFixture";

/**
 * Certifies BigQuery inventory, graph, failure, fingerprint, and ambiguity
 * contracts.
 *
 * The fixture is the independent expected surface, so certification must reject
 * changes that make a reported database population less exact.
 *
 * 1. Analyze the fixture and validate its inventory, graph, failure handling,
 *    fingerprint, and ambiguity checks.
 * 2. Remove a unit or host, change a column symbol, and replace an address
 *    segment.
 * 3. Require inventory validation to reject each mutated report.
 */
export async function test_bigquery_certification(): Promise<void> {
  const fixture = BigQueryCertificationFixture.create();
  const inventory = await EvidDatabaseAdapterCertification.analyze(fixture);
  EvidDatabaseAdapterCertification.assertInventory(fixture, inventory);
  await EvidDatabaseAdapterCertification.assertGraph(fixture);
  await EvidDatabaseAdapterCertification.assertFailures(fixture);
  await EvidDatabaseAdapterCertification.assertFingerprint(fixture);
  await EvidDatabaseAdapterCertification.assertAmbiguity(fixture);
  for (const mutation of ["unit", "kind", "host", "address"]) {
    const broken = structuredClone(inventory);
    if (mutation === "unit") broken.units.pop();
    else if (mutation === "kind") {
      const unit = broken.units.find((entry) => entry.symbol === "column");
      if (unit !== undefined) unit.symbol = "relation";
    } else if (mutation === "host") broken.hosts.pop();
    else {
      const address = broken.addresses[0];
      if (address !== undefined) address.segments = ["wrong"];
    }
    TestValidator.error(`reject ${mutation} mutation`, () =>
      EvidDatabaseAdapterCertification.assertInventory(fixture, broken),
    );
  }
}

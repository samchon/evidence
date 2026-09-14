import { TestValidator } from "@nestia/e2e";

import { DatabaseAdapterCertification } from "../../internal/certification/DatabaseAdapterCertification";
import { BigQueryCertificationFixture } from "./BigQueryCertificationFixture";

/** Runs database certification and proves denominator, kind, host, and alias mutations fail. */
export async function test_bigquery_certification(): Promise<void> {
  const fixture = BigQueryCertificationFixture.create();
  const inventory = await DatabaseAdapterCertification.analyze(fixture);
  DatabaseAdapterCertification.assertInventory(fixture, inventory);
  await DatabaseAdapterCertification.assertGraph(fixture);
  await DatabaseAdapterCertification.assertFailures(fixture);
  await DatabaseAdapterCertification.assertFingerprint(fixture);
  await DatabaseAdapterCertification.assertAmbiguity(fixture);
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
    await TestValidator.error(`reject ${mutation} mutation`, () =>
      DatabaseAdapterCertification.assertInventory(fixture, broken),
    );
  }
}

import { TestValidator } from "@nestia/e2e";
import { EvidDatabaseAdapterCertification } from "../../internal/certification/EvidDatabaseAdapterCertification";
import { EvidSqlCertificationFixture } from "./EvidSqlCertificationFixture";

/**
 * Certifies SQL inventory against exact database adapter expectations.
 *
 * Removing a unit, kind, host, or address must fail the fixture rather than
 * weaken its declared contract.
 *
 * 1. Construct the SQL certification fixture.
 * 2. Run shared database certification and its mutation checks.
 * 3. Require every removal and behavior gate to be rejected.
 */
export async function test_sql_certification(): Promise<void> {
  const fixture = EvidSqlCertificationFixture.create();
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
      if (address !== undefined) address.segments = ["WRONG"];
    }
    TestValidator.error(`reject ${mutation} mutation`, () =>
      EvidDatabaseAdapterCertification.assertInventory(fixture, broken),
    );
  }
}

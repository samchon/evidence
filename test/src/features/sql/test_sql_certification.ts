import { TestValidator } from "@nestia/e2e";
import { EvidenceDatabaseAdapterCertification } from "../../internal/certification/EvidenceDatabaseAdapterCertification";
import { EvidenceSqlCertificationFixture } from "./EvidenceSqlCertificationFixture";

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
  const fixture = EvidenceSqlCertificationFixture.create();
  const inventory = await EvidenceDatabaseAdapterCertification.analyze(fixture);
  EvidenceDatabaseAdapterCertification.assertInventory(fixture, inventory);
  await EvidenceDatabaseAdapterCertification.assertGraph(fixture);
  await EvidenceDatabaseAdapterCertification.assertFailures(fixture);
  await EvidenceDatabaseAdapterCertification.assertFingerprint(fixture);
  await EvidenceDatabaseAdapterCertification.assertAmbiguity(fixture);
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
      EvidenceDatabaseAdapterCertification.assertInventory(fixture, broken),
    );
  }
}

import { TestValidator } from "@nestia/e2e";
import { DatabaseAdapterCertification } from "../../internal/certification/DatabaseAdapterCertification";
import { SqlCertificationFixture } from "./SqlCertificationFixture";

/** Certifies SQL inventory against exact database adapter expectations.
 *
 * Removing a unit, kind, host, or address must fail the fixture rather than weaken its declared contract.
 *
 * 1. Construct the SQL certification fixture.
 * 2. Run shared database certification and its mutation checks.
 * 3. Require every removal and behavior gate to be rejected.
 */
export async function test_sql_certification(): Promise<void> {
  const fixture = SqlCertificationFixture.create();
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
      if (address !== undefined) address.segments = ["WRONG"];
    }
    TestValidator.error(`reject ${mutation} mutation`, () =>
      DatabaseAdapterCertification.assertInventory(fixture, broken),
    );
  }
}

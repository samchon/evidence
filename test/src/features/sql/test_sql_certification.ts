import { TestValidator } from "@nestia/e2e";
import { DatabaseAdapterCertification } from "../../internal/certification/DatabaseAdapterCertification";
import { SqlCertificationFixture } from "./SqlCertificationFixture";

/** Certifies exact database inventory and ensures removed units, kinds, hosts, and addresses cannot pass. */
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
    await TestValidator.error(`reject ${mutation} mutation`, () =>
      DatabaseAdapterCertification.assertInventory(fixture, broken),
    );
  }
}

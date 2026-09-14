import { DbmlCertificationFixture } from "../../internal/DbmlCertificationFixture";
import { DatabaseAdapterCertification } from "../../internal/certification/DatabaseAdapterCertification";

/** Certifies DBML inventories, selector graphs, failures, fingerprints, and ambiguity.
 *
 * The DBML fixture independently specifies the expected database surface for the shared certification contract.
 *
 * 1. Analyze the fixture and compare its declared units, ownership, addresses, and hosts.
 * 2. Run coverage and failure checks for every DBML selector.
 * 3. Verify review fingerprints and competing target resolution behavior.
 */
export async function test_dbml_certification(): Promise<void> {
  const fixture = DbmlCertificationFixture.create();
  DatabaseAdapterCertification.assertInventory(
    fixture,
    await DatabaseAdapterCertification.analyze(fixture),
  );
  await DatabaseAdapterCertification.assertGraph(fixture);
  await DatabaseAdapterCertification.assertFailures(fixture);
  await DatabaseAdapterCertification.assertFingerprint(fixture);
  await DatabaseAdapterCertification.assertAmbiguity(fixture);
}

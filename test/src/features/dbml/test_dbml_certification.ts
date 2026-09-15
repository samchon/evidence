import { EvidDbmlCertificationFixture } from "../../internal/EvidDbmlCertificationFixture";
import { EvidDatabaseAdapterCertification } from "../../internal/certification/EvidDatabaseAdapterCertification";

/**
 * Certifies DBML inventories, selector graphs, failures, fingerprints, and
 * ambiguity.
 *
 * The DBML fixture independently specifies the expected database surface for
 * the shared certification contract.
 *
 * 1. Analyze the fixture and compare its declared units, ownership, addresses, and
 *    hosts.
 * 2. Run coverage and failure checks for every DBML selector.
 * 3. Verify review fingerprints and competing target resolution behavior.
 */
export async function test_dbml_certification(): Promise<void> {
  const fixture = EvidDbmlCertificationFixture.create();
  EvidDatabaseAdapterCertification.assertInventory(
    fixture,
    await EvidDatabaseAdapterCertification.analyze(fixture),
  );
  await EvidDatabaseAdapterCertification.assertGraph(fixture);
  await EvidDatabaseAdapterCertification.assertFailures(fixture);
  await EvidDatabaseAdapterCertification.assertFingerprint(fixture);
  await EvidDatabaseAdapterCertification.assertAmbiguity(fixture);
}

import { EvidenceDbmlCertificationFixture } from "../../internal/EvidenceDbmlCertificationFixture";
import { EvidenceDatabaseAdapterCertification } from "../../internal/certification/EvidenceDatabaseAdapterCertification";

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
  const fixture = EvidenceDbmlCertificationFixture.create();
  EvidenceDatabaseAdapterCertification.assertInventory(
    fixture,
    await EvidenceDatabaseAdapterCertification.analyze(fixture),
  );
  await EvidenceDatabaseAdapterCertification.assertGraph(fixture);
  await EvidenceDatabaseAdapterCertification.assertFailures(fixture);
  await EvidenceDatabaseAdapterCertification.assertFingerprint(fixture);
  await EvidenceDatabaseAdapterCertification.assertAmbiguity(fixture);
}

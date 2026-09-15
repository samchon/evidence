import { EvidenceAdapterCertification } from "../../internal/certification/EvidenceAdapterCertification";
import { EvidenceAdapterCertificationFixtures } from "../../internal/certification/EvidenceAdapterCertificationFixtures";

/**
 * Applies the shared adapter certification contract to PHP.
 *
 * The PHP fixture declares the expected inventory, graph, mutation, and
 * fingerprint behavior.
 *
 * 1. Construct the PHP fixture.
 * 2. Run shared adapter certification.
 * 3. Require every declared gate to pass.
 */
export async function test_php_certification(): Promise<void> {
  const fixture = EvidenceAdapterCertificationFixtures.all().find(
    (item) => item.type === "php",
  );
  if (fixture === undefined)
    throw new Error("Php certification fixture is missing.");

  EvidenceAdapterCertification.assertInventory(
    fixture,
    await EvidenceAdapterCertification.analyze(fixture),
  );
  await EvidenceAdapterCertification.assertGraph(fixture);
  await EvidenceAdapterCertification.assertFailures(fixture);
  await EvidenceAdapterCertification.assertFingerprint(fixture);
  await EvidenceAdapterCertification.assertAmbiguity(fixture);
}
